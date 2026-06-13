import { cookies } from 'next/headers';
import db from '@/lib/db';
import { redirect } from 'next/navigation';
import Sidebar from './Sidebar';

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies();
  const emailCookie = cookieStore.get('user_email');

  if (!emailCookie) {
    redirect('/login');
  }

  const { rows } = await db.query("SELECT * FROM user_profiles WHERE email = $1;", [email]);
  const user = rows[0];

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans">
      {/* Client-side Interactive Sidebar */}
      <Sidebar user={user} />

      {/* Main Dashboard Content */}
      <main className="lg:pl-[19.5rem] pt-24 pb-10 px-6 lg:px-8 min-h-screen transition-all duration-300 overflow-x-hidden">
        {children}
      </main>

      {/* Toast Notification Container */}
      <div id="toast-container" className="toast-container"></div>
    </div>
  );
}
