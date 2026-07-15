import "./globals.css";

export const metadata = {
  title: "Taqlima",
  description: "Aplikasi Pendataan & Kehadiran Jamaah Pengajian Desa Andara",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {/* Global Loading Spinner */}
        <div id="loading-spinner" className="spinner-overlay hidden">
          <div className="spinner"></div>
        </div>
        {children}
      </body>
    </html>
  );
}
