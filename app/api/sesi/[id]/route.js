import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: "Sesi tidak ditemukan (Sesi manual dinonaktifkan)" }, { status: 404 });
}

export async function PUT() {
  return NextResponse.json({ error: "Sesi manual dinonaktifkan" }, { status: 400 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Sesi manual dinonaktifkan" }, { status: 400 });
}
