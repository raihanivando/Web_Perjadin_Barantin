/**
 * ai-checker.js
 * =============
 * AI Checker Module — ported from ai_checker.py
 * Validates perjadin records: typo detection, numeric checks, date logic, cross-total verification.
 *
 * IMPROVED: Setiap hasil validasi sekarang menyertakan:
 *  - field: nama field yang dicek
 *  - fieldKey: key properti record (untuk edit langsung)
 *  - status: "ok" | "warning" | "error"
 *  - message: penjelasan singkat masalah
 *  - explanation: penjelasan detail apa yang salah & harus dilakukan
 *  - suggestion: saran nilai yang benar (jika ada)
 *  - currentValue: nilai saat ini di record
 *  - expectedValue: nilai yang diharapkan (jika bisa dihitung)
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
  if (tb === 0 && komponen === 0) return { status: "skip", message: "Biaya belum diisi", expectedValue: null };
  const selisih = Math.abs(tb - komponen);
  if (selisih === 0) return { status: "ok", message: "Total biaya sesuai dengan seluruh rincian komponen", expectedValue: null };
  if (selisih <= 1000) return { status: "ok", message: `Sesuai (toleransi pembulatan Rp ${selisih.toLocaleString("id-ID")})`, expectedValue: null };
  const batas = tb > 0 ? tb * 0.02 : 5000;
  if (selisih <= batas) return { status: "warning", message: `Selisih kecil antara total dan komponen`, expectedValue: komponen, totalBiaya: tb, selisih };
  return { status: "error", message: `Total biaya tidak cocok dengan penjumlahan rincian komponen`, expectedValue: komponen, totalBiaya: tb, selisih };
}

// ============================
// FULL VALIDATION (IMPROVED)
// ============================
export function validasiLengkap(data) {
  const results = [];

  // 1. Typo tujuan
  const cekTuj = cekTypo(data.tujuan, MASTER_TUJUAN);
  if (cekTuj.status !== "skip") {
    results.push({
      field: "Tujuan",
      fieldKey: "tujuan",
      status: cekTuj.status,
      message: cekTuj.status === "ok" ? "Sesuai dengan daftar tujuan resmi" : (cekTuj.suggestion ? `Kemungkinan typo. Mungkin seharusnya "${cekTuj.suggestion}"` : "Nama tujuan tidak ditemukan di daftar referensi standar"),
      explanation: cekTuj.status === "ok"
        ? "Nama tujuan sudah cocok dengan daftar kota/daerah tujuan perjalanan dinas resmi."
        : cekTuj.suggestion
          ? `Nama tujuan "${data.tujuan}" terlihat mirip dengan "${cekTuj.suggestion}" di daftar resmi. Silakan periksa apakah ada kesalahan penulisan (typo), kemudian klik kolom Tujuan di bawah untuk memperbaikinya.`
          : `Nama tujuan "${data.tujuan}" tidak ditemukan di daftar tujuan perjalanan dinas standar. Jika ini memang tujuan baru, bisa diabaikan. Jika salah ketik, silakan edit di kolom Tujuan di bawah.`,
      suggestion: cekTuj.suggestion || null,
      currentValue: data.tujuan || "",
    });
  }

  // 2. Maskapai
  for (const [key, label] of [["berangkat_maskapai", "Maskapai Berangkat"], ["pulang_maskapai", "Maskapai Pulang"]]) {
    const val = data[key];
    if (val && val.trim() && val.trim() !== "-") {
      const cekM = cekTypo(val, MASTER_MASKAPAI, 70);
      if (cekM.status !== "skip") {
        results.push({
          field: label,
          fieldKey: key,
          status: cekM.status,
          message: cekM.status === "ok" ? "Sesuai dengan daftar maskapai resmi" : (cekM.suggestion ? `Nama maskapai mirip "${cekM.suggestion}"` : "Nama maskapai tidak ditemukan di daftar referensi"),
          explanation: cekM.status === "ok"
            ? `Nama maskapai "${val}" sudah terdaftar dan valid.`
            : cekM.suggestion
              ? `Nama maskapai "${val}" terdeteksi kemungkinan salah ketik. Mungkin yang dimaksud adalah "${cekM.suggestion}". Periksa dan perbaiki jika perlu di kolom ${label} di bawah.`
              : `Nama maskapai "${val}" tidak ditemukan di daftar maskapai penerbangan/transportasi resmi. Periksa apakah nama ini benar atau ada kesalahan penulisan.`,
          suggestion: cekM.suggestion || null,
          currentValue: val,
        });
      }
    }
  }

  // 3. Tanggal
  const cekTgl = cekTanggalLogis(data.tgl_mulai, data.tgl_selesai);
  if (cekTgl.status === "error") {
    results.push({
      field: "Tanggal Penugasan",
      fieldKey: "tgl_mulai",
      status: "error",
      message: "Tanggal mulai lebih lambat dari tanggal selesai",
      explanation: `Tanggal mulai perjalanan dinas (${data.tgl_mulai}) tercatat lebih besar/lambat dari tanggal selesai (${data.tgl_selesai}). Kemungkinan urutan tanggal terbalik. Silakan periksa dan koreksi tanggal mulai atau tanggal selesai di kolom yang tersedia di bawah.`,
      currentValue: `${data.tgl_mulai} s/d ${data.tgl_selesai}`,
    });
  } else if (cekTgl.status === "warning") {
    const delta = Math.round((new Date(data.tgl_selesai) - new Date(data.tgl_mulai)) / 86400000);
    results.push({
      field: "Tanggal Penugasan",
      fieldKey: "tgl_mulai",
      status: "warning",
      message: `Durasi penugasan sangat panjang (${delta} hari)`,
      explanation: `Durasi perjalanan dinas tercatat selama ${delta} hari (${data.tgl_mulai} s/d ${data.tgl_selesai}). Durasi ini tergolong sangat panjang untuk satu perjalanan dinas. Periksa apakah tanggal mulai dan selesai sudah benar, atau apakah ini memang penugasan jangka panjang.`,
      currentValue: `${data.tgl_mulai} s/d ${data.tgl_selesai}`,
    });
  }

  // 4. Angka — hanya yang bermasalah
  const numericChecks = [
    ["Uang Harian", "uang_harian_diterima", data.uang_harian_diterima],
    ["Nilai Hotel", "nilai_hotel", data.nilai_hotel],
    ["Tiket Berangkat", "berangkat_nilai", data.berangkat_nilai],
    ["Tiket Pulang", "pulang_nilai", data.pulang_nilai],
    ["DPR Transportasi", "dpr_nilai_transportasi", data.dpr_nilai_transportasi],
    ["Total Biaya", "nilai_total_biaya", data.nilai_total_biaya],
    ["SP2D Nominal", "sp2d_nominal", data.sp2d_nominal],
  ];
  for (const [label, key, val] of numericChecks) {
    const cekNum = cekAngka(val, label);
    if (cekNum.status === "error") {
      results.push({
        field: label,
        fieldKey: key,
        status: "error",
        message: cekNum.message,
        explanation: Number(val) < 0
          ? `Nilai ${label} tercatat negatif (Rp ${Number(val).toLocaleString("id-ID")}). Nominal perjalanan dinas tidak boleh bernilai negatif. Periksa apakah ada kesalahan input, lalu perbaiki di kolom ${label} di bawah.`
          : `Nilai ${label} bukan format angka yang valid. Pastikan hanya berisi angka (tanpa huruf, titik, atau karakter lain selain koma desimal), lalu perbaiki di kolom ${label} di bawah.`,
        currentValue: val,
      });
    } else if (cekNum.status === "warning") {
      results.push({
        field: label,
        fieldKey: key,
        status: "warning",
        message: cekNum.message,
        explanation: `Nilai ${label} tercatat sangat kecil (Rp ${Number(val).toLocaleString("id-ID")}). Untuk perjalanan dinas, biasanya nominal ini lebih besar. Silakan periksa apakah ada kesalahan input (misalnya lupa menambahkan nol), atau memang sudah benar sesuai SPJ.`,
        currentValue: val,
      });
    }
  }

  // 5. Cross-check total
  const cekTot = cekCrossTotal({
    uangHarian: data.uang_harian_diterima, uangRepresentative: data.uang_representative_diterima,
    nilaiHotel: data.nilai_hotel, berangkatNilai: data.berangkat_nilai, berangkatTaksi: data.berangkat_taksi_nilai,
    pulangNilai: data.pulang_nilai, pulangTaksi: data.pulang_taksi_nilai,
    dprHotel: data.dpr_nilai_hotel, dprTransport: data.dpr_nilai_transportasi, dprTaksi: data.dpr_nilai_taksi,
    totalBiaya: data.nilai_total_biaya,
  });
  if (cekTot.status === "error" || cekTot.status === "warning") {
    const tb = Number(data.nilai_total_biaya) || 0;
    const komponen = cekTot.expectedValue || 0;
    const selisih = cekTot.selisih || Math.abs(tb - komponen);

    // Build rincian breakdown
    const rincianParts = [];
    if (Number(data.uang_harian_diterima)) rincianParts.push(`Uang Harian Rp ${Number(data.uang_harian_diterima).toLocaleString("id-ID")}`);
    if (Number(data.uang_representative_diterima)) rincianParts.push(`Representative Rp ${Number(data.uang_representative_diterima).toLocaleString("id-ID")}`);
    if (Number(data.nilai_hotel)) rincianParts.push(`Hotel Rp ${Number(data.nilai_hotel).toLocaleString("id-ID")}`);
    if (Number(data.berangkat_nilai)) rincianParts.push(`Tiket Berangkat Rp ${Number(data.berangkat_nilai).toLocaleString("id-ID")}`);
    if (Number(data.berangkat_taksi_nilai)) rincianParts.push(`Taksi Berangkat Rp ${Number(data.berangkat_taksi_nilai).toLocaleString("id-ID")}`);
    if (Number(data.pulang_nilai)) rincianParts.push(`Tiket Pulang Rp ${Number(data.pulang_nilai).toLocaleString("id-ID")}`);
    if (Number(data.pulang_taksi_nilai)) rincianParts.push(`Taksi Pulang Rp ${Number(data.pulang_taksi_nilai).toLocaleString("id-ID")}`);
    if (Number(data.dpr_nilai_hotel)) rincianParts.push(`DPR Hotel Rp ${Number(data.dpr_nilai_hotel).toLocaleString("id-ID")}`);
    if (Number(data.dpr_nilai_transportasi)) rincianParts.push(`DPR Transport Rp ${Number(data.dpr_nilai_transportasi).toLocaleString("id-ID")}`);
    if (Number(data.dpr_nilai_taksi)) rincianParts.push(`DPR Taksi Rp ${Number(data.dpr_nilai_taksi).toLocaleString("id-ID")}`);

    results.push({
      field: "Cross-Check Total Biaya",
      fieldKey: "nilai_total_biaya",
      status: cekTot.status,
      message: `Total biaya (Rp ${tb.toLocaleString("id-ID")}) ${tb > komponen ? "lebih besar" : "lebih kecil"} dari penjumlahan rincian komponen (Rp ${komponen.toLocaleString("id-ID")}). Selisih: Rp ${selisih.toLocaleString("id-ID")}`,
      explanation: `Hasil penjumlahan seluruh komponen biaya:\n${rincianParts.map(r => `  • ${r}`).join("\n")}\n\n= Total komponen: Rp ${komponen.toLocaleString("id-ID")}\n\nSedangkan Total Biaya tercatat: Rp ${tb.toLocaleString("id-ID")}\nSelisih: Rp ${selisih.toLocaleString("id-ID")} (${tb > komponen ? "total biaya lebih besar" : "total biaya lebih kecil"}).\n\nYang perlu dilakukan:\n1. Periksa apakah ada komponen biaya yang belum diinput atau salah input (misalnya uang harian, hotel, tiket).\n2. Jika memang total biaya yang benar, Anda bisa mengubah nilai Total Biaya menjadi Rp ${komponen.toLocaleString("id-ID")} (sesuai penjumlahan komponen).\n3. Atau koreksi komponen biaya individual yang salah.`,
      currentValue: tb,
      expectedValue: komponen,
      suggestion: komponen,
    });
  }

  const totalError = results.filter((r) => r.status === "error").length;
  const totalWarning = results.filter((r) => r.status === "warning").length;

  let statusAkhir;
  if (totalError > 0) statusAkhir = `❌ ${totalError} Error, ${totalWarning} Warning`;
  else if (totalWarning > 0) statusAkhir = `⚠️ ${totalWarning} Perlu Diperiksa`;
  else statusAkhir = "✅ Sesuai & Valid";

  return { status_akhir: statusAkhir, total_error: totalError, total_warning: totalWarning, details: results };
}
