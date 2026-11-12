/**
 * database.js
 * ===========
 * Modul database in-memory performa tinggi untuk Rekap Perjalanan Dinas.
 * Kompatibel 100% dengan Node.js, Vercel Serverless, Cloudflare Workers (workerd), dan Edge Runtime.
 * Bebas dari C++ native addons (node-gyp / better-sqlite3) sehingga mencegah build & runtime error
 * di seluruh cloud platform (Vercel, Cloudflare, Netlify).
 * Auto-seeded dari records-seed.js (477 data terverifikasi) dan disinkronkan real-time via Google Sheets API.
 */

import seedRecords from "./records-seed.js";

// ==========================================
// CANONICAL NAME NORMALIZER
// ==========================================
export function normalizePersonnelName(name) {
  if (!name) return "";
  const n = String(name).trim();
  const lower = n.toLowerCase().replace(/\s+/g, " ");

  // 1. drh. Reza Mahlefi
  if (lower === "reza mahlefi" || lower === "drh. reza mahlefi") {
    return "drh. Reza Mahlefi";
  }

  // 2. Miftachurohman, S.P.
  if (lower === "miftachurohman, s.p." || lower === "miftachurohman, s. p") {
    return "Miftachurohman, S.P.";
  }

  // 3. drh. Amrie Muhammad, M.Si
  if (lower === "drh. amrie muhammad, m.si" || lower === "drh. amrie muhammad, m. si") {
    return "drh. Amrie Muhammad, M.Si";
  }

  // 4. Anita Elizabeth Tholoan Sianipar, S.E., M.A.P
  if (lower === "anita elizabeth tholoan sianipar, s.e." || lower === "anita elizabeth tholoan sianipar, s.e., m.a.p") {
    return "Anita Elizabeth Tholoan Sianipar, S.E., M.A.P";
  }

  // 5. Harismon J.N. Hutauruk
  if (lower === "harismon j.n. hutauruk" || lower === "harismon j.m. hutauruk") {
    return "Harismon J.N. Hutauruk";
  }

  // 6. Siti Nabila Abdurachman, B.A.
  if (lower === "siti nabila abdurachman, b.a." || lower === "siti nabila abdulrachman, b.a." || lower === "siti nabila abdurachman, ba") {
    return "Siti Nabila Abdurachman, B.A.";
  }

  // 7. Kemas Fuad Adriansyah, S.E.
  if (lower === "kemas fuad adriansyah, a.md" || lower === "kemas fuad adriansyah, s.e." || lower === "kemas fuadh adriansyah, se") {
    return "Kemas Fuad Adriansyah, S.E.";
  }

  // 8. Muh. Khunaini Adnan, S.Tr.Pi
  if (lower === "muh. khunaini adnan, s.tr.pi" || lower === "muhammad khunaini adnan") {
    return "Muh. Khunaini Adnan, S.Tr.Pi";
  }

  // 9. Niki Paulina Simanjuntak, S.M.
  if (lower === "niki paulina simanjuntak, a.md" || lower === "niki paulina simanjuntak, s. m" || lower === "niki paulina simanjuntak, a.md.") {
    return "Niki Paulina Simanjuntak, S.M.";
  }

  // 10. Nita Keysha Syahfitri
  if (lower === "nita keysha syahfitri" || lower === "nita keysa syahfitri") {
    return "Nita Keysha Syahfitri";
  }

  return n;
}

// ==========================================
// IN-MEMORY STORE & SCHEMA
// ==========================================
let _records = [];
let _nextId = 1;
let _initialized = false;

