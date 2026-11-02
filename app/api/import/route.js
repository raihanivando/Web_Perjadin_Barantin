/**
 * API Route: /api/import
 * POST — Import data from Excel file (clears existing data first)
 * GET  — Check file status or auto-sync if check=true
 */
import { NextResponse } from "next/server";
import { importExcelPerjadin, getDefaultExcelPath, getLastSyncInfo, checkAndAutoSync } from "@/lib/excel-importer";

export async function POST(request) {
  try {
    let filePath;
    const body = await request.json().catch(() => ({}));
    
    if (body.filePath) {
      filePath = body.filePath;
    } else {
      filePath = getDefaultExcelPath();
    }

    if (!filePath) {
      return NextResponse.json({ error: "File Excel tidak ditemukan" }, { status: 404 });
    }

    const result = importExcelPerjadin(filePath);
    return NextResponse.json({
      success: true,
      message: `Berhasil memuat ${result.totalImported} data dari ${result.sheets.length} sheet`,
      ...result,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const check = searchParams.get("check");

    if (check === "true") {
      const syncResult = checkAndAutoSync();
      return NextResponse.json(syncResult);
    }

    const info = getLastSyncInfo();
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
