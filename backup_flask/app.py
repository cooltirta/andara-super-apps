from flask import Flask, request, jsonify, render_template, session, g
from flask_cors import CORS
import os
import uuid
from datetime import datetime
from database import get_db_connection, init_db

app = Flask(__name__, 
            static_folder="static", 
            template_folder="templates")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "andara_super_secret_key_12345")
CORS(app) # Enable CORS

# helper database
@app.before_request
def before_request():
    g.db = get_db_connection()

@app.teardown_request
def teardown_request(exception):
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()

# Helper: Ambil User Login Saat Ini
def get_current_user():
    if "user_email" not in session:
        return None
    
    cursor = g.db.cursor()
    cursor.execute("SELECT * FROM user_profiles WHERE email = ?;", (session["user_email"],))
    user = cursor.fetchone()
    if user:
        return dict(user)
    return None

# Helper: Cek Otorisasi Modifikasi Sesi (Delete & Update)
def can_modify_session(sesi, user):
    if not user:
        return False
    if user["role"] == "Super Admin":
        return True
        
    s_dict = dict(sesi)
    if s_dict["jenis_pengajian"] == "Pengajian Desa":
        # Only Admin from the same village can delete/update
        return user["role"] == "Admin" and user["desa"] == s_dict["desa"]
        
    elif s_dict["jenis_pengajian"] == "Pengajian Kelompok":
        if user["desa"] != s_dict["desa"]:
            return False
        if user["role"] == "Admin":
            return user["kelompok"] is None or user["kelompok"] == s_dict["kelompok"]
        elif user["role"] == "Moderator":
            return user["kelompok"] == s_dict["kelompok"]
            
    return False

# Helper: Dekorator Proteksi Role
def require_roles(*roles):
    def decorator(f):
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({"error": "Tidak terautentikasi"}), 401
            if user["role"] not in roles:
                return jsonify({"error": "Akses ditolak: Hak akses tidak mencukupi"}), 403
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

# ==========================================================================
# AUTHENTICATION API
# ==========================================================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.json
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email wajib diisi"}), 400
        
    email = email.strip().lower()
    
    desa = data.get("desa", "Andara")
    kelompok = data.get("kelompok")
    
    cursor = g.db.cursor()
    cursor.execute("SELECT * FROM user_profiles WHERE email = ?;", (email,))
    user = cursor.fetchone()
    
    if not user:
        user_id = str(uuid.uuid4())
        role = "Member"
        
        if email == "cooltirta@gmail.com":
            role = "Super Admin"
            desa = "Andara"
            kelompok = None
            
        cursor.execute(
            "INSERT INTO user_profiles (id, email, role, kelompok, desa) VALUES (?, ?, ?, ?, ?);",
            (user_id, email, role, kelompok, desa)
        )
        g.db.commit()
        cursor.execute("SELECT * FROM user_profiles WHERE email = ?;", (email,))
        user = cursor.fetchone()
    else:
        user_dict = dict(user)
        if email != "cooltirta@gmail.com" and (kelompok is not None or desa != user_dict["desa"]):
            cursor.execute(
                "UPDATE user_profiles SET kelompok = ?, desa = ? WHERE email = ?;",
                (kelompok, desa, email)
            )
            g.db.commit()
            cursor.execute("SELECT * FROM user_profiles WHERE email = ?;", (email,))
            user = cursor.fetchone()
        
    user_dict = dict(user)
    session["user_email"] = user_dict["email"]
    return jsonify(user_dict)

@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    user = get_current_user()
    if not user:
        return jsonify({"user": None}), 200
    return jsonify({"user": user})

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.pop("user_email", None)
    return jsonify({"success": True, "message": "Berhasil keluar"})

# ==========================================================================
# JAMAAH CRUD API
# ==========================================================================

