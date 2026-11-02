/**
 * ai-checker.js
 * =============
 * AI Checker Module — ported from ai_checker.py
 * Validates perjadin records: typo detection, numeric checks, date logic, cross-total verification.
 */

// ============================
// MASTER DATA
// ============================
export const MASTER_TUJUAN = [
  "Bali", "Bandung, Jawa Barat", "Bekasi, Jawa Barat", "Bogor", "Bogor, Jawa Barat",
  "Gorontalo", "Jakarta", "Jakarta Selatan", "Jakarta Utara", "Jawa Tengah", "Jawa Timur", "Jawa TImur",
  "Kab. Bekasi, Jawa Barat", "Kabupaten Tangerang, Banten", "Kalimantan Utara", "Kalimantan Barat",
  "Kendari, Sulawesi Tenggara", "Kendari Sulawesi Tenggara", "Lampung", "Bandar Lampung",
  "Palu Sulawesi Tengah", "Palu, Sulawesi Tengah",
  "Pelabuhan Tanjung Mas, Jawa Tengah", "Sidoarjo, Jawa Timur", "Sulawesi Selatan",
  "Tangerang, Banten", "Tanjung Priok, Jakarta Utara", "Yogyakarta", "DI Yogyakarta", "D.I. Yogyakarta",
  "Surabaya", "Semarang", "Semarang, Jawa Tengah", "Solo", "Malang", "Malang, Jawa Timur",
  "Cirebon", "Serang", "Karawang", "Depok", "Batam", "Batam, Kep. Riau", "Batam, Kepulauan Riau",
  "Prov. Kepulauan Riau", "Medan", "Medan, Sumatera Utara", "Sumatera Utara",
  "Kab. Tapanuli Utara, Sumatera Utara", "Palembang", "Palembang, Sumatera Selatan",
  "Palembang & Lampung", "Padang", "Pekanbaru", "Banda Aceh", "Jambi", "Bengkulu",
  "Pangkal Pinang", "Tanjung Pinang", "Pontianak", "Pontianak, Kalimantan Barat",
  "Banjarmasin", "Balikpapan", "Samarinda", "Palangkaraya", "Palangkaraya, Kalimantan Tengah",
  "Tarakan", "Tarakan, Kalimantan Utara", "Nusantara", "Makassar", "Makassar, Sulawesi Selatan",
  "Manado", "Mamuju", "Denpasar", "Mataram", "Kupang", "Lombok", "NTT dan Bali",
  "Ambon", "Ternate", "Jayapura", "Sorong", "Manokwari", "Merauke",
  "Jakarta Pusat", "Jakarta Timur", "Gambir, Jakarta Pusat", "Kuningan, Jakarta Selatan",
  "Kota Bogor, Jawa Barat", "Kab. Bogor, Jawa Barat", "Kabupaten Bogor, Jawa Barat",
  "Kota Tangerang, Banten", "Kab. Tangerang, Banten", "Serpong, Kab. Tangerang",
  "Kota Surakarta, Jawa Tengah", "Jawa Tengah dan DI Yogyakarta",
  "D.I. Yogyakarta & Jawa Timur", "D.I. Yogyakarta dan Jawa Timur",
  "Makassar, Sulawesi Selatan & Palu, Sulawesi Tengah", "Makassar, Sulsel & Palu, Sulteng"
];

export const MASTER_MASKAPAI = [
  "Garuda Indonesia", "Lion Air", "Batik Air", "Batik air", "Citilink", "Sriwijaya Air",
  "NAM Air", "Wings Air", "Wing Air", "AirAsia", "TransNusa", "Transnusa", "TransNusa Air",
  "Pelita Air", "Super Air Jet", "Super Air Jet & Wing Air", "Super Air Jet - Wing Air",
  "Lion Air & Batik Air", "Indonesia AirAsia",
  "Whoosh", "PT Kereta Cepat Indonesia China", "KAI", "Kereta Api Indonesia",
  "Damri", "Perum DAMRI", "Blue Bird", "Grab", "Gojek",
  "Ferizy", "Sinar Jaya Bus"
];

export const MASTER_PANGKAT = [
  "I/a", "I/b", "I/c", "I/d",
  "II/a", "II/b", "II/c", "II/d",
  "III/a", "III/b", "III/c", "III/d",
  "IV/a", "IV/b", "IV/c", "IV/d", "IV/e",
  "IX", "X", "XI", "XII",
  "Penata Muda", "Penata Muda Tk. I", "Penata", "Penata Tk. I",
  "Pembina", "Pembina Tk. I", "Pembina Utama Muda", "Pembina Utama Madya", "Pembina Utama",
  "Tenaga Alih Daya", "PPNPN",
];

