/**
 * API Route: /api/records
 * GET  — Fetch all records with optional filters (kategori, status, search, suratTugas)
 * POST — Insert a new record (auto-validates with AI checker)
 */
import { NextResponse } from "next/server";
import { getAllRecords, insertRecord, getSummaryStats, getAvailableCategories, getSuratTugasList, getPersonnelMonitoringList } from "@/lib/database";
import { validasiLengkap } from "@/lib/ai-checker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const kategori = searchParams.get("kategori") || null;

  try {
    if (action === "stats") {
      return NextResponse.json(getSummaryStats(kategori), {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
    if (action === "categories") {
      return NextResponse.json(getAvailableCategories(), {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
    if (action === "surat-tugas") {
      return NextResponse.json(getSuratTugasList(kategori), {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
    if (action === "personnel" || action === "monitoring-personel") {
      return NextResponse.json(getPersonnelMonitoringList(kategori), {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    const filterStatus = searchParams.get("status") || null;
    const search = searchParams.get("search") || null;
    const suratTugas = searchParams.get("suratTugas") || null;
    const sort = searchParams.get("sort") || null;
    const records = getAllRecords({ kategori, filterStatus, search, suratTugas, sort });
    return NextResponse.json(records, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const valRes = validasiLengkap(data);
    data.status_validasi_ai = valRes.status_akhir;
    const id = insertRecord(data);
    return NextResponse.json({ id, validation: valRes });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
