/**
 * sheets-importer.js
 * ==================
 * Import data dari Google Sheets API ke SQLite.
 * Menggunakan fetch() bawaan Next.js (tanpa package tambahan).
 * Logika parsing identik dengan excel-importer:
 * - multi-leg rows, sub-rows (extra hotel & transit flights)
 * - normalisasi typo & phantom cell
 * - sinkronisasi otomatis via Google Sheets API v4
 */

import { initDb, clearAllRecords, insertRecordsBatch, replaceRecordsAtomic, normalizePersonnelName } from "./database.js";
import { validasiLengkap } from "./ai-checker.js";

// ============================
// CONFIG HELPERS (dynamic lookup)
// ============================
function getSpreadsheetId() {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1qKpAVWslsUx8yaCdbflIm55XOe21TwOGJhrwQtawDgU";
}

function getApiKey() {
  return process.env.GOOGLE_SHEETS_API_KEY || "AIzaSyCDZ5SjF-lewQ-P1xmyWXM504w-2lw-jqw";
}

// Nama-nama sheet yang akan diambil (termasuk trailing spaces persis seperti aslinya)
const SHEET_NAMES = [
  "DOMESTIK TIM",
  "DOMESTIK KABADAN ",         // trailing space
  "DOMESTIK TIM (2)",
  "DOMESTIK KABADAN  (2)",     // trailing double space
];

// ============================
// HELPER PARSERS
// ============================
function parseNumVal(val) {
  if (val == null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  let s = String(val).trim().replace(/Rp/gi, "").replace(/\s+/g, "");
  if (["-", "", "None", "nan", "NaN", "undefined", "null"].includes(s)) return 0;

  // Handle various thousands and decimal separator patterns
  if (s.includes(".") && s.includes(",")) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      // 1.234.567,89 -> dot is thousand, comma is decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234,567.89 -> comma is thousand, dot is decimal
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length > 2) {
      // Multiple commas -> thousands separator: 52,703,800
      s = s.replace(/,/g, "");
    } else if (parts.length === 2) {
      if (parts[1].length === 3) {
        // e.g. 170,000 -> thousand separator
        s = s.replace(/,/g, "");
      } else {
        // e.g. 170,5 -> decimal
        s = s.replace(",", ".");
      }
    }
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.length > 2) {
      // Multiple dots -> thousands separator: 52.703.800
      s = s.replace(/\./g, "");
    } else if (parts.length === 2) {
      if (parts[1].length === 3) {
        // e.g. 170.000 -> thousand separator
        s = s.replace(/\./g, "");
      }
    }
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseIntVal(val) {
  if (val == null) return 0;
  if (typeof val === "number") return Math.floor(val);
  const n = parseInt(String(val).trim(), 10);
  return isNaN(n) ? 0 : n;
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateVal(val) {
  if (val == null) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // Convert 5-digit Excel serial numbers
  const numVal =
    typeof val === "number"
      ? val
      : typeof val === "string" && /^\d{5}(\.\d+)?$/.test(val.trim())
      ? parseFloat(val.trim())
      : null;
  if (numVal != null && numVal > 30000 && numVal < 60000) {
    return excelSerialToDate(numVal);
  }

  const s = String(val).replace(/-/g, " ").trim();
  const months = {
    jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", may: "05",
    jun: "06", jul: "07", agu: "08", aug: "08", sep: "09", okt: "10",
    oct: "10", nov: "11", des: "12", dec: "12",
  };
  const parts = s.split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const mon = months[parts[1].toLowerCase().substring(0, 3)];
    let year = parts[2];
    if (mon) {
      if (year.length === 2) year = "20" + year;
      return `${year}-${mon}-${day}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(String(val))) return String(val).substring(0, 10);
  return String(val).trim();
}

function str(val) {
  if (val == null) return "";
  return String(val).trim();
}

// ============================
// GOOGLE SHEETS API FETCH
// ============================

/**
 * Fetch satu sheet dari Google Sheets API v4 menggunakan UNFORMATTED_VALUE
 * agar seluruh angka (Uang Harian, Tiket, Total, SP2D) dan tanggal serial
 * dibaca secara presisi tanpa truncation atau formatting issue.
 */
async function fetchSheetData(sheetName) {
  const apiKey = getApiKey();
  const spreadsheetId = getSpreadsheetId();

  if (!apiKey) {
    throw new Error("GOOGLE_SHEETS_API_KEY belum di-set di environment variables");
  }

  const encodedSheet = encodeURIComponent(sheetName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}?key=${apiKey}&valueRenderOption=UNFORMATTED_VALUE`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new Error(`Google Sheets API quota exceeded. Coba lagi nanti. (${response.status})`);
    }
    throw new Error(`Gagal mengambil data sheet "${sheetName}": ${response.status} ${response.statusText}. ${errorBody}`);
  }

  const data = await response.json();
  return data.values || [];
}

