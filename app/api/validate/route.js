/**
 * API Route: /api/validate
 * POST — Run AI validation on a single record (without saving)
 */
import { NextResponse } from "next/server";
import { validasiLengkap } from "@/lib/ai-checker";

export async function POST(request) {
  try {
    const data = await request.json();
    const result = validasiLengkap(data);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
