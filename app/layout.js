import "./globals.css";

export const metadata = {
  title: "Rekap Perjalanan Dinas — TU Kepala 2026",
  description:
    "Dashboard Monitoring Realisasi Biaya, Klasifikasi Surat Tugas, Data Rekap & Ekspor, Input Data, dan AI Validator untuk Perjalanan Dinas Subbagian TU Kepala.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✈️</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
