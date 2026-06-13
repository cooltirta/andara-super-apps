import sqlite3
import os
import uuid
from datetime import datetime

DATABASE_NAME = "database.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    # Remove database file if it exists to perform a fresh migration
    if os.path.exists(DATABASE_NAME):
        try:
            os.remove(DATABASE_NAME)
        except Exception as e:
            print(f"Warning: could not delete {DATABASE_NAME}: {e}")
            
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Tabel user_profiles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Super Admin', 'Admin', 'Moderator', 'Member')),
        kelompok TEXT NULL,
        desa TEXT NOT NULL DEFAULT 'Andara'
    );
    """)
    
    # 2. Tabel jamaah
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS jamaah (
        id TEXT PRIMARY KEY,
        nama_lengkap TEXT NOT NULL,
        jenis_kelamin TEXT NOT NULL CHECK(jenis_kelamin IN ('Laki-laki', 'Perempuan')),
        tempat_lahir TEXT NOT NULL,
        status_kehidupan TEXT NOT NULL DEFAULT 'Hidup' CHECK(status_kehidupan IN ('Hidup', 'Meninggal')),
        golongan_darah TEXT NOT NULL CHECK(golongan_darah IN ('A', 'B', 'O', 'AB')),
        kelompok TEXT NOT NULL CHECK(kelompok IN ('Andara 1', 'Andara 2', 'Andara 3', 'Andara 4', 'Andara 5', 'Lain-lain')),
        pendidikan_terakhir TEXT NOT NULL CHECK(pendidikan_terakhir IN ('Tidak Sekolah', 'SD', 'SMP', 'SMA', 'S1', 'S2', 'S3')),
        tanggal_lulus_pendidikan_terakhir TEXT NULL,
        desa TEXT NOT NULL DEFAULT 'Andara'
    );
    """)
    
    # 3. Tabel keluarga
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS keluarga (
        id TEXT PRIMARY KEY,
        nama_keluarga TEXT NOT NULL
    );
    """)
    
    # 4. Tabel anggota_keluarga
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS anggota_keluarga (
        id TEXT PRIMARY KEY,
        keluarga_id TEXT NOT NULL,
        jamaah_id TEXT UNIQUE NOT NULL,
        jenis_anggota TEXT NOT NULL CHECK(jenis_anggota IN ('Kepala Keluarga', 'Istri', 'Anak', 'Ayah', 'Ibu', 'Ayah Mertua', 'Ibu Mertua', 'Famili Lain')),
        FOREIGN KEY (keluarga_id) REFERENCES keluarga(id) ON DELETE CASCADE,
        FOREIGN KEY (jamaah_id) REFERENCES jamaah(id) ON DELETE CASCADE
    );
    """)
    
    # 5. Tabel sesi_presensi (ditambahkan created_by)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sesi_presensi (
        id TEXT PRIMARY KEY,
        tanggal TEXT NOT NULL,
        nama_sesi TEXT NOT NULL,
        keterangan TEXT NULL,
        jenis_pengajian TEXT NOT NULL CHECK(jenis_pengajian IN ('Pengajian Kelompok', 'Pengajian Desa')) DEFAULT 'Pengajian Kelompok',
        kelompok TEXT NULL,
        desa TEXT NOT NULL DEFAULT 'Andara',
        created_by TEXT NULL
    );
    """)
    
    # 6. Tabel kehadiran
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS kehadiran (
        id TEXT PRIMARY KEY,
        sesi_id TEXT NOT NULL,
        jamaah_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Tidak Hadir' CHECK(status IN ('Hadir', 'Ijin', 'Tidak Hadir')),
        FOREIGN KEY (sesi_id) REFERENCES sesi_presensi(id) ON DELETE CASCADE,
        FOREIGN KEY (jamaah_id) REFERENCES jamaah(id) ON DELETE CASCADE,
        UNIQUE(sesi_id, jamaah_id)
    );
    """)
    
    seed_data(cursor)
        
    conn.commit()
    conn.close()

