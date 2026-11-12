/**
 * API Route: /api/records/[id]
 * GET    — Get single record by ID
 * PUT    — Update a record by ID (re-validates with AI checker)
 * DELETE — Delete a record by ID
 */
import { NextResponse } from "next/server";
import { getRecordById, updateRecord, deleteRecord } from "@/lib/database";
import { validasiLengkap } from "@/lib/ai-checker";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const rec = getRecordById(Number(id));
    if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rec);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const data = await request.json();
    // Re-validate
    const valRes = validasiLengkap(data);
    data.status_validasi_ai = valRes.status_akhir;
    updateRecord(Number(id), data);
    const updated = getRecordById(Number(id));
    return NextResponse.json({ success: true, record: updated, validation: valRes });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    deleteRecord(Number(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