function cloneRecord(r, id) {
  return {
    id: id !== undefined ? id : (r.id || _nextId++),
    kategori: r.kategori || "DOMESTIK TIM (2)",
    no_urut: r.no_urut != null ? String(r.no_urut) : "",
    nama_pelaksana: normalizePersonnelName(r.nama_pelaksana || ""),
    pangkat_golongan: r.pangkat_golongan || "",
    jabatan: r.jabatan || "",
    tujuan: r.tujuan || "",
    no_surat_tugas_spd: r.no_surat_tugas_spd || "",
    uraian_penugasan: r.uraian_penugasan || "",
    tgl_mulai: r.tgl_mulai || "",
    tgl_selesai: r.tgl_selesai || "",
    tarif_uang_harian: Number(r.tarif_uang_harian) || 0,
    uang_harian_diterima: Number(r.uang_harian_diterima) || 0,
    uang_representative_tarif: Number(r.uang_representative_tarif) || 0,
    uang_representative_diterima: Number(r.uang_representative_diterima) || 0,
    nama_hotel: r.nama_hotel || "",
    lama_menginap: Number(r.lama_menginap) || 0,
    nilai_hotel: Number(r.nilai_hotel) || 0,
    berangkat_penyedia_jasa: r.berangkat_penyedia_jasa || "",
    berangkat_maskapai: r.berangkat_maskapai || "",
    berangkat_nomor_tiket: r.berangkat_nomor_tiket || "",
    berangkat_kode_booking: r.berangkat_kode_booking || "",
    berangkat_tanggal: r.berangkat_tanggal || "",
    berangkat_nilai: Number(r.berangkat_nilai) || 0,
    berangkat_taksi_penyedia: r.berangkat_taksi_penyedia || "",
    berangkat_taksi_nilai: Number(r.berangkat_taksi_nilai) || 0,
    pulang_penyedia_jasa: r.pulang_penyedia_jasa || "",
    pulang_maskapai: r.pulang_maskapai || "",
    pulang_nomor_tiket: r.pulang_nomor_tiket || "",
    pulang_kode_booking: r.pulang_kode_booking || "",
    pulang_tanggal: r.pulang_tanggal || "",
    pulang_nilai: Number(r.pulang_nilai) || 0,
    pulang_taksi_penyedia: r.pulang_taksi_penyedia || "",
    pulang_taksi_nilai: Number(r.pulang_taksi_nilai) || 0,
    dpr_nilai_hotel: Number(r.dpr_nilai_hotel) || 0,
    dpr_nilai_transportasi: Number(r.dpr_nilai_transportasi) || 0,
    dpr_nilai_taksi: Number(r.dpr_nilai_taksi) || 0,
    dpr_keterangan: r.dpr_keterangan || "",
    nilai_total_hotel: Number(r.nilai_total_hotel) || 0,
    nilai_total_transportasi: Number(r.nilai_total_transportasi) || 0,
    nilai_total_biaya: Number(r.nilai_total_biaya) || 0,
    sp2d_nomor: r.sp2d_nomor || "",
    sp2d_tanggal: r.sp2d_tanggal || "",
    sp2d_nominal: Number(r.sp2d_nominal) || 0,
    sp2d_pengembalian: Number(r.sp2d_pengembalian) || 0,
    no_spm: r.no_spm || "",
    link_dokumen_spj: r.link_dokumen_spj || "",
    kode_akun: r.kode_akun || "",
    status_validasi_ai: r.status_validasi_ai || "✅ Sesuai & Valid",
    created_at: r.created_at || new Date().toISOString(),
    updated_at: r.updated_at || new Date().toISOString(),
  };
}

export function initDb() {
  if (!_initialized) {
    if (seedRecords && seedRecords.length > 0) {
      let maxId = 0;
      _records = seedRecords.map((r, i) => {
        const id = r.id || (i + 1);
        if (id > maxId) maxId = id;
        return cloneRecord(r, id);
      });
      _nextId = maxId + 1;
    }
    _initialized = true;
  }
  return _records;
}

// Auto init on module load
initDb();

export function getDb() {
  initDb();
  return {
    records: _records,
  };
}