@app.route('/api/jamaah', methods=['GET'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def get_jamaah():
    user = get_current_user()
    cursor = g.db.cursor()
    
    if user["role"] == "Super Admin":
        cursor.execute("""
            SELECT j.*, ak.keluarga_id, k.nama_keluarga, ak.jenis_anggota 
            FROM jamaah j
            LEFT JOIN anggota_keluarga ak ON j.id = ak.jamaah_id
            LEFT JOIN keluarga k ON ak.keluarga_id = k.id
            ORDER BY j.desa ASC, j.kelompok ASC, j.nama_lengkap ASC;
        """)
    elif user["role"] == "Admin":
        cursor.execute("""
            SELECT j.*, ak.keluarga_id, k.nama_keluarga, ak.jenis_anggota 
            FROM jamaah j
            LEFT JOIN anggota_keluarga ak ON j.id = ak.jamaah_id
            LEFT JOIN keluarga k ON ak.keluarga_id = k.id
            WHERE j.desa = ?
            ORDER BY j.kelompok ASC, j.nama_lengkap ASC;
        """, (user["desa"],))
    else: # Moderator
        cursor.execute("""
            SELECT j.*, ak.keluarga_id, k.nama_keluarga, ak.jenis_anggota 
            FROM jamaah j
            LEFT JOIN anggota_keluarga ak ON j.id = ak.jamaah_id
            LEFT JOIN keluarga k ON ak.keluarga_id = k.id
            WHERE j.kelompok = ? AND j.desa = ?
            ORDER BY j.nama_lengkap ASC;
        """, (user["kelompok"], user["desa"]))
        
    jamaah_list = [dict(row) for row in cursor.fetchall()]
    return jsonify(jamaah_list)

@app.route('/api/jamaah', methods=['POST'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def create_jamaah():
    user = get_current_user()
    data = request.json
    nama_lengkap = data.get("nama_lengkap")
    jenis_kelamin = data.get("jenis_kelamin")
    tempat_lahir = data.get("tempat_lahir")
    status_kehidupan = data.get("status_kehidupan", "Hidup")
    golongan_darah = data.get("golongan_darah")
    kelompok = data.get("kelompok")
    pendidikan_terakhir = data.get("pendidikan_terakhir")
    tanggal_lulus = data.get("tanggal_lulus_pendidikan_terakhir")
    
    desa = data.get("desa", "Andara")
    
    if user["role"] == "Moderator":
        kelompok = user["kelompok"]
        desa = user["desa"]
    elif user["role"] == "Admin":
        desa = user["desa"]
        
    if not all([nama_lengkap, jenis_kelamin, tempat_lahir, golongan_darah, kelompok, pendidikan_terakhir]):
        return jsonify({"error": "Semua data wajib diisi kecuali tanggal lulus"}), 400
        
    if pendidikan_terakhir != "Tidak Sekolah" and not tanggal_lulus:
        return jsonify({"error": "Tanggal lulus wajib diisi jika memiliki riwayat sekolah"}), 400
        
    if pendidikan_terakhir == "Tidak Sekolah":
        tanggal_lulus = None
        
    jamaah_id = str(uuid.uuid4())
    cursor = g.db.cursor()
    try:
        # 1. Masukkan data jamaah baru
        cursor.execute("""
            INSERT INTO jamaah (id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus_pendidikan_terakhir, desa)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (jamaah_id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus, desa))
        
        # 2. Sinkronisasikan jamaah baru ke lembar presensi sesi yang sudah dibuat & relevan
        # Skenario: "namanya harus langsung ada di lembar presensi dengan default Tidak Hadir"
        # Cari semua sesi presensi di desa yang sama, bertipe Pengajian Desa, ATAU bertipe Pengajian Kelompok kelompok tersebut
        cursor.execute("""
            SELECT id FROM sesi_presensi 
            WHERE desa = ? AND (jenis_pengajian = 'Pengajian Desa' OR (jenis_pengajian = 'Pengajian Kelompok' AND kelompok = ?));
        """, (desa, kelompok))
        matching_sessions = cursor.fetchall()
        
        kehadiran_inserts = []
        for s in matching_sessions:
            kehadiran_inserts.append((str(uuid.uuid4()), s["id"], jamaah_id, "Tidak Hadir"))
            
        if kehadiran_inserts:
            cursor.executemany("INSERT INTO kehadiran (id, sesi_id, jamaah_id, status) VALUES (?, ?, ?, ?);", kehadiran_inserts)
            
        g.db.commit()
        return jsonify({"success": True, "id": jamaah_id, "message": "Data jamaah berhasil ditambahkan & disinkronisasikan ke sesi presensi aktif."})
    except Exception as e:
        g.db.rollback()
        return jsonify({"error": f"Gagal menambahkan data: {str(e)}"}), 500

@app.route('/api/jamaah/<id>', methods=['PUT'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def update_jamaah(id):
    user = get_current_user()
    data = request.json
    nama_lengkap = data.get("nama_lengkap")
    jenis_kelamin = data.get("jenis_kelamin")
    tempat_lahir = data.get("tempat_lahir")
    status_kehidupan = data.get("status_kehidupan")
    golongan_darah = data.get("golongan_darah")
    kelompok = data.get("kelompok")
    pendidikan_terakhir = data.get("pendidikan_terakhir")
    tanggal_lulus = data.get("tanggal_lulus_pendidikan_terakhir")
    desa = data.get("desa", "Andara")
    
    cursor = g.db.cursor()
    
    cursor.execute("SELECT * FROM jamaah WHERE id = ?;", (id,))
    orig = cursor.fetchone()
    if not orig:
        return jsonify({"error": "Data jamaah tidak ditemukan"}), 404
        
    orig = dict(orig)
    
    if user["role"] == "Moderator":
        if orig["kelompok"] != user["kelompok"] or orig["desa"] != user["desa"]:
            return jsonify({"error": "Akses ditolak: Jamaah di luar kelompok Anda"}), 403
        kelompok = user["kelompok"]
        desa = user["desa"]
    elif user["role"] == "Admin":
        if orig["desa"] != user["desa"]:
            return jsonify({"error": "Akses ditolak: Jamaah di luar desa Anda"}), 403
        desa = user["desa"]
        
    if not all([nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir]):
        return jsonify({"error": "Semua data wajib diisi"}), 400
        
    if pendidikan_terakhir != "Tidak Sekolah" and not tanggal_lulus:
        return jsonify({"error": "Tanggal lulus wajib diisi"}), 400
        
    if pendidikan_terakhir == "Tidak Sekolah":
        tanggal_lulus = None
        
    try:
        cursor.execute("""
            UPDATE jamaah 
            SET nama_lengkap = ?, jenis_kelamin = ?, tempat_lahir = ?, status_kehidupan = ?, golongan_darah = ?, kelompok = ?, pendidikan_terakhir = ?, tanggal_lulus_pendidikan_terakhir = ?, desa = ?
            WHERE id = ?;
        """, (nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus, desa, id))
        g.db.commit()
        return jsonify({"success": True, "message": "Data jamaah berhasil diperbarui"})
    except Exception as e:
        return jsonify({"error": f"Gagal memperbarui data: {str(e)}"}), 500

@app.route('/api/jamaah/<id>', methods=['DELETE'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def delete_jamaah(id):
    user = get_current_user()
    cursor = g.db.cursor()
    
    cursor.execute("SELECT * FROM jamaah WHERE id = ?;", (id,))
    orig = cursor.fetchone()
    if not orig:
        return jsonify({"error": "Data jamaah tidak ditemukan"}), 404
        
    orig = dict(orig)
    
    if user["role"] == "Moderator" and (orig["kelompok"] != user["kelompok"] or orig["desa"] != user["desa"]):
        return jsonify({"error": "Akses ditolak: Jamaah di luar kelompok Anda"}), 403
    elif user["role"] == "Admin" and orig["desa"] != user["desa"]:
        return jsonify({"error": "Akses ditolak: Jamaah di luar desa Anda"}), 403
        
    try:
        cursor.execute("DELETE FROM jamaah WHERE id = ?;", (id,))
        g.db.commit()
        return jsonify({"success": True, "message": "Data jamaah berhasil dihapus"})
    except Exception as e:
        return jsonify({"error": f"Gagal menghapus data: {str(e)}"}), 500

# ==========================================================================
# KELUARGA API
# ==========================================================================

@app.route('/api/keluarga', methods=['GET'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def get_keluarga():
    user = get_current_user()
    cursor = g.db.cursor()
    
    if user["role"] == "Super Admin":
        cursor.execute("SELECT * FROM keluarga ORDER BY nama_keluarga ASC;")
    elif user["role"] == "Admin":
        cursor.execute("""
            SELECT DISTINCT k.* 
            FROM keluarga k 
            JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
            JOIN jamaah j ON ak.jamaah_id = j.id
            WHERE j.desa = ?
            ORDER BY k.nama_keluarga ASC;
        """, (user["desa"],))
    else: # Moderator
        cursor.execute("""
            SELECT DISTINCT k.* 
            FROM keluarga k 
            JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
            JOIN jamaah j ON ak.jamaah_id = j.id
            WHERE j.kelompok = ? AND j.desa = ?
            ORDER BY k.nama_keluarga ASC;
        """, (user["kelompok"], user["desa"]))
        
    keluarga_list = [dict(row) for row in cursor.fetchall()]
    
    for fam in keluarga_list:
        cursor.execute("""
            SELECT ak.id as anggota_id, ak.jenis_anggota, j.id as jamaah_id, j.nama_lengkap, j.kelompok, j.status_kehidupan, j.desa
            FROM anggota_keluarga ak
            JOIN jamaah j ON ak.jamaah_id = j.id
            WHERE ak.keluarga_id = ?;
        """, (fam["id"],))
        fam["anggota"] = [dict(row) for row in cursor.fetchall()]
        
    return jsonify(keluarga_list)

@app.route('/api/keluarga', methods=['POST'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def create_keluarga():
    user = get_current_user()
    data = request.json
    kepala_keluarga_id = data.get("kepala_keluarga_id")
    
    if not kepala_keluarga_id:
        return jsonify({"error": "Harus memilih jamaah sebagai Kepala Keluarga"}), 400
        
    cursor = g.db.cursor()
    cursor.execute("SELECT * FROM jamaah WHERE id = ?;", (kepala_keluarga_id,))
    jamaah = cursor.fetchone()
    if not jamaah:
        return jsonify({"error": "Jamaah tidak ditemukan"}), 404
    jamaah = dict(jamaah)
        
    if user["role"] == "Moderator" and (jamaah["kelompok"] != user["kelompok"] or jamaah["desa"] != user["desa"]):
        return jsonify({"error": "Akses ditolak: Kepala Keluarga harus berada di kelompok Anda"}), 403
    elif user["role"] == "Admin" and jamaah["desa"] != user["desa"]:
        return jsonify({"error": "Akses ditolak: Kepala Keluarga harus berada di desa Anda"}), 403
        
    cursor.execute("SELECT keluarga_id FROM anggota_keluarga WHERE jamaah_id = ?;", (kepala_keluarga_id,))
    existing = cursor.fetchone()
    if existing:
        return jsonify({"error": "Jamaah ini sudah terdaftar sebagai anggota di keluarga lain"}), 400
        
    keluarga_id = str(uuid.uuid4())
    nama_keluarga = f"Keluarga {jamaah['nama_lengkap']}"
    anggota_id = str(uuid.uuid4())
    
    try:
        cursor.execute("INSERT INTO keluarga (id, nama_keluarga) VALUES (?, ?);", (keluarga_id, nama_keluarga))
        cursor.execute("""
            INSERT INTO anggota_keluarga (id, keluarga_id, jamaah_id, jenis_anggota) 
            VALUES (?, ?, ?, 'Kepala Keluarga');
        """, (anggota_id, keluarga_id, kepala_keluarga_id))
        g.db.commit()
        return jsonify({"success": True, "id": keluarga_id, "nama_keluarga": nama_keluarga, "message": "Keluarga baru berhasil dibuat"})
    except Exception as e:
        g.db.rollback()
        return jsonify({"error": f"Gagal membuat keluarga: {str(e)}"}), 500

@app.route('/api/keluarga/<id>', methods=['DELETE'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def delete_keluarga(id):
    user = get_current_user()
    cursor = g.db.cursor()
    
    cursor.execute("""
        SELECT j.* FROM anggota_keluarga ak 
        JOIN jamaah j ON ak.jamaah_id = j.id 
        WHERE ak.keluarga_id = ? LIMIT 1;
    """, (id,))
    j_row = cursor.fetchone()
    
    if j_row:
        j_row = dict(j_row)
        if user["role"] == "Moderator" and (j_row["kelompok"] != user["kelompok"] or j_row["desa"] != user["desa"]):
            return jsonify({"error": "Akses ditolak: Unit keluarga di luar kelompok Anda"}), 403
        elif user["role"] == "Admin" and j_row["desa"] != user["desa"]:
            return jsonify({"error": "Akses ditolak: Unit keluarga di luar desa Anda"}), 403
            
    try:
        cursor.execute("DELETE FROM keluarga WHERE id = ?;", (id,))
        g.db.commit()
        return jsonify({"success": True, "message": "Keluarga berhasil dihapus"})
    except Exception as e:
        return jsonify({"error": f"Gagal menghapus keluarga: {str(e)}"}), 500

@app.route('/api/keluarga/<id>/anggota', methods=['POST'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def add_anggota_keluarga(id):
    user = get_current_user()
    data = request.json
    jamaah_id = data.get("jamaah_id")
    jenis_anggota = data.get("jenis_anggota")
    
    if not all([jamaah_id, jenis_anggota]):
        return jsonify({"error": "Jamaah dan jenis anggota wajib dipilih"}), 400
        
    cursor = g.db.cursor()
    
    cursor.execute("SELECT * FROM jamaah WHERE id = ?;", (jamaah_id,))
    j_target = cursor.fetchone()
    if not j_target:
        return jsonify({"error": "Jamaah tidak ditemukan"}), 404
    j_target = dict(j_target)
    
    if user["role"] == "Moderator" and (j_target["kelompok"] != user["kelompok"] or j_target["desa"] != user["desa"]):
        return jsonify({"error": "Akses ditolak: Jamaah harus berada di kelompok Anda"}), 403
    elif user["role"] == "Admin" and j_target["desa"] != user["desa"]:
        return jsonify({"error": "Akses ditolak: Jamaah harus berada di desa Anda"}), 403
        
    cursor.execute("SELECT keluarga_id FROM anggota_keluarga WHERE jamaah_id = ?;", (jamaah_id,))
    existing = cursor.fetchone()
    if existing:
        return jsonify({"error": "Jamaah ini sudah terdaftar di keluarga lain"}), 400
        
    if jenis_anggota == 'Kepala Keluarga':
        cursor.execute("SELECT COUNT(*) FROM anggota_keluarga WHERE keluarga_id = ? AND jenis_anggota = 'Kepala Keluarga';", (id,))
        if cursor.fetchone()[0] > 0:
            return jsonify({"error": "Keluarga ini sudah memiliki Kepala Keluarga"}), 400
            
    anggota_id = str(uuid.uuid4())
    try:
        cursor.execute("""
            INSERT INTO anggota_keluarga (id, keluarga_id, jamaah_id, jenis_anggota) 
            VALUES (?, ?, ?, ?);
        """, (anggota_id, id, jamaah_id, jenis_anggota))
        g.db.commit()
        return jsonify({"success": True, "message": "Anggota keluarga berhasil ditambahkan"})
    except Exception as e:
        return jsonify({"error": f"Gagal menambahkan anggota keluarga: {str(e)}"}), 500

@app.route('/api/keluarga/anggota/<anggota_id>', methods=['DELETE'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def remove_anggota_keluarga(anggota_id):
    user = get_current_user()
    cursor = g.db.cursor()
    
    cursor.execute("""
        SELECT j.* FROM anggota_keluarga ak 
        JOIN jamaah j ON ak.jamaah_id = j.id 
        WHERE ak.id = ?;
    """, (anggota_id,))
    j_row = cursor.fetchone()
    if not j_row:
        return jsonify({"error": "Anggota keluarga tidak ditemukan"}), 404
        
    j_row = dict(j_row)
    if user["role"] == "Moderator" and (j_row["kelompok"] != user["kelompok"] or j_row["desa"] != user["desa"]):
        return jsonify({"error": "Akses ditolak: Anggota keluarga di luar kelompok Anda"}), 403
    elif user["role"] == "Admin" and j_row["desa"] != user["desa"]:
        return jsonify({"error": "Akses ditolak: Anggota keluarga di luar desa Anda"}), 403
        
    try:
        cursor.execute("DELETE FROM anggota_keluarga WHERE id = ?;", (anggota_id,))
        g.db.commit()
        return jsonify({"success": True, "message": "Anggota keluarga berhasil dikeluarkan"})
    except Exception as e:
        return jsonify({"error": f"Gagal mengeluarkan anggota: {str(e)}"}), 500

# ==========================================================================
# SESI PRESENSI API
# ==========================================================================

@app.route('/api/sesi', methods=['GET'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def get_sesi():
    user = get_current_user()
    cursor = g.db.cursor()
    
    if user["role"] == "Super Admin":
        cursor.execute("SELECT * FROM sesi_presensi ORDER BY tanggal DESC, nama_sesi ASC;")
    elif user["role"] == "Admin":
        cursor.execute("SELECT * FROM sesi_presensi WHERE desa = ? ORDER BY tanggal DESC, nama_sesi ASC;", (user["desa"],))
    else: # Moderator
        cursor.execute("""
            SELECT * FROM sesi_presensi 
            WHERE desa = ? AND (jenis_pengajian = 'Pengajian Desa' OR (jenis_pengajian = 'Pengajian Kelompok' AND kelompok = ?))
            ORDER BY tanggal DESC, nama_sesi ASC;
        """, (user["desa"], user["kelompok"]))
        
    sesi_list = [dict(row) for row in cursor.fetchall()]
    for s in sesi_list:
        s["can_edit"] = can_modify_session(s, user)
    return jsonify(sesi_list)

@app.route('/api/sesi', methods=['POST'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def create_sesi():
    user = get_current_user()
    data = request.json
    nama_sesi = data.get("nama_sesi")
    tanggal = data.get("tanggal", datetime.now().strftime("%Y-%m-%d"))
    keterangan = data.get("keterangan")
    
    jenis_pengajian = data.get("jenis_pengajian", "Pengajian Kelompok")
    kelompok_sesi = data.get("kelompok") 
    desa_sesi = data.get("desa", "Andara")
    created_by = user["email"] # Penanda pembuat sesi
    
    if user["role"] == "Moderator":
        jenis_pengajian = "Pengajian Kelompok"
        kelompok_sesi = user["kelompok"]
        desa_sesi = user["desa"]
    elif user["role"] == "Admin":
        desa_sesi = user["desa"]
        if jenis_pengajian == "Pengajian Desa":
            kelompok_sesi = None
            
    if not nama_sesi:
        return jsonify({"error": "Nama sesi wajib diisi"}), 400
        
    if jenis_pengajian == "Pengajian Kelompok" and not kelompok_sesi:
        return jsonify({"error": "Kelompok wajib dipilih untuk pengajian tingkat kelompok"}), 400
        
    sesi_id = str(uuid.uuid4())
    cursor = g.db.cursor()
    try:
        # Masukkan detail created_by
        cursor.execute("""
            INSERT INTO sesi_presensi (id, tanggal, nama_sesi, keterangan, jenis_pengajian, kelompok, desa, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """, (sesi_id, tanggal, nama_sesi, keterangan, jenis_pengajian, kelompok_sesi, desa_sesi, created_by))
                       
        if jenis_pengajian == "Pengajian Kelompok":
            cursor.execute("""
                SELECT id FROM jamaah 
                WHERE status_kehidupan = 'Hidup' AND kelompok = ? AND desa = ?;
            """, (kelompok_sesi, desa_sesi))
        else: # Pengajian Desa
            cursor.execute("""
                SELECT id FROM jamaah 
                WHERE status_kehidupan = 'Hidup' AND desa = ?;
            """, (desa_sesi,))
            
        jamaahs = cursor.fetchall()
        
        kehadiran_records = []
        for j in jamaahs:
            kehadiran_records.append((str(uuid.uuid4()), sesi_id, j["id"], "Tidak Hadir"))
            
        if kehadiran_records:
            cursor.executemany("INSERT INTO kehadiran (id, sesi_id, jamaah_id, status) VALUES (?, ?, ?, ?);", kehadiran_records)
            
        g.db.commit()
        return jsonify({"success": True, "id": sesi_id, "message": "Sesi pengajian baru berhasil dibuat"})
    except Exception as e:
        g.db.rollback()
        return jsonify({"error": f"Gagal membuat sesi: {str(e)}"}), 500

@app.route('/api/sesi/<id>', methods=['DELETE'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def delete_sesi(id):
    user = get_current_user()
    cursor = g.db.cursor()
    
    cursor.execute("SELECT * FROM sesi_presensi WHERE id = ?;", (id,))
    orig = cursor.fetchone()
    if not orig:
        return jsonify({"error": "Sesi tidak ditemukan"}), 404
    orig = dict(orig)
    
    # Hak penghapusan:
    # "untuk setiap jamaah yang memiliki akses dan berasal dari kelompok atau desa yang sama maka bisa juga menghapus."
    if not can_modify_session(orig, user):
        return jsonify({"error": "Akses ditolak: Anda tidak memiliki wewenang untuk menghapus sesi ini."}), 403
            
    try:
        cursor.execute("DELETE FROM sesi_presensi WHERE id = ?;", (id,))
        g.db.commit()
        return jsonify({"success": True, "message": "Sesi berhasil dihapus"})
    except Exception as e:
        return jsonify({"error": f"Gagal menghapus sesi: {str(e)}"}), 500

# ==========================================================================
# KEHADIRAN / PRESENSI DETAIL API
# ==========================================================================

@app.route('/api/kehadiran/<sesi_id>', methods=['GET'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def get_kehadiran_detail(sesi_id):
    user = get_current_user()
    cursor = g.db.cursor()
    
    cursor.execute("SELECT * FROM sesi_presensi WHERE id = ?;", (sesi_id,))
    sesi = cursor.fetchone()
    if not sesi:
        return jsonify({"error": "Sesi tidak ditemukan"}), 404
    sesi = dict(sesi)
        
    if user["role"] == "Moderator":
        if sesi["desa"] != user["desa"] or (sesi["jenis_pengajian"] == "Pengajian Kelompok" and sesi["kelompok"] != user["kelompok"]):
            return jsonify({"error": "Akses ditolak: Sesi di luar cakupan akses Anda"}), 403
    elif user["role"] == "Admin":
        if sesi["desa"] != user["desa"]:
            return jsonify({"error": "Akses ditolak: Sesi di luar desa Anda"}), 403
            
    if user["role"] == "Super Admin":
        cursor.execute("""
            SELECT k.id as kehadiran_id, k.status, j.id as jamaah_id, j.nama_lengkap, j.kelompok, j.jenis_kelamin, j.desa
            FROM kehadiran k
            JOIN jamaah j ON k.jamaah_id = j.id
            WHERE k.sesi_id = ?
            ORDER BY j.desa ASC, j.kelompok ASC, j.nama_lengkap ASC;
        """, (sesi_id,))
    elif user["role"] == "Admin":
        cursor.execute("""
            SELECT k.id as kehadiran_id, k.status, j.id as jamaah_id, j.nama_lengkap, j.kelompok, j.jenis_kelamin, j.desa
            FROM kehadiran k
            JOIN jamaah j ON k.jamaah_id = j.id
            WHERE k.sesi_id = ? AND j.desa = ?
            ORDER BY j.kelompok ASC, j.nama_lengkap ASC;
        """, (sesi_id, user["desa"]))
    else: # Moderator
        cursor.execute("""
            SELECT k.id as kehadiran_id, k.status, j.id as jamaah_id, j.nama_lengkap, j.kelompok, j.jenis_kelamin, j.desa
            FROM kehadiran k
            JOIN jamaah j ON k.jamaah_id = j.id
            WHERE k.sesi_id = ? AND j.kelompok = ? AND j.desa = ?
            ORDER BY j.nama_lengkap ASC;
        """, (sesi_id, user["kelompok"], user["desa"]))
        
    kehadiran_list = [dict(row) for row in cursor.fetchall()]
    sesi["can_edit"] = can_modify_session(sesi, user)
    return jsonify({
        "sesi": sesi,
        "kehadiran": kehadiran_list
    })

@app.route('/api/kehadiran', methods=['PUT'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def update_kehadiran():
    data = request.json
    kehadiran_id = data.get("kehadiran_id")
    status = data.get("status")
    
    if not all([kehadiran_id, status]):
        return jsonify({"error": "Kehadiran ID dan status wajib diisi"}), 400
        
    if status not in ['Hadir', 'Ijin', 'Tidak Hadir']:
        return jsonify({"error": "Status tidak valid"}), 400
        
    user = get_current_user()
    cursor = g.db.cursor()
    
    cursor.execute("""
        SELECT s.* 
        FROM kehadiran k
        JOIN sesi_presensi s ON k.sesi_id = s.id
        WHERE k.id = ?;
    """, (kehadiran_id,))
    sesi_row = cursor.fetchone()
    if not sesi_row:
        return jsonify({"error": "Data kehadiran tidak ditemukan"}), 404
        
    sesi = dict(sesi_row)
    
    if not can_modify_session(sesi, user):
        return jsonify({"error": "Akses ditolak: Anda tidak memiliki wewenang untuk memperbarui kehadiran di sesi ini."}), 403
            
    try:
        cursor.execute("UPDATE kehadiran SET status = ? WHERE id = ?;", (status, kehadiran_id))
        g.db.commit()
        return jsonify({"success": True, "message": "Status kehadiran berhasil diperbarui"})
    except Exception as e:
        return jsonify({"error": f"Gagal memperbarui kehadiran: {str(e)}"}), 500

# ==========================================================================
# USER ACCESS MANAGEMENT API
# ==========================================================================

@app.route('/api/users', methods=['GET'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def get_users():
    user = get_current_user()
    cursor = g.db.cursor()
    
    if user["role"] == "Super Admin":
        cursor.execute("SELECT * FROM user_profiles ORDER BY email ASC;")
    elif user["role"] == "Admin":
        cursor.execute("SELECT * FROM user_profiles WHERE desa = ? ORDER BY email ASC;", (user["desa"],))
    else: # Moderator
        cursor.execute("SELECT * FROM user_profiles WHERE desa = ? AND kelompok = ? ORDER BY email ASC;", (user["desa"], user["kelompok"]))
        
    users_list = [dict(row) for row in cursor.fetchall()]
    return jsonify(users_list)

@app.route('/api/users', methods=['POST'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def create_user():
    data = request.json
    email = data.get("email")
    role = data.get("role", "Member")
    kelompok = data.get("kelompok")
    desa = data.get("desa", "Andara")
    
    if not email:
        return jsonify({"error": "Email wajib diisi"}), 400
        
    email = email.strip().lower()
    user = get_current_user()
    cursor = g.db.cursor()
    
    if user["role"] == "Moderator":
        role = "Member"
        kelompok = user["kelompok"]
        desa = user["desa"]
    elif user["role"] == "Admin":
        desa = user["desa"]
        if role in ["Admin", "Super Admin"]:
            return jsonify({"error": "Admin tidak diperbolehkan membuat user Admin atau Super Admin"}), 403
            
    cursor.execute("SELECT COUNT(*) FROM user_profiles WHERE email = ?;", (email,))
    if cursor.fetchone()[0] > 0:
        return jsonify({"error": "User dengan email ini sudah terdaftar"}), 400
        
    user_id = str(uuid.uuid4())
    try:
        cursor.execute("INSERT INTO user_profiles (id, email, role, kelompok, desa) VALUES (?, ?, ?, ?, ?);",
                       (user_id, email, role, kelompok if role in ['Moderator', 'Admin'] else None, desa))
        g.db.commit()
        return jsonify({"success": True, "id": user_id, "message": "User berhasil ditambahkan"})
    except Exception as e:
        return jsonify({"error": f"Gagal menambahkan user: {str(e)}"}), 500

@app.route('/api/users/<id>', methods=['PUT'])
@require_roles('Super Admin', 'Admin', 'Moderator')
def update_user(id):
    user = get_current_user()
    data = request.json
    role = data.get("role")
    kelompok = data.get("kelompok")
    desa = data.get("desa", "Andara")
    
    if not role:
        return jsonify({"error": "Role wajib dipilih"}), 400
        
    cursor = g.db.cursor()
    cursor.execute("SELECT * FROM user_profiles WHERE id = ?;", (id,))
    target = cursor.fetchone()
    if not target:
        return jsonify({"error": "User tidak ditemukan"}), 404
        
    target = dict(target)
    
    if target["email"] == user["email"]:
        return jsonify({"error": "Anda tidak diperbolehkan mengubah role akun Anda sendiri"}), 400
        
    if target["email"] == "cooltirta@gmail.com":
        return jsonify({"error": "Role Super Admin Utama tidak dapat diubah"}), 403
        
    if user["role"] == "Moderator":
        return jsonify({"error": "Moderator tidak diperbolehkan memperbarui data user lain"}), 403
    elif user["role"] == "Admin":
        if target["desa"] != user["desa"] or target["role"] in ["Admin", "Super Admin"]:
            return jsonify({"error": "Akses ditolak: User berada di luar wewenang Anda"}), 403
        if role in ["Admin", "Super Admin"]:
            return jsonify({"error": "Admin hanya dapat menetapkan role Member atau Moderator"}), 403
        desa = user["desa"]
    
    try:
        cursor.execute("UPDATE user_profiles SET role = ?, kelompok = ?, desa = ? WHERE id = ?;",
                       (role, kelompok if role in ['Moderator', 'Admin'] else None, desa, id))
        g.db.commit()
        return jsonify({"success": True, "message": "User access berhasil diperbarui"})
    except Exception as e:
        return jsonify({"error": f"Gagal memperbarui user access: {str(e)}"}), 500

@app.route('/api/users/<id>', methods=['DELETE'])
@require_roles('Super Admin', 'Admin')
def delete_user(id):
    user = get_current_user()
    cursor = g.db.cursor()
    
    cursor.execute("SELECT * FROM user_profiles WHERE id = ?;", (id,))
    target = cursor.fetchone()
    if not target:
        return jsonify({"error": "User tidak ditemukan"}), 404
    target = dict(target)
    
    if target["email"] == user["email"]:
        return jsonify({"error": "Anda tidak diperbolehkan menghapus akun Anda sendiri"}), 400
        
    if target["email"] == "cooltirta@gmail.com":
        return jsonify({"error": "Akun Super Admin Utama tidak dapat dihapus"}), 403
        
    if user["role"] == "Admin":
        if target["desa"] != user["desa"] or target["role"] in ["Admin", "Super Admin"]:
            return jsonify({"error": "Akses ditolak: User berada di luar wewenang Anda"}), 403
        
    try:
        cursor.execute("DELETE FROM user_profiles WHERE id = ?;", (id,))
        g.db.commit()
        return jsonify({"success": True, "message": "User berhasil dihapus"})
    except Exception as e:
        return jsonify({"error": f"Gagal menghapus user: {str(e)}"}), 500

# ==========================================================================
# DASHBOARD METRIC / STATS API (Filtered by Role scope & Date Range)
# ==========================================================================

@app.route('/api/stats', methods=['GET'])
@require_roles('Super Admin', 'Admin', 'Moderator', 'Member')
def get_stats():
    user = get_current_user()
    cursor = g.db.cursor()
    
    # Read date range parameters
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    
    is_date_filtered = bool(start_date and end_date)
    
    # --------------------------------------------------------
    # 1. Total Jamaah (Static current total based on scope)
    # --------------------------------------------------------
    if user["role"] == "Super Admin":
        cursor.execute("SELECT COUNT(*) FROM jamaah WHERE status_kehidupan = 'Hidup';")
    elif user["role"] == "Admin":
        cursor.execute("SELECT COUNT(*) FROM jamaah WHERE status_kehidupan = 'Hidup' AND desa = ?;", (user["desa"],))
    else: # Moderator / Member
        cursor.execute("SELECT COUNT(*) FROM jamaah WHERE status_kehidupan = 'Hidup' AND kelompok = ? AND desa = ?;", (user["kelompok"], user["desa"]))
    
    total_jamaah = cursor.fetchone()[0] if user["role"] == "Super Admin" or user["role"] == "Admin" or user.get("kelompok") else 0

    # --------------------------------------------------------
    # 2. Total Keluarga (Static current total based on scope)
    # --------------------------------------------------------
    if user["role"] == "Super Admin":
        cursor.execute("SELECT COUNT(*) FROM keluarga;")
    elif user["role"] == "Admin":
        cursor.execute("""
            SELECT COUNT(DISTINCT k.id) 
            FROM keluarga k 
            JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
            JOIN jamaah j ON ak.jamaah_id = j.id
            WHERE j.desa = ?;
        """, (user["desa"],))
    else: # Moderator / Member
        cursor.execute("""
            SELECT COUNT(DISTINCT k.id) 
            FROM keluarga k 
            JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
            JOIN jamaah j ON ak.jamaah_id = j.id
            WHERE j.kelompok = ? AND j.desa = ?;
        """, (user["kelompok"], user["desa"]))
        
    total_keluarga = cursor.fetchone()[0] if user["role"] == "Super Admin" or user["role"] == "Admin" or user.get("kelompok") else 0

    # --------------------------------------------------------
    # 3. Distribusi Kelompok
    # --------------------------------------------------------
    if user["role"] == "Super Admin":
        cursor.execute("SELECT kelompok, COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' GROUP BY kelompok;")
    elif user["role"] == "Admin":
        cursor.execute("SELECT kelompok, COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND desa = ? GROUP BY kelompok;", (user["desa"],))
    else: # Moderator / Member
        cursor.execute("SELECT kelompok, COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND kelompok = ? AND desa = ? GROUP BY kelompok;", (user["kelompok"], user["desa"]))
        
    groups_dist = [dict(row) for row in cursor.fetchall()]

    # --------------------------------------------------------
    # 4. Kehadiran Sesi Terakhir OR Rekapitulasi Date Range
    # --------------------------------------------------------
    last_session_stats = None
    
    if is_date_filtered:
        # Cari semua sesi dalam rentang tanggal dan sesuai wewenang
        if user["role"] == "Super Admin":
            cursor.execute("""
                SELECT * FROM sesi_presensi 
                WHERE tanggal >= ? AND tanggal <= ? 
                ORDER BY tanggal DESC;
            """, (start_date, end_date))
        elif user["role"] == "Admin":
            cursor.execute("""
                SELECT * FROM sesi_presensi 
                WHERE desa = ? AND tanggal >= ? AND tanggal <= ? 
                ORDER BY tanggal DESC;
            """, (user["desa"], start_date, end_date))
        else: # Moderator / Member
            cursor.execute("""
                SELECT * FROM sesi_presensi 
                WHERE desa = ? AND (jenis_pengajian = 'Pengajian Desa' OR (jenis_pengajian = 'Pengajian Kelompok' AND kelompok = ?))
                AND tanggal >= ? AND tanggal <= ? 
                ORDER BY tanggal DESC;
            """, (user["desa"], user["kelompok"], start_date, end_date))
            
        sessions = [dict(row) for row in cursor.fetchall()]
        
        if sessions:
            session_ids = [s["id"] for s in sessions]
            placeholders = ",".join(["?"] * len(session_ids))
            
            # Hitung agregat kehadiran dari sesi-sesi tersebut
            if user["role"] == "Super Admin":
                cursor.execute(f"""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                        SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
                        SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                    FROM kehadiran
                    WHERE sesi_id IN ({placeholders});
                """, session_ids)
            elif user["role"] == "Admin":
                cursor.execute(f"""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                        SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
                        SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                    FROM kehadiran k
                    JOIN jamaah j ON k.jamaah_id = j.id
                    WHERE k.sesi_id IN ({placeholders}) AND j.desa = ?;
                """, session_ids + [user["desa"]])
            else: # Moderator / Member
                cursor.execute(f"""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                        SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
                        SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                    FROM kehadiran k
                    JOIN jamaah j ON k.jamaah_id = j.id
                    WHERE k.sesi_id IN ({placeholders}) AND j.kelompok = ? AND j.desa = ?;
                """, session_ids + [user["kelompok"], user["desa"]])
                
            stats = dict(cursor.fetchone())
            
            # Buat Sesi Virtual Rekapitulasi
            virtual_sesi = {
                "id": "range_summary",
                "nama_sesi": f"Rekapitulasi Kehadiran ({len(sessions)} Sesi)",
                "tanggal": f"Rentang: {start_date} s/d {end_date}",
                "jenis_pengajian": "Agregat",
                "kelompok": None,
                "desa": user.get("desa", "Andara")
            }
            
            # Kembalikan stats agregat (jika NULL ganti ke 0)
            last_session_stats = {
                "sesi": virtual_sesi,
                "stats": {
                    "hadir": stats.get("hadir") or 0,
                    "ijin": stats.get("ijin") or 0,
                    "tidak_hadir": stats.get("tidak_hadir") or 0
                }
            }
    else:
        # Mode Default: Sesi terakhir
        if user["role"] == "Super Admin":
            cursor.execute("SELECT * FROM sesi_presensi ORDER BY tanggal DESC LIMIT 1;")
        elif user["role"] == "Admin":
            cursor.execute("SELECT * FROM sesi_presensi WHERE desa = ? ORDER BY tanggal DESC LIMIT 1;", (user["desa"],))
        else: # Moderator / Member
            cursor.execute("""
                SELECT * FROM sesi_presensi 
                WHERE desa = ? AND (jenis_pengajian = 'Pengajian Desa' OR (jenis_pengajian = 'Pengajian Kelompok' AND kelompok = ?))
                ORDER BY tanggal DESC LIMIT 1;
            """, (user["desa"], user["kelompok"]))
            
        last_session = cursor.fetchone()
        
        if last_session:
            last_session = dict(last_session)
            if user["role"] == "Super Admin":
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                        SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
                        SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                    FROM kehadiran
                    WHERE sesi_id = ?;
                """, (last_session["id"],))
            elif user["role"] == "Admin":
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                        SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
                        SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                    FROM kehadiran k
                    JOIN jamaah j ON k.jamaah_id = j.id
                    WHERE k.sesi_id = ? AND j.desa = ?;
                """, (last_session["id"], user["desa"]))
            else: # Moderator / Member
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                        SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
                        SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                    FROM kehadiran k
                    JOIN jamaah j ON k.jamaah_id = j.id
                    WHERE k.sesi_id = ? AND j.kelompok = ? AND j.desa = ?;
                """, (last_session["id"], user["kelompok"], user["desa"]))
                
            stats = dict(cursor.fetchone())
            last_session_stats = {
                "sesi": last_session,
                "stats": {
                    "hadir": stats.get("hadir") or 0,
                    "ijin": stats.get("ijin") or 0,
                    "tidak_hadir": stats.get("tidak_hadir") or 0
                }
            }
            
    return jsonify({
        "total_jamaah": total_jamaah,
        "total_keluarga": total_keluarga,
        "distribusi_kelompok": groups_dist,
        "sesi_terakhir": last_session_stats
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