export const MASTER_KODE_AKUN = [
  "6999.EBA.994.002.AA.524111",
  "7003.QIA.601.631.BA.524111",
  "7003.QIA.601.631.BA.524112",
];

// Simple Levenshtein distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function similarityScore(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  return ((1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / maxLen) * 100);
}

function cekTypoSingle(clean, daftarBaku, threshold = 75) {
  if (!clean) return { status: "skip", message: "Data kosong", suggestion: null };

  // Exact case-insensitive match
  for (const item of daftarBaku) {
    if (clean.toLowerCase() === item.toLowerCase()) return { status: "ok", message: "Sesuai", suggestion: null };
  }

  // Substring match
  for (const item of daftarBaku) {
    if (clean.toLowerCase().includes(item.toLowerCase()) || item.toLowerCase().includes(clean.toLowerCase())) {
      if (Math.abs(clean.length - item.length) <= 6) return { status: "ok", message: "Sesuai", suggestion: null };
    }
  }

  // Fuzzy match
  let bestMatch = null, bestScore = 0;
  for (const item of daftarBaku) {
    const score = similarityScore(clean, item);
    if (score > bestScore) { bestScore = score; bestMatch = item; }
  }
  if (bestScore >= 90) return { status: "ok", message: "Sesuai", suggestion: null };
  if (bestScore >= threshold) return { status: "warning", message: `Kemungkinan typo (${bestScore.toFixed(0)}% mirip)`, suggestion: bestMatch };
  return { status: "warning", message: "Tidak ada di referensi standar", suggestion: null };
}

// ============================
// CHECK FUNCTIONS
// ============================
export function cekTypo(teks, daftarBaku, threshold = 75) {
  if (!teks || String(teks).trim() === "") return { status: "skip", message: "Data kosong", suggestion: null };
  const clean = String(teks).trim();

  // If text contains slashes or ampersand (e.g. combined transit "Super Air Jet / Wing Air")
  if (clean.includes("/") || clean.includes("&")) {
    const parts = clean.split(/\s*[/&]\s*/).filter((p) => p.length > 0);
    let allOk = true;
    for (const part of parts) {
      const res = cekTypoSingle(part, daftarBaku, threshold);
      if (res.status !== "ok") {
        allOk = false;
        break;
      }
    }
    if (allOk) return { status: "ok", message: "Sesuai", suggestion: null };
  }

  return cekTypoSingle(clean, daftarBaku, threshold);
}

export function cekAngka(nilai, namaField, allowZero = true) {
  if (nilai == null || String(nilai).trim() === "") return { status: "skip", message: `${namaField}: Data kosong` };
  const val = Number(nilai);
  if (isNaN(val)) return { status: "error", message: `${namaField}: Bukan format angka valid` };
  if (val < 0) return { status: "error", message: `${namaField}: Bernilai negatif (Rp ${val.toLocaleString("id-ID")})` };
  if (!allowZero && val === 0) return { status: "warning", message: `${namaField}: Bernilai nol` };
  const sensitiveFields = ["Tarif Uang Harian", "Uang Harian Diterima", "Nilai Hotel", "Nilai Tiket Berangkat", "Nilai Tiket Pulang", "Total Biaya", "SP2D Nominal"];
  if (val > 0 && val < 5000 && sensitiveFields.includes(namaField))
    return { status: "warning", message: `${namaField}: Nominal sangat kecil (Rp ${val.toLocaleString("id-ID")}) — mohon verifikasi` };
  return { status: "ok", message: `${namaField}: Sesuai` };
}

export function cekTanggalLogis(tglMulai, tglSelesai) {
  if (!tglMulai || !tglSelesai) return { status: "skip", message: "Tanggal belum diisi" };
  try {
    const mulai = new Date(tglMulai), selesai = new Date(tglSelesai);
    if (isNaN(mulai) || isNaN(selesai)) return { status: "ok", message: `Tanggal tercatat: ${tglMulai} s/d ${tglSelesai}` };
    if (mulai > selesai) return { status: "error", message: `Tgl Mulai (${tglMulai}) lebih lambat dari Tgl Selesai (${tglSelesai})` };
    const delta = Math.round((selesai - mulai) / 86400000);
    if (delta > 30) return { status: "warning", message: `Durasi penugasan sangat lama (${delta} hari) — mohon konfirmasi` };
    return { status: "ok", message: `Tanggal valid (${delta} hari)` };
  } catch {
    return { status: "ok", message: `Tanggal tercatat: ${tglMulai} s/d ${tglSelesai}` };
  }
}

