"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ClipboardCheck, ShieldCheck, LogOut, Menu, X, Bell, History, MapPin, Compass, Heart, Package, Calendar, Radio } from 'lucide-react';

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = async () => {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login';
      } else {
        if (spinner) spinner.classList.add('hidden');
      }
    } catch (err) {
      console.error("Gagal logout:", err);
      if (spinner) spinner.classList.add('hidden');
    }
  };

  const role = user.role;
  const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}&backgroundColor=0f766e,3f5e43`;

  return (
    <>
      {/* Top Header Bar */}
      <header className="fixed top-0 right-0 left-0 lg:left-72 h-16 bg-white border-b border-slate-100 z-30 flex items-center justify-between px-6 shadow-sm">
        {/* Left: Mobile Toggle & Brand in Mobile */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-50 focus:outline-none transition-all duration-200"
            aria-label="Toggle Sidebar"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="text-slate-800 lg:hidden font-extrabold tracking-tight text-sm uppercase">
            Taqlima
          </span>
        </div>

        {/* Right: Notifications & User Avatar Profile */}
        <div className="flex items-center gap-4 relative">
          <button className="p-2 rounded-full text-slate-500 hover:bg-slate-50 transition-colors">
            <Bell size={20} />
          </button>
          
          {/* User profile button */}
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-full p-1 hover:bg-slate-50 transition-all"
            >
              <img className="w-8 h-8 rounded-full border border-slate-200 object-cover" src={avatarUrl} alt="Avatar" />
              <span className="text-xs font-bold text-slate-700 hidden sm:inline-block truncate max-w-[120px]">
                {user.email.split('@')[0]}
              </span>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-45" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-800 truncate">{user.email}</p>
                    <span className="text-[10px] font-bold text-primary bg-primary-light px-2 py-0.5 rounded-full inline-block mt-1 uppercase">
                      {role}
                    </span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm font-semibold text-red-650 hover:bg-red-50 transition-colors mt-1"
                  >
                    <LogOut size={16} />
                    <span>Keluar Sesi</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar Backdrop Overlay on Mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 z-35 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`w-72 fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ease-in-out flex flex-col justify-between py-6 bg-white border-r border-slate-100 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col gap-6">
          {/* Logo Brand Header */}
          <div className="flex items-center justify-center px-6 pb-6 border-b border-slate-100">
            <img src="/logo-horizontal.png" alt="Taqlima Logo" className="h-10 w-auto object-contain" />
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3 mb-2 block">
              Menu Utama
            </span>

            {/* 1. Beranda */}
            <Link 
              href="/dashboard" 
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                pathname === '/dashboard' 
                  ? 'bg-primary-light text-primary font-bold shadow-sm' 
                  : 'text-slate-600 hover:text-primary hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard size={18} />
              <span>Beranda</span>
            </Link>

            {/* 2. Database Jamaah */}
            {(user.can_read_jamaah || user.can_read_keluarga) && (
              <Link 
                href="/dashboard/database" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/database' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-650 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <Users size={18} />
                <span>Database Jamaah</span>
              </Link>
            )}

            {/* 3. Ngajiku */}
            {(user.can_read_kehadiran || user.can_create_kehadiran || user.can_update_kehadiran || user.can_delete_kehadiran || user.can_read_laporan) && (
              <Link 
                href="/dashboard/presensi" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/presensi' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-650 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <ClipboardCheck size={18} />
                <span>Ngajiku</span>
              </Link>
            )}

            {/* Kiosk RFID */}
            {(user.can_read_kehadiran || user.can_create_kehadiran || user.can_update_kehadiran) && (
              <Link 
                href="/dashboard/presensi/rfid" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/presensi/rfid' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-650 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <Radio size={18} />
                <span>Kiosk RFID</span>
              </Link>
            )}

            {/* 4. Kalender */}
            {user.can_read_kalender && (
              <Link 
                href="/dashboard/kalender" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/kalender' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-655 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <Calendar size={18} />
                <span>Kalender</span>
              </Link>
            )}

            {/* 5. Dapukan & Wilayah */}
            {user.can_read_lokasi && (
              <Link 
                href="/dashboard/lokasi" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/lokasi' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-650 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <MapPin size={18} />
                <span>Dapukan & Wilayah</span>
              </Link>
            )}

            {/* 6. User Access */}
            {user.can_read_user && (
              <Link 
                href="/dashboard/users" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/users' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-650 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <ShieldCheck size={18} />
                <span>User Access</span>
              </Link>
            )}

            {/* 7. Rekam Jejak */}
            {user.can_read_logs && (
              <Link 
                href="/dashboard/activity-logs" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/activity-logs' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-650 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <History size={18} />
                <span>Rekam Jejak</span>
              </Link>
            )}

            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3 mt-4 mb-2 block">
              Tim & Layanan SB
            </span>

            {/* 1. Tim Haji */}
            {user.can_read_haji && (
              <Link 
                href="/dashboard/haji" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/haji' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-650 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <Compass size={18} />
                <span>Tim Haji</span>
              </Link>
            )}

            {/* 2. Tim PNKB */}
            {user.can_read_pnkb && (
              <Link 
                href="/dashboard/pnkb" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/pnkb' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-650 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <Heart size={18} />
                <span>Tim PNKB</span>
              </Link>
            )}

            {/* 3. Benda Sabilillah */}
            {user.can_read_sabilillah && (
              <Link 
                href="/dashboard/sabilillah" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-3xl font-semibold text-sm transition-all duration-150 ${
                  pathname === '/dashboard/sabilillah' 
                    ? 'bg-primary-light text-primary font-bold shadow-sm' 
                    : 'text-slate-650 hover:text-primary hover:bg-slate-50'
                }`}
              >
                <Package size={18} />
                <span>Benda Sabilillah</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Sidebar Footer - Clean user banner */}
        <div className="px-6 border-t border-slate-100 pt-6">
          <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center text-sm font-extrabold border border-slate-200 shrink-0">
              {user.email.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate" title={user.email}>
                {user.email.split('@')[0]}
              </span>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide truncate">
                {role}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