def seed_data(cursor):
    # Seeding user_profiles
    users = [
        ("user_super_admin", "cooltirta@gmail.com", "Super Admin", None, "Andara"),
        ("user_admin", "admin@andara.com", "Admin", None, "Andara"),
        ("user_mod_1", "mod1@andara.com", "Moderator", "Andara 1", "Andara"),
        ("user_mod_2", "mod2@andara.com", "Moderator", "Andara 2", "Andara"),
        ("user_member", "member@andara.com", "Member", None, "Andara"),
        ("user_fulan_a", "fulan_a@andara.com", "Moderator", "Andara 2", "Andara"),
        ("user_fulan_b", "fulan_b@andara.com", "Moderator", "Andara 2", "Andara"),
        ("user_fulan_c", "fulan_c@andara.com", "Admin", "Andara 1", "Andara"),
        ("user_fulan_d", "fulan_d@andara.com", "Admin", "Andara 2", "Andara"),
    ]
    cursor.executemany("INSERT INTO user_profiles (id, email, role, kelompok, desa) VALUES (?, ?, ?, ?, ?);", users)
    
    # Seeding jamaah
    jamaahs = [
        # Keluarga 1 (Andara 1, Desa Andara)
        ("j_1", "Budi Santoso", "Laki-laki", "Jakarta", "Hidup", "O", "Andara 1", "S1", "2010-08-17", "Andara"),
        ("j_2", "Siti Aminah", "Perempuan", "Bogor", "Hidup", "A", "Andara 1", "SMA", "2012-06-20", "Andara"),
        ("j_3", "Roni Santoso", "Laki-laki", "Jakarta", "Hidup", "O", "Andara 1", "SD", "2024-06-15", "Andara"),
        # Keluarga 2 (Andara 2, Desa Andara)
        ("j_4", "Ahmad Hidayat", "Laki-laki", "Bandung", "Hidup", "B", "Andara 2", "S2", "2015-05-12", "Andara"),
        ("j_5", "Fatmawati", "Perempuan", "Surabaya", "Meninggal", "AB", "Andara 2", "SMP", "1985-06-10", "Andara"),
        # Lainnya (Desa Andara)
        ("j_6", "Joko Susilo", "Laki-laki", "Semarang", "Hidup", "O", "Andara 3", "Tidak Sekolah", None, "Andara"),
        ("j_7", "Lina Marlina", "Perempuan", "Cirebon", "Hidup", "A", "Andara 4", "S1", "2018-09-01", "Andara"),
        ("j_8", "Hendra Wijaya", "Laki-laki", "Medan", "Hidup", "B", "Andara 5", "SMA", "2005-06-18", "Andara"),
    ]
    cursor.executemany("""
        INSERT INTO jamaah (id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus_pendidikan_terakhir, desa)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, jamaahs)
    
    # Seeding keluarga
    families = [
        ("f_1", "Keluarga Budi Santoso"),
        ("f_2", "Keluarga Ahmad Hidayat"),
    ]
    cursor.executemany("INSERT INTO keluarga (id, nama_keluarga) VALUES (?, ?);", families)
    
    # Seeding anggota_keluarga
    family_members = [
        ("am_1", "f_1", "j_1", "Kepala Keluarga"),
        ("am_2", "f_1", "j_2", "Istri"),
        ("am_3", "f_1", "j_3", "Anak"),
        ("am_4", "f_2", "j_4", "Kepala Keluarga"),
        ("am_5", "f_2", "j_5", "Istri"),
    ]
    cursor.executemany("INSERT INTO anggota_keluarga (id, keluarga_id, jamaah_id, jenis_anggota) VALUES (?, ?, ?, ?);", family_members)
    
    # Seeding sesi_presensi (ditambahkan created_by)
    sessions = [
        ("s_1", "2026-06-04", "Pengajian Kelompok Andara 1", "Membahas Kitab Riyadhus Shalihin", "Pengajian Kelompok", "Andara 1", "Andara", "mod1@andara.com"),
        ("s_2", "2026-06-11", "Kajian Bulanan Tafsir Desa Andara", "Membahas Tafsir Al-Quran", "Pengajian Desa", None, "Andara", "admin@andara.com"),
    ]
    cursor.executemany("INSERT INTO sesi_presensi (id, tanggal, nama_sesi, keterangan, jenis_pengajian, kelompok, desa, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?);", sessions)
    
    # Seeding kehadiran
    kehadirans = [
        # Sesi 1: Pengajian Kelompok (Andara 1) -> j_1, j_2, j_3
        ("k_1", "s_1", "j_1", "Hadir"),
        ("k_2", "s_1", "j_2", "Hadir"),
        ("k_3", "s_1", "j_3", "Hadir"),
        
        # Sesi 2: Pengajian Desa (Desa Andara) -> j_1, j_2, j_3, j_4, j_6, j_7, j_8
        ("k_4", "s_2", "j_1", "Hadir"),
        ("k_5", "s_2", "j_2", "Hadir"),
        ("k_6", "s_2", "j_3", "Tidak Hadir"),
        ("k_7", "s_2", "j_4", "Hadir"),
        ("k_8", "s_2", "j_6", "Tidak Hadir"),
        ("k_9", "s_2", "j_7", "Ijin"),
        ("k_10", "s_2", "j_8", "Hadir"),
    ]
    cursor.executemany("INSERT INTO kehadiran (id, sesi_id, jamaah_id, status) VALUES (?, ?, ?, ?);", kehadirans)

if __name__ == "__main__":
    init_db()
    print("Database berhasil di-reset, migrasi kolom 'created_by' sukses, dan data telah di-seed.")
