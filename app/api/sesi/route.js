import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([]);
}

export async function POST() {
  return NextResponse.json({ error: "Sesi manual dinonaktifkan. Catatan kehadiran saat ini dikelola otomatis per tanggal." }, { status: 400 });
}
