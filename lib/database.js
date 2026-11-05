/**
 * database.js
 * ===========
 * Modul database SQLite (better-sqlite3) untuk Rekap Perjalanan Dinas.
 * Port dari database.py — CRUD, stats, klasifikasi surat tugas, export.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function resolveDbPath() {
  const candidatePaths = [
    path.join(process.cwd(), "perjadin.db"),
    path.resolve("./perjadin.db"),
  ];

  let localDb = null;
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        localDb = p;
        break;
      }
    } catch {
      // ignore
    }
  }

  // In serverless / read-only environment like Vercel, copy to /tmp for writable SQLite access
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDb = path.join("/tmp", "perjadin.db");
    try {
      let shouldCopy = !fs.existsSync(tmpDb);
      if (!shouldCopy && localDb && fs.existsSync(localDb)) {
        const localStat = fs.statSync(localDb);
        const tmpStat = fs.statSync(tmpDb);
        if (localStat.mtimeMs > tmpStat.mtimeMs || localStat.size !== tmpStat.size) {
          shouldCopy = true;
        }
      }
      if (shouldCopy && localDb && fs.existsSync(localDb)) {
        fs.copyFileSync(localDb, tmpDb);
      }
      return tmpDb;
    } catch (e) {
      console.error("resolveDbPath error copying to /tmp:", e);
      return tmpDb;
    }
  }
  return localDb || path.join(process.cwd(), "perjadin.db");
}

let _db = null;

export function getDb() {
  if (!_db) {
    const dbPath = resolveDbPath();
    _db = new Database(dbPath);
    try {
      _db.pragma("journal_mode = WAL");
    } catch {
      // WAL mode not supported in read-only environment
    }
  }
  return _db;
}

// ==========================================
// INIT
// ==========================================
export function initDb() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS rekap_perjadin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kategori TEXT NOT NULL DEFAULT 'DOMESTIK TIM (2)',
      no_urut TEXT,
      nama_pelaksana TEXT NOT NULL,
      pangkat_golongan TEXT,
      jabatan TEXT,
      tujuan TEXT,
      no_surat_tugas_spd TEXT,
      uraian_penugasan TEXT,
      tgl_mulai TEXT,
      tgl_selesai TEXT,
      tarif_uang_harian REAL DEFAULT 0,
      uang_harian_diterima REAL DEFAULT 0,
      uang_representative_tarif REAL DEFAULT 0,
      uang_representative_diterima REAL DEFAULT 0,
      nama_hotel TEXT,
      lama_menginap INTEGER DEFAULT 0,
      nilai_hotel REAL DEFAULT 0,
      berangkat_penyedia_jasa TEXT,
      berangkat_maskapai TEXT,
      berangkat_nomor_tiket TEXT,
      berangkat_kode_booking TEXT,
      berangkat_tanggal TEXT,
      berangkat_nilai REAL DEFAULT 0,
      berangkat_taksi_penyedia TEXT,
      berangkat_taksi_nilai REAL DEFAULT 0,
      pulang_penyedia_jasa TEXT,
      pulang_maskapai TEXT,
      pulang_nomor_tiket TEXT,
      pulang_kode_booking TEXT,
      pulang_tanggal TEXT,
      pulang_nilai REAL DEFAULT 0,
      pulang_taksi_penyedia TEXT,
      pulang_taksi_nilai REAL DEFAULT 0,
      dpr_nilai_hotel REAL DEFAULT 0,
      dpr_nilai_transportasi REAL DEFAULT 0,
      dpr_nilai_taksi REAL DEFAULT 0,
      dpr_keterangan TEXT,
      nilai_total_hotel REAL DEFAULT 0,
      nilai_total_transportasi REAL DEFAULT 0,
      nilai_total_biaya REAL DEFAULT 0,
      sp2d_nomor TEXT,
      sp2d_tanggal TEXT,
      sp2d_nominal REAL DEFAULT 0,
      sp2d_pengembalian REAL DEFAULT 0,
      no_spm TEXT,
      link_dokumen_spj TEXT,
      kode_akun TEXT,
      status_validasi_ai TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);
}

// ==========================================
// CANONICAL NAME NORMALIZER
// ==========================================
export function normalizePersonnelName(name) {
  if (!name) return "";
  const n = String(name).trim();
  const lower = n.toLowerCase().replace(/\s+/g, " ");

  // 1. drh. Reza Mahlefi (Explicit user instruction: reza Mahlefi dan drh. Reza Mahlefi sama)
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
// CRUD
// ==========================================
export function insertRecord(data) {
  const db = getDb();
  if (data.nama_pelaksana) {
    data.nama_pelaksana = normalizePersonnelName(data.nama_pelaksana);
  }
  const keys = Object.keys(data);
  const cols = keys.join(", ");
  const placeholders = keys.map(() => "?").join(", ");
  const stmt = db.prepare(`INSERT INTO rekap_perjadin (${cols}) VALUES (${placeholders})`);
  const info = stmt.run(...Object.values(data));
  return info.lastInsertRowid;
}

export function insertRecordsBatch(records) {
  if (!records || records.length === 0) return 0;
  const db = getDb();
  const insertMany = db.transaction((rows) => {
    for (const data of rows) {
      if (data.nama_pelaksana) {
        data.nama_pelaksana = normalizePersonnelName(data.nama_pelaksana);
      }
      const keys = Object.keys(data);
      const cols = keys.join(", ");
      const placeholders = keys.map(() => "?").join(", ");
      db.prepare(`INSERT INTO rekap_perjadin (${cols}) VALUES (${placeholders})`).run(...Object.values(data));
    }
  });
  insertMany(records);
  return records.length;
}

export function getAllRecords({ kategori, filterStatus, search, suratTugas, sort = "newest" } = {}) {
  const db = getDb();
  let query = "SELECT * FROM rekap_perjadin WHERE 1=1";
  const params = [];

  if (kategori && kategori !== "SEMUA") {
    query += " AND kategori = ?";
    params.push(kategori);
  }
  if (suratTugas && suratTugas !== "SEMUA") {
    query += " AND no_surat_tugas_spd = ?";
    params.push(suratTugas);
  }
  if (filterStatus && filterStatus !== "SEMUA") {
    if (filterStatus === "VALID") query += " AND status_validasi_ai LIKE '%Valid%'";
    else if (filterStatus === "WARNING") query += " AND status_validasi_ai LIKE '%Perlu Diperiksa%'";
    else if (filterStatus === "ERROR") query += " AND status_validasi_ai LIKE '%Error%'";
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query += " AND (nama_pelaksana LIKE ? OR tujuan LIKE ? OR no_surat_tugas_spd LIKE ? OR kode_akun LIKE ?)";
    params.push(term, term, term, term);
  }

  // Sorting logic
  if (sort === "newest" || sort === "desc") {
    query += " ORDER BY id DESC";
  } else if (sort === "oldest" || sort === "asc") {
    query += " ORDER BY id ASC";
  } else if (sort === "date_desc") {
    query += " ORDER BY tgl_mulai DESC, id DESC";
  } else if (sort === "date_asc") {
    query += " ORDER BY tgl_mulai ASC, id ASC";
  } else if (sort === "cost_desc") {
    query += " ORDER BY nilai_total_biaya DESC, id DESC";
  } else if (sort === "cost_asc") {
    query += " ORDER BY nilai_total_biaya ASC, id ASC";
  } else {
    query += " ORDER BY id DESC";
  }

  return db.prepare(query).all(...params);
}

export function getRecordById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM rekap_perjadin WHERE id = ?").get(id);
}

export function updateRecord(id, data) {
  const db = getDb();
  if (data.nama_pelaksana) {
    data.nama_pelaksana = normalizePersonnelName(data.nama_pelaksana);
  }
  const keys = Object.keys(data);
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE rekap_perjadin SET ${setClause}, updated_at = datetime('now','localtime') WHERE id = ?`).run(
    ...Object.values(data),
    id
  );
}

export function deleteRecord(id) {
  const db = getDb();
  db.prepare("DELETE FROM rekap_perjadin WHERE id = ?").run(id);
}

export function clearAllRecords() {
  const db = getDb();
  db.exec("DELETE FROM rekap_perjadin");
  db.exec("DELETE FROM sqlite_sequence WHERE name='rekap_perjadin'");
}

// ==========================================
// STATS
// ==========================================
export function getAvailableCategories() {
  const db = getDb();
  const rows = db.prepare("SELECT DISTINCT kategori FROM rekap_perjadin ORDER BY kategori").all();
  const cats = rows.map((r) => r.kategori).filter(Boolean);
  return cats.length > 0 ? cats : ["DOMESTIK TIM (2)"];
}

export function getSummaryStats(kategori) {
  const db = getDb();
  let w = "WHERE 1=1";
  const p = [];
  if (kategori && kategori !== "SEMUA") {
    w += " AND kategori = ?";
    p.push(kategori);
  }

  const totalRecords = db.prepare(`SELECT COUNT(*) as c FROM rekap_perjadin ${w}`).get(...p).c;
  const totalBiaya = db.prepare(`SELECT COALESCE(SUM(nilai_total_biaya),0) as s FROM rekap_perjadin ${w}`).get(...p).s;
  const validCount = db.prepare(`SELECT COUNT(*) as c FROM rekap_perjadin ${w} AND status_validasi_ai LIKE '%Valid%'`).get(...p).c;
  const errorCount = db.prepare(`SELECT COUNT(*) as c FROM rekap_perjadin ${w} AND status_validasi_ai LIKE '%Error%'`).get(...p).c;
  const warningCount = db.prepare(`SELECT COUNT(*) as c FROM rekap_perjadin ${w} AND status_validasi_ai LIKE '%Perlu Diperiksa%'`).get(...p).c;
  const totalSuratTugas = db.prepare(`SELECT COUNT(DISTINCT no_surat_tugas_spd) as c FROM rekap_perjadin ${w} AND no_surat_tugas_spd != ''`).get(...p).c;

  const topTujuan = db.prepare(
    `SELECT tujuan, COUNT(*) as cnt, SUM(nilai_total_biaya) as total FROM rekap_perjadin ${w} AND tujuan IS NOT NULL AND tujuan != '' GROUP BY tujuan ORDER BY cnt DESC LIMIT 6`
  ).all(...p);

  const biayaPerBulan = db.prepare(
    `SELECT substr(tgl_mulai,1,7) as bulan, SUM(nilai_total_biaya) as total, COUNT(*) as cnt FROM rekap_perjadin ${w} AND tgl_mulai IS NOT NULL AND tgl_mulai != '' GROUP BY bulan ORDER BY bulan ASC`
  ).all(...p);

  const komponen = db.prepare(
    `SELECT COALESCE(SUM(uang_harian_diterima),0) as uh, COALESCE(SUM(nilai_hotel),0) as hotel, COALESCE(SUM(berangkat_nilai+pulang_nilai),0) as tiket, COALESCE(SUM(berangkat_taksi_nilai+pulang_taksi_nilai+dpr_nilai_transportasi),0) as transport FROM rekap_perjadin ${w}`
  ).get(...p);

  return {
    totalRecords,
    totalBiaya,
    totalSuratTugas,
    validCount,
    warningCount,
    errorCount,
    topTujuan,
    biayaPerBulan,
    breakdownBiaya: {
      "Uang Harian": komponen.uh,
      "Hotel & Akomodasi": komponen.hotel,
      "Tiket Pesawat/Kereta": komponen.tiket,
      "Taksi & Transport Lokal": komponen.transport,
    },
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

// Init on load
initDb();
