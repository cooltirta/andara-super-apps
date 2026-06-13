import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: "Sesi tidak ditemukan (Sesi manual dinonaktifkan)" }, { status: 404 });
}
