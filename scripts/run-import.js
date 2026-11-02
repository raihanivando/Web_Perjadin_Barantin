import { importExcelPerjadin, getDefaultExcelPath } from '../lib/excel-importer.js';
import { getDb, getSummaryStats } from '../lib/database.js';

const filePath = getDefaultExcelPath();
console.log('Using file:', filePath);

const res = importExcelPerjadin(filePath);
console.log('Import result:', res);

const db = getDb();
const total = db.prepare('SELECT COUNT(*) as count FROM rekap_perjadin').get().count;
console.log('Total rows in SQLite database:', total);

const stats = getSummaryStats();
console.log('Database stats:', stats);

const validationCounts = db.prepare(`
  SELECT 
    status_validasi_ai,
    COUNT(*) as count
  FROM rekap_perjadin
  GROUP BY status_validasi_ai
`).all();

console.log('\nAI Validation Breakdown:');
console.table(validationCounts);

const totalCost = db.prepare('SELECT SUM(nilai_total_biaya) as total FROM rekap_perjadin').get().total;
console.log(`\nTotal Biaya in DB: Rp ${totalCost.toLocaleString('id-ID')}`);
