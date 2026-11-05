/**
 * API Route: /api/sync-sheets
 * ============================
 * POST — Trigger sinkronisasi data dari Google Sheets API
 * GET  — Mendapatkan informasi status sinkronisasi terakhir
 */
import { NextResponse } from "next/server";
import { importFromGoogleSheets, getSheetsSyncInfo } from "@/lib/sheets-importer";

export async function POST() {
  try {
    const result = await importFromGoogleSheets();
    return NextResponse.json({
      success: true,
      message: `Berhasil memuat ${result.totalImported} data dari ${result.sheets.length} sheet (Google Sheets)`,
      ...result,
    });
  } catch (err) {
    const status = err.message.includes("quota") ? 429 : 500;
    return NextResponse.json(
      { success: false, error: err.message },
      { status }
    );
  }
}

export async function GET() {
  try {
    const info = getSheetsSyncInfo();
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