// ==========================================
// ATOMIC REPLACE
// ==========================================
export function replaceRecordsAtomic(records) {
  if (!records || records.length === 0) return 0;
  let newId = 1;
  const newRecords = records.map((r) => cloneRecord(r, newId++));
  _records = newRecords;
  _nextId = newId;
  _initialized = true;
  return _records.length;
}

// ==========================================
// CRUD
// ==========================================
export function insertRecord(data) {
  initDb();
  const id = _nextId++;
  const rec = cloneRecord(data, id);
  _records.push(rec);
  return id;
}

export function insertRecordsBatch(records) {
  if (!records || records.length === 0) return 0;
  initDb();
  for (const r of records) {
    const id = _nextId++;
    _records.push(cloneRecord(r, id));
  }
  return records.length;
}

export function getAllRecords({ kategori, filterStatus, search, suratTugas, sort = "newest" } = {}) {
  initDb();
  let result = _records;

  if (kategori && kategori !== "SEMUA") {
    result = result.filter((r) => r.kategori === kategori);
  }
  if (suratTugas && suratTugas !== "SEMUA") {
    result = result.filter((r) => (r.no_surat_tugas_spd || "").trim() === suratTugas.trim());
  }
  if (filterStatus && filterStatus !== "SEMUA") {
    if (filterStatus === "VALID") {
      result = result.filter((r) => (r.status_validasi_ai || "").includes("Valid"));
    } else if (filterStatus === "WARNING") {
      result = result.filter((r) => (r.status_validasi_ai || "").includes("Perlu Diperiksa"));
    } else if (filterStatus === "ERROR") {
      result = result.filter((r) => (r.status_validasi_ai || "").includes("Error"));
    }
  }
  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    result = result.filter(
      (r) =>
        (r.nama_pelaksana && r.nama_pelaksana.toLowerCase().includes(term)) ||
        (r.tujuan && r.tujuan.toLowerCase().includes(term)) ||
        (r.no_surat_tugas_spd && r.no_surat_tugas_spd.toLowerCase().includes(term)) ||
        (r.kode_akun && r.kode_akun.toLowerCase().includes(term))
    );
  }

  // Sorting
  const sorted = [...result];
  if (sort === "newest" || sort === "desc") {
    sorted.sort((a, b) => b.id - a.id);
  } else if (sort === "oldest" || sort === "asc") {
    sorted.sort((a, b) => a.id - b.id);
  } else if (sort === "date_desc") {
    sorted.sort((a, b) => (b.tgl_mulai || "").localeCompare(a.tgl_mulai || "") || b.id - a.id);
  } else if (sort === "date_asc") {
    sorted.sort((a, b) => (a.tgl_mulai || "").localeCompare(b.tgl_mulai || "") || a.id - b.id);
  } else if (sort === "cost_desc") {
    sorted.sort((a, b) => (b.nilai_total_biaya || 0) - (a.nilai_total_biaya || 0) || b.id - a.id);
  } else if (sort === "cost_asc") {
    sorted.sort((a, b) => (a.nilai_total_biaya || 0) - (b.nilai_total_biaya || 0) || a.id - b.id);
  } else {
    sorted.sort((a, b) => b.id - a.id);
  }

  return sorted;
}

export function getRecordById(id) {
  initDb();
  const numId = Number(id);
  return _records.find((r) => r.id === numId) || null;
}

export function updateRecord(id, data) {
  initDb();
  const numId = Number(id);
  const idx = _records.findIndex((r) => r.id === numId);
  if (idx !== -1) {
    const existing = _records[idx];
    const updated = {
      ...existing,
      ...data,
      id: numId,
      nama_pelaksana: data.nama_pelaksana ? normalizePersonnelName(data.nama_pelaksana) : existing.nama_pelaksana,
      updated_at: new Date().toISOString(),
    };
    _records[idx] = updated;
  }
}

export function deleteRecord(id) {
  initDb();
  const numId = Number(id);
  _records = _records.filter((r) => r.id !== numId);
}

export function clearAllRecords() {
  _records = [];
  _nextId = 1;
  _initialized = true;
}

