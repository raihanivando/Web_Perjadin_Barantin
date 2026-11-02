 "use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// ============================
// HELPERS
// ============================
const fmt = (val) => {
  const n = Number(val) || 0;
  return n.toLocaleString("id-ID");
};

const fmtShort = (val) => {
  const n = Number(val) || 0;
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)} M`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(1)} Jt`;
  return `Rp ${fmt(n)}`;
};

const monthLabel = (ym) => {
  if (!ym || ym.length !== 7) return ym;
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${months[parseInt(m) - 1]} ${y}`;
};

function statusBadge(status) {
  if (!status) return null;
  if (status.includes("Valid")) return <span className="badge badge-valid">✅ Valid</span>;
  if (status.includes("Error")) return <span className="badge badge-error">❌ Error</span>;
  if (status.includes("Perlu")) return <span className="badge badge-warning">⚠️ Cek</span>;
  return <span className="badge">{status}</span>;
}

// ============================
// CUSTOM TOOLTIP
// ============================
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 14px", boxShadow: "var(--shadow-md)",
      fontSize: "0.82rem"
    }}>
      <p style={{ fontWeight: 600, color: "var(--text-title)", marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: "var(--text-muted)" }}>
          {p.name}: <strong style={{ color: "var(--accent)" }}>Rp {fmt(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

// ============================
// MAIN APP
// ============================
export default function Home() {
  const [theme, setTheme] = useState("dark");
  const [activePage, setActivePage] = useState("dashboard");
  const [kategori, setKategori] = useState("SEMUA");
  const [categories, setCategories] = useState(["DOMESTIK TIM (2)"]);
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [suratGroups, setSuratGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("SEMUA");
  const [stFilter, setStFilter] = useState("SEMUA");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formTab, setFormTab] = useState(0);
  const [formData, setFormData] = useState(getEmptyForm());
  const [monitoringViewMode, setMonitoringViewMode] = useState("grouped"); // "grouped" | "detailed"
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [detailModalKey, setDetailModalKey] = useState(null);
  const [sortBy, setSortBy] = useState("newest"); // "newest" | "oldest" | "date_desc" | "date_asc" | "cost_desc" | "cost_asc"

  // Personnel Monitoring States
  const [personnelList, setPersonnelList] = useState([]);
  const [klasifikasiTab, setKlasifikasiTab] = useState("personel"); // "personel" | "surat"
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelSort, setPersonnelSort] = useState("trips_desc"); // "trips_desc" | "cost_desc" | "cost_avg_desc" | "name_asc" | "trips_asc"
  const [personnelViewMode, setPersonnelViewMode] = useState("cards"); // "cards" | "table"
  const [selectedPersonModal, setSelectedPersonModal] = useState(null);
  const [expandedPersonnelCards, setExpandedPersonnelCards] = useState(new Set());
  const [personModalTripSearch, setPersonModalTripSearch] = useState("");

  const toggleExpandPersonnelCard = (nama) => {
    setExpandedPersonnelCards((prev) => {
      const next = new Set(prev);
      if (next.has(nama)) next.delete(nama);
      else next.add(nama);
      return next;
    });
  };

  const toggleExpandRow = (key) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Theme
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  // Toast helper
  const addToast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // Sync Excel helper
  const handleSyncExcel = async () => {
    setSyncing(true);
    addToast("Sedang membaca & menyinkronkan data dari file Excel...", "info");
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        addToast(`✅ ${data.message}`, "success");
        fetchData();
      } else {
        addToast("Gagal sinkronisasi: " + (data.error || "Unknown error"), "error");
      }
    } catch (err) {
      addToast("Gagal sinkronisasi: " + err.message, "error");
    } finally {
      setSyncing(false);
    }
  };

  // Data fetching
  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, statsRes] = await Promise.all([
        fetch("/api/records?action=categories").then((r) => r.json()),
        fetch(`/api/records?action=stats&kategori=${encodeURIComponent(kategori)}`).then((r) => r.json()),
      ]);
      setCategories(catRes);
      setStats(statsRes);

      if (activePage === "klasifikasi" || activePage === "dashboard" || activePage === "monitoring") {
        const [stRes, pRes] = await Promise.all([
          fetch(`/api/records?action=surat-tugas&kategori=${encodeURIComponent(kategori)}`).then((r) => r.json()),
          fetch(`/api/records?action=personnel&kategori=${encodeURIComponent(kategori)}`).then((r) => r.json()),
        ]);
        setSuratGroups(stRes || []);
        setPersonnelList(pRes || []);
        if (stRes && stRes.length > 0) {
          setSelectedGroup((prev) => prev || stRes[0]);
        }
      }

      if (activePage === "monitoring" || activePage === "validator" || activePage === "dashboard") {
        const params = new URLSearchParams({ kategori });
        if (statusFilter !== "SEMUA") params.set("status", statusFilter);
        if (searchQuery) params.set("search", searchQuery);
        if (stFilter !== "SEMUA") params.set("suratTugas", stFilter);
        if (sortBy) params.set("sort", sortBy);
        const recRes = await fetch(`/api/records?${params}`).then((r) => r.json());
        setRecords(recRes);
      }
    } catch (err) {
      addToast("Gagal memuat data: " + err.message, "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori, activePage, statusFilter, searchQuery, stFilter, sortBy]);

  // Auto-sync watcher: checks if Excel file on disk was modified every 4 seconds
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/import?check=true");
        const data = await res.json();
        if (data && data.updated) {
          addToast(`🔔 ${data.message || "File Excel diperbarui! Data otomatis disinkronkan."}`, "info");
          fetchData();
        }
      } catch {
        // silent on network pause
      }
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast]);

  // Pengelompokan baris per No Surat Tugas & SPD (dengan dukungan sorting)
  const groupedSpdList = useMemo(() => {
    const groupsMap = new Map();
    for (const r of records) {
      const spd = (r.no_surat_tugas_spd || "").trim();
      const noU = (r.no_urut != null ? String(r.no_urut) : "").trim();
      // Prioritas key pengelompokan: No SPD jika ada, jika tidak ada fallback ke no_urut, atau ID
      const key = spd || (noU ? `NO_URUT_${noU}` : `ID_${r.id}`);

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          no_urut: r.no_urut,
          no_surat_tugas_spd: spd || "(Tanpa Nomor SPD)",
          tujuan: r.tujuan || "-",
          tgl_mulai: r.tgl_mulai || "-",
          tgl_selesai: r.tgl_selesai || "-",
          uraian_penugasan: r.uraian_penugasan || "",
          sp2d_nomor: r.sp2d_nomor || "",
          sp2d_tanggal: r.sp2d_tanggal || "",
          sp2d_nominal: r.sp2d_nominal || 0,
          no_spm: r.no_spm || "",
          kode_akun: r.kode_akun || "",
          kategori: r.kategori || "",
          totalBiaya: 0,
          totalUangHarian: 0,
          totalHotel: 0,
          totalTransport: 0,
          totalDpr: 0,
          pelaksanaList: [],
          hasError: false,
          hasWarning: false,
          latestId: Number(r.id) || 0,
          earliestId: Number(r.id) || 0,
        });
      }

      const g = groupsMap.get(key);
      g.pelaksanaList.push(r);
      const recId = Number(r.id) || 0;
      g.latestId = Math.max(g.latestId, recId);
      g.earliestId = Math.min(g.earliestId, recId);
      g.totalBiaya += Number(r.nilai_total_biaya) || 0;
      g.totalUangHarian += Number(r.uang_harian_diterima) || 0;
      g.totalHotel += Number(r.nilai_hotel) || 0;
      g.totalTransport += (Number(r.berangkat_nilai) || 0) + (Number(r.pulang_nilai) || 0);
      g.totalDpr += (Number(r.dpr_nilai_transportasi) || 0) + (Number(r.dpr_nilai_hotel) || 0) + (Number(r.dpr_nilai_taksi) || 0);

      if (r.status_validasi_ai?.includes("Error")) g.hasError = true;
      if (r.status_validasi_ai?.includes("Perlu Diperiksa")) g.hasWarning = true;
      if (r.sp2d_nominal && r.sp2d_nominal > g.sp2d_nominal) g.sp2d_nominal = r.sp2d_nominal;
    }

    const list = Array.from(groupsMap.values());
    if (sortBy === "newest") {
      list.sort((a, b) => b.latestId - a.latestId);
    } else if (sortBy === "oldest") {
      list.sort((a, b) => a.earliestId - b.earliestId);
    } else if (sortBy === "date_desc") {
      list.sort((a, b) => (b.tgl_mulai || "").localeCompare(a.tgl_mulai || ""));
    } else if (sortBy === "date_asc") {
      list.sort((a, b) => (a.tgl_mulai || "").localeCompare(b.tgl_mulai || ""));
    } else if (sortBy === "cost_desc") {
      list.sort((a, b) => b.totalBiaya - a.totalBiaya);
    } else if (sortBy === "cost_asc") {
      list.sort((a, b) => a.totalBiaya - b.totalBiaya);
    }
    return list;
  }, [records, sortBy]);

  // Derived state untuk modal detail SPD (otomatis tersinkronisasi)
  const detailModalGroup = useMemo(
    () => (detailModalKey ? groupedSpdList.find((g) => g.key === detailModalKey) || null : null),
    [detailModalKey, groupedSpdList]
  );

  // Listener tombol ESC untuk menutup modal detail
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setDetailModalKey(null);
        setSelectedPersonModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Form helpers
  function getEmptyForm() {
    return {
      kategori: "DOMESTIK TIM (2)", no_urut: "", nama_pelaksana: "", pangkat_golongan: "",
      jabatan: "", tujuan: "", no_surat_tugas_spd: "", uraian_penugasan: "",
      tgl_mulai: "2026-01-15", tgl_selesai: "2026-01-17",
      tarif_uang_harian: 410000, uang_harian_diterima: 820000,
      uang_representative_tarif: 0, uang_representative_diterima: 0,
      nama_hotel: "", lama_menginap: 0, nilai_hotel: 0,
      berangkat_penyedia_jasa: "", berangkat_maskapai: "", berangkat_nomor_tiket: "",
      berangkat_kode_booking: "", berangkat_tanggal: "2026-01-15", berangkat_nilai: 0,
      berangkat_taksi_penyedia: "", berangkat_taksi_nilai: 0,
      pulang_penyedia_jasa: "", pulang_maskapai: "", pulang_nomor_tiket: "",
      pulang_kode_booking: "", pulang_tanggal: "2026-01-17", pulang_nilai: 0,
      pulang_taksi_penyedia: "", pulang_taksi_nilai: 0,
      dpr_nilai_hotel: 0, dpr_nilai_transportasi: 0, dpr_nilai_taksi: 0, dpr_keterangan: "",
      nilai_total_biaya: 0, sp2d_nomor: "", sp2d_tanggal: "2026-01-20",
      sp2d_nominal: 0, sp2d_pengembalian: 0, no_spm: "", link_dokumen_spj: "",
      kode_akun: "6999.EBA.994.002.AA.524111",
    };
  }

  const updateForm = (key, val) => setFormData((f) => ({ ...f, [key]: val }));

  const submitForm = async () => {
    if (!formData.nama_pelaksana.trim() || !formData.tujuan.trim()) {
      addToast("Nama Pelaksana dan Tujuan wajib diisi!", "error");
      return;
    }
    const data = {
      ...formData,
      kategori: kategori !== "SEMUA" ? kategori : "DOMESTIK TIM (2)",
      nilai_total_biaya:
        Number(formData.uang_harian_diterima) + Number(formData.uang_representative_diterima) +
        Number(formData.nilai_hotel) + Number(formData.berangkat_nilai) + Number(formData.pulang_nilai) +
        Number(formData.dpr_nilai_hotel) + Number(formData.dpr_nilai_transportasi) + Number(formData.dpr_nilai_taksi),
    };
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.id) {
        addToast(`Data berhasil disimpan (ID #${result.id})!`, "success");
        setFormData(getEmptyForm());
        fetchData();
      }
    } catch (err) {
      addToast("Gagal menyimpan: " + err.message, "error");
    }
  };

  const deleteRec = async (id) => {
    if (!confirm("Hapus record ini?")) return;
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    addToast("Record berhasil dihapus.", "success");
    fetchData();
  };

  // Chart colors
  const COLORS = ["#fbc253", "#d49520", "#522e2e", "#7a4444"];

  const pages = [
    { key: "dashboard", label: "Ringkasan / Dashboard", icon: "📊" },
    { key: "klasifikasi", label: "Klasifikasi Surat Tugas", icon: "📂" },
    { key: "monitoring", label: "Data Rekap & Monitoring", icon: "📋" },
    { key: "input", label: "Input Data Baru", icon: "📝" },
    { key: "validator", label: "AI Validator & Verifikasi", icon: "🤖" },
  ];

  const formTabs = ["Personel & Tugas", "Uang Harian", "Penginapan", "Transportasi", "DPR (Lump Sum)", "Total & Dokumen"];

  // Filtered records for validator
  const errorRecords = useMemo(
    () => records.filter((r) => r.status_validasi_ai && (r.status_validasi_ai.includes("Error") || r.status_validasi_ai.includes("Perlu Diperiksa"))),
    [records]
  );

  // Filtered & sorted personnel list for monitoring per-orang
  const filteredPersonnel = useMemo(() => {
    let list = [...personnelList];

    if (personnelSearch.trim()) {
      const q = personnelSearch.trim().toLowerCase();
      list = list.filter((p) =>
        p.nama.toLowerCase().includes(q) ||
        (p.jabatan && p.jabatan.toLowerCase().includes(q)) ||
        (p.pangkat && p.pangkat.toLowerCase().includes(q)) ||
        p.daftarTujuan.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (personnelSort === "trips_desc") {
      list.sort((a, b) => b.totalPerjalanan - a.totalPerjalanan || b.totalBiaya - a.totalBiaya);
    } else if (personnelSort === "trips_asc") {
      list.sort((a, b) => a.totalPerjalanan - b.totalPerjalanan || a.totalBiaya - b.totalBiaya);
    } else if (personnelSort === "cost_desc") {
      list.sort((a, b) => b.totalBiaya - a.totalBiaya);
    } else if (personnelSort === "cost_avg_desc") {
      list.sort((a, b) => b.rataRataBiaya - a.rataRataBiaya);
    } else if (personnelSort === "name_asc") {
      list.sort((a, b) => a.nama.localeCompare(b.nama));
    }

    return list;
  }, [personnelList, personnelSearch, personnelSort]);

  return (
    <>
      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {/* Mobile menu */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
      {sidebarOpen && <div className="sidebar-overlay show" onClick={() => setSidebarOpen(false)} />}

      <div className="app-layout">
        {/* ============================
            SIDEBAR
            ============================ */}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">✈️</div>
              <div className="sidebar-logo-text">
                <h2>REKAP PERJADIN</h2>
                <p>Subbagian TU Kepala • 2026</p>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {pages.map((p) => (
              <div
                key={p.key}
                className={`nav-item ${activePage === p.key ? "active" : ""}`}
                onClick={() => { setActivePage(p.key); setSidebarOpen(false); setSelectedGroup(null); }}
              >
                <span className="nav-item-icon">{p.icon}</span>
                {p.label}
              </div>
            ))}

            <div className="category-select" style={{ marginTop: 20 }}>
              <label>Kategori / Sheet</label>
              <select
                className="form-select"
                style={{ width: "100%", marginTop: 6 }}
                value={kategori}
                onChange={(e) => { setKategori(e.target.value); setSelectedGroup(null); }}
              >
                <option value="SEMUA">🌐 SEMUA KATEGORI (4 Sheet)</option>
                {categories.map((c) => <option key={c} value={c}>📁 {c}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  fontSize: "0.8rem",
                  padding: "9px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: "var(--radius-sm)",
                  cursor: syncing ? "not-allowed" : "pointer"
                }}
                onClick={handleSyncExcel}
                disabled={syncing}
                title="Muat ulang seluruh data langsung dari file Excel terbaru"
              >
                <span>{syncing ? "⏳" : "🔄"}</span>
                <span>{syncing ? "Menyelaraskan..." : "Sinkronkan Excel"}</span>
              </button>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: "0.72rem", color: "var(--text-dim)" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e" }} />
                <span>Auto-Sync Excel Aktif</span>
              </div>
            </div>
          </nav>

          <div className="sidebar-footer">
            {stats && (
              <div className="sidebar-stats">
                <div className="sidebar-stats-row"><span>Total Pelaksana</span><strong>{stats.totalRecords} orang</strong></div>
                <div className="sidebar-stats-row"><span>Surat Tugas</span><strong>{stats.totalSuratTugas} surat</strong></div>
                <div className="sidebar-stats-row"><span>Total Biaya</span><strong>{fmtShort(stats.totalBiaya)}</strong></div>
                <div className="sidebar-stats-row"><span>Status Valid</span><strong>{stats.validCount} data</strong></div>
                <div className="sidebar-stats-row"><span>Perlu Cek</span><strong>{stats.errorCount} data</strong></div>
              </div>
            )}
            <div className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <span>{theme === "dark" ? "🌙 Mode Gelap" : "☀️ Mode Terang"}</span>
              <div className={`toggle-switch ${theme === "dark" ? "on" : ""}`} />
            </div>
          </div>
        </aside>

        {/* ============================
            MAIN CONTENT
            ============================ */}
        <main className="main-content">

          {/* ===================== DASHBOARD ===================== */}
          {activePage === "dashboard" && (
            <>
              <div className="page-header animate-in">
                <h1>Monitoring Rekap Perjalanan Dinas</h1>
                <p>Dashboard realisasi anggaran, rincian biaya penugasan, dan pengawasan berbasis AI Validator ({kategori}).</p>
              </div>

              {stats && (
                <div className="metrics-grid">
                  <div className="metric-card animate-in accent">
                    <div className="metric-label">Total Penugasan</div>
                    <div className="metric-value">{stats.totalRecords}</div>
                    <div className="metric-sub">{stats.totalSuratTugas} Surat Tugas</div>
                  </div>
                  <div className="metric-card animate-in">
                    <div className="metric-label">Total Realisasi Biaya</div>
                    <div className="metric-value currency">{fmtShort(stats.totalBiaya)}</div>
                    <div className="metric-sub">Tahun Anggaran 2026</div>
                  </div>
                  <div className="metric-card animate-in">
                    <div className="metric-label">Validasi AI Sesuai</div>
                    <div className="metric-value">{stats.validCount}</div>
                    <div className="metric-sub">{stats.totalRecords > 0 ? ((stats.validCount / stats.totalRecords) * 100).toFixed(1) : 0}% terverifikasi</div>
                  </div>
                  <div className="metric-card animate-in">
                    <div className="metric-label">Perlu Konfirmasi AI</div>
                    <div className="metric-value">{stats.errorCount}</div>
                    <div className="metric-sub">Selisih rincian di dokumen</div>
                  </div>
                </div>
              )}

              {stats && (
                <>
                  <div className="charts-grid">
                    <div className="chart-card animate-in">
                      <h3>📈 Realisasi Pengeluaran per Bulan</h3>
                      {stats.biayaPerBulan?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={stats.biayaPerBulan.map((b) => ({ name: monthLabel(b.bulan), Total: b.total }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} />
                            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}Jt`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="Total" fill="#fbc253" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="empty-state"><div className="empty-state-text">Belum ada data tanggal</div></div>}
                    </div>

                    <div className="chart-card animate-in">
                      <h3>🧩 Komposisi Komponen Biaya</h3>
                      {stats.breakdownBiaya && (
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie
                              data={Object.entries(stats.breakdownBiaya).map(([k, v]) => ({ name: k, value: v }))}
                              innerRadius={60} outerRadius={95} paddingAngle={4}
                              dataKey="value"
                            >
                              {Object.keys(stats.breakdownBiaya).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v) => `Rp ${fmt(v)}`} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.82rem" }} />
                            <Legend wrapperStyle={{ fontSize: "0.78rem", color: "var(--text-muted)" }} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="charts-grid-half">
                    <div className="chart-card animate-in">
                      <h3>📍 Top 6 Kota Tujuan</h3>
                      {stats.topTujuan?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart layout="vertical" data={stats.topTujuan.map((t) => ({ name: t.tujuan, Frekuensi: t.cnt }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} />
                            <YAxis dataKey="name" type="category" width={140} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="Frekuensi" fill="#522e2e" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="empty-state"><div className="empty-state-text">Belum ada data tujuan</div></div>}
                    </div>

                    <div className="chart-card animate-in">
                      <h3>🛡️ Status Hasil Pengecekan AI</h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={[
                          { name: "Sesuai & Valid", value: stats.validCount },
                          { name: "Perlu Konfirmasi", value: stats.errorCount },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} />
                          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {/* Preview Table */}
              <div className="section-title"><span className="icon">📄</span> Data Rekap Terbaru</div>
              <div className="table-container animate-in">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No</th><th>Nama Pelaksana</th><th>Tujuan</th><th>No Surat Tugas</th>
                        <th>Mulai</th><th>Selesai</th><th>Total Biaya</th><th>Status AI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.slice(0, 15).map((r) => (
                        <tr key={r.id}>
                          <td>{r.no_urut}</td>
                          <td style={{ fontWeight: 500 }}>{r.nama_pelaksana}</td>
                          <td>{r.tujuan}</td>
                          <td style={{ fontSize: "0.75rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{r.no_surat_tugas_spd}</td>
                          <td>{r.tgl_mulai}</td><td>{r.tgl_selesai}</td>
                          <td className="currency">{fmt(r.nilai_total_biaya)}</td>
                          <td>{statusBadge(r.status_validasi_ai)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {records.length === 0 && <div className="empty-state"><div className="empty-state-icon">📭</div><div className="empty-state-text">Tidak ada data</div></div>}
                </div>
              </div>
            </>
          )}

          {/* ===================== KLASIFIKASI & MONITORING PERSONEL ===================== */}
          {activePage === "klasifikasi" && (
            <>
              <div className="page-header animate-in">
                <h1>Klasifikasi & Monitoring Perjalanan Dinas</h1>
                <p>
                  Pantau rombongan penugasan per Surat Tugas/SPD atau lakukan monitoring mendalam riwayat frekuensi dan total nominal perorangan ({kategori}).
                </p>
              </div>

              {/* Segmented Sub-Nav */}
              <div className="tab-pill-container animate-in">
                <button
                  type="button"
                  className={`tab-pill-btn ${klasifikasiTab === "personel" ? "active" : ""}`}
                  onClick={() => setKlasifikasiTab("personel")}
                >
                  <span>👤</span> Monitoring Personel (Per Orang)
                  <span
                    className="badge"
                    style={{
                      background: klasifikasiTab === "personel" ? "rgba(255,255,255,0.22)" : "var(--bg-elevated)",
                      color: klasifikasiTab === "personel" ? "#ffffff" : "var(--text-muted)",
                      fontSize: "0.72rem",
                      padding: "2px 7px",
                      borderRadius: 10,
                    }}
                  >
                    {personnelList.length} Orang
                  </span>
                </button>
                <button
                  type="button"
                  className={`tab-pill-btn ${klasifikasiTab === "surat" ? "active" : ""}`}
                  onClick={() => setKlasifikasiTab("surat")}
                >
                  <span>📂</span> Berdasarkan Surat Tugas & SPD
                  <span
                    className="badge"
                    style={{
                      background: klasifikasiTab === "surat" ? "rgba(255,255,255,0.22)" : "var(--bg-elevated)",
                      color: klasifikasiTab === "surat" ? "#ffffff" : "var(--text-muted)",
                      fontSize: "0.72rem",
                      padding: "2px 7px",
                      borderRadius: 10,
                    }}
                  >
                    {suratGroups.length} Rombongan
                  </span>
                </button>
              </div>

              {/* ================= SUB-TAB 1: MONITORING PERSONEL ================= */}
              {klasifikasiTab === "personel" && (
                <>
                  {/* Metric Summary Cards */}
                  <div className="metrics-grid">
                    <div className="metric-card animate-in accent">
                      <div className="metric-label">Total Personel Aktif</div>
                      <div className="metric-value">{personnelList.length}</div>
                      <div className="metric-sub">Pegawai & Pelaksana dinas</div>
                    </div>
                    <div className="metric-card animate-in">
                      <div className="metric-label">Total Perjalanan Terlaksana</div>
                      <div className="metric-value">{personnelList.reduce((a, p) => a + p.totalPerjalanan, 0)}</div>
                      <div className="metric-sub">Akumulasi penugasan orang</div>
                    </div>
                    <div className="metric-card animate-in">
                      <div className="metric-label">Rata-rata Frekuensi</div>
                      <div className="metric-value">
                        {personnelList.length > 0
                          ? (personnelList.reduce((a, p) => a + p.totalPerjalanan, 0) / personnelList.length).toFixed(1)
                          : 0}x
                      </div>
                      <div className="metric-sub">Perjalanan per personel</div>
                    </div>
                    <div className="metric-card animate-in">
                      <div className="metric-label">Total Realisasi Biaya</div>
                      <div className="metric-value currency">
                        {fmtShort(personnelList.reduce((a, p) => a + p.totalBiaya, 0))}
                      </div>
                      <div className="metric-sub">Nominal seluruh personel</div>
                    </div>
                  </div>

                  {/* Filter & Toolbar */}
                  <div className="table-toolbar animate-in" style={{ flexWrap: "wrap", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Cari nama personel, jabatan, atau tujuan..."
                        value={personnelSearch}
                        onChange={(e) => setPersonnelSearch(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        className="form-select"
                        value={personnelSort}
                        onChange={(e) => setPersonnelSort(e.target.value)}
                        style={{ fontSize: "0.82rem", minWidth: 210 }}
                      >
                        <option value="trips_desc">✈️ Frekuensi Terbanyak (Default)</option>
                        <option value="cost_desc">💰 Total Nominal Tertinggi</option>
                        <option value="cost_avg_desc">📊 Rata-rata Biaya Tertinggi</option>
                        <option value="name_asc">🔤 Nama Personel (A - Z)</option>
                        <option value="trips_asc">📉 Frekuensi Tersedikit</option>
                      </select>

                      <div style={{ display: "inline-flex", background: "var(--bg-app)", padding: 2, borderRadius: 8, border: "1px solid var(--border)" }}>
                        <button
                          type="button"
                          className={`view-mode-btn ${personnelViewMode === "cards" ? "active" : ""}`}
                          onClick={() => setPersonnelViewMode("cards")}
                          title="Tampilan Kartu Personel"
                        >
                          🎴 Kartu
                        </button>
                        <button
                          type="button"
                          className={`view-mode-btn ${personnelViewMode === "table" ? "active" : ""}`}
                          onClick={() => setPersonnelViewMode("table")}
                          title="Tampilan Tabel Ringkas"
                        >
                          📋 Tabel
                        </button>
                      </div>

                      <a
                        href={`/api/export?kategori=${encodeURIComponent(kategori)}`}
                        className="btn btn-secondary btn-sm"
                        style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                        download
                        title="Ekspor seluruh data personel ke Excel"
                      >
                        <span>📥</span> Ekspor Semua
                      </a>
                    </div>
                  </div>

                  {/* Showing count indicator */}
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 10, marginBottom: 12 }}>
                    Menampilkan <strong>{filteredPersonnel.length}</strong> dari <strong>{personnelList.length}</strong> personel terdaftar
                    {personnelSearch && (
                      <span> • Hasil pencarian: &quot;{personnelSearch}&quot;</span>
                    )}
                  </div>

                  {/* CARDS VIEW MODE */}
                  {personnelViewMode === "cards" && (
                    <div className="personnel-grid animate-in">
                      {filteredPersonnel.map((p) => {
                        const isExpanded = expandedPersonnelCards.has(p.nama);
                        return (
                          <div key={p.nama} className="personnel-card">
                            <div className="personnel-header">
                              <div className="personnel-avatar">{p.initials}</div>
                              <div className="personnel-info">
                                <div className="personnel-name" title={p.nama}>
                                  {p.nama}
                                </div>
                                <div className="personnel-role" title={p.jabatan || "Pelaksana Dinas"}>
                                  <span>{p.jabatan || "Pelaksana Dinas"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Main Statistics Row */}
                            <div className="personnel-stats-row">
                              <div className="personnel-stat-box">
                                <span className="personnel-stat-label">TOTAL PERJALANAN</span>
                                <span className="personnel-stat-val highlight">
                                  {p.totalPerjalanan}x <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-muted)" }}>Dinas</span>
                                </span>
                              </div>
                              <div className="personnel-stat-box">
                                <span className="personnel-stat-label">TOTAL NOMINAL UANG</span>
                                <span className="personnel-stat-val money" title={`Rp ${p.totalBiaya.toLocaleString("id-ID")}`}>
                                  Rp {fmt(p.totalBiaya)}
                                </span>
                              </div>
                            </div>

                            {/* Breakdown Chips */}
                            <div className="personnel-breakdown-row">
                              <span className="personnel-chip">
                                💼 UH: <strong>{fmtShort(p.totalUangHarian)}</strong>
                              </span>
                              <span className="personnel-chip">
                                🏨 Hotel: <strong>{fmtShort(p.totalHotel)}</strong>
                              </span>
                              <span className="personnel-chip">
                                ✈️ Trans: <strong>{fmtShort(p.totalTransport)}</strong>
                              </span>
                              <span className="personnel-chip">
                                📊 Avg: <strong>{fmtShort(p.rataRataBiaya)}/trip</strong>
                              </span>
                            </div>

                            {/* Destinations Preview */}
                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <span style={{ color: "var(--text-title)", fontWeight: 600 }}>📍 {p.daftarTujuan.length} Kota:</span>{" "}
                              {p.daftarTujuan.slice(0, 3).join(", ")}
                              {p.daftarTujuan.length > 3 && `, +${p.daftarTujuan.length - 3} lainnya`}
                            </div>

                            {/* Card Footer Actions */}
                            <div className="personnel-footer">
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ flex: 1, justifyContent: "center" }}
                                onClick={() => {
                                  setSelectedPersonModal(p);
                                  setPersonModalTripSearch("");
                                }}
                              >
                                👁️ Lihat Detail Riwayat ({p.totalPerjalanan})
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => toggleExpandPersonnelCard(p.nama)}
                                title={isExpanded ? "Tutup rincian cepat" : "Buka rincian cepat"}
                                style={{ padding: "6px 10px" }}
                              >
                                {isExpanded ? "▲" : "▼"}
                              </button>
                            </div>

                            {/* Inline Expandable Mini Table */}
                            {isExpanded && (
                              <div className="personnel-trips-preview animate-in">
                                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                                  Riwayat Perjalanan ({p.trips.length} Kegiatan)
                                </div>
                                {p.trips.map((trip, tIdx) => (
                                  <div key={trip.id || tIdx} className="personnel-trip-mini-row">
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                      <div style={{ fontWeight: 600, color: "var(--text-title)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        #{tIdx + 1}. 📍 {trip.tujuan}
                                      </div>
                                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                        {trip.tgl_mulai ? `${trip.tgl_mulai} • ` : ""}{trip.no_surat_tugas_spd}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                      <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.8rem" }}>
                                        Rp {fmt(trip.nilai_total_biaya)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TABLE VIEW MODE */}
                  {personnelViewMode === "table" && (
                    <div className="table-container animate-in">
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>No</th>
                              <th>Nama Personel</th>
                              <th>Jabatan</th>
                              <th style={{ textAlign: "center" }}>Frekuensi Dinas</th>
                              <th style={{ textAlign: "right" }}>Total Uang Harian</th>
                              <th style={{ textAlign: "right" }}>Total Hotel</th>
                              <th style={{ textAlign: "right" }}>Total Transport</th>
                              <th style={{ textAlign: "right" }}>Total Akumulasi Biaya</th>
                              <th style={{ textAlign: "center" }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPersonnel.map((p, i) => (
                              <tr key={p.nama}>
                                <td>{i + 1}</td>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div className="personnel-avatar" style={{ width: 34, height: 34, fontSize: "0.78rem" }}>
                                      {p.initials}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, color: "var(--text-title)" }}>{p.nama}</div>
                                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        📍 {p.daftarTujuan.length} Destinasi
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontSize: "0.82rem", fontWeight: 500 }}>{p.jabatan || "-"}</div>
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <span
                                    className="badge"
                                    style={{
                                      background: "var(--accent-muted)",
                                      color: "var(--accent)",
                                      fontWeight: 700,
                                      fontSize: "0.82rem",
                                      padding: "4px 10px",
                                    }}
                                  >
                                    {p.totalPerjalanan}x Dinas
                                  </span>
                                </td>
                                <td className="currency">{fmt(p.totalUangHarian)}</td>
                                <td className="currency">{fmt(p.totalHotel)}</td>
                                <td className="currency">{fmt(p.totalTransport)}</td>
                                <td className="currency" style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--success)" }}>
                                  Rp {fmt(p.totalBiaya)}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    style={{ fontSize: "0.76rem", padding: "5px 12px" }}
                                    onClick={() => {
                                      setSelectedPersonModal(p);
                                      setPersonModalTripSearch("");
                                    }}
                                  >
                                    👁️ Lihat Detail ({p.totalPerjalanan})
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {filteredPersonnel.length === 0 && (
                    <div className="empty-state">
                      <div className="empty-state-icon">👤</div>
                      <div className="empty-state-text">
                        Tidak ditemukan personel yang cocok dengan pencarian &quot;{personnelSearch}&quot;
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ================= SUB-TAB 2: BERDASARKAN SURAT TUGAS & SPD ================= */}
              {klasifikasiTab === "surat" && (
                <>
                  {suratGroups.length > 0 && (
                <>
                  <div className="metrics-grid">
                    <div className="metric-card animate-in accent">
                      <div className="metric-label">Total Kegiatan</div>
                      <div className="metric-value">{suratGroups.length}</div>
                      <div className="metric-sub">Rombongan penugasan</div>
                    </div>
                    <div className="metric-card animate-in">
                      <div className="metric-label">Total Personel</div>
                      <div className="metric-value">{suratGroups.reduce((a, g) => a + g.totalPelaksana, 0)}</div>
                      <div className="metric-sub">Orang Pelaksana</div>
                    </div>
                    <div className="metric-card animate-in">
                      <div className="metric-label">Rata-rata Anggota</div>
                      <div className="metric-value">{(suratGroups.reduce((a, g) => a + g.totalPelaksana, 0) / suratGroups.length).toFixed(1)}</div>
                      <div className="metric-sub">Personel per Surat Tugas</div>
                    </div>
                    <div className="metric-card animate-in">
                      <div className="metric-label">Total Realisasi</div>
                      <div className="metric-value currency">{fmtShort(suratGroups.reduce((a, g) => a + g.totalBiayaRombongan, 0))}</div>
                      <div className="metric-sub">Akumulasi seluruh rombongan</div>
                    </div>
                  </div>

                  <div className="section-title"><span className="icon">📑</span> Pilih Nomor Surat Tugas</div>
                  <div style={{ marginBottom: 20 }}>
                    <select
                      className="form-select"
                      style={{ width: "100%", maxWidth: 600 }}
                      value={selectedGroup?.groupKey || ""}
                      onChange={(e) => {
                        const g = suratGroups.find((x) => x.groupKey === e.target.value);
                        setSelectedGroup(g);
                      }}
                    >
                      {suratGroups.map((g) => (
                        <option key={g.groupKey} value={g.groupKey}>{g.displayLabel}</option>
                      ))}
                    </select>
                  </div>

                  {selectedGroup && (
                    <>
                      <div className="surat-card animate-in">
                        <div className="surat-card-header">
                          <div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>
                              NOMOR SURAT TUGAS & SPD
                            </div>
                            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-title)", marginTop: 4 }}>
                              {selectedGroup.noSuratTugasSpd}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <span className="badge" style={{
                              background: "var(--accent-muted)", color: "var(--accent)",
                              border: "1px solid var(--border)", padding: "6px 14px", fontSize: "0.82rem"
                            }}>
                              Kegiatan No. {selectedGroup.noUrut}
                            </span>
                            <a
                              href={`/api/export?suratTugas=${encodeURIComponent(selectedGroup.noSuratTugasSpd)}`}
                              className="btn btn-secondary btn-sm"
                              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem" }}
                              download
                              title="Unduh seluruh pelaksana surat tugas ini ke format Excel (.xlsx)"
                            >
                              <span>📥</span> Ekspor Excel
                            </a>
                          </div>
                        </div>
                        <div className="surat-card-meta">
                          <div><div className="meta-label">Kota Tujuan</div><div className="meta-value">📍 {selectedGroup.tujuan}</div></div>
                          <div><div className="meta-label">Periode Penugasan</div><div className="meta-value">📅 {selectedGroup.tglMulai} s/d {selectedGroup.tglSelesai}</div></div>
                          <div><div className="meta-label">Total Pelaksana</div><div className="meta-value">👥 {selectedGroup.totalPelaksana} Orang</div></div>
                          <div><div className="meta-label">Total Biaya Rombongan</div><div className="meta-value currency">💰 Rp {fmt(selectedGroup.totalBiayaRombongan)}</div></div>
                        </div>
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: "0.82rem" }}>
                          <span style={{ color: "var(--text-dim)" }}>Uraian:</span>{" "}
                          <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>&quot;{selectedGroup.uraianPenugasan || "-"}&quot;</span>
                        </div>
                        <div style={{ marginTop: 10, display: "flex", gap: 20, fontSize: "0.78rem", color: "var(--text-dim)", flexWrap: "wrap" }}>
                          <span>SP2D Nominal: <strong style={{ color: "var(--text-title)" }}>Rp {fmt(selectedGroup.sp2dNominal)}</strong></span>
                          <span>No SPM: <strong style={{ color: "var(--text-title)" }}>{selectedGroup.noSpm || "-"}</strong></span>
                          <span>Kode Akun: <strong style={{ color: "var(--text-title)" }}>{selectedGroup.kodeAkun || "-"}</strong></span>
                        </div>
                      </div>

                      <div className="section-title"><span className="icon">👥</span> Daftar Personel ({selectedGroup.totalPelaksana} Orang)</div>
                      <div className="table-container animate-in">
                        <div className="table-scroll">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>No</th><th>Nama</th><th>Jabatan</th>
                                <th>UH (Rp)</th><th>Hotel</th><th>Hotel (Rp)</th>
                                <th>Maskapai Pergi</th><th>Tiket Pergi</th>
                                <th>Maskapai Pulang</th><th>Tiket Pulang</th>
                                <th>DPR (Rp)</th><th>Total Biaya</th><th>Status AI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedGroup.pelaksanaList.map((p) => (
                                <tr key={p.id}>
                                  <td>{p.no_urut}</td>
                                  <td style={{ fontWeight: 500 }}>{p.nama_pelaksana}</td>
                                  <td>{p.jabatan}</td>
                                  <td className="currency">{fmt(p.uang_harian_diterima)}</td>
                                  <td>{p.nama_hotel}</td>
                                  <td className="currency">{fmt(p.nilai_hotel)}</td>
                                  <td>{p.berangkat_maskapai}</td>
                                  <td className="currency">{fmt(p.berangkat_nilai)}</td>
                                  <td>{p.pulang_maskapai}</td>
                                  <td className="currency">{fmt(p.pulang_nilai)}</td>
                                  <td className="currency">{fmt(p.dpr_nilai_transportasi)}</td>
                                  <td className="currency" style={{ fontWeight: 600 }}>{fmt(p.nilai_total_biaya)}</td>
                                  <td>{statusBadge(p.status_validasi_ai)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {suratGroups.length === 0 && (
                    <div className="empty-state"><div className="empty-state-icon">📭</div><div className="empty-state-text">Belum ada data untuk kategori ini</div></div>
                  )}
                </>
              )}
            </>
          )}

          {/* ===================== MONITORING ===================== */}
          {activePage === "monitoring" && (
            <>
              <div className="page-header animate-in">
                <h1>Data Lengkap Rekap Perjalanan Dinas</h1>
                <p>Pencarian personel, pemfilteran berdasarkan No Surat Tugas, dan inspeksi data ({kategori}).</p>
              </div>

              <div className="filter-bar animate-in">
                <input
                  className="form-input" style={{ flex: 2, minWidth: 240 }}
                  placeholder="🔍 Cari nama, tujuan, nomor surat, kode akun..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select className="form-select" style={{ minWidth: 200 }} value={stFilter} onChange={(e) => setStFilter(e.target.value)}>
                  <option value="SEMUA">Semua Surat Tugas</option>
                  {suratGroups.map((g) => <option key={g.groupKey} value={g.noSuratTugasSpd}>{g.noSuratTugasSpd}</option>)}
                </select>
                <select className="form-select" style={{ minWidth: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="SEMUA">Semua Status</option>
                  <option value="VALID">Valid</option>
                  <option value="ERROR">Error</option>
                </select>
                <select
                  className="form-select"
                  style={{ minWidth: 205 }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  title="Urutkan data berdasarkan waktu input atau kriteria lainnya"
                >
                  <option value="newest">🆕 Baru Saja Di-input (Terbaru)</option>
                  <option value="oldest">⏳ Lama Di-input (Terlama)</option>
                  <option value="date_desc">📅 Tanggal Kegiatan (Terbaru)</option>
                  <option value="date_asc">📅 Tanggal Kegiatan (Terlama)</option>
                  <option value="cost_desc">💰 Total Biaya Tertinggi</option>
                  <option value="cost_asc">💰 Total Biaya Terendah</option>
                </select>
                <a
                  href={`/api/export?kategori=${encodeURIComponent(kategori)}&suratTugas=${encodeURIComponent(stFilter)}`}
                  className="btn btn-secondary"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", padding: "8px 14px" }}
                  download
                  title="Unduh data terfilter ke format Excel (.xlsx)"
                >
                  <span>📥</span> Ekspor Excel
                </a>

                <div className="view-mode-toggle" style={{ marginLeft: "auto" }}>
                  <button
                    type="button"
                    className={`view-mode-btn ${monitoringViewMode === "grouped" ? "active" : ""}`}
                    onClick={() => setMonitoringViewMode("grouped")}
                    title="Gabung personel yang berada dalam No SPD yang sama"
                  >
                    <span>📦</span> Ringkas per No SPD ({groupedSpdList.length})
                  </button>
                  <button
                    type="button"
                    className={`view-mode-btn ${monitoringViewMode === "detailed" ? "active" : ""}`}
                    onClick={() => setMonitoringViewMode("detailed")}
                    title="Tampilkan seluruh baris perorangan"
                  >
                    <span>📄</span> Semua Baris ({records.length})
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  {monitoringViewMode === "grouped" ? (
                    <>
                      Menampilkan <strong style={{ color: "var(--text-title)" }}>{groupedSpdList.length}</strong> kegiatan SPD (<strong style={{ color: "var(--text-title)" }}>{records.length}</strong> total personel) | Total Nilai: <strong style={{ color: "var(--text-title)" }}>Rp {fmt(records.reduce((a, r) => a + (r.nilai_total_biaya || 0), 0))}</strong>
                    </>
                  ) : (
                    <>
                      Menampilkan <strong style={{ color: "var(--text-title)" }}>{records.length}</strong> data personel | Total Nilai: <strong style={{ color: "var(--text-title)" }}>Rp {fmt(records.reduce((a, r) => a + (r.nilai_total_biaya || 0), 0))}</strong>
                    </>
                  )}
                  <span style={{ marginLeft: 10, fontSize: "0.76rem", color: "var(--accent)" }}>
                    • Urutan: <strong>{sortBy === "newest" ? "🆕 Baru Saja Di-input" : sortBy === "oldest" ? "⏳ Lama Di-input" : sortBy === "date_desc" ? "📅 Tanggal Terbaru" : sortBy === "date_asc" ? "📅 Tanggal Terlama" : sortBy === "cost_desc" ? "💰 Biaya Tertinggi" : "💰 Biaya Terendah"}</strong>
                  </span>
                </div>
                {monitoringViewMode === "grouped" && (
                  <div style={{ fontSize: "0.76rem", color: "var(--text-dim)" }}>
                    💡 Klik tombol <strong>&quot;👁️ Lihat Detail&quot;</strong> atau <strong>&quot;▼&quot;</strong> untuk melihat rincian nama personel di dalam SPD
                  </div>
                )}
              </div>

              {/* TAMPILAN 1: GROUPED PER NO SPD (SIMPLIFIED & RINGKAS) */}
              {monitoringViewMode === "grouped" ? (
                <div className="table-container animate-in">
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th
                            style={{ width: 60, cursor: "pointer", userSelect: "none" }}
                            onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
                            title="Klik untuk ubah urutan input (Terbaru ⇄ Terlama)"
                          >
                            No {sortBy === "newest" ? "▼" : sortBy === "oldest" ? "▲" : ""}
                          </th>
                          <th>No Surat Tugas & SPD</th>
                          <th>Tujuan</th>
                          <th
                            style={{ cursor: "pointer", userSelect: "none" }}
                            onClick={() => setSortBy(sortBy === "date_desc" ? "date_asc" : "date_desc")}
                            title="Klik untuk ubah urutan tanggal kegiatan"
                          >
                            Periode {sortBy === "date_desc" ? "▼" : sortBy === "date_asc" ? "▲" : ""}
                          </th>
                          <th>Personel Tim</th>
                          <th
                            style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                            onClick={() => setSortBy(sortBy === "cost_desc" ? "cost_asc" : "cost_desc")}
                            title="Klik untuk ubah urutan total biaya"
                          >
                            Total Biaya SPD {sortBy === "cost_desc" ? "▼" : sortBy === "cost_asc" ? "▲" : ""}
                          </th>
                          <th>Status AI</th>
                          <th style={{ textAlign: "center", minWidth: 160 }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedSpdList.map((g, idx) => {
                          const isExpanded = expandedRows.has(g.key);
                          return (
                            <Fragment key={g.key}>
                              <tr style={{ background: isExpanded ? "var(--accent-muted)" : undefined }}>
                                <td><strong>#{g.no_urut || idx + 1}</strong></td>
                                <td>
                                  <div style={{ fontWeight: 600, color: "var(--text-title)", fontSize: "0.84rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }} title={g.no_surat_tugas_spd}>
                                    {g.no_surat_tugas_spd}
                                  </div>
                                  {g.uraian_penugasan && (
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={g.uraian_penugasan}>
                                      {g.uraian_penugasan}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div style={{ fontWeight: 500 }}>📍 {g.tujuan}</div>
                                </td>
                                <td>
                                  <div style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                                    📅 {g.tgl_mulai} s/d {g.tgl_selesai}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span className="badge" style={{ background: "var(--accent-muted)", color: "var(--accent)", fontWeight: 700 }}>
                                      👥 {g.pelaksanaList.length} Orang
                                    </span>
                                    <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.pelaksanaList.map(p => p.nama_pelaksana).join(", ")}>
                                      {g.pelaksanaList.map(p => p.nama_pelaksana).slice(0, 2).join(", ")}
                                      {g.pelaksanaList.length > 2 ? ` +${g.pelaksanaList.length - 2} lainnya` : ""}
                                    </span>
                                  </div>
                                </td>
                                <td className="currency" style={{ textAlign: "right", fontWeight: 700, color: "var(--text-title)", fontSize: "0.88rem" }}>
                                  Rp {fmt(g.totalBiaya)}
                                </td>
                                <td>
                                  {g.hasError ? (
                                    <span className="badge badge-error">❌ Ada Error</span>
                                  ) : g.hasWarning ? (
                                    <span className="badge badge-warning">⚠️ Cek</span>
                                  ) : (
                                    <span className="badge badge-valid">✅ Valid</span>
                                  )}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={() => setDetailModalKey(g.key)}
                                      title="Buka popup detail lengkap personel & biaya"
                                    >
                                      👁️ Lihat Detail ({g.pelaksanaList.length})
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={() => toggleExpandRow(g.key)}
                                      title={isExpanded ? "Tutup rincian baris" : "Lihat cepat di bawah"}
                                      style={{ padding: "6px 8px" }}
                                    >
                                      {isExpanded ? "▲" : "▼"}
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Inline Expandable Row */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={8} style={{ padding: 0 }}>
                                    <div className="expanded-row-box">
                                      <div className="expanded-meta">
                                        <div><span style={{ color: "var(--text-dim)" }}>Kegiatan:</span> <strong>{g.uraian_penugasan || "-"}</strong></div>
                                        <div><span style={{ color: "var(--text-dim)" }}>SP2D:</span> <strong>{g.sp2d_nomor || "-"}</strong> (Rp {fmt(g.sp2d_nominal)})</div>
                                        <div><span style={{ color: "var(--text-dim)" }}>Kode Akun:</span> <strong>{g.kode_akun || "-"}</strong></div>
                                        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                          <a
                                            href={`/api/export?suratTugas=${encodeURIComponent(g.no_surat_tugas_spd)}`}
                                            className="btn btn-sm"
                                            download
                                            title="Unduh data SPD ini ke Excel"
                                          >
                                            📥 Ekspor SPD Ini
                                          </a>
                                          <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => setDetailModalKey(g.key)}
                                          >
                                            🔍 Buka Modal Penuh
                                          </button>
                                        </div>
                                      </div>

                                      <table className="expanded-subtable">
                                        <thead>
                                          <tr>
                                            <th>No</th>
                                            <th>Nama Pelaksana</th>
                                            <th>Jabatan</th>
                                            <th style={{ textAlign: "right" }}>Uang Harian</th>
                                            <th style={{ textAlign: "right" }}>Hotel</th>
                                            <th style={{ textAlign: "right" }}>Tiket Berangkat</th>
                                            <th style={{ textAlign: "right" }}>Tiket Pulang</th>
                                            <th style={{ textAlign: "right" }}>DPR</th>
                                            <th style={{ textAlign: "right" }}>Total Biaya</th>
                                            <th>Status AI</th>
                                            <th style={{ textAlign: "center" }}>Hapus</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {g.pelaksanaList.map((p, pIdx) => (
                                            <tr key={p.id}>
                                              <td>{pIdx + 1}</td>
                                              <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{p.nama_pelaksana}</td>
                                              <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                {p.jabatan || "-"}
                                              </td>
                                              <td className="currency" style={{ textAlign: "right" }}>{fmt(p.uang_harian_diterima)}</td>
                                              <td className="currency" style={{ textAlign: "right" }}>
                                                <div>{fmt(p.nilai_hotel)}</div>
                                                {p.nama_hotel && <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>{p.nama_hotel}</div>}
                                              </td>
                                              <td className="currency" style={{ textAlign: "right" }}>
                                                <div>{fmt(p.berangkat_nilai)}</div>
                                                {p.berangkat_maskapai && <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>{p.berangkat_maskapai}</div>}
                                              </td>
                                              <td className="currency" style={{ textAlign: "right" }}>
                                                <div>{fmt(p.pulang_nilai)}</div>
                                                {p.pulang_maskapai && <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>{p.pulang_maskapai}</div>}
                                              </td>
                                              <td className="currency" style={{ textAlign: "right" }}>{fmt(p.dpr_nilai_transportasi)}</td>
                                              <td className="currency" style={{ textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>
                                                {fmt(p.nilai_total_biaya)}
                                              </td>
                                              <td>{statusBadge(p.status_validasi_ai)}</td>
                                              <td style={{ textAlign: "center" }}>
                                                <button
                                                  className="btn btn-danger btn-sm"
                                                  style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                                                  onClick={() => deleteRec(p.id)}
                                                  title="Hapus record personel ini"
                                                >
                                                  🗑️
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    {groupedSpdList.length === 0 && (
                      <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <div className="empty-state-text">Tidak ada kegiatan SPD yang cocok</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* TAMPILAN 2: SEMUA BARIS PERSONEL (DETAILED ROW VIEW) */
                <div className="table-container animate-in">
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th
                            style={{ cursor: "pointer", userSelect: "none" }}
                            onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
                            title="Klik untuk ubah urutan ID input (Terbaru ⇄ Terlama)"
                          >
                            ID {sortBy === "newest" ? "▼" : sortBy === "oldest" ? "▲" : ""}
                          </th>
                          <th>No</th><th>Nama</th><th>Jabatan</th><th>Tujuan</th>
                          <th>No SPD</th>
                          <th
                            style={{ cursor: "pointer", userSelect: "none" }}
                            onClick={() => setSortBy(sortBy === "date_desc" ? "date_asc" : "date_desc")}
                            title="Klik untuk ubah urutan tanggal kegiatan"
                          >
                            Mulai {sortBy === "date_desc" ? "▼" : sortBy === "date_asc" ? "▲" : ""}
                          </th>
                          <th>Selesai</th>
                          <th>UH</th><th>Hotel</th><th>Tiket Pergi</th><th>Tiket Pulang</th>
                          <th>DPR</th>
                          <th
                            style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                            onClick={() => setSortBy(sortBy === "cost_desc" ? "cost_asc" : "cost_desc")}
                            title="Klik untuk ubah urutan total biaya"
                          >
                            Total Biaya {sortBy === "cost_desc" ? "▼" : sortBy === "cost_asc" ? "▲" : ""}
                          </th>
                          <th>Status AI</th><th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r.id}>
                            <td>#{r.id}</td>
                            <td>{r.no_urut}</td>
                            <td style={{ fontWeight: 500, minWidth: 150 }}>{r.nama_pelaksana}</td>
                            <td style={{ fontSize: "0.75rem" }}>{r.jabatan}</td>
                            <td>{r.tujuan}</td>
                            <td style={{ fontSize: "0.72rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r.no_surat_tugas_spd}</td>
                            <td style={{ fontSize: "0.75rem" }}>{r.tgl_mulai}</td>
                            <td style={{ fontSize: "0.75rem" }}>{r.tgl_selesai}</td>
                            <td className="currency">{fmt(r.uang_harian_diterima)}</td>
                            <td className="currency">{fmt(r.nilai_hotel)}</td>
                            <td className="currency">{fmt(r.berangkat_nilai)}</td>
                            <td className="currency">{fmt(r.pulang_nilai)}</td>
                            <td className="currency">{fmt(r.dpr_nilai_transportasi)}</td>
                            <td className="currency" style={{ fontWeight: 600 }}>{fmt(r.nilai_total_biaya)}</td>
                            <td>{statusBadge(r.status_validasi_ai)}</td>
                            <td>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteRec(r.id)}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {records.length === 0 && <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-text">Tidak ada data yang cocok</div></div>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===================== INPUT DATA ===================== */}
          {activePage === "input" && (
            <>
              <div className="page-header animate-in">
                <h1>Input Data Rekap Perjalanan Dinas</h1>
                <p>Form input lengkap terstruktur sesuai format dokumen Excel Rekap Perjadin ({kategori}).</p>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 20 }} className="animate-in">
                <button className="btn" onClick={() => setFormData(getEmptyForm())}>🧹 Kosongkan Form</button>
              </div>

              <div className="tabs animate-in">
                {formTabs.map((t, i) => (
                  <button key={i} className={`tab-item ${formTab === i ? "active" : ""}`} onClick={() => setFormTab(i)}>{t}</button>
                ))}
              </div>

              <div className="chart-card animate-in" style={{ padding: 28 }}>
                {/* Tab 0: Personel & Tugas */}
                {formTab === 0 && (
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">Nomor Urut</label><input className="form-input" value={formData.no_urut} onChange={(e) => updateForm("no_urut", e.target.value)} placeholder="1" /></div>
                    <div className="form-group"><label className="form-label">Nama Pelaksana *</label><input className="form-input" value={formData.nama_pelaksana} onChange={(e) => updateForm("nama_pelaksana", e.target.value)} placeholder="Nama lengkap & gelar" /></div>
                    <div className="form-group"><label className="form-label">Pangkat / Golongan</label><input className="form-input" value={formData.pangkat_golongan} onChange={(e) => updateForm("pangkat_golongan", e.target.value)} placeholder="Contoh: III/c" /></div>
                    <div className="form-group"><label className="form-label">Jabatan</label><input className="form-input" value={formData.jabatan} onChange={(e) => updateForm("jabatan", e.target.value)} placeholder="Ajudan Kepala Badan" /></div>
                    <div className="form-group"><label className="form-label">Tujuan Penugasan *</label><input className="form-input" value={formData.tujuan} onChange={(e) => updateForm("tujuan", e.target.value)} placeholder="Kalimantan Utara" /></div>
                    <div className="form-group"><label className="form-label">No Surat Tugas & SPD</label><input className="form-input" value={formData.no_surat_tugas_spd} onChange={(e) => updateForm("no_surat_tugas_spd", e.target.value)} placeholder="12853/RT.04.01/B.2/8/2026" /></div>
                    <div className="form-group"><label className="form-label">Tanggal Mulai</label><input className="form-input" type="date" value={formData.tgl_mulai} onChange={(e) => updateForm("tgl_mulai", e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Tanggal Selesai</label><input className="form-input" type="date" value={formData.tgl_selesai} onChange={(e) => updateForm("tgl_selesai", e.target.value)} /></div>
                    <div className="form-group full"><label className="form-label">Uraian Penugasan</label><textarea className="form-textarea" value={formData.uraian_penugasan} onChange={(e) => updateForm("uraian_penugasan", e.target.value)} placeholder="Uraian kegiatan atau pendampingan pimpinan..." /></div>
                  </div>
                )}

                {/* Tab 1: Uang Harian */}
                {formTab === 1 && (
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">Tarif Uang Harian / Hari (Rp)</label><input className="form-input" type="number" value={formData.tarif_uang_harian} onChange={(e) => updateForm("tarif_uang_harian", Number(e.target.value))} /></div>
                    <div className="form-group"><label className="form-label">Uang Harian Diterima (Rp) *</label><input className="form-input" type="number" value={formData.uang_harian_diterima} onChange={(e) => updateForm("uang_harian_diterima", Number(e.target.value))} /></div>
                    <div className="form-group"><label className="form-label">Tarif Representative / Hari (Rp)</label><input className="form-input" type="number" value={formData.uang_representative_tarif} onChange={(e) => updateForm("uang_representative_tarif", Number(e.target.value))} /></div>
                    <div className="form-group"><label className="form-label">Uang Representative Diterima (Rp)</label><input className="form-input" type="number" value={formData.uang_representative_diterima} onChange={(e) => updateForm("uang_representative_diterima", Number(e.target.value))} /></div>
                  </div>
                )}

                {/* Tab 2: Hotel */}
                {formTab === 2 && (
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">Nama Hotel</label><input className="form-input" value={formData.nama_hotel} onChange={(e) => updateForm("nama_hotel", e.target.value)} placeholder="Swiss-Belhotel" /></div>
                    <div className="form-group"><label className="form-label">Lama Menginap (Malam)</label><input className="form-input" type="number" value={formData.lama_menginap} onChange={(e) => updateForm("lama_menginap", Number(e.target.value))} /></div>
                    <div className="form-group"><label className="form-label">Nilai Hotel (Rp)</label><input className="form-input" type="number" value={formData.nilai_hotel} onChange={(e) => updateForm("nilai_hotel", Number(e.target.value))} /></div>
                  </div>
                )}

                {/* Tab 3: Transportasi */}
                {formTab === 3 && (
                  <>
                    <div className="section-title" style={{ marginTop: 0 }}><span className="icon">🛫</span> Transportasi Keberangkatan</div>
                    <div className="form-grid" style={{ marginBottom: 24 }}>
                      <div className="form-group"><label className="form-label">Penyedia Jasa (Pergi)</label><input className="form-input" value={formData.berangkat_penyedia_jasa} onChange={(e) => updateForm("berangkat_penyedia_jasa", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Maskapai (Pergi)</label><input className="form-input" value={formData.berangkat_maskapai} onChange={(e) => updateForm("berangkat_maskapai", e.target.value)} placeholder="Lion Air / Batik Air" /></div>
                      <div className="form-group"><label className="form-label">Nomor Tiket (Pergi)</label><input className="form-input" value={formData.berangkat_nomor_tiket} onChange={(e) => updateForm("berangkat_nomor_tiket", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Kode Booking (Pergi)</label><input className="form-input" value={formData.berangkat_kode_booking} onChange={(e) => updateForm("berangkat_kode_booking", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Tanggal Berangkat</label><input className="form-input" type="date" value={formData.berangkat_tanggal} onChange={(e) => updateForm("berangkat_tanggal", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Nilai Tiket Berangkat (Rp)</label><input className="form-input" type="number" value={formData.berangkat_nilai} onChange={(e) => updateForm("berangkat_nilai", Number(e.target.value))} /></div>
                    </div>
                    <div className="section-title"><span className="icon">🛬</span> Transportasi Kepulangan</div>
                    <div className="form-grid">
                      <div className="form-group"><label className="form-label">Penyedia Jasa (Pulang)</label><input className="form-input" value={formData.pulang_penyedia_jasa} onChange={(e) => updateForm("pulang_penyedia_jasa", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Maskapai (Pulang)</label><input className="form-input" value={formData.pulang_maskapai} onChange={(e) => updateForm("pulang_maskapai", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Nomor Tiket (Pulang)</label><input className="form-input" value={formData.pulang_nomor_tiket} onChange={(e) => updateForm("pulang_nomor_tiket", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Kode Booking (Pulang)</label><input className="form-input" value={formData.pulang_kode_booking} onChange={(e) => updateForm("pulang_kode_booking", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Tanggal Pulang</label><input className="form-input" type="date" value={formData.pulang_tanggal} onChange={(e) => updateForm("pulang_tanggal", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Nilai Tiket Pulang (Rp)</label><input className="form-input" type="number" value={formData.pulang_nilai} onChange={(e) => updateForm("pulang_nilai", Number(e.target.value))} /></div>
                    </div>
                  </>
                )}

                {/* Tab 4: DPR */}
                {formTab === 4 && (
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">Nilai Transportasi DPR (Lump Sum)</label><input className="form-input" type="number" value={formData.dpr_nilai_transportasi} onChange={(e) => updateForm("dpr_nilai_transportasi", Number(e.target.value))} /></div>
                    <div className="form-group"><label className="form-label">Nilai Hotel DPR</label><input className="form-input" type="number" value={formData.dpr_nilai_hotel} onChange={(e) => updateForm("dpr_nilai_hotel", Number(e.target.value))} /></div>
                    <div className="form-group"><label className="form-label">Nilai Taksi DPR</label><input className="form-input" type="number" value={formData.dpr_nilai_taksi} onChange={(e) => updateForm("dpr_nilai_taksi", Number(e.target.value))} /></div>
                    <div className="form-group"><label className="form-label">Keterangan Penggunaan DPR</label><input className="form-input" value={formData.dpr_keterangan} onChange={(e) => updateForm("dpr_keterangan", e.target.value)} placeholder="LUMP SUM" /></div>
                  </div>
                )}

                {/* Tab 5: Total & Dokumen */}
                {formTab === 5 && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Total Biaya (Auto)</label>
                      <div className="form-input" style={{ background: "var(--accent-muted)", fontWeight: 700, color: "var(--accent)", fontSize: "1.1rem" }}>
                        Rp {fmt(
                          Number(formData.uang_harian_diterima) + Number(formData.uang_representative_diterima) +
                          Number(formData.nilai_hotel) + Number(formData.berangkat_nilai) + Number(formData.pulang_nilai) +
                          Number(formData.dpr_nilai_hotel) + Number(formData.dpr_nilai_transportasi) + Number(formData.dpr_nilai_taksi)
                        )}
                      </div>
                    </div>
                    <div className="form-group"><label className="form-label">Nomor SP2D</label><input className="form-input" value={formData.sp2d_nomor} onChange={(e) => updateForm("sp2d_nomor", e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Tanggal SP2D</label><input className="form-input" type="date" value={formData.sp2d_tanggal} onChange={(e) => updateForm("sp2d_tanggal", e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Nominal SP2D (Rp)</label><input className="form-input" type="number" value={formData.sp2d_nominal} onChange={(e) => updateForm("sp2d_nominal", Number(e.target.value))} /></div>
                    <div className="form-group"><label className="form-label">Pengembalian SP2D (Rp)</label><input className="form-input" type="number" value={formData.sp2d_pengembalian} onChange={(e) => updateForm("sp2d_pengembalian", Number(e.target.value))} /></div>
                    <div className="form-group"><label className="form-label">Nomor SPM</label><input className="form-input" value={formData.no_spm} onChange={(e) => updateForm("no_spm", e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Link Dokumen SPJ</label><input className="form-input" value={formData.link_dokumen_spj} onChange={(e) => updateForm("link_dokumen_spj", e.target.value)} /></div>
                    <div className="form-group">
                      <label className="form-label">Kode Akun Anggaran</label>
                      <select className="form-select" value={formData.kode_akun} onChange={(e) => updateForm("kode_akun", e.target.value)}>
                        <option value="6999.EBA.994.002.AA.524111">6999.EBA.994.002.AA.524111</option>
                        <option value="7003.QIA.601.631.BA.524111">7003.QIA.601.631.BA.524111</option>
                        <option value="7003.QIA.601.631.BA.524112">7003.QIA.601.631.BA.524112</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "flex-end" }} className="animate-in">
                {formTab > 0 && <button className="btn" onClick={() => setFormTab(formTab - 1)}>← Sebelumnya</button>}
                {formTab < formTabs.length - 1 && <button className="btn" onClick={() => setFormTab(formTab + 1)}>Selanjutnya →</button>}
                {formTab === formTabs.length - 1 && (
                  <button className="btn btn-primary" onClick={submitForm}>💾 Simpan & Jalankan AI Validator</button>
                )}
              </div>
            </>
          )}

          {/* ===================== AI VALIDATOR ===================== */}
          {activePage === "validator" && (
            <>
              <div className="page-header animate-in">
                <h1>AI Auditor & Quality Assurance Perjadin</h1>
                <p>Pendeteksi otomatis ketidaksesuaian angka, typo nama, logika tanggal, dan audit rincian biaya ({kategori}).</p>
              </div>

              {stats && (
                <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div className="metric-card animate-in">
                    <div className="metric-label">Total Dokumen Diaudit</div>
                    <div className="metric-value">{records.length}</div>
                    <div className="metric-sub">Seluruh baris transaksi</div>
                  </div>
                  <div className="metric-card animate-in">
                    <div className="metric-label">Temuan Anomali AI</div>
                    <div className="metric-value" style={{ color: "var(--error)" }}>{errorRecords.length}</div>
                    <div className="metric-sub">Perlu konfirmasi bendahara</div>
                  </div>
                  <div className="metric-card animate-in">
                    <div className="metric-label">Tingkat Keselarasan</div>
                    <div className="metric-value" style={{ color: "var(--success)" }}>
                      {records.length > 0 ? (((records.length - errorRecords.length) / records.length) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="metric-sub">Kesesuaian rincian vs total</div>
                  </div>
                </div>
              )}

              <div className="section-title"><span className="icon">⚠️</span> Dokumen dengan Ketidaksesuaian</div>
              {errorRecords.length > 0 ? (
                errorRecords.map((r) => (
                  <ErrorAccordion key={r.id} record={r} />
                ))
              ) : (
                <div className="chart-card animate-in" style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎉</div>
                  <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--success)", marginBottom: 6 }}>
                    Luar biasa! Semua data valid.
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Seluruh data transaksi perjalanan dinas telah sesuai dan terverifikasi oleh AI Checker.
                  </div>
                </div>
              )}
            </>
          )}

          {loading && (
            <div className="loading-container">
              <div className="loading-spinner" />
              <div className="loading-text">Memuat data...</div>
            </div>
          )}
        </main>
      </div>

      {/* ===================== MODAL DETAIL SPD ===================== */}
      {detailModalGroup && (
        <div className="modal-overlay" onClick={() => setDetailModalKey(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2><span>📋</span> Detail Rombongan Perjalanan Dinas</h2>
                <div style={{ fontSize: "0.82rem", color: "var(--accent)", fontWeight: 600, marginTop: 4 }}>
                  No Surat Tugas & SPD: {detailModalGroup.no_surat_tugas_spd}
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDetailModalKey(null)}
                title="Tutup (ESC)"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Info Cards Grid */}
              <div className="modal-info-grid">
                <div className="modal-info-card">
                  <div className="label">📍 Tujuan & Periode</div>
                  <div className="value">{detailModalGroup.tujuan}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                    📅 {detailModalGroup.tgl_mulai} s/d {detailModalGroup.tgl_selesai}
                  </div>
                </div>
                <div className="modal-info-card">
                  <div className="label">👥 Jumlah Personel</div>
                  <div className="value" style={{ color: "var(--accent)" }}>{detailModalGroup.pelaksanaList.length} Orang</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Kategori: {detailModalGroup.kategori || "-"} • No. Urut #{detailModalGroup.no_urut || "-"}
                  </div>
                </div>
                <div className="modal-info-card">
                  <div className="label">💰 Total Biaya SPD</div>
                  <div className="value currency" style={{ color: "var(--text-title)" }}>Rp {fmt(detailModalGroup.totalBiaya)}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Akumulasi seluruh anggota
                  </div>
                </div>
                <div className="modal-info-card">
                  <div className="label">🏛️ Realisasi SP2D</div>
                  <div className="value" style={{ fontSize: "0.85rem" }}>{detailModalGroup.sp2d_nomor || "-"}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Nominal: Rp {fmt(detailModalGroup.sp2d_nominal)} • SPM: {detailModalGroup.no_spm || "-"}
                  </div>
                </div>
              </div>

              {/* Cost Chips */}
              <div className="modal-cost-chips">
                <div className="cost-chip">
                  <span className="chip-label">💵 Total Uang Harian:</span>
                  <span className="chip-val currency">Rp {fmt(detailModalGroup.totalUangHarian)}</span>
                </div>
                <div className="cost-chip">
                  <span className="chip-label">🏨 Total Penginapan:</span>
                  <span className="chip-val currency">Rp {fmt(detailModalGroup.totalHotel)}</span>
                </div>
                <div className="cost-chip">
                  <span className="chip-label">✈️ Total Transportasi:</span>
                  <span className="chip-val currency">Rp {fmt(detailModalGroup.totalTransport)}</span>
                </div>
                <div className="cost-chip">
                  <span className="chip-label">🚕 Total DPR / Taksi:</span>
                  <span className="chip-val currency">Rp {fmt(detailModalGroup.totalDpr)}</span>
                </div>
              </div>

              {detailModalGroup.uraian_penugasan && (
                <div style={{ marginBottom: 20, padding: "12px 16px", background: "var(--bg-elevated)", borderRadius: 8, fontSize: "0.82rem", borderLeft: "3px solid var(--accent)" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-title)" }}>Uraian Penugasan: </span>
                  <span style={{ color: "var(--text-muted)" }}>{detailModalGroup.uraian_penugasan}</span>
                </div>
              )}

              {/* Sub Table */}
              <div className="section-title" style={{ fontSize: "0.92rem", marginBottom: 12 }}>
                <span className="icon">👥</span> Personel yang Ditugaskan ({detailModalGroup.pelaksanaList.length} Orang)
              </div>
              <div className="table-container" style={{ margin: 0 }}>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Nama Pelaksana</th>
                        <th>Jabatan</th>
                        <th style={{ textAlign: "right" }}>Uang Harian</th>
                        <th style={{ textAlign: "right" }}>Hotel</th>
                        <th style={{ textAlign: "right" }}>Tiket Berangkat</th>
                        <th style={{ textAlign: "right" }}>Tiket Pulang</th>
                        <th style={{ textAlign: "right" }}>DPR</th>
                        <th style={{ textAlign: "right" }}>Total Biaya</th>
                        <th>Status AI</th>
                        <th style={{ textAlign: "center" }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailModalGroup.pelaksanaList.map((p, idx) => (
                        <tr key={p.id}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: "var(--text-title)", minWidth: 160 }}>
                            {p.nama_pelaksana}
                          </td>
                          <td style={{ fontSize: "0.78rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }} title={p.jabatan}>
                            {p.jabatan || "-"}
                          </td>
                          <td className="currency" style={{ textAlign: "right" }}>{fmt(p.uang_harian_diterima)}</td>
                          <td className="currency" style={{ textAlign: "right" }}>
                            <div>{fmt(p.nilai_hotel)}</div>
                            {p.nama_hotel && <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{p.nama_hotel}</div>}
                          </td>
                          <td className="currency" style={{ textAlign: "right" }}>
                            <div>{fmt(p.berangkat_nilai)}</div>
                            {p.berangkat_maskapai && <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{p.berangkat_maskapai}</div>}
                          </td>
                          <td className="currency" style={{ textAlign: "right" }}>
                            <div>{fmt(p.pulang_nilai)}</div>
                            {p.pulang_maskapai && <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{p.pulang_maskapai}</div>}
                          </td>
                          <td className="currency" style={{ textAlign: "right" }}>{fmt(p.dpr_nilai_transportasi)}</td>
                          <td className="currency" style={{ textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>
                            {fmt(p.nilai_total_biaya)}
                          </td>
                          <td>{statusBadge(p.status_validasi_ai)}</td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => deleteRec(p.id)}
                              title="Hapus personel ini dari penugasan"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                Kode Akun: <strong style={{ color: "var(--text-muted)" }}>{detailModalGroup.kode_akun || "-"}</strong>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  href={`/api/export?suratTugas=${encodeURIComponent(detailModalGroup.no_surat_tugas_spd)}`}
                  className="btn btn-secondary btn-sm"
                  download
                  title="Unduh seluruh personel surat tugas ini ke format Excel (.xlsx)"
                >
                  📥 Ekspor Excel Tim Ini
                </a>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setDetailModalKey(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL DETAIL MONITORING PERSONEL ===================== */}
      {selectedPersonModal && (
        <div className="modal-overlay" onClick={() => setSelectedPersonModal(null)}>
          <div className="modal-container" style={{ maxWidth: 1100 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="personnel-avatar" style={{ width: 50, height: 50, fontSize: "1.1rem" }}>
                  {selectedPersonModal.initials}
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", margin: 0 }}>
                    {selectedPersonModal.nama}
                  </h2>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 3 }}>
                    <span>{selectedPersonModal.jabatan || "Pelaksana Dinas"}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedPersonModal(null)}
                title="Tutup (ESC)"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Summary Metrics Grid */}
              <div className="modal-info-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 20 }}>
                <div className="modal-info-card">
                  <div className="label">✈️ Total Frekuensi Dinas</div>
                  <div className="value" style={{ color: "var(--accent)" }}>
                    {selectedPersonModal.totalPerjalanan}x Perjalanan
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>
                    📍 {selectedPersonModal.daftarTujuan.length} Kota tujuan berbeda
                  </div>
                </div>

                <div className="modal-info-card">
                  <div className="label">💰 Total Nominal Uang</div>
                  <div className="value currency" style={{ color: "var(--success)" }}>
                    Rp {fmt(selectedPersonModal.totalBiaya)}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Akumulasi seluruh kegiatan
                  </div>
                </div>

                <div className="modal-info-card">
                  <div className="label">💼 Total Uang Harian</div>
                  <div className="value currency">
                    Rp {fmt(selectedPersonModal.totalUangHarian)}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Uang saku penugasan
                  </div>
                </div>

                <div className="modal-info-card">
                  <div className="label">🏨 Total Akomodasi Hotel</div>
                  <div className="value currency">
                    Rp {fmt(selectedPersonModal.totalHotel)}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Biaya penginapan dinas
                  </div>
                </div>

                <div className="modal-info-card">
                  <div className="label">✈️ Tiket & Transportasi</div>
                  <div className="value currency">
                    Rp {fmt(selectedPersonModal.totalTransport)}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Pesawat, kereta, taksi & transpor
                  </div>
                </div>
              </div>

              {/* Search Toolbar for Trips */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div className="section-title" style={{ margin: 0 }}>
                  <span className="icon">📋</span> Riwayat Seluruh Perjalanan Dinas ({selectedPersonModal.trips.length} Kegiatan)
                </div>
                <div style={{ minWidth: 260 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Filter tujuan, no surat tugas, tanggal..."
                    value={personModalTripSearch}
                    onChange={(e) => setPersonModalTripSearch(e.target.value)}
                    style={{ fontSize: "0.8rem", padding: "6px 12px", width: "100%" }}
                  />
                </div>
              </div>

              {/* Scrollable Trips Table */}
              <div className="table-container" style={{ margin: 0 }}>
                <div className="table-scroll" style={{ maxHeight: 420 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>No Surat Tugas & SPD</th>
                        <th>Kota Tujuan</th>
                        <th>Periode Dinas</th>
                        <th>Uraian Kegiatan</th>
                        <th style={{ textAlign: "right" }}>Uang Harian</th>
                        <th style={{ textAlign: "right" }}>Hotel / Akomodasi</th>
                        <th style={{ textAlign: "right" }}>Tiket & Transport</th>
                        <th style={{ textAlign: "right" }}>Nominal Perjalanan</th>
                        <th style={{ textAlign: "center" }}>Status AI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPersonModal.trips
                        .filter((t) => {
                          if (!personModalTripSearch.trim()) return true;
                          const q = personModalTripSearch.trim().toLowerCase();
                          return (
                            t.tujuan.toLowerCase().includes(q) ||
                            t.no_surat_tugas_spd.toLowerCase().includes(q) ||
                            (t.uraian_penugasan && t.uraian_penugasan.toLowerCase().includes(q)) ||
                            (t.tgl_mulai && t.tgl_mulai.toLowerCase().includes(q))
                          );
                        })
                        .map((t, idx) => (
                          <tr key={t.id || idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: "0.82rem",
                                  color: "var(--text-title)",
                                  maxWidth: 180,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={t.no_surat_tugas_spd}
                              >
                                {t.no_surat_tugas_spd}
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                                {t.kategori || "-"}
                              </div>
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: "var(--bg-elevated)",
                                  color: "var(--text-primary)",
                                  fontWeight: 600,
                                  fontSize: "0.78rem",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                📍 {t.tujuan}
                              </span>
                            </td>
                            <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                              <div>📅 {t.tgl_mulai || "-"}</div>
                              {t.tgl_selesai && t.tgl_selesai !== t.tgl_mulai && (
                                <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                                  s/d {t.tgl_selesai}
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: "0.76rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }} title={t.uraian_penugasan}>
                              {t.uraian_penugasan || "-"}
                            </td>
                            <td className="currency" style={{ textAlign: "right" }}>
                              {fmt(t.uang_harian_diterima)}
                            </td>
                            <td className="currency" style={{ textAlign: "right" }}>
                              <div>{fmt(t.nilai_hotel)}</div>
                              {t.nama_hotel && t.nama_hotel !== "-" && (
                                <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }} title={t.nama_hotel}>
                                  {t.nama_hotel}
                                </div>
                              )}
                            </td>
                            <td className="currency" style={{ textAlign: "right" }}>
                              <div>{fmt(t.berangkat_nilai + t.pulang_nilai + t.berangkat_taksi_nilai + t.pulang_taksi_nilai + t.dpr_nilai_transportasi)}</div>
                              {t.berangkat_maskapai && t.berangkat_maskapai !== "-" && (
                                <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }} title={t.berangkat_maskapai}>
                                  ✈️ {t.berangkat_maskapai}
                                </div>
                              )}
                            </td>
                            <td className="currency" style={{ textAlign: "right", fontWeight: 700, fontSize: "0.9rem", color: "var(--accent)" }}>
                              Rp {fmt(t.nilai_total_biaya)}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {statusBadge(t.status_validasi_ai)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--bg-input)", fontWeight: 700 }}>
                        <td colSpan={5} style={{ textAlign: "right", padding: "12px 14px", color: "var(--text-title)" }}>
                          TOTAL AKUMULASI SELURUH PERJALANAN DINAS:
                        </td>
                        <td className="currency" style={{ textAlign: "right", color: "var(--text-title)" }}>
                          Rp {fmt(selectedPersonModal.totalUangHarian)}
                        </td>
                        <td className="currency" style={{ textAlign: "right", color: "var(--text-title)" }}>
                          Rp {fmt(selectedPersonModal.totalHotel)}
                        </td>
                        <td className="currency" style={{ textAlign: "right", color: "var(--text-title)" }}>
                          Rp {fmt(selectedPersonModal.totalTransport)}
                        </td>
                        <td className="currency" style={{ textAlign: "right", color: "var(--success)", fontSize: "1.05rem" }}>
                          Rp {fmt(selectedPersonModal.totalBiaya)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge badge-valid">Semua Valid</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Total <strong>{selectedPersonModal.totalPerjalanan}</strong> kegiatan penugasan • Akumulasi: <strong style={{ color: "var(--success)" }}>Rp {fmt(selectedPersonModal.totalBiaya)}</strong>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  href={`/api/export?nama=${encodeURIComponent(selectedPersonModal.nama)}`}
                  className="btn btn-secondary btn-sm"
                  download
                  title="Unduh seluruh riwayat perjalanan personel ini ke format Excel (.xlsx)"
                >
                  <span>📥</span> Ekspor Riwayat Excel
                </a>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setSelectedPersonModal(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================
// ERROR ACCORDION COMPONENT
// ============================
function ErrorAccordion({ record }) {
  const [open, setOpen] = useState(false);
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    if (open && !validation) {
      fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      })
        .then((r) => r.json())
        .then(setValidation);
    }
  }, [open, validation, record]);

  return (
    <div className={`accordion animate-in ${open ? "open" : ""}`}>
      <div className="accordion-header" onClick={() => setOpen(!open)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--error)" }}>⚠️</span>
          <span>#{record.id} — <strong>{record.nama_pelaksana}</strong> | Tujuan: {record.tujuan}</span>
          {statusBadge(record.status_validasi_ai)}
        </div>
        <span className="accordion-chevron">▼</span>
      </div>
      {open && (
        <div className="accordion-body">
          {validation ? (
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
              <div>
                <strong style={{ color: "var(--text-title)" }}>Analisis AI Checker:</strong>
                <div style={{ marginTop: 8 }}>
                  {validation.details.map((d, i) => (
                    <div key={i} style={{
                      padding: "8px 12px", marginBottom: 6, borderRadius: 6,
                      background: d.status === "error" ? "var(--error-bg)" : "var(--warning-bg)",
                      border: `1px solid ${d.status === "error" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                      fontSize: "0.82rem"
                    }}>
                      <strong>{d.field}:</strong> {d.message}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <strong style={{ color: "var(--text-title)" }}>Rincian Komponen:</strong>
                <div style={{ marginTop: 8, fontSize: "0.82rem", lineHeight: 2 }}>
                  <div>Uang Harian: <strong>Rp {fmt(record.uang_harian_diterima)}</strong></div>
                  <div>Hotel: <strong>Rp {fmt(record.nilai_hotel)}</strong></div>
                  <div>Tiket Berangkat: <strong>Rp {fmt(record.berangkat_nilai)}</strong></div>
                  <div>Tiket Pulang: <strong>Rp {fmt(record.pulang_nilai)}</strong></div>
                  <div>DPR Transport: <strong>Rp {fmt(record.dpr_nilai_transportasi)}</strong></div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontWeight: 700, color: "var(--accent)" }}>
                    Total Tercatat: Rp {fmt(record.nilai_total_biaya)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="loading-container" style={{ padding: 20 }}>
              <div className="loading-spinner" />
              <div className="loading-text">Memvalidasi...</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