// ============================
// MAIN IMPORT FUNCTION
// ============================

let _lastSyncTime = null;
let _lastSyncResult = null;
let _isSyncing = false;

/**
 * Import data dari Google Sheets API.
 */
export async function importFromGoogleSheets({ force = false } = {}) {
  // If synced within the last 20 seconds and not forced, return cached result to prevent rate-limits and race conditions
  if (!force && _lastSyncResult && _lastSyncTime) {
    const elapsed = Date.now() - new Date(_lastSyncTime).getTime();
    if (elapsed < 20000) {
      return _lastSyncResult;
    }
  }

  if (_isSyncing) {
    if (_lastSyncResult) return _lastSyncResult;
    throw new Error("Sinkronisasi sedang berjalan. Silakan tunggu.");
  }

  _isSyncing = true;

  try {
    const allRecords = [];
    const sheetResults = [];

    for (const sheetName of SHEET_NAMES) {
      const rows = await fetchSheetData(sheetName);

      const cleanSheetName = sheetName.trim().replace(/\s+/g, " ");
      const sheetRecs = [];
      let currNo = "";
      let currSurat = "";
      let currUraian = "";
      let currTujuan = "";
      let currNama = "";
      let currPangkat = "";
      let currJabatan = "";

      // Header spans rows 0..5; data begins at row 6
      for (let idx = 6; idx < rows.length; idx++) {
        const r = rows[idx];
        if (!r || !r.some((v) => v != null && String(v).trim() !== "")) continue;

        let nama = str(r[1]);

        // Standalone leg with blank name (e.g. Row 29 in Kabadan (2))
        const rowTotal = r.length > 36 ? parseNumVal(r[36]) : 0;
        const rowDate = r.length > 7 ? parseDateVal(r[7]) : "";
        const isStandaloneLeg = !nama && (rowTotal > 0 || (rowDate && str(r[4])));

        if (!nama && isStandaloneLeg && currNama) {
          nama = currNama;
        }

        if (nama) {
          nama = normalizePersonnelName(nama);
        }

        // Sub-row to be merged into previous record
        if (!nama) {
          if (sheetRecs.length > 0) {
            const prev = sheetRecs[sheetRecs.length - 1];

            // 1. Extra Uang Harian
            const subUh = r.length > 10 ? parseNumVal(r[10]) : 0;
            if (subUh > 0) prev.uang_harian_diterima += subUh;

            // 2. Extra Representative
            const subRep = r.length > 12 ? parseNumVal(r[12]) : 0;
            if (subRep > 0) prev.uang_representative_diterima += subRep;

            // 3. Extra Hotel
            if (r.length > 13 && r[13] != null && str(r[13]) !== "") {
              const subHotel = str(r[13]);
              const subMalam = r.length > 14 ? parseIntVal(r[14]) : 0;
              const subNilai = r.length > 15 ? parseNumVal(r[15]) : 0;
              prev.nama_hotel = prev.nama_hotel ? `${prev.nama_hotel} / ${subHotel}` : subHotel;
              prev.lama_menginap += subMalam;
              prev.nilai_hotel += subNilai;
            }

            // 4. Extra Flight / Transport Berangkat/Transit
            const subBgNilai = r.length > 21 ? parseNumVal(r[21]) : 0;
            if (subBgNilai > 0) prev.berangkat_nilai += subBgNilai;
            if (r.length > 17 && str(r[17])) {
              prev.berangkat_maskapai = prev.berangkat_maskapai ? `${prev.berangkat_maskapai} / ${str(r[17])}` : str(r[17]);
            }
            if (r.length > 18 && str(r[18])) {
              prev.berangkat_nomor_tiket = prev.berangkat_nomor_tiket ? `${prev.berangkat_nomor_tiket} / ${str(r[18])}` : str(r[18]);
            }
            if (r.length > 19 && str(r[19])) {
              prev.berangkat_kode_booking = prev.berangkat_kode_booking ? `${prev.berangkat_kode_booking} / ${str(r[19])}` : str(r[19]);
            }

            // 5. Extra Flight / Transport Pulang
            const subPlNilai = r.length > 29 ? parseNumVal(r[29]) : 0;
            if (subPlNilai > 0) prev.pulang_nilai += subPlNilai;
            if (r.length > 25 && str(r[25])) {
              prev.pulang_maskapai = prev.pulang_maskapai ? `${prev.pulang_maskapai} / ${str(r[25])}` : str(r[25]);
            }
            if (r.length > 26 && str(r[26])) {
              prev.pulang_nomor_tiket = prev.pulang_nomor_tiket ? `${prev.pulang_nomor_tiket} / ${str(r[26])}` : str(r[26]);
            }

            // 6. Taksi & DPR
            if (r.length > 23 && parseNumVal(r[23])) prev.berangkat_taksi_nilai += parseNumVal(r[23]);
            if (r.length > 31 && parseNumVal(r[31])) prev.pulang_taksi_nilai += parseNumVal(r[31]);
            if (r.length > 32 && parseNumVal(r[32])) prev.dpr_nilai_hotel += parseNumVal(r[32]);
            if (r.length > 33 && parseNumVal(r[33])) prev.dpr_nilai_transportasi += parseNumVal(r[33]);
            if (r.length > 34 && parseNumVal(r[34])) prev.dpr_nilai_taksi += parseNumVal(r[34]);

            // Recalculate totals
            prev.nilai_total_hotel = (prev.nilai_hotel || 0) + (prev.dpr_nilai_hotel || 0);
            prev.nilai_total_transportasi =
              (prev.berangkat_nilai || 0) +
              (prev.berangkat_taksi_nilai || 0) +
              (prev.pulang_nilai || 0) +
              (prev.pulang_taksi_nilai || 0) +
              (prev.dpr_nilai_transportasi || 0) +
              (prev.dpr_nilai_taksi || 0);

            const calcTotal =
              (prev.uang_harian_diterima || 0) +
              (prev.uang_representative_diterima || 0) +
              prev.nilai_total_hotel +
              prev.nilai_total_transportasi;
            if (!prev.nilai_total_biaya || prev.nilai_total_biaya === 0) {
              prev.nilai_total_biaya = calcTotal;
            }

            // Re-validate merged record
            const reVal = validasiLengkap(prev);
            prev.status_validasi_ai = reVal.status_akhir;
          }
          continue;
        }

        currNama = nama;
        const noVal = str(r[0]);
        if (noVal) currNo = noVal;
        const suratVal = r.length > 5 ? str(r[5]) : "";
        if (suratVal) currSurat = suratVal;

        // Normalisasi typo penulisan tujuan dari spreadsheet
        let tujuanVal = r.length > 4 ? str(r[4]) : "";
        if (tujuanVal === "78j") tujuanVal = "Gambir, Jakarta Pusat";
        else if (tujuanVal === "Jakarta Pusaat") tujuanVal = "Jakarta Pusat";
        else if (tujuanVal === "Kunignan, Jakarta Selatan") tujuanVal = "Kuningan, Jakarta Selatan";
        else if (tujuanVal === "Medan, Sumatera Utama") tujuanVal = "Medan, Sumatera Utara";
        if (tujuanVal) currTujuan = tujuanVal;

        const uraianVal = r.length > 6 ? str(r[6]) : "";
        if (uraianVal) currUraian = uraianVal;

        const pangkatVal = r.length > 2 ? str(r[2]) : "";
        if (pangkatVal) currPangkat = pangkatVal;
        const jabatanVal = r.length > 3 ? str(r[3]) : "";
        if (jabatanVal) currJabatan = jabatanVal;

        const nHotel = r.length > 15 ? parseNumVal(r[15]) : 0;
        const dprHotel = r.length > 32 ? parseNumVal(r[32]) : 0;
        const totHotel = nHotel + dprHotel;

        const bgNilai = r.length > 21 ? parseNumVal(r[21]) : 0;
        let bgTaksi = r.length > 23 ? parseNumVal(r[23]) : 0;
        let bgTaksiPenyedia = r.length > 22 ? str(r[22]) : "";

        const plNilai = r.length > 29 ? parseNumVal(r[29]) : 0;
        let plTaksi = r.length > 31 ? parseNumVal(r[31]) : 0;
        let plTaksiPenyedia = r.length > 30 ? str(r[30]) : "";

        let dprTrans = r.length > 33 ? parseNumVal(r[33]) : 0;
        let dprTaksi = r.length > 34 ? parseNumVal(r[34]) : 0;
        // Duplikasi taksi di DPR pada sheet Kabadan
        if (dprTrans > 0 && dprTaksi === dprTrans && cleanSheetName.includes("KABADAN")) {
          dprTaksi = 0;
        }

        let uhDiterima = r.length > 10 ? parseNumVal(r[10]) : 0;
        let repDiterima = r.length > 12 ? parseNumVal(r[12]) : 0;

        // Accidental representative untuk non-kabadan / non-eselon I
        if (
          repDiterima > 0 &&
          !cleanSheetName.includes("KABADAN") &&
          !pangkatVal.includes("IV/e") &&
          !jabatanVal.includes("Kepala Badan")
        ) {
          repDiterima = 0;
        }

        let totalBiaya = r.length > 36 ? parseNumVal(r[36]) : 0;

        // Filter phantom copy-paste di kolom taksi yang menyalin nilai tiket
        if (bgTaksi > 0 && totalBiaya > 0) {
          const sumWithoutBgTaksi = uhDiterima + repDiterima + totHotel + bgNilai + plNilai + plTaksi + dprTrans + dprTaksi;
          if (Math.abs(sumWithoutBgTaksi - totalBiaya) < 10) {
            bgTaksi = 0;
            bgTaksiPenyedia = "";
          }
        }
        if (plTaksi > 0 && totalBiaya > 0) {
          const sumWithoutPlTaksi = uhDiterima + repDiterima + totHotel + bgNilai + bgTaksi + plNilai + dprTrans + dprTaksi;
          if (Math.abs(sumWithoutPlTaksi - totalBiaya) < 10) {
            plTaksi = 0;
            plTaksiPenyedia = "";
          }
        }

        // Kasus di mana hanya transport lokal yang dibayarkan
        if (totalBiaya > 0 && dprTrans > 0 && uhDiterima > 0 && Math.abs(dprTrans - totalBiaya) < 10) {
          uhDiterima = 0;
        }

        // Kasus di mana hanya total biaya yang diinput (perjadin dalam kota tanpa rincian kolom)
        let totTrans = bgNilai + bgTaksi + plNilai + plTaksi + dprTrans + dprTaksi;
        if (totalBiaya > 0 && uhDiterima === 0 && repDiterima === 0 && totHotel === 0 && totTrans === 0) {
          dprTrans = totalBiaya;
          totTrans = totalBiaya;
        }

        if (totalBiaya === 0) {
          totalBiaya = uhDiterima + repDiterima + totHotel + totTrans;
        }

        let tglMulai = r.length > 7 ? parseDateVal(r[7]) : "";
        let tglSelesai = r.length > 8 ? parseDateVal(r[8]) : "";
        // Koreksi tanggal terbalik pada sheet Kabadan row 9
        if (tglMulai && tglSelesai && tglMulai > tglSelesai && tglMulai === "2026-06-04" && tglSelesai === "2026-06-03") {
          tglMulai = "2026-06-03";
          tglSelesai = "2026-06-04";
        }

        const rec = {
          kategori: cleanSheetName,
          no_urut: noVal || currNo,
          nama_pelaksana: nama,
          pangkat_golongan: pangkatVal || currPangkat,
          jabatan: jabatanVal || currJabatan,
          tujuan: tujuanVal || currTujuan,
          no_surat_tugas_spd: suratVal || currSurat,
          uraian_penugasan: uraianVal || currUraian,
          tgl_mulai: tglMulai,
          tgl_selesai: tglSelesai,
          tarif_uang_harian: r.length > 9 ? parseNumVal(r[9]) : 0,
          uang_harian_diterima: uhDiterima,
          uang_representative_tarif: r.length > 11 ? parseNumVal(r[11]) : 0,
          uang_representative_diterima: repDiterima,
          nama_hotel: r.length > 13 ? str(r[13]) : "",
          lama_menginap: r.length > 14 ? parseIntVal(r[14]) : 0,
          nilai_hotel: nHotel,
          berangkat_penyedia_jasa: r.length > 16 ? str(r[16]) : "",
          berangkat_maskapai: r.length > 17 ? str(r[17]) : "",
          berangkat_nomor_tiket: r.length > 18 ? str(r[18]) : "",
          berangkat_kode_booking: r.length > 19 ? str(r[19]) : "",
          berangkat_tanggal: r.length > 20 ? parseDateVal(r[20]) : "",
          berangkat_nilai: bgNilai,
          berangkat_taksi_penyedia: bgTaksiPenyedia,
          berangkat_taksi_nilai: bgTaksi,
          pulang_penyedia_jasa: r.length > 24 ? str(r[24]) : "",
          pulang_maskapai: r.length > 25 ? str(r[25]) : "",
          pulang_nomor_tiket: r.length > 26 ? str(r[26]) : "",
          pulang_kode_booking: r.length > 27 ? str(r[27]) : "",
          pulang_tanggal: r.length > 28 ? parseDateVal(r[28]) : "",
          pulang_nilai: plNilai,
          pulang_taksi_penyedia: plTaksiPenyedia,
          pulang_taksi_nilai: plTaksi,
          dpr_nilai_hotel: dprHotel,
          dpr_nilai_transportasi: dprTrans,
          dpr_nilai_taksi: dprTaksi,
          dpr_keterangan: r.length > 35 ? str(r[35]) : "",
          nilai_total_hotel: totHotel,
          nilai_total_transportasi: totTrans,
          nilai_total_biaya: totalBiaya,
          sp2d_nomor: r.length > 37 ? str(r[37]) : "",
          sp2d_tanggal: r.length > 38 ? parseDateVal(r[38]) : "",
          sp2d_nominal: r.length > 39 ? parseNumVal(r[39]) : 0,
          sp2d_pengembalian: r.length > 40 ? parseNumVal(r[40]) : 0,
          no_spm: r.length > 41 ? str(r[41]) : "",
          link_dokumen_spj: r.length > 42 ? str(r[42]) : "",
          kode_akun: r.length > 43 ? str(r[43]) : "",
        };

        // AI Validation
        const valRes = validasiLengkap(rec);
        rec.status_validasi_ai = valRes.status_akhir;

        sheetRecs.push(rec);
      }

      sheetResults.push({ name: cleanSheetName, count: sheetRecs.length });
      allRecords.push(...sheetRecs);
    }

    // Atomic replacement inside a single SQLite transaction
    replaceRecordsAtomic(allRecords);

    // Update sync timestamp
    _lastSyncTime = new Date().toISOString();
    _lastSyncResult = {
      totalImported: allRecords.length,
      sheets: sheetResults.map((s) => s.name),
      sheetDetails: sheetResults,
      source: "google_sheets",
      syncTime: _lastSyncTime,
    };

    return _lastSyncResult;
  } finally {
    _isSyncing = false;
  }
}

// ============================
// SYNC INFO
// ============================

/**
 * Mendapatkan informasi sinkronisasi terakhir dari Google Sheets.
 */
export function getSheetsSyncInfo() {
  return {
    source: "google_sheets",
    spreadsheetId: getSpreadsheetId(),
    apiKeyConfigured: !!getApiKey(),
    lastSyncTime: _lastSyncTime,
    lastSyncResult: _lastSyncResult,
    isSyncing: _isSyncing,
    sheets: SHEET_NAMES.map((n) => n.trim().replace(/\s+/g, " ")),
  };
}
