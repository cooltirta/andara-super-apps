"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';

function ScanPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jamaahId = searchParams.get('jamaah_id');
  
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const performScanRecord = async () => {
    if (!jamaahId) {
      setError("Parameter 'jamaah_id' tidak ditemukan di URL QR Code.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/kehadiran/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jamaah_id: jamaahId })
      });

      const resData = await response.json();

      if (response.ok) {
        setSuccess(true);
        setData(resData);
      } else {
        // Jika belum terautentikasi (401), arahkan ke login dengan callbackUrl kembali ke sini
        if (response.status === 401) {
          const currentUrl = window.location.pathname + window.location.search;
          router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
          return;
        }
        setError(resData.error || "Gagal mencatat kehadiran");
      }
    } catch (err) {
      console.error(err);
      setError("Gagal menghubungi server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performScanRecord();
  }, [jamaahId]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-100 shadow-xl rounded-2xl p-8 text-center animate-scaleIn">
        {loading && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h2 className="text-base font-bold text-slate-700">Mencatat Kehadiran...</h2>
            <p className="text-xs text-slate-400 font-semibold">Memproses data QR Code kartu jamaah</p>
          </div>
        )}

        {!loading && success && data && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-pastel-green text-pastel-green-text flex items-center justify-center shadow-lg shadow-pastel-green-solid/10 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            
            <div>
              <h2 className="text-lg font-black text-slate-800">Kehadiran Berhasil Dicatat!</h2>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Metode: QR Code Card Scan</p>
            </div>

            <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-100/50 text-left flex flex-col gap-2">
              <div>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block">Nama Jamaah</span>
                <span className="text-sm font-black text-slate-800">{data.jamaah.nama_lengkap}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block">Desa</span>
                  <span className="text-xs font-bold text-slate-700">{data.jamaah.desa}</span>
                </div>
                <div>
                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block">Kelompok</span>
                  <span className="text-xs font-bold text-slate-700">{data.jamaah.kelompok}</span>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2 mt-1">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block">Waktu Pencatatan</span>
                <span className="text-xs font-bold text-primary">
                  {new Date(data.waktu_presensi).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                  {new Date(data.waktu_presensi).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block">Discan Oleh (Moderator)</span>
                <span className="text-[10px] font-bold text-slate-600 truncate block">{data.recorded_by}</span>
              </div>
            </div>

            <button 
              onClick={() => router.push('/dashboard/presensi')} 
              className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-sm shadow-primary/10"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Panel Presensi</span>
            </button>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-pastel-red text-pastel-red-text flex items-center justify-center shadow-lg shadow-pastel-red-solid/10 animate-pulse">
              <ShieldAlert size={36} />
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-800">Pencatatan Gagal</h2>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Kesalahan Otoritas / Data</p>
            </div>

            <div className="w-full bg-red-50/50 rounded-xl p-4 border border-red-150 text-left text-xs font-semibold text-red-650 leading-relaxed">
              {error}
            </div>

            <button 
              onClick={() => router.push('/dashboard/presensi')} 
              className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Panel Presensi</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <ScanPageContent />
    </Suspense>
  );
}
