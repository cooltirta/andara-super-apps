"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Copy, Check, Info, ExternalLink, RefreshCw } from 'lucide-react';

export default function KalenderPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const fetchAuth = async () => {
    try {
      setLoading(true);
      const authRes = await fetch('/api/auth/me');
      if (!authRes.ok) throw new Error("Unauthenticated");
      const currentUser = await authRes.json();
      setUser(currentUser);

      if (!currentUser.can_read_kalender) {
        alert("Akses Ditolak: Anda tidak memiliki akses ke Kalender");
        router.push('/dashboard');
        return;
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      router.push('/login?callbackUrl=/dashboard/kalender');
    }
  };

  useEffect(() => {
    fetchAuth();
  }, []);

  const email = "js2@mail.com";
  const password = "har354";
  const targetUrl = `https://e-kalenderjs2.vercel.app/?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleIframeLoad = (e) => {
    try {
      const iframe = e.target;
      // Send postMessage to notify the iframe to auto-login if it has listeners
      iframe.contentWindow.postMessage({
        type: 'AUTO_LOGIN',
        email,
        password
      }, '*');
    } catch (err) {
      console.warn("Could not postMessage to iframe:", err);
    }
  };

  if (loading && !user) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-9 h-9 text-primary animate-spin" />
          <h2 className="text-xs font-bold text-slate-400 tracking-wider">Memuat Kalender Sinkronisasi...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Calendar className="text-primary w-7 h-7" />
            <span>Kalender Sinkronisasi</span>
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Lihat jadwal kegiatan pengajian, rapat koordinasi, dan agenda pembinaan
          </p>
        </div>

        <a 
          href="https://e-kalenderjs2.vercel.app/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-2.5 px-4 font-bold text-xs bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 hover:text-slate-700 rounded-lg shadow-sm transition-all"
        >
          <span>Buka di Tab Baru</span>
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Iframe container */}
        <div className="flex-1 w-full bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden p-2">
          <iframe 
            src={targetUrl}
            onLoad={handleIframeLoad}
            className="w-full h-[72vh] border-0 rounded-xl"
            title="E-Kalender JS2"
            allow="geolocation"
          />
        </div>

        {/* Credentials Assistant Panel */}
        <div className="w-full lg:w-80 shrink-0 bg-white border border-slate-100 shadow-sm rounded-2xl p-5 text-left flex flex-col gap-4">
          <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider">
            <Info size={16} />
            <span>Asisten Login Kalender</span>
          </div>

          <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
            Halaman kalender terintegrasi di samping dilindungi oleh sesi masuk. Jika Anda belum masuk, silakan gunakan kredensial berikut.
          </p>

          <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-150/60 text-xs font-semibold">
            {/* Email Field */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">ALAMAT EMAIL</span>
              <div className="flex items-center justify-between bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                <span className="font-mono text-slate-750 truncate select-all">{email}</span>
                <button 
                  onClick={() => copyToClipboard(email, setCopiedEmail)}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-50 hover:text-primary transition-colors cursor-pointer"
                  title="Salin Email"
                >
                  {copiedEmail ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">KATA SANDI</span>
              <div className="flex items-center justify-between bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                <span className="font-mono text-slate-750 select-all">{password}</span>
                <button 
                  onClick={() => copyToClipboard(password, setCopiedPassword)}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-50 hover:text-primary transition-colors cursor-pointer"
                  title="Salin Sandi"
                >
                  {copiedPassword ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-150 p-3.5 rounded-xl text-[10.5px] font-bold text-amber-700 leading-normal flex gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
            <p>
              Peramban (browser) membatasi pengetikan otomatis demi keamanan (**Same-Origin Policy**). Silakan klik tombol salin di atas, lalu tempel (*paste*) pada halaman login kalender.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