// ==========================================
// STATS
// ==========================================
export function getAvailableCategories() {
  initDb();
  const cats = Array.from(new Set(_records.map((r) => r.kategori).filter(Boolean))).sort();
  return cats.length > 0 ? cats : ["DOMESTIK TIM (2)"];
}

export function getSummaryStats(kategori) {
  initDb();
  const records = (kategori && kategori !== "SEMUA")
    ? _records.filter((r) => r.kategori === kategori)
    : _records;

  const totalRecords = records.length;
  let totalBiaya = 0;
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  const suratTugasSet = new Set();
  const tujuanMap = new Map();
  const bulanMap = new Map();

  let uhTotal = 0;
  let hotelTotal = 0;
  let tiketTotal = 0;
  let transportTotal = 0;

  for (const r of records) {
    const biaya = Number(r.nilai_total_biaya) || 0;
    totalBiaya += biaya;

    const val = r.status_validasi_ai || "";
    if (val.includes("Valid")) validCount++;
    else if (val.includes("Error")) errorCount++;
    else if (val.includes("Perlu Diperiksa")) warningCount++;

    if (r.no_surat_tugas_spd && r.no_surat_tugas_spd.trim()) {
      suratTugasSet.add(r.no_surat_tugas_spd.trim());
    }

    if (r.tujuan && r.tujuan.trim()) {
      const tuj = r.tujuan.trim();
      const curr = tujuanMap.get(tuj) || { cnt: 0, total: 0 };
      curr.cnt += 1;
      curr.total += biaya;
      tujuanMap.set(tuj, curr);
    }

    if (r.tgl_mulai && r.tgl_mulai.trim()) {
      const bln = r.tgl_mulai.trim().substring(0, 7);
      const curr = bulanMap.get(bln) || { total: 0, cnt: 0 };
      curr.cnt += 1;
      curr.total += biaya;
      bulanMap.set(bln, curr);
    }

    uhTotal += Number(r.uang_harian_diterima) || 0;
    hotelTotal += Number(r.nilai_hotel) || 0;
    tiketTotal += (Number(r.berangkat_nilai) || 0) + (Number(r.pulang_nilai) || 0);
    transportTotal +=
      (Number(r.berangkat_taksi_nilai) || 0) +
      (Number(r.pulang_taksi_nilai) || 0) +
      (Number(r.dpr_nilai_transportasi) || 0);
  }

  const topTujuan = Array.from(tujuanMap.entries())
    .map(([tujuan, d]) => ({ tujuan, cnt: d.cnt, total: d.total }))
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 6);

  const biayaPerBulan = Array.from(bulanMap.entries())
    .map(([bulan, d]) => ({ bulan, total: d.total, cnt: d.cnt }))
    .sort((a, b) => a.bulan.localeCompare(b.bulan));

  // Budget Monitoring (Pimpinan & Tim) as drawn in user sketch
  const pimRecords = _records.filter((r) => r.kategori === "Perjadin Pimpinan");
  const timRecords = _records.filter((r) => r.kategori === "Perjadin Tim");

  function formatTripCompact(r) {
    return {
      id: r.id,
      no_urut: r.no_urut,
      no_surat_tugas_spd: r.no_surat_tugas_spd || "",
      nama_pelaksana: r.nama_pelaksana || "",
      jabatan: r.jabatan || "",
      pangkat_golongan: r.pangkat_golongan || "",
      tujuan: r.tujuan || "",
      uraian_penugasan: r.uraian_penugasan || "",
      tgl_mulai: r.tgl_mulai || "",
      tgl_selesai: r.tgl_selesai || "",
      nilai_total_biaya: Number(r.nilai_total_biaya) || 0,
      uang_harian_diterima: Number(r.uang_harian_diterima) || 0,
      nilai_hotel: Number(r.nilai_hotel) || 0,
      nama_hotel: r.nama_hotel || "",
      berangkat_maskapai: r.berangkat_maskapai || "",
      tiket_total: (Number(r.berangkat_nilai) || 0) + (Number(r.pulang_nilai) || 0),
      transport_total:
        (Number(r.berangkat_taksi_nilai) || 0) +
        (Number(r.pulang_taksi_nilai) || 0) +
        (Number(r.dpr_nilai_transportasi) || 0),
      status_validasi_ai: r.status_validasi_ai || "Valid",
      link_dokumen_spj: r.link_dokumen_spj || "",
      sp2d_nomor: r.sp2d_nomor || "",
      no_spm: r.no_spm || "",
      kategori: r.kategori || "",
    };
  }

  function computeTujuanAndStStats(records) {
    const tujuanMap = new Map();
    const stSet = new Set();
    for (const r of records) {
      const t = (r.tujuan || "Lainnya").trim();
      const curr = tujuanMap.get(t) || { tujuan: t, count: 0, total: 0 };
      curr.count += 1;
      curr.total += Number(r.nilai_total_biaya) || 0;
      tujuanMap.set(t, curr);
      if (r.no_surat_tugas_spd && r.no_surat_tugas_spd.trim()) {
        stSet.add(r.no_surat_tugas_spd.trim());
      }
    }
    const tujuanStats = Array.from(tujuanMap.values()).sort((a, b) => b.count - a.count);
    return {
      suratTugasCount: stSet.size,
      tujuanStats,
    };
  }

  const pimpinanSummary = {
    kabadan: { key: "kabadan", label: "Kabadan", desc: "Kepala Badan Karantina Indonesia", total: 0, count: 0, records: [] },
    sestama: { key: "sestama", label: "Sekretaris Utama", desc: "Sekretaris Utama", total: 0, count: 0, records: [] },
    kasubagTu: { key: "kasubagTu", label: "Kasubag TU", desc: "Subbagian Tata Usaha Kepala", total: 0, count: 0, records: [] },
    protopim: { key: "protopim", label: "Protopim", desc: "Kabag RT, Protokol & TU Pimpinan", total: 0, count: 0, records: [] },
  };
  let pimpinanTotal = 0;
  for (const r of pimRecords) {
    const cost = Number(r.nilai_total_biaya) || 0;
    pimpinanTotal += cost;
    const ft = formatTripCompact(r);
    const n = (r.nama_pelaksana || "").toLowerCase();
    const j = (r.jabatan || "").toLowerCase();
    if (n.includes("sahat") || n.includes("karding") || (j.includes("kepala badan") && !n.includes("amrie"))) {
      pimpinanSummary.kabadan.total += cost;
      pimpinanSummary.kabadan.count++;
      pimpinanSummary.kabadan.records.push(ft);
    } else if (n.includes("riswan") || j.includes("sekretaris") || j.includes("sestama") || j.includes("inspektur")) {
      pimpinanSummary.sestama.total += cost;
      pimpinanSummary.sestama.count++;
      pimpinanSummary.sestama.records.push(ft);
    } else if (n.includes("amrie") || j.includes("tata usaha kepala") || (j.includes("kasubag") && !j.includes("rt") && !j.includes("protokol"))) {
      pimpinanSummary.kasubagTu.total += cost;
      pimpinanSummary.kasubagTu.count++;
      pimpinanSummary.kasubagTu.records.push(ft);
    } else {
      pimpinanSummary.protopim.total += cost;
      pimpinanSummary.protopim.count++;
      pimpinanSummary.protopim.records.push(ft);
    }
  }

  for (const item of Object.values(pimpinanSummary)) {
    const s = computeTujuanAndStStats(item.records);
    item.suratTugasCount = s.suratTugasCount;
    item.tujuanStats = s.tujuanStats;
  }

  const pimAllRecords = [
    ...pimpinanSummary.kabadan.records,
    ...pimpinanSummary.sestama.records,
    ...pimpinanSummary.kasubagTu.records,
    ...pimpinanSummary.protopim.records,
  ];
  const pimAllStats = computeTujuanAndStStats(pimAllRecords);

  const timSummary = {
    rumahTangga: { key: "rumahTangga", label: "Rumah Tangga", desc: "Bagian Rumah Tangga & Sarana", total: 0, count: 0, records: [] },
    tuKepala: { key: "tuKepala", label: "Tata Usaha Kepala", desc: "Staf Substansi & Administrasi TU", total: 0, count: 0, records: [] },
    protokol: { key: "protokol", label: "Protokol", desc: "Tim Keprotokolan & Acara", total: 0, count: 0, records: [] },
    perangkat: { key: "perangkat", label: "Perangkat", desc: "Ajudan, Pamwal, Walpri, Serkapom, TAD", total: 0, count: 0, records: [] },
  };
  let timTotal = 0;
  for (const r of timRecords) {
    const cost = Number(r.nilai_total_biaya) || 0;
    timTotal += cost;
    const ft = formatTripCompact(r);
    const n = (r.nama_pelaksana || "").toLowerCase();
    const j = (r.jabatan || "").toLowerCase();
    const u = (r.uraian_penugasan || "").toLowerCase();
    if (j.includes("rumah tangga") || u.includes("rumah tangga") || j.includes("rt ") || u.includes("sarana") || j.includes("pengadministrasi perkantoran") || n.includes("sumarno") || n.includes("henrico")) {
      timSummary.rumahTangga.total += cost;
      timSummary.rumahTangga.count++;
      timSummary.rumahTangga.records.push(ft);
    } else if (j.includes("protokol") || u.includes("protokol") || u.includes("keprotokolan")) {
      timSummary.protokol.total += cost;
      timSummary.protokol.count++;
      timSummary.protokol.records.push(ft);
    } else if (
      j.includes("ajudan") || j.includes("walpri") || j.includes("pamwal") || j.includes("patwal") || j.includes("pengawal") || j.includes("serkapom") ||
      u.includes("ajudan") || u.includes("walpri") || u.includes("pamwal") || u.includes("patwal") || u.includes("pengawal") || u.includes("serkapom") ||
      j.includes("tenaga alih daya") || j.includes("non-asn") || j.includes("non pns")
    ) {
      timSummary.perangkat.total += cost;
      timSummary.perangkat.count++;
      timSummary.perangkat.records.push(ft);
    } else {
      timSummary.tuKepala.total += cost;
      timSummary.tuKepala.count++;
      timSummary.tuKepala.records.push(ft);
    }
  }

  for (const item of Object.values(timSummary)) {
    const s = computeTujuanAndStStats(item.records);
    item.suratTugasCount = s.suratTugasCount;
    item.tujuanStats = s.tujuanStats;
  }

  const timAllRecords = [
    ...timSummary.rumahTangga.records,
    ...timSummary.tuKepala.records,
    ...timSummary.protokol.records,
    ...timSummary.perangkat.records,
  ];
  const timAllStats = computeTujuanAndStStats(timAllRecords);

  const budgetMonitoring = {
    pimpinan: {
      key: "pimpinan",
      label: "Anggaran Pimpinan",
      desc: "Seluruh Pimpinan (Kabadan, Sekretaris Utama, Kasubag TU, Protopim)",
      total: pimpinanTotal,
      count: pimRecords.length,
      suratTugasCount: pimAllStats.suratTugasCount,
      tujuanStats: pimAllStats.tujuanStats,
      records: pimAllRecords,
      items: [
        pimpinanSummary.kabadan,
        pimpinanSummary.sestama,
        pimpinanSummary.kasubagTu,
        pimpinanSummary.protopim,
      ],
    },
    tim: {
      key: "tim",
      label: "Anggaran Tim",
      desc: "Seluruh Tim (Rumah Tangga, TU Kepala, Protokol, Perangkat)",
      total: timTotal,
      count: timRecords.length,
      suratTugasCount: timAllStats.suratTugasCount,
      tujuanStats: timAllStats.tujuanStats,
      records: timAllRecords,
      items: [
        timSummary.rumahTangga,
        timSummary.tuKepala,
        timSummary.protokol,
        timSummary.perangkat,
      ],
    },
  };

  return {
    totalRecords,
    totalBiaya,
    totalSuratTugas: suratTugasSet.size,
    validCount,
    warningCount,
    errorCount,
    topTujuan,
    biayaPerBulan,
    breakdownBiaya: {
      "Uang Harian": uhTotal,
      "Hotel & Akomodasi": hotelTotal,
      "Tiket Pesawat/Kereta": tiketTotal,
      "Transport Lokal": transportTotal,
    },
    budgetMonitoring,
  };
}