export function cekCrossTotal({ uangHarian = 0, uangRepresentative = 0, nilaiHotel = 0, berangkatNilai = 0, berangkatTaksi = 0, pulangNilai = 0, pulangTaksi = 0, dprHotel = 0, dprTransport = 0, dprTaksi = 0, totalBiaya = 0 }) {
  const tb = Number(totalBiaya) || 0;
  const komponen = [uangHarian, uangRepresentative, nilaiHotel, berangkatNilai, berangkatTaksi, pulangNilai, pulangTaksi, dprHotel, dprTransport, dprTaksi].reduce((a, b) => a + (Number(b) || 0), 0);
  if (tb === 0 && komponen === 0) return { status: "skip", message: "Biaya belum diisi" };
  const selisih = Math.abs(tb - komponen);
  if (selisih === 0) return { status: "ok", message: "Total biaya sesuai dengan seluruh rincian komponen" };
  if (selisih <= 1000) return { status: "ok", message: `Sesuai (toleransi pembulatan Rp ${selisih.toLocaleString("id-ID")})` };
  const batas = tb > 0 ? tb * 0.02 : 5000;
  if (selisih <= batas) return { status: "warning", message: `Selisih kecil (Rp ${selisih.toLocaleString("id-ID")}) antara total biaya (Rp ${tb.toLocaleString("id-ID")}) dan komponen (Rp ${komponen.toLocaleString("id-ID")})` };
  return { status: "error", message: `Total biaya (Rp ${tb.toLocaleString("id-ID")}) ≠ Rincian komponen (Rp ${komponen.toLocaleString("id-ID")}). Selisih: Rp ${selisih.toLocaleString("id-ID")}` };
}

// ============================
// FULL VALIDATION
// ============================
export function validasiLengkap(data) {
  const results = [];

  // 1. Typo tujuan
  const cekTuj = cekTypo(data.tujuan, MASTER_TUJUAN);
  if (cekTuj.status !== "skip") {
    let msg = cekTuj.message;
    if (cekTuj.suggestion) msg += ` → Saran: ${cekTuj.suggestion}`;
    results.push({ field: "Tujuan", status: cekTuj.status, message: msg });
  }

  // 2. Maskapai
  for (const [key, label] of [["berangkat_maskapai", "Maskapai Berangkat"], ["pulang_maskapai", "Maskapai Pulang"]]) {
    const val = data[key];
    if (val) {
      const cekM = cekTypo(val, MASTER_MASKAPAI, 70);
      if (cekM.status !== "skip") {
        let msg = cekM.message;
        if (cekM.suggestion) msg += ` → Saran: ${cekM.suggestion}`;
        results.push({ field: label, status: cekM.status, message: msg });
      }
    }
  }

  // 3. Tanggal
  const cekTgl = cekTanggalLogis(data.tgl_mulai, data.tgl_selesai);
  if (!["ok", "skip"].includes(cekTgl.status)) results.push({ field: "Tanggal", status: cekTgl.status, message: cekTgl.message });

  // 4. Angka
  const numericChecks = [
    ["Uang Harian", data.uang_harian_diterima], ["Nilai Hotel", data.nilai_hotel],
    ["Tiket Berangkat", data.berangkat_nilai], ["Tiket Pulang", data.pulang_nilai],
    ["DPR Transportasi", data.dpr_nilai_transportasi], ["Total Biaya", data.nilai_total_biaya],
    ["SP2D Nominal", data.sp2d_nominal],
  ];
  for (const [label, val] of numericChecks) {
    const cekNum = cekAngka(val, label);
    if (!["ok", "skip"].includes(cekNum.status)) results.push({ field: label, status: cekNum.status, message: cekNum.message });
  }

  // 5. Cross-check total
  const cekTot = cekCrossTotal({
    uangHarian: data.uang_harian_diterima, uangRepresentative: data.uang_representative_diterima,
    nilaiHotel: data.nilai_hotel, berangkatNilai: data.berangkat_nilai, berangkatTaksi: data.berangkat_taksi_nilai,
    pulangNilai: data.pulang_nilai, pulangTaksi: data.pulang_taksi_nilai,
    dprHotel: data.dpr_nilai_hotel, dprTransport: data.dpr_nilai_transportasi, dprTaksi: data.dpr_nilai_taksi,
    totalBiaya: data.nilai_total_biaya,
  });
  if (!["ok", "skip"].includes(cekTot.status)) results.push({ field: "Cross-Check Total", status: cekTot.status, message: cekTot.message });

  const totalError = results.filter((r) => r.status === "error").length;
  const totalWarning = results.filter((r) => r.status === "warning").length;

  let statusAkhir;
  if (totalError > 0) statusAkhir = `❌ ${totalError} Error, ${totalWarning} Warning`;
  else if (totalWarning > 0) statusAkhir = `⚠️ ${totalWarning} Perlu Diperiksa`;
  else statusAkhir = "✅ Sesuai & Valid";

  return { status_akhir: statusAkhir, total_error: totalError, total_warning: totalWarning, details: results };
}
