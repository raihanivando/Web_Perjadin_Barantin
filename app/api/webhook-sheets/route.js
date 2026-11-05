/**
 * API Route: /api/webhook-sheets
 * ===============================
 * POST — Webhook endpoint yang dipanggil oleh Google Apps Script
 *         ketika spreadsheet berubah (on edit trigger).
 *         Memicu sinkronisasi ulang dari Google Sheets.
 *
 * Memerlukan env var:
 *   SHEETS_WEBHOOK_SECRET — token rahasia untuk validasi request
 */
import { NextResponse } from "next/server";
import { importFromGoogleSheets } from "@/lib/sheets-importer";

export async function POST(request) {
  try {
    // ---- Validasi secret token ----
    const webhookSecret = process.env.SHEETS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: "Webhook secret belum dikonfigurasi di server" },
        { status: 500 }
      );
    }

    // Token bisa dikirim via header atau body
    let token = request.headers.get("x-webhook-secret") || request.headers.get("authorization");
    let body = {};

    try {
      body = await request.json();
    } catch {
      // Body kosong tidak masalah
    }

    // Jika token di header menggunakan format "Bearer <token>", ambil token-nya saja
    if (token && token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    // Fallback: cek token di body
    if (!token && body.secret) {
      token = body.secret;
    }

    if (token !== webhookSecret) {
      return NextResponse.json(
        { success: false, error: "Token tidak valid" },
        { status: 401 }
      );
    }

    // ---- Trigger sinkronisasi ----
    const result = await importFromGoogleSheets();

    return NextResponse.json({
      success: true,
      message: `Webhook sync berhasil: ${result.totalImported} data dari ${result.sheets.length} sheet`,
      totalImported: result.totalImported,
      sheets: result.sheets,
      source: "webhook_google_sheets",
      syncTime: result.syncTime,
    });
  } catch (err) {
    // Jika sedang syncing, kembalikan 409 Conflict
    if (err.message.includes("sedang berjalan")) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 409 }
      );
    }
    const status = err.message.includes("quota") ? 429 : 500;
    return NextResponse.json(
      { success: false, error: err.message },
      { status }
    );
  }
}