// ==========================================
// KLASIFIKASI SURAT TUGAS
// ==========================================
export function getSuratTugasList(kategori) {
  const records = getAllRecords({ kategori });
  if (!records.length) return [];

  const seenKeys = new Set();
  const orderedKeys = [];
  for (const r of records) {
    const surat = (r.no_surat_tugas_spd || "").trim();
    const noU = (r.no_urut || "").toString().trim();
    const key = `${surat}|||${noU}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      orderedKeys.push({ surat, noU });
    }
  }

  const groups = [];
  for (const { surat, noU } of orderedKeys) {
    if (!surat && !noU) continue;
    const sub = records.filter(
      (r) => (r.no_surat_tugas_spd || "").trim() === surat && (r.no_urut || "").toString().trim() === noU
    );
    if (!sub.length) continue;

    const first = sub[0];
    const names = sub.map((s) => s.nama_pelaksana);
    const sp2dNom = Math.max(...sub.map((s) => s.sp2d_nominal || 0));
    const label = surat || "Tanpa No Surat";
    const displayLabel = noU
      ? `No. ${noU} | ${label} — ${first.tujuan || ""} (${sub.length} Orang)`
      : `${label} — ${first.tujuan || ""} (${sub.length} Orang)`;

    groups.push({
      groupKey: `${surat}___${noU}`,
      displayLabel,
      noSuratTugasSpd: surat,
      noUrut: noU,
      tujuan: first.tujuan || "",
      tglMulai: first.tgl_mulai || "",
      tglSelesai: first.tgl_selesai || "",
      uraianPenugasan: first.uraian_penugasan || "",
      totalPelaksana: sub.length,
      pelaksanaNames: names.join(", "),
      pelaksanaList: sub,
      totalBiayaRombongan: sub.reduce((a, s) => a + (s.nilai_total_biaya || 0), 0),
      sp2dNomor: first.sp2d_nomor || "",
      sp2dTanggal: first.sp2d_tanggal || "",
      sp2dNominal: sp2dNom,
      noSpm: first.no_spm || "",
      kodeAkun: first.kode_akun || "",
      kategori: first.kategori || "",
    });
  }
  return groups;
}

// ==========================================
// MONITORING PER PERSONEL (PER ORANG)
// ==========================================
export function getPersonnelMonitoringList(kategori) {
  const records = getAllRecords({ kategori });
  if (!records.length) return [];

  const map = new Map();

  for (const r of records) {
    const rawName = (r.nama_pelaksana || "").trim();
    if (!rawName) continue;

    const canonicalName = normalizePersonnelName(rawName);
    const key = canonicalName.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        nama: canonicalName,
        pangkat: (r.pangkat_golongan || "").trim(),
        jabatan: (r.jabatan || "").trim(),
        totalPerjalanan: 0,
        totalBiaya: 0,
        totalUangHarian: 0,
        totalHotel: 0,
        totalTransport: 0,
        totalDpr: 0,
        daftarTujuan: new Set(),
        kategoriSet: new Set(),
        trips: [],
      });
    }

    const p = map.get(key);
    if (canonicalName.length > p.nama.length) p.nama = canonicalName;
    const pg = (r.pangkat_golongan || "").trim();
    if (pg && (!p.pangkat || pg.length > p.pangkat.length)) p.pangkat = pg;
    const jb = (r.jabatan || "").trim();
    if (jb && (!p.jabatan || jb.length > p.jabatan.length)) p.jabatan = jb;

    p.totalPerjalanan += 1;
    p.totalBiaya += Number(r.nilai_total_biaya) || 0;
    p.totalUangHarian += Number(r.uang_harian_diterima) || 0;
    p.totalHotel += Number(r.nilai_total_hotel) || 0;
    p.totalTransport += Number(r.nilai_total_transportasi) || 0;
    p.totalDpr +=
      (Number(r.dpr_nilai_transportasi) || 0) +
      (Number(r.dpr_nilai_hotel) || 0) +
      (Number(r.dpr_nilai_taksi) || 0);

    if (r.tujuan) p.daftarTujuan.add(r.tujuan.trim());
    if (r.kategori) p.kategoriSet.add(r.kategori.trim());

    p.trips.push({
      id: r.id,
      no_urut: r.no_urut,
      kategori: r.kategori,
      no_surat_tugas_spd: r.no_surat_tugas_spd || "-",
      tujuan: r.tujuan || "-",
      uraian_penugasan: r.uraian_penugasan || "-",
      tgl_mulai: r.tgl_mulai || "",
      tgl_selesai: r.tgl_selesai || "",
      tarif_uang_harian: r.tarif_uang_harian || 0,
      uang_harian_diterima: r.uang_harian_diterima || 0,
      uang_representative_diterima: r.uang_representative_diterima || 0,
      nama_hotel: r.nama_hotel || "-",
      lama_menginap: r.lama_menginap || 0,
      nilai_hotel: r.nilai_hotel || 0,
      berangkat_maskapai: r.berangkat_maskapai || "-",
      berangkat_nomor_tiket: r.berangkat_nomor_tiket || "-",
      berangkat_nilai: r.berangkat_nilai || 0,
      pulang_maskapai: r.pulang_maskapai || "-",
      pulang_nomor_tiket: r.pulang_nomor_tiket || "-",
      pulang_nilai: r.pulang_nilai || 0,
      berangkat_taksi_nilai: r.berangkat_taksi_nilai || 0,
      pulang_taksi_nilai: r.pulang_taksi_nilai || 0,
      dpr_nilai_transportasi: r.dpr_nilai_transportasi || 0,
      nilai_total_biaya: r.nilai_total_biaya || 0,
      sp2d_nomor: r.sp2d_nomor || "-",
      sp2d_nominal: r.sp2d_nominal || 0,
      link_dokumen_spj: r.link_dokumen_spj || "",
      status_validasi_ai: r.status_validasi_ai || "✅ Sesuai & Valid",
    });
  }

  const result = [];
  for (const p of map.values()) {
    p.rataRataBiaya = p.totalPerjalanan > 0 ? Math.round(p.totalBiaya / p.totalPerjalanan) : 0;
    p.daftarTujuan = Array.from(p.daftarTujuan);
    p.kategoriList = Array.from(p.kategoriSet);
    delete p.kategoriSet;

    // Inisial untuk avatar (misal "Muhammad Tegar" -> "MT")
    const words = p.nama.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/).filter(Boolean);
    p.initials =
      words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : words.length === 1
        ? words[0].substring(0, 2).toUpperCase()
        : "PL";

    // Urutkan riwayat perjalanan dari tanggal terbaru
    p.trips.sort((a, b) => (b.tgl_mulai || "").localeCompare(a.tgl_mulai || ""));
    result.push(p);
  }

  // Default urut: Perjalanan terbanyak, lalu total biaya terbesar
  result.sort((a, b) => b.totalPerjalanan - a.totalPerjalanan || b.totalBiaya - a.totalBiaya);
  return result;
}
