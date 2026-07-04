"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [showBypass, setShowBypass] = useState(false);

  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    const isPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';
    if (isDev || isPreview) {
      setShowBypass(true);
    }
  }, []);

  useEffect(() => {
    // Read Google Client ID from environment variable
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (clientId) {
      setGoogleClientId(clientId);

      // Load Google Identity Services script
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleLoginSuccess,
          });
          window.google.accounts.id.renderButton(
            document.getElementById("google-signin-button"),
            { 
              theme: "outline", 
              size: "large", 
              width: "350",
              text: "signin_with",
              shape: "rectangular"
            }
          );
        }
      };
      document.body.appendChild(script);

      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, []);

  const decodeJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error("Failed to decode JWT:", error);
      return null;
    }
  };

  const handleGoogleLoginSuccess = async (response) => {
    setLoading(true);
    setError('');

    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
      const payload = decodeJwt(response.credential);
      if (!payload || !payload.email) {
        throw new Error("Gagal membaca email dari Akun Google");
      }

      const userEmail = payload.email;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          desa: "Andara", // default values for new signups
          kelompok: null
        })
      });

      const data = await res.json();

      if (res.ok) {
        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get('callbackUrl') || '/dashboard';
        window.location.href = callbackUrl;
      } else {
        setError(data.error || 'Gagal masuk');
        if (spinner) spinner.classList.add('hidden');
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan koneksi server');
      console.error(err);
      if (spinner) spinner.classList.add('hidden');
    } finally {
      setLoading(false);
    }
  };

  const handleMockGoogleLogin = async () => {
    const inputEmail = prompt("Masukkan Email Akun Google Anda untuk login/simulasi:", "cooltirta@gmail.com");
    if (!inputEmail) return;

    setLoading(true);
    setError('');

    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inputEmail,
          desa: "Andara",
          kelompok: null
        })
      });

      const data = await res.json();

      if (res.ok) {
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

  const handleBypassLogin = async () => {
    setLoading(true);
    setError('');

    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: "cooltirta@gmail.com",
          desa: "Andara",
          kelompok: null
        })
      });

      const data = await res.json();

      if (res.ok) {
        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get('callbackUrl') || '/dashboard';
        window.location.href = callbackUrl;
      } else {
        setError(data.error || 'Gagal masuk bypass');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-100 p-4 font-sans">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md border border-grey-200/50 shadow-xl rounded-md p-8 text-center transition-all duration-300">
        <div className="w-16 h-16 rounded-md bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white font-extrabold text-3xl mx-auto mb-6 shadow-lg shadow-primary/20">
          A
        </div>
        <h1 className="text-2xl font-extrabold text-grey-900 tracking-tight mb-2">Andara Super Apps</h1>
        <p className="text-sm text-grey-500 font-medium mb-8">Pendataan & Kehadiran Jamaah Pengajian Desa Andara</p>

        {error && (
          <div className="bg-pastel-red text-pastel-red-text p-3 rounded-sm mb-6 text-sm font-semibold text-left">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center justify-center w-full min-h-[50px] mb-4">
          {!googleClientId ? (
            <button 
              onClick={handleMockGoogleLogin} 
              className="flex items-center justify-center gap-3 w-full max-w-[350px] py-3 px-4 rounded-sm bg-white hover:bg-grey-50 border border-grey-300 text-grey-700 font-semibold shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer text-sm"
              disabled={loading}
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" className="w-5 h-5" alt="Google Logo" />
              <span>Masuk dengan Akun Google</span>
            </button>
          ) : (
            <div id="google-signin-button" className="w-full flex justify-center"></div>
          )}

          {showBypass && (
            <button 
              onClick={handleBypassLogin}
              className="mt-4 flex items-center justify-center gap-2 w-full max-w-[350px] py-3 px-4 rounded-sm bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer text-sm"
              disabled={loading}
            >
              <span>Masuk Sebagai Admin (Bypass)</span>
            </button>
          )}
        </div>
        
        <p className="text-xs text-grey-400 font-medium mt-6">
          Gunakan akun Google Anda yang terdaftar untuk masuk atau mendaftar ke sistem.
        </p>
      </div>
    </div>
  );
}
