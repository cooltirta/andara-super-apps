"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';


export default function DashboardHome() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) throw new Error("Gagal mengambil data profil pengguna");
      const currentUser = await userRes.json();
      setUser(currentUser);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-750">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Beranda</h1>
      </div>

      {/* Main Content Card: Tentang Taqlima */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-8 mb-8 w-full">
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
          {/* Left side: Logo */}
          <div className="w-32 shrink-0 flex items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-fadeIn">
            <img src="/logo.png" alt="Taqlima Logo" className="w-full h-auto object-contain" />
          </div>

          {/* Right side: Information */}
          <div className="flex-1 text-center md:text-left">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
              TENTANG TAQLIMA
            </span>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mt-4 mb-3">
              Mendekatkan Diri Kepada Allah Melalui Ilmu
            </h2>
            <p className="text-sm text-slate-600 font-semibold leading-relaxed mb-4">
              <strong>Taqlima</strong> merupakan platform pelayanan jamaah terpadu yang didesain melampaui batas sistem pencatatan presensi biasa. Nama <strong>Taqlima</strong> diilhami dari perpaduan luhur dua pilar spiritual, yaitu <strong>Taqorrub</strong> (proses mendekatkan diri kepada Allah SWT) dan <strong>Ta'lima</strong> (berakar dari kata <em>ta'lim</em> yang merujuk pada pengajaran keilmuan).
            </p>
            <p className="text-sm text-slate-600 font-semibold leading-relaxed mb-4">
              Filosofi keilmuan dan ketakwaan ini menuntun kita untuk meyakini bahwa kehadiran di setiap majelis pengajian adalah bagian utuh dari ibadah dan taqorrub kepada-Nya. Dengan landasan ilmu dan ketulusan ibadah, Taqlima hadir untuk memfasilitasi jamaah dalam menyatukan langkah menjaga amanah ini secara bersama-sama.
            </p>
            <div className="border-l-4 border-teal-500 pl-4 py-2 bg-slate-50/70 rounded-r-lg mt-5">
              <p className="text-sm text-slate-700 font-bold italic">
                "Bersama Meramut Jamaah, Saling Menjaga Menuju Surga"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
