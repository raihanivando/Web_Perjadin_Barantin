import { importFromGoogleSheets } from "../lib/sheets-importer.js";
import { getSummaryStats, getAllRecords } from "../lib/database.js";

async function main() {
  console.log("Starting sync from Google Sheets...");
  const result = await importFromGoogleSheets({ force: true });
  console.log("Sync finished successfully!");
  console.log("Total imported:", result.totalImported);
  console.log("Sheets:", result.sheets);

  const stats = getSummaryStats();
  console.log("\n=== SUMMARY STATS ===");
  console.log("Total Records:", stats.totalRecords);
  console.log("Total Surat Tugas:", stats.totalSuratTugas);

  console.log("\n=== PIMPINAN MONITORING ===");
  const pimpinan = stats.budgetMonitoring?.pimpinan;
  if (pimpinan) {
    for (const [k, v] of Object.entries(pimpinan)) {
      console.log(`- ${v.label}: ${v.count} penugasan, ${v.suratTugasCount} ST, Realisasi: Rp ${v.total?.toLocaleString('id-ID')}`);
    }
  }

  const allRecs = getAllRecords();
  const sestamaRecs = allRecs.filter(r => (r.nama_pelaksana || "").toLowerCase().includes("shahandra"));
  console.log("\n=== SHAHANDRA HANITIYO (SEKRETARIS UTAMA) RECORDS ===");
  console.log("Total rows found:", sestamaRecs.length);
  sestamaRecs.forEach((r, idx) => {
    console.log(`[${idx+1}] No: ${r.no_urut} | Tujuan: ${r.tujuan} | ST: "${r.no_surat_tugas_spd}" | Uraian: "${r.uraian_penugasan}"`);
  });

  const emptyStOverall = allRecs.filter(r => !r.no_surat_tugas_spd || r.no_surat_tugas_spd.trim() === "");
  console.log(`\nOverall records with empty ST: ${emptyStOverall.length} of ${allRecs.length}`);
}

main().catch(err => {
  console.error("Sync error:", err);
  process.exit(1);
});
