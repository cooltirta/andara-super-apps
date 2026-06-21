"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, RefreshCw, Clock, ArrowLeft, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

export default function RfidKioskPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Scan states
  const [rfidValue, setRfidValue] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle', 'loading', 'success', 'cooldown', 'error'
  const [statusMessage, setStatusMessage] = useState('Silakan tap kartu RFID Anda');
  const [scannedJamaah, setScannedJamaah] = useState(null);
  const [lastScannedUid, setLastScannedUid] = useState('');
  const [history, setHistory] = useState([]); // List of last 5 successful scans

  // Clock
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  const inputRef = useRef(null);

  // Web Audio Context for synthesizer beep chimes
  const playChime = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'success') {
        // High pleasant double chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'cooldown') {
        // Double medium tone beep
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(523, ctx.currentTime);
        gain1.gain.setValueAtTime(0.15, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.12);

        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(523, ctx.currentTime);
          gain2.gain.setValueAtTime(0.15, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.12);
        }, 180);
      } else if (type === 'error') {
        // Low harsh warning buzz
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(220, ctx.currentTime);
        gain1.gain.setValueAtTime(0.2, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.25);

        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(180, ctx.currentTime);
          gain2.gain.setValueAtTime(0.2, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.3);
        }, 150);
      }
    } catch (e) {
      console.warn("Web Audio API not supported or blocked by user gesture:", e);
    }
  };

  // Clock Update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      setTimeStr(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
      
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      setDateStr(now.toLocaleDateString('id-ID', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch User & Check Auth
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error("Tidak terautentikasi");
      const currentUser = await res.json();
      setUser(currentUser);

      if (!currentUser.can_create_kehadiran && !currentUser.can_update_kehadiran) {
        alert("Akses Ditolak: Anda tidak memiliki wewenang presensi.");
        router.push('/dashboard/presensi');
        return;
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      router.push('/login?callbackUrl=/dashboard/presensi/rfid');
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Keep input field focused at all times for keyboard emulator reader
  useEffect(() => {
    if (loading) return;

    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    // Focus on mount/update
    focusInput();

    // Focus on clicking anywhere in document
    document.addEventListener('click', focusInput);

    // Keep checking and focusing every 2.5 seconds
    const interval = setInterval(focusInput, 2500);

    return () => {
      document.removeEventListener('click', focusInput);
      clearInterval(interval);
    };
  }, [loading]);

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const uid = rfidValue.trim();
    if (!uid) return;

    // Reset input
    setRfidValue('');
    setLastScannedUid(uid);
    setStatus('loading');
    setStatusMessage('Memproses pemindaian...');

    try {
      const res = await fetch('/api/kehadiran/rfid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfid: uid })
      });
      const data = await res.json();

      if (res.ok) {
        setScannedJamaah(data.jamaah);
        
        if (data.alreadyLogged) {
          // Cooldown active
          setStatus('cooldown');
          setStatusMessage(data.message || 'Sudah melakukan tap absensi baru-baru ini.');
          playChime('cooldown');
        } else {
          // Success present logged
          setStatus('success');
          setStatusMessage('Kehadiran berhasil dicatat!');
          playChime('success');

          // Add to running history of latest scans
          const scanTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          setHistory(prev => [
            {
              id: Date.now(),
              nama_lengkap: data.jamaah.nama_lengkap,
              desa: data.jamaah.desa,
              kelompok: data.jamaah.kelompok,
              time: scanTime
            },
            ...prev.slice(0, 4) // Keep latest 5 items
          ]);
        }
      } else {
        // Error (unregistered card, etc.)
        setStatus('error');
        setStatusMessage(data.error || 'Terjadi kesalahan. Coba tap kembali.');
        setScannedJamaah(null);
        playChime('error');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setStatusMessage('Gagal menghubungi server. Coba lagi.');
      setScannedJamaah(null);
      playChime('error');
    }

    // Reset back to idle/scan mode after 5 seconds of status display
    setTimeout(() => {
      setStatus(prev => {
        if (prev === 'loading') return 'loading'; // don't disrupt if still processing another
        setStatusMessage('Silakan tap kartu RFID Anda');
        return 'idle';
      });
    }, 5000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
          <h2 className="text-sm font-bold tracking-wider">Memuat Kiosk Absensi...</h2>
        </div>
      </div>
    );
  }

  // Get status color tokens
  const getStatusStyles = () => {
    if (status === 'success') {
      return {
        bg: 'bg-emerald-950/70 border-emerald-500/30 text-emerald-400',
        card: 'bg-emerald-900/60 border-emerald-500/50 shadow-emerald-950/40',
        icon: <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce" />,
        glow: 'shadow-emerald-500/10'
      };
    } else if (status === 'cooldown') {
      return {
        bg: 'bg-amber-950/70 border-amber-500/30 text-amber-400',
        card: 'bg-amber-900/60 border-amber-500/50 shadow-amber-950/40',
        icon: <AlertTriangle className="w-16 h-16 text-amber-400 animate-pulse" />,
        glow: 'shadow-amber-500/10'
      };
    } else if (status === 'error') {
      return {
        bg: 'bg-red-950/70 border-red-500/30 text-red-400',
        card: 'bg-red-900/60 border-red-500/50 shadow-red-950/40',
        icon: <AlertCircle className="w-16 h-16 text-red-400 animate-pulse" />,
        glow: 'shadow-red-500/10'
      };
    } else if (status === 'loading') {
      return {
        bg: 'bg-slate-850 border-slate-700/30 text-slate-400',
        card: 'bg-slate-800/80 border-slate-700 shadow-slate-950/40',
        icon: <RefreshCw className="w-16 h-16 text-primary animate-spin" />,
        glow: 'shadow-primary/5'
      };
    }
    // Idle
    return {
      bg: 'bg-slate-900/40 border-slate-800 text-slate-400',
      card: 'bg-slate-850/60 border-slate-800/60 shadow-slate-950/50',
      icon: <Radio className="w-16 h-16 text-emerald-500 animate-pulse" />,
      glow: 'shadow-emerald-950/20'
    };
  };

  const style = getStatusStyles();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 relative overflow-hidden select-none">
      {/* Background glowing gradients */}
      <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-emerald-900/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute -left-32 -bottom-32 w-96 h-96 rounded-full bg-teal-900/10 blur-[100px] pointer-events-none"></div>

      {/* Top Bar */}
      <div className="flex justify-between items-center z-10">
        <button 
          onClick={() => router.push('/dashboard/presensi')}
          className="flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Kembali ke Absensi</span>
        </button>

        <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/40 px-4 py-2 rounded-xl text-[11px] font-bold text-emerald-400">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
          <span>KIOSK RFID AKTIF</span>
        </div>
      </div>

      {/* Main Kiosk Area */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto gap-6 z-10 py-6">
        {/* Real-time Clock */}
        <div className="text-center flex flex-col gap-1">
          <h2 className="text-5xl font-mono font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 drop-shadow-sm">
            {timeStr}
          </h2>
          <p className="text-xs font-extrabold tracking-wider text-slate-400 uppercase mt-0.5">
            {dateStr}
          </p>
        </div>

        {/* Hidden RFID Input Capture */}
        <form onSubmit={handleScanSubmit} className="absolute opacity-0 pointer-events-none">
          <input 
            type="text"
            ref={inputRef}
            value={rfidValue}
            onChange={(e) => setRfidValue(e.target.value)}
            placeholder="Tap RFID"
            autoComplete="off"
          />
        </form>

        {/* Big Scanner Card Display */}
        <div className={`w-full max-w-md border rounded-3xl p-8 text-center flex flex-col items-center gap-6 shadow-2xl transition-all duration-300 ${style.bg} ${style.card} ${style.glow}`}>
          
          {/* Status Icon */}
          <div className="mb-2">
            {style.icon}
          </div>

          {/* Status Message */}
          <div className="flex flex-col gap-2 w-full px-4">
            <h3 className="text-lg font-black tracking-tight leading-snug">
              {statusMessage}
            </h3>
            
            {/* Show details if we scanned a jamaah */}
            {scannedJamaah && (status === 'success' || status === 'cooldown') && (
              <div className="flex flex-col items-center mt-3 animate-fadeIn">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">NAMA JAMAAH</span>
                <span className="text-xl font-black text-white tracking-wide mt-1 block truncate max-w-[340px]">
                  {scannedJamaah.nama_lengkap}
                </span>
                
                <span className="text-[11px] font-bold text-teal-400 mt-1 uppercase tracking-widest">
                  {scannedJamaah.kelompok} &bull; {scannedJamaah.desa}
                </span>

                {status === 'cooldown' && (
                  <span className="text-[9px] font-extrabold text-amber-500 mt-2 block bg-amber-950/60 px-3 py-1 rounded-full border border-amber-500/20">
                    COOLDOWN AKTIF (TAP DIABAIKAN)
                  </span>
                )}
              </div>
            )}

            {status === 'error' && lastScannedUid && (
              <div className="flex flex-col items-center mt-2 animate-fadeIn">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">UID KARTU</span>
                <span className="text-sm font-mono font-black text-red-400 tracking-wider mt-1 block bg-red-950/40 px-4 py-1.5 rounded-xl border border-red-500/25">
                  {lastScannedUid}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Kehadiran Terbaru (Bottom) */}
      <div className="max-w-2xl w-full mx-auto border-t border-slate-900/60 pt-6 mt-auto z-10">
        <h4 className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase mb-4 text-center">
          LOG KEHADIRAN TERBARU (MAKS 5 DATA)
        </h4>

        {history.length === 0 ? (
          <div className="text-center py-4 bg-slate-950/40 border border-slate-900/60 rounded-2xl text-slate-500 text-xs font-bold">
            Belum ada absensi terekam saat ini.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {history.map(item => (
              <div 
                key={item.id} 
                className="flex justify-between items-center bg-slate-900/50 border border-slate-900/80 hover:bg-slate-900/70 p-3 rounded-2xl text-xs font-semibold text-slate-300 animate-slideIn transition-all"
              >
                <div className="flex flex-col gap-0.5 text-left min-w-0">
                  <span className="font-extrabold text-white truncate max-w-[320px]">{item.nama_lengkap}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">{item.kelompok} &bull; {item.desa}</span>
                </div>
                <div className="flex items-center gap-2 text-right shrink-0">
                  <Clock size={11} className="text-emerald-500" />
                  <span className="font-mono text-emerald-400 font-bold">{item.time} WIB</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
