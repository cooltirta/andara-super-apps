# Blueprint Rancangan: Andara Super Apps (Pembaruan Filter & Lingkup Pengajian)

Dokumen ini berisi pembaruan cetak biru (blueprint) rancangan untuk aplikasi **Andara Super Apps**. Pembaruan ini mencakup penambahan kolom `desa` pada jamaah, penyesuaian jenis pengajian ("Pengajian Kelompok" & "Pengajian Desa"), serta pengetatan filter akses data berdasarkan peran (*role*): Member, Moderator, Admin, dan Super Admin.

---

## 1. Perubahan Database (SQLite)

Kita akan melakukan migrasi database untuk menambahkan kolom `desa` dan kolom pendukung jenis pengajian.

### A. Tabel `jamaah` (Diperbarui)
*   **Kolom Baru:** `desa` (TEXT, NOT NULL, DEFAULT `'Andara'`).
*   Menyimpan informasi wilayah desa asal jamaah.

### B. Tabel `user_profiles` (Diperbarui)
*   **Kolom Baru:** `desa` (TEXT, NOT NULL, DEFAULT `'Andara'`).
*   Menentukan wilayah desa kekuasaan pengguna (sangat penting untuk filter Admin).

### C. Tabel `sesi_presensi` (Diperbarui)
*   **Kolom Baru:** 
    *   `jenis_pengajian` (TEXT, NOT NULL, CHECK: `'Pengajian Kelompok'` atau `'Pengajian Desa'`).
    *   `kelompok` (TEXT, NULL) &mdash; Hanya diisi jika `jenis_pengajian` = `'Pengajian Kelompok'`.
    *   `desa` (TEXT, NOT NULL, DEFAULT `'Andara'`).

---

## 2. Definisi Otorisasi & Lingkup Akses Data (Terbaru)

Aplikasi akan memfilter seluruh data (baik statistik, CRUD jamaah, kehadiran, maupun user) secara otomatis di sisi backend sesuai dengan batasan peran masing-masing:

### A. Member
*   **Akses Halaman:** Hanya halaman **Home (Dashboard)**.
*   **Lingkup Filter:** 
    *   Statistik dashboard (Total Jamaah, Total Keluarga, grafik distribusi) **hanya** menampilkan data jamaah yang berada di dalam **kelompoknya sendiri** (`user.kelompok`).
    *   Statistik sesi pengajian terakhir disesuaikan dengan sesi terbaru yang relevan bagi kelompoknya (sesi Pengajian Desa atau Pengajian Kelompok miliknya).

### B. Moderator
*   **Akses Halaman:** Home, Daftar Kehadiran, User Access.
*   **Lingkup Filter:**
    *   **Home:** Hanya menampilkan statistik jamaah di **kelompoknya sendiri**.
    *   **Daftar Kehadiran:** 
        *   Daftar sesi pengajian hanya menampilkan sesi "Pengajian Desa" ATAU sesi "Pengajian Kelompok" yang ditujukan untuk kelompoknya.
        *   Lembar presensi (checklist) hanya menampilkan jamaah dari **kelompoknya sendiri** (baik pada sesi desa maupun kelompok).
        *   Pembuatan sesi baru dibatasi: hanya bisa membuat sesi "Pengajian Kelompok" untuk kelompoknya sendiri.
    *   **User Access:** Hanya menampilkan user yang memiliki kelompok yang sama dengan dirinya. Hanya bisa menambah user baru dengan role **Member** di kelompoknya sendiri.

### C. Admin
*   **Akses Halaman:** Home, Database Jamaah, Daftar Kehadiran, User Access.
*   **Lingkup Filter:**
    *   **Home:** Hanya menampilkan statistik jamaah yang berasal dari **desanya sendiri** (`user.desa`).
    *   **Database Jamaah:** 
        *   Hanya bisa melihat, menambah, mengubah, dan menghapus data jamaah yang berasal dari **desanya sendiri**.
        *   Manajemen keluarga dibatasi pada jamaah dari desanya sendiri.
    *   **Daftar Kehadiran:** 
        *   Daftar sesi pengajian hanya menampilkan sesi yang diadakan di desanya sendiri.
        *   Lembar presensi menampilkan seluruh kelompok jamaah yang ada di desanya.
        *   Bisa membuat sesi baru berupa "Pengajian Desa" (semua kelompok di desanya) atau "Pengajian Kelompok" (untuk salah satu kelompok di desanya).
    *   **User Access:** Hanya menampilkan user yang berada di desanya sendiri. Bisa menambahkan user dengan role **Moderator** dan **Member** untuk kelompok-kelompok di desanya.

