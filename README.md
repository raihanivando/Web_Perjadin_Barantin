# Web Monitoring & Rekap Perjalanan Dinas — Barantin

Aplikasi Web Modern untuk Monitoring Realisasi Biaya, Klasifikasi Surat Tugas, Evaluasi Personel, dan Validasi AI Perjalanan Dinas (Badan Karantina Indonesia).

---

## 🌟 Fitur Utama

- **📊 Dashboard Interaktif & Statistik**:
  - Ringkasan total realisasi biaya dinas, uang harian, hotel, transportasi, dan representatif.
  - Grafik visualisasi perbandingan realisasi vs anggaran dan tren penugasan per bulan.
  - Distribusi biaya per moda transportasi dan klasifikasi penugasan.

- **👤 Monitoring Personel (Per Orang)**:
  - Pelacakan frekuensi perjalanan dinas per personel.
  - Akumulasi total nominal uang yang diterima setiap personel beserta rincian (*UH, Hotel, Tiket/Transport, Rata-rata per trip*).
  - Normalisasi nama kanonikal dan gelar secara cerdas.
  - Modal riwayat lengkap perjalanan dan destinasi kota yang pernah dikunjungi.

- **📂 Klasifikasi Surat Tugas & SPD**:
  - Pengelompokan data berdasarkan Nomor Surat Tugas dan SPD rombongan.
  - Rincian pelaksana penugasan, SP2D, kode akun, dan SPM.

- **🤖 AI Validation & Quality Checker**:
  - Validasi otomatis data perjalanan dinas (*integritas tanggal, batas tarif SBM, kelengkapan tiket & SP2D*).
  - Status validasi: `✅ Valid`, `⚠️ Perlu Diperiksa`, atau `❌ Error`.

- **📥 Ekspor & Sinkronisasi Excel**:
  - Impor dan sinkronisasi dua arah dari file Excel master (`.xlsx`).
  - Ekspor data bersih hasil rekapitulasi ke format spreadsheet Excel.

---

## 🚀 Memulai (Quick Start)

### 1. Prasyarat
- [Node.js](https://nodejs.org/) (versi 18.18 atau lebih baru)
- npm / pnpm / yarn

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Menjalankan Server Development
```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

### 4. Build untuk Produksi
```bash
npm run build
npm run start
```

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Database**: SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3))
- **Charts**: [Recharts](https://recharts.org/)
- **Spreadsheet Processing**: SheetJS ([xlsx](https://sheetjs.com/))
- **Styling**: Modern CSS Variables dengan dukungan Dark & Light Theme
