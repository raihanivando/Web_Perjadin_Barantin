/**
 * API Route: /api/sync-sheets
 * ============================
 * POST — Trigger sinkronisasi data dari Google Sheets API
 * GET  — Mendapatkan informasi status sinkronisasi terakhir
 */
import { NextResponse } from "next/server";
import { importFromGoogleSheets, getSheetsSyncInfo } from "@/lib/sheets-importer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  try {
    let force = false;
    try {
      const { searchParams } = new URL(request.url);
      force = searchParams.get("force") === "true";
    } catch {
      // ignore
    }

    const result = await importFromGoogleSheets({ force });
    return NextResponse.json({
      success: true,
      message: `Berhasil memuat ${result.totalImported} data dari ${result.sheets.length} sheet (Google Sheets)`,
      ...result,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const status = err.message.includes("quota") ? 429 : 500;
    return NextResponse.json(
      { success: false, error: err.message },
      { status, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function GET() {
  try {
    const info = getSheetsSyncInfo();
    return NextResponse.json(info, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