### D. Super Admin
*   **Akses Halaman:** Semua halaman.
*   **Lingkup Filter:** Tanpa batasan filter (*Global Scope*). Melihat semua desa, semua kelompok, dan bebas mengelola seluruh data serta seluruh level role user.

---

## 3. Logika Inisialisasi Presensi Sesi

Untuk menghemat penyimpanan dan mengoptimalkan tampilan, saat sesi pengajian baru dibuat:
1.  Jika `jenis_pengajian` = `'Pengajian Kelompok'` (misal Kelompok: Andara 1):
    *   Sistem akan otomatis memasukkan data ke tabel `kehadiran` **hanya** untuk jamaah hidup yang terdaftar di kelompok **Andara 1**. Status *default* adalah `'Tidak Hadir'`.
2.  Jika `jenis_pengajian` = `'Pengajian Desa'` (Desa: Andara):
    *   Sistem akan otomatis memasukkan data ke tabel `kehadiran` untuk **seluruh** jamaah hidup yang terdaftar di desa **Andara** (semua kelompok di desa tersebut). Status *default* adalah `'Tidak Hadir'`.

---

## 4. Rencana Kerja Pengerjaan (Execution Steps)

1.  **Pembaruan `database.py`:**
    *   Ubah skema tabel dengan menambahkan kolom baru (`desa`, `jenis_pengajian`, dan `kelompok` untuk sesi).
    *   Perbarui dataset *seed* untuk menyesuaikan skema baru.
    *   Jalankan ulang script untuk merekonstruksi database.
2.  **Pembaruan API Backend (`app.py`):**
    *   Perbarui helper auth dan otorisasi.
    *   Terapkan klausa `WHERE` pada query database di endpoint `/api/stats`, `/api/jamaah`, `/api/keluarga`, `/api/sesi`, `/api/kehadiran`, dan `/api/users` berdasarkan role pengguna login.
    *   Sesuaikan logika insert data kehadiran saat pembuatan sesi baru.
3.  **Pembaruan Frontend SPA:**
    *   **Login Page (`login.js`):** Tambahkan dropdown simulasi `desa` atau sesuaikan profile default.
    *   **Home Dashboard (`home.js`):** Dashboard akan menampilkan data terfilter yang dikirim backend secara langsung.
    *   **Database Page (`database.js`):** Tambahkan kolom input "Desa" pada form jamaah (nilai default diisi otomatis berdasarkan desa admin/moderator). Batasi daftar pilihan Kepala Keluarga dan penambahan keluarga sesuai dengan lingkup desanya.
    *   **Presensi Page (`presensi.js`):** Tambahkan pilihan jenis pengajian dan kelompok pada modal pembuatan sesi baru.
    *   **User Access Page (`user_access.js`):** Sesuaikan form pembuatan user dengan input email, role, kelompok, dan desa.

---

## 5. Rencana Verifikasi

*   [ ] **Verifikasi Dashboard Member:** Login sebagai `member@andara.com` (Kelompok: Andara 1). Pastikan total jamaah di dashboard hanya menghitung jamaah di kelompok Andara 1.
*   [ ] **Verifikasi Presensi Kelompok vs Desa:**
    *   Login sebagai `mod2@andara.com` (Moderator Andara 2).
    *   Pastikan hanya melihat sesi "Pengajian Desa" dan sesi "Pengajian Kelompok" khusus Andara 2.
    *   Saat membuka sesi "Pengajian Desa", pastikan Moderator Andara 2 hanya melihat list absen jamaah kelompok Andara 2.
*   [ ] **Verifikasi CRUD Admin:** Login sebagai `admin@andara.com` (Desa: Andara). Coba tambahkan jamaah baru di luar desa Andara (jika diizinkan oleh Super Admin) atau pastikan hanya bisa mengedit jamaah Desa Andara.
