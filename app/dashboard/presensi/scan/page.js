import { redirect } from 'next/navigation';
import { XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ScanRedirectPage({ searchParams }) {
  const { jamaah_id } = await searchParams;

  if (jamaah_id) {
    redirect(`/status/${jamaah_id}`);
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 bg-slate-55 text-slate-800 font-sans">
      <div className="max-w-md w-full bg-white border border-slate-100 shadow-xl rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-50 border border-red-100 text-red-500 flex items-center justify-center rounded-2xl mb-4 mx-auto shadow-sm">
          <XCircle size={32} />
        </div>
        <h2 className="text-lg font-black text-slate-800">QR Code Tidak Valid</h2>
        <p className="text-xs text-slate-500 font-semibold mt-1">
          Parameter 'jamaah_id' tidak ditemukan di URL QR Code ini.
        </p>
      </div>
    </div>
  );
}
