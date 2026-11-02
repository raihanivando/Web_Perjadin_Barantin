/**
 * API Route: /api/records/[id]
 * GET    — Get single record by ID
 * DELETE — Delete a record by ID
 */
import { NextResponse } from "next/server";
import { getRecordById, deleteRecord } from "@/lib/database";

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

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    deleteRecord(Number(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
