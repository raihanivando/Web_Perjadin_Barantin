/**
 * API Route: /api/export
 * GET — Export records to Excel (.xlsx) file
 * Query params:
 *   - kategori: filter by category or 'SEMUA'
 *   - suratTugas: filter by surat tugas
 */
import { NextResponse } from "next/server";
import { getAllRecords } from "@/lib/database";
import * as XLSX from "xlsx";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const kategori = searchParams.get("kategori") || "SEMUA";
    const suratTugas = searchParams.get("suratTugas") || "";
    const nama = searchParams.get("nama") || "";

    const records = getAllRecords({
      kategori: kategori !== "SEMUA" ? kategori : undefined,
      suratTugas: suratTugas && suratTugas !== "SEMUA" ? suratTugas : undefined,
      search: nama ? nama : undefined,
    });

    // Transform records to clean spreadsheet columns
    const exportData = records.map((r, idx) => ({
      "No": r.no_urut || idx + 1,
      "Kategori": r.kategori,
      "Nama Pelaksana": r.nama_pelaksana,
      "Pangkat/Golongan": r.pangkat_golongan || "",
      "Jabatan": r.jabatan || "",
      "Tujuan": r.tujuan || "",
      "No Surat Tugas & SPD": r.no_surat_tugas_spd || "",
      "Uraian Penugasan": r.uraian_penugasan || "",
      "Tgl Mulai": r.tgl_mulai || "",
      "Tgl Selesai": r.tgl_selesai || "",
      "Tarif UH": r.tarif_uang_harian || 0,
      "UH Diterima": r.uang_harian_diterima || 0,
      "Tarif Representative": r.uang_representative_tarif || 0,
      "Representative Diterima": r.uang_representative_diterima || 0,
      "Nama Hotel": r.nama_hotel || "",
      "Lama Menginap (Malam)": r.lama_menginap || 0,
      "Nilai Hotel": r.nilai_hotel || 0,
      "Penyedia Berangkat": r.berangkat_penyedia_jasa || "",
      "Maskapai Berangkat": r.berangkat_maskapai || "",
      "No Tiket Berangkat": r.berangkat_nomor_tiket || "",
      "Kode Booking Berangkat": r.berangkat_kode_booking || "",
      "Tgl Berangkat": r.berangkat_tanggal || "",
      "Nilai Tiket Berangkat": r.berangkat_nilai || 0,
      "Taksi Berangkat (Penyedia)": r.berangkat_taksi_penyedia || "",
      "Taksi Berangkat (Nilai)": r.berangkat_taksi_nilai || 0,
      "Penyedia Pulang": r.pulang_penyedia_jasa || "",
      "Maskapai Pulang": r.pulang_maskapai || "",
      "No Tiket Pulang": r.pulang_nomor_tiket || "",
      "Kode Booking Pulang": r.pulang_kode_booking || "",
      "Tgl Pulang": r.pulang_tanggal || "",
      "Nilai Tiket Pulang": r.pulang_nilai || 0,
      "Taksi Pulang (Penyedia)": r.pulang_taksi_penyedia || "",
      "Taksi Pulang (Nilai)": r.pulang_taksi_nilai || 0,
      "DPR Nilai Hotel": r.dpr_nilai_hotel || 0,
      "DPR Nilai Transportasi": r.dpr_nilai_transportasi || 0,
      "DPR Nilai Taksi": r.dpr_nilai_taksi || 0,
      "DPR Keterangan": r.dpr_keterangan || "",
      "Total Biaya": r.nilai_total_biaya || 0,
      "SP2D Nomor": r.sp2d_nomor || "",
      "SP2D Tanggal": r.sp2d_tanggal || "",
      "SP2D Nominal": r.sp2d_nominal || 0,
      "SP2D Pengembalian": r.sp2d_pengembalian || 0,
      "No SPM": r.no_spm || "",
      "Link Dokumen SPJ": r.link_dokumen_spj || "",
      "Kode Akun": r.kode_akun || "",
      "Status Validasi AI": r.status_validasi_ai || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Perjadin");

    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const cleanKat = (nama ? `Personel_${nama}` : suratTugas ? `ST_${suratTugas}` : kategori).replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
    const filename = `Rekap_Perjadin_${cleanKat}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
