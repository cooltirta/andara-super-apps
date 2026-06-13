"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [desa, setDesa] = useState('Andara');
  const [kelompok, setKelompok] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (targetEmail, targetDesa, targetKelompok) => {
    setLoading(true);
    setError('');

    // Toggle loading spinner
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          desa: targetDesa,
          kelompok: targetKelompok || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to dashboard or callbackUrl
        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get('callbackUrl') || '/dashboard';
        window.location.href = callbackUrl;
      } else {
        setError(data.error || 'Gagal masuk');
        if (spinner) spinner.classList.add('hidden');
      }
    } catch (err) {
      setError('Terjadi kesalahan koneksi server');
      console.error(err);
      if (spinner) spinner.classList.add('hidden');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      handleLogin(email, desa, kelompok || null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-100 p-4 font-sans">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md border border-grey-200/50 shadow-xl rounded-md p-8 text-center transition-all duration-300">
        <div className="w-16 h-16 rounded-md bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white font-extrabold text-3xl mx-auto mb-6 shadow-lg shadow-primary/20">
          A
        </div>
        <h1 className="text-2xl font-extrabold text-grey-900 tracking-tight mb-2">Andara Super Apps</h1>
        <p className="text-sm text-grey-500 font-medium mb-6">Pendataan & Kehadiran Jamaah Pengajian Desa Andara</p>

        {error && (
          <div className="bg-pastel-red text-pastel-red-text p-3 rounded-sm mb-5 text-sm font-semibold text-left">
            {error}
          </div>
        )}

        {/* Login / Register Form */}
        <form onSubmit={handleSubmit} className="text-left flex flex-col gap-4 mt-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="login-email" className="text-xs font-bold uppercase tracking-wider text-grey-500">Alamat Email</label>
            <input 
              type="email" 
              id="login-email" 
              className="w-full px-4 py-2.5 rounded-sm border border-grey-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white/50 text-grey-900" 
              placeholder="nama@email.com" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="login-desa" className="text-xs font-bold uppercase tracking-wider text-grey-500">Pilih Desa</label>
              <select 
                id="login-desa" 
                className="w-full px-3 py-2.5 rounded-sm border border-grey-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-grey-900 cursor-pointer"
                value={desa}
                onChange={(e) => setDesa(e.target.value)}
                disabled={loading}
              >
                <option value="Andara">Andara</option>
                <option value="Bojong">Bojong</option>
                <option value="Cisadane">Cisadane</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="login-kelompok" className="text-xs font-bold uppercase tracking-wider text-grey-500">Pilih Kelompok</label>
              <select 
                id="login-kelompok" 
                className="w-full px-3 py-2.5 rounded-sm border border-grey-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-grey-900 cursor-pointer"
                value={kelompok}
                onChange={(e) => setKelompok(e.target.value)}
                disabled={loading}
              >
                <option value="">Tidak Ada</option>
                <option value="Andara 1">Andara 1</option>
                <option value="Andara 2">Andara 2</option>
                <option value="Andara 3">Andara 3</option>
                <option value="Andara 4">Andara 4</option>
                <option value="Andara 5">Andara 5</option>
              </select>
            </div>
          </div>
          <button type="submit" className="w-full mt-2 py-3 px-4 rounded-sm bg-primary hover:bg-primary-hover text-white font-semibold shadow-md shadow-primary/20 transition-all active:scale-[0.98]" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk / Daftar'}
          </button>
        </form>
      </div>
    </div>
  );
}
