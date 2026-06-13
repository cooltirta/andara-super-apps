// DATABASE JAMAAH PAGE MODULE (database.js)

import { state, showToast } from '../app.js';

let localJamaahList = [];
let localKeluargaList = [];
let activeTab = 'jamaah'; // 'jamaah' or 'keluarga'

export async function renderDatabase(container) {
    let scopeLabel = '';
    if (state.user.role === 'Admin') {
        scopeLabel = ` (Desa ${state.user.desa})`;
    } else if (state.user.role === 'Moderator') {
        scopeLabel = ` (Kelompok ${state.user.kelompok})`;
    }

    container.innerHTML = `
        <div class="page-header">
            <div class="page-title-area">
                <h1>Database Jamaah & Keluarga${scopeLabel}</h1>
                <p class="page-subtitle">Kelola informasi pribadi jamaah dan pengelompokan unit keluarga</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="btn-modal-keluarga" class="btn btn-secondary">
                    <i data-lucide="home"></i>
                    <span>Buat Keluarga Baru</span>
                </button>
                <button id="btn-modal-jamaah" class="btn btn-primary">
                    <i data-lucide="user-plus"></i>
                    <span>Tambah Jamaah</span>
                </button>
            </div>
        </div>

        <!-- Tabs Navigation -->
        <div style="display: flex; border-bottom: 2px solid var(--color-grey-200); margin-bottom: 24px; gap: 24px;">
            <button class="db-tab ${activeTab === 'jamaah' ? 'active' : ''}" id="tab-jamaah" style="background:none; border:none; padding: 12px 8px; font-weight:700; font-size:1.05rem; cursor:pointer; color: ${activeTab === 'jamaah' ? 'var(--color-primary)' : 'var(--color-grey-500)'}; border-bottom: 3px solid ${activeTab === 'jamaah' ? 'var(--color-primary)' : 'transparent'}; transition: all 0.2s;">
                Daftar Jamaah
            </button>
            <button class="db-tab ${activeTab === 'keluarga' ? 'active' : ''}" id="tab-keluarga" style="background:none; border:none; padding: 12px 8px; font-weight:700; font-size:1.05rem; cursor:pointer; color: ${activeTab === 'keluarga' ? 'var(--color-primary)' : 'var(--color-grey-500)'}; border-bottom: 3px solid ${activeTab === 'keluarga' ? 'var(--color-primary)' : 'transparent'}; transition: all 0.2s;">
                Unit Keluarga
            </button>
        </div>

        <!-- Search & Filter Bar (Only for Jamaah Tab) -->
        <div class="search-filter-bar" id="search-filter-section">
            <div class="search-input-wrapper">
                <i data-lucide="search"></i>
                <input type="text" id="search-jamaah-name" class="form-control" placeholder="Cari nama jamaah...">
            </div>
            <div class="filter-group">
                ${state.user.role === 'Super Admin' ? `
                    <select id="filter-kelompok" class="filter-select">
                        <option value="">Semua Kelompok</option>
                        <option value="Andara 1">Andara 1</option>
                        <option value="Andara 2">Andara 2</option>
                        <option value="Andara 3">Andara 3</option>
                        <option value="Andara 4">Andara 4</option>
                        <option value="Andara 5">Andara 5</option>
                        <option value="Lain-lain">Lain-lain</option>
                    </select>
                ` : '<input type="hidden" id="filter-kelompok" value="">'}
                <select id="filter-gender" class="filter-select">
                    <option value="">Semua Gander</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                </select>
                <select id="filter-blood" class="filter-select">
                    <option value="">Semua Gol. Darah</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="O">O</option>
                    <option value="AB">AB</option>
                </select>
                <select id="filter-status" class="filter-select">
                    <option value="">Semua Status Kehidupan</option>
                    <option value="Hidup">Hidup</option>
                    <option value="Meninggal">Meninggal</option>
                </select>
            </div>
        </div>

        <!-- Tab Content Area -->
        <div id="db-tab-content">
            <!-- Spinner -->
            <div style="display:flex; justify-content:center; padding: 40px;">
                <div class="spinner"></div>
            </div>
        </div>

        <!-- Modals Layout Structure -->
        <div id="modal-container-area"></div>
    `;

    lucide.createIcons();

    // Bind Tabs
    document.getElementById('tab-jamaah').addEventListener('click', () => switchTab('jamaah'));
    document.getElementById('tab-keluarga').addEventListener('click', () => switchTab('keluarga'));

    // Bind Modal Buttons
    document.getElementById('btn-modal-jamaah').addEventListener('click', () => openJamaahModal());
    document.getElementById('btn-modal-keluarga').addEventListener('click', () => openKeluargaModal());

    // Fetch initial data
    await refreshData();
}

async function switchTab(tab) {
    activeTab = tab;
    const tabJ = document.getElementById('tab-jamaah');
    const tabK = document.getElementById('tab-keluarga');
    const searchFilter = document.getElementById('search-filter-section');
    
    if (tab === 'jamaah') {
        tabJ.style.color = 'var(--color-primary)';
        tabJ.style.borderBottomColor = 'var(--color-primary)';
        tabK.style.color = 'var(--color-grey-500)';
        tabK.style.borderBottomColor = 'transparent';
        searchFilter.style.display = 'flex';
        renderJamaahTable();
    } else {
        tabK.style.color = 'var(--color-primary)';
        tabK.style.borderBottomColor = 'var(--color-primary)';
        tabJ.style.color = 'var(--color-grey-500)';
        tabJ.style.borderBottomColor = 'transparent';
        searchFilter.style.display = 'none';
        renderKeluargaList();
    }
}

async function refreshData() {
    try {
        const [jamaahRes, keluargaRes] = await Promise.all([
            fetch('/api/jamaah'),
            fetch('/api/keluarga')
        ]);
        
        if (jamaahRes.ok && keluargaRes.ok) {
            localJamaahList = await jamaahRes.json();
            localKeluargaList = await keluargaRes.json();
            
            // Render active tab
            if (activeTab === 'jamaah') {
                renderJamaahTable();
                setupFilters();
            } else {
                renderKeluargaList();
            }
        } else {
            showToast("Gagal mengambil data dari server", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Kesalahan koneksi database", "error");
    }
}

// ==========================================================================
// RENDERING JAMAAH
// ==========================================================================
function renderJamaahTable(filteredList = null) {
    const list = filteredList || localJamaahList;
    const content = document.getElementById('db-tab-content');
    
    if (list.length === 0) {
        content.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px; color: var(--color-grey-500);">
                <i data-lucide="users" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;"></i>
                <p>Tidak ada data jamaah ditemukan.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    let tableHtml = `
        <div class="table-container">
            <table class="responsive-table">
                <thead>
                    <tr>
                        <th>Nama Lengkap</th>
                        <th>Gander</th>
                        <th>Tempat Lahir</th>
                        <th>Desa</th>
                        <th>Kelompok</th>
                        <th>Status</th>
                        <th>Gol. Darah</th>
                        <th>Pendidikan</th>
                        <th>Hub. Keluarga</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    list.forEach(j => {
        const statusClass = j.status_kehidupan === 'Hidup' ? 'hidup' : 'meninggal';
        const familyText = j.nama_keluarga ? `${j.nama_keluarga} (${j.jenis_anggota})` : '<em style="color: var(--color-grey-500)">Belum berasosiasi</em>';
        const gradText = j.pendidikan_terakhir === 'Tidak Sekolah' ? '-' : (j.tanggal_lulus_pendidikan_terakhir || '-');
        
        tableHtml += `
            <tr id="row-jamaah-${j.id}">
                <td style="font-weight: 600;">${j.nama_lengkap}</td>
                <td>${j.jenis_kelamin}</td>
                <td>${j.tempat_lahir}</td>
                <td style="font-weight: 600; color: var(--color-earth-green);">${j.desa}</td>
                <td><span class="badge" style="background-color: var(--color-primary-light); color: var(--color-primary); font-weight:600; padding: 4px 10px; border-radius: var(--radius-sm);">${j.kelompok}</span></td>
                <td><span class="badge-status ${statusClass}">${j.status_kehidupan}</span></td>
                <td style="text-align: center; font-weight:700;">${j.golongan_darah}</td>
                <td>
                    <span style="font-weight: 600;">${j.pendidikan_terakhir}</span>
                    <span style="display:block; font-size: 0.75rem; color: var(--color-grey-500)">Lulus: ${gradText}</span>
                </td>
                <td style="font-size: 0.85rem;">${familyText}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn btn-secondary btn-icon btn-edit-jamaah" data-id="${j.id}" title="Edit Data">
                            <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                        </button>
                        <button class="btn btn-danger btn-icon btn-delete-jamaah" data-id="${j.id}" title="Hapus Data">
                            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableHtml += `
                </tbody>
            </table>
        </div>
    `;
    
    content.innerHTML = tableHtml;
    lucide.createIcons();
    
    // Bind Actions
    document.querySelectorAll('.btn-edit-jamaah').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            openJamaahModal(id);
        });
    });
    
    document.querySelectorAll('.btn-delete-jamaah').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            handleDeleteJamaah(id);
        });
    });
}

function setupFilters() {
    const searchInput = document.getElementById('search-jamaah-name');
    const filterKelompok = document.getElementById('filter-kelompok');
    const filterGender = document.getElementById('filter-gender');
    const filterBlood = document.getElementById('filter-blood');
    const filterStatus = document.getElementById('filter-status');
    
    const applyFilters = () => {
        const query = searchInput.value.toLowerCase().trim();
        const kelompok = filterKelompok ? filterKelompok.value : '';
        const gender = filterGender.value;
        const blood = filterBlood.value;
        const status = filterStatus.value;
        
        const filtered = localJamaahList.filter(j => {
            const matchName = j.nama_lengkap.toLowerCase().includes(query);
            const matchKelompok = kelompok ? j.kelompok === kelompok : true;
            const matchGender = gender ? j.jenis_kelamin === gender : true;
            const matchBlood = blood ? j.golongan_darah === blood : true;
            const matchStatus = status ? j.status_kehidupan === status : true;
            return matchName && matchKelompok && matchGender && matchBlood && matchStatus;
        });
        
        renderJamaahTable(filtered);
    };
    
    searchInput.addEventListener('input', applyFilters);
    if (filterKelompok) filterKelompok.addEventListener('change', applyFilters);
    filterGender.addEventListener('change', applyFilters);
    filterBlood.addEventListener('change', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
}

async function handleDeleteJamaah(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data jamaah ini? Seluruh riwayat presensi dan asosiasi keluarga juga akan terhapus.")) return;
    
    try {
        const res = await fetch(`/api/jamaah/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
            refreshData();
        } else {
            showToast(data.error, "error");
        }
    } catch (err) {
        showToast("Gagal menghapus data", "error");
    }
}

// ==========================================================================
// RENDERING KELUARGA
// ==========================================================================
function renderKeluargaList() {
    const content = document.getElementById('db-tab-content');
    
    if (localKeluargaList.length === 0) {
        content.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px; color: var(--color-grey-500);">
                <i data-lucide="home" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;"></i>
                <p>Belum ada data keluarga dibuat.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    let familiesHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px;">`;
    
    localKeluargaList.forEach(f => {
        let membersHtml = '';
        
        if (f.anggota.length === 0) {
            membersHtml = `<p style="font-size:0.85rem; color:var(--color-grey-500); font-style:italic;">Keluarga tidak memiliki anggota aktif</p>`;
        } else {
            membersHtml = `
                <table style="width:100%; font-size:0.85rem; text-align:left; border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--color-grey-200); color: var(--color-grey-700);">
                            <th style="padding:6px 0;">Nama Anggota</th>
                            <th style="padding:6px 0;">Hubungan</th>
                            <th style="padding:6px 0; text-align:right;">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            f.anggota.forEach(m => {
                const statusDec = m.status_kehidupan === 'Meninggal' ? ' <span style="font-size:0.7rem; color:var(--color-pastel-red-solid); font-weight:700;">(Wafat)</span>' : '';
                membersHtml += `
                    <tr style="border-bottom: 1px solid var(--color-grey-100);">
                        <td style="padding:8px 0; font-weight:600;">${m.nama_lengkap}${statusDec}</td>
                        <td style="padding:8px 0; color:var(--color-grey-700);">${m.jenis_anggota}</td>
                        <td style="padding:8px 0; text-align:right;">
                            <button class="btn-remove-member" data-id="${m.anggota_id}" style="background:none; border:none; color:var(--color-pastel-red-solid); cursor:pointer; font-weight:600;" title="Keluarkan dari keluarga">
                                Hapus
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            membersHtml += `</tbody></table>`;
        }
        
        familiesHtml += `
            <div class="card glass-card" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 250px;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:8px;">
                        <h4 style="font-weight:700; font-size:1.1rem; color:var(--color-bg-dark);">${f.nama_keluarga}</h4>
                        <button class="btn-delete-family" data-id="${f.id}" style="background:none; border:none; color:var(--color-grey-500); hover:color:red; cursor:pointer;" title="Hapus Unit Keluarga">
                            <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                        </button>
                    </div>
                    <div style="margin-bottom:16px;">
                        ${membersHtml}
                    </div>
                </div>
                <div>
                    <button class="btn btn-secondary btn-add-member" data-id="${f.id}" style="width: 100%; font-size:0.85rem; padding: 8px 12px;">
                        <i data-lucide="plus" style="width:14px; height:14px;"></i>
                        <span>Tambah Anggota Keluarga</span>
                    </button>
                </div>
            </div>
        `;
    });
    
    familiesHtml += `</div>`;
    content.innerHTML = familiesHtml;
    lucide.createIcons();
    
    document.querySelectorAll('.btn-delete-family').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            handleDeleteKeluarga(id);
        });
    });
    
    document.querySelectorAll('.btn-remove-member').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            handleRemoveMember(id);
        });
    });
    
    document.querySelectorAll('.btn-add-member').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            openAddMemberModal(id);
        });
    });
}

async function handleDeleteKeluarga(id) {
    if (!confirm("Hapus unit keluarga ini? Anggota keluarga yang terhubung akan dilepaskan (tetapi tidak menghapus data jamaah itu sendiri).")) return;
    
    try {
        const res = await fetch(`/api/keluarga/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
            refreshData();
        } else {
            showToast(data.error, "error");
        }
    } catch (err) {
        showToast("Gagal menghapus keluarga", "error");
    }
}

async function handleRemoveMember(anggotaId) {
    if (!confirm("Keluarkan jamaah ini dari unit keluarga?")) return;
    
    try {
        const res = await fetch(`/api/keluarga/anggota/${anggotaId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
            refreshData();
        } else {
            showToast(data.error, "error");
        }
    } catch (err) {
        showToast("Gagal mengeluarkan anggota", "error");
    }
}

// ==========================================================================
// MODALS LOGIC
// ==========================================================================

// 1. JAMAAH FORM MODAL (Add/Edit)
function openJamaahModal(id = null) {
    const modalArea = document.getElementById('modal-container-area');
    const isEdit = id !== null;
    const jamaah = isEdit ? localJamaahList.find(j => j.id === id) : null;
    const currentUser = state.user;
    
    // Desa field control based on role:
    // Super Admin: select/input text
    // Admin/Moderator: locked to their own village
    let desaInputHtml = '';
    if (currentUser.role === 'Super Admin') {
        desaInputHtml = `
            <select id="form-desa" class="form-control" required>
                <option value="Andara" ${isEdit && jamaah.desa === 'Andara' ? 'selected' : 'selected'}>Andara</option>
                <option value="Bojong" ${isEdit && jamaah.desa === 'Bojong' ? 'selected' : ''}>Bojong</option>
                <option value="Cisadane" ${isEdit && jamaah.desa === 'Cisadane' ? 'selected' : ''}>Cisadane</option>
            </select>
        `;
    } else {
        desaInputHtml = `
            <input type="text" id="form-desa" class="form-control" value="${isEdit ? jamaah.desa : currentUser.desa}" disabled style="background-color: var(--color-grey-100)">
        `;
    }
    
    // Kelompok field control based on role:
    // Moderator: locked to their own kelompok
    // Admin/Super Admin: select kelompok
    let kelompokInputHtml = '';
    if (currentUser.role === 'Moderator') {
        kelompokInputHtml = `
            <input type="text" id="form-kelompok" class="form-control" value="${isEdit ? jamaah.kelompok : currentUser.kelompok}" disabled style="background-color: var(--color-grey-100)">
        `;
    } else {
        kelompokInputHtml = `
            <select id="form-kelompok" class="form-control" required>
                <option value="Andara 1" ${isEdit && jamaah.kelompok === 'Andara 1' ? 'selected' : ''}>Andara 1</option>
                <option value="Andara 2" ${isEdit && jamaah.kelompok === 'Andara 2' ? 'selected' : ''}>Andara 2</option>
                <option value="Andara 3" ${isEdit && jamaah.kelompok === 'Andara 3' ? 'selected' : ''}>Andara 3</option>
                <option value="Andara 4" ${isEdit && jamaah.kelompok === 'Andara 4' ? 'selected' : ''}>Andara 4</option>
                <option value="Andara 5" ${isEdit && jamaah.kelompok === 'Andara 5' ? 'selected' : ''}>Andara 5</option>
                <option value="Lain-lain" ${isEdit && jamaah.kelompok === 'Lain-lain' ? 'selected' : ''}>Lain-lain</option>
            </select>
        `;
    }
    
    modalArea.innerHTML = `
        <div class="modal-backdrop active" id="jamaah-modal-backdrop">
            <div class="modal-container">
                <div class="modal-header">
                    <h2>${isEdit ? 'Ubah Data Jamaah' : 'Tambah Jamaah Baru'}</h2>
                    <button class="btn-close-modal" id="btn-close-jamaah-modal">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="jamaah-form">
                        <div class="form-group">
                            <label for="form-nama">Nama Lengkap</label>
                            <input type="text" id="form-nama" class="form-control" value="${isEdit ? jamaah.nama_lengkap : ''}" required placeholder="Masukkan nama lengkap">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="form-gender">Jenis Kelamin</label>
                                <select id="form-gender" class="form-control" required>
                                    <option value="Laki-laki" ${isEdit && jamaah.jenis_kelamin === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option>
                                    <option value="Perempuan" ${isEdit && jamaah.jenis_kelamin === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="form-birthplace">Tempat Lahir</label>
                                <input type="text" id="form-birthplace" class="form-control" value="${isEdit ? jamaah.tempat_lahir : ''}" required placeholder="Kota kelahiran">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="form-desa">Wilayah Desa</label>
                                ${desaInputHtml}
                            </div>
                            <div class="form-group">
                                <label for="form-kelompok">Kelompok Pengajian</label>
                                ${kelompokInputHtml}
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="form-blood">Golongan Darah</label>
                                <select id="form-blood" class="form-control" required>
                                    <option value="O" ${isEdit && jamaah.golongan_darah === 'O' ? 'selected' : ''}>O</option>
                                    <option value="A" ${isEdit && jamaah.golongan_darah === 'A' ? 'selected' : ''}>A</option>
                                    <option value="B" ${isEdit && jamaah.golongan_darah === 'B' ? 'selected' : ''}>B</option>
                                    <option value="AB" ${isEdit && jamaah.golongan_darah === 'AB' ? 'selected' : ''}>AB</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="form-status">Status Kehidupan</label>
                                <select id="form-status" class="form-control" required>
                                    <option value="Hidup" ${isEdit && jamaah.status_kehidupan === 'Hidup' ? 'selected' : ''}>Hidup</option>
                                    <option value="Meninggal" ${isEdit && jamaah.status_kehidupan === 'Meninggal' ? 'selected' : ''}>Meninggal</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="form-education">Pendidikan Terakhir</label>
                                <select id="form-education" class="form-control" required>
                                    <option value="Tidak Sekolah" ${isEdit && jamaah.pendidikan_terakhir === 'Tidak Sekolah' ? 'selected' : ''}>Tidak Sekolah</option>
                                    <option value="SD" ${isEdit && jamaah.pendidikan_terakhir === 'SD' ? 'selected' : ''}>SD</option>
                                    <option value="SMP" ${isEdit && jamaah.pendidikan_terakhir === 'SMP' ? 'selected' : ''}>SMP</option>
                                    <option value="SMA" ${isEdit && jamaah.pendidikan_terakhir === 'SMA' ? 'selected' : ''}>SMA</option>
                                    <option value="S1" ${isEdit && jamaah.pendidikan_terakhir === 'S1' ? 'selected' : ''}>S1</option>
                                    <option value="S2" ${isEdit && jamaah.pendidikan_terakhir === 'S2' ? 'selected' : ''}>S2</option>
                                    <option value="S3" ${isEdit && jamaah.pendidikan_terakhir === 'S3' ? 'selected' : ''}>S3</option>
                                </select>
                            </div>
                            <div class="form-group" id="form-grad-date-group" style="display:none;">
                                <label for="form-grad-date">Tanggal Lulus</label>
                                <input type="date" id="form-grad-date" class="form-control" value="${isEdit && jamaah.tanggal_lulus_pendidikan_terakhir ? jamaah.tanggal_lulus_pendidikan_terakhir : ''}">
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="btn-close-jamaah-modal-cancel">Batal</button>
                            <button type="submit" class="btn btn-primary">Simpan</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    
    const backdrop = document.getElementById('jamaah-modal-backdrop');
    const closeBtn = document.getElementById('btn-close-jamaah-modal');
    const cancelBtn = document.getElementById('btn-close-jamaah-modal-cancel');
    const form = document.getElementById('jamaah-form');
    const eduSelect = document.getElementById('form-education');
    const gradGroup = document.getElementById('form-grad-date-group');
    const gradInput = document.getElementById('form-grad-date');
    
    const toggleGradDate = () => {
        if (eduSelect.value === 'Tidak Sekolah') {
            gradGroup.style.display = 'none';
            gradInput.removeAttribute('required');
            gradInput.value = '';
        } else {
            gradGroup.style.display = 'block';
            gradInput.setAttribute('required', 'required');
        }
    };
    
    eduSelect.addEventListener('change', toggleGradDate);
    toggleGradDate();
    
    const closeModal = () => {
        backdrop.classList.remove('active');
        setTimeout(() => modalArea.innerHTML = '', 300);
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            nama_lengkap: document.getElementById('form-nama').value,
            jenis_kelamin: document.getElementById('form-gender').value,
            tempat_lahir: document.getElementById('form-birthplace').value,
            golongan_darah: document.getElementById('form-blood').value,
            kelompok: document.getElementById('form-kelompok').value,
            status_kehidupan: document.getElementById('form-status').value,
            pendidikan_terakhir: eduSelect.value,
            tanggal_lulus_pendidikan_terakhir: gradInput.value || null,
            desa: document.getElementById('form-desa').value
        };
        
        try {
            const url = isEdit ? `/api/jamaah/${id}` : '/api/jamaah';
            const method = isEdit ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok) {
                showToast(data.message, "success");
                closeModal();
                refreshData();
            } else {
                showToast(data.error, "error");
            }
        } catch (err) {
            showToast("Gagal menyimpan data", "error");
        }
    });
}

// 2. KELUARGA BARU MODAL (Create family)
function openKeluargaModal() {
    const modalArea = document.getElementById('modal-container-area');
    
    // Cari jamaah yang tidak sedang berada di keluarga lain
    const associatedJamaahIds = localKeluargaList.flatMap(f => f.anggota.map(m => m.jamaah_id));
    const unassociatedJamaah = localJamaahList.filter(j => !associatedJamaahIds.includes(j.id) && j.status_kehidupan === 'Hidup');
    
    if (unassociatedJamaah.length === 0) {
        showToast("Semua jamaah yang hidup dalam wewenang Anda sudah memiliki keluarga.", "warning");
        return;
    }
    
    let selectOptions = unassociatedJamaah.map(j => `<option value="${j.id}">${j.nama_lengkap} (${j.desa} - ${j.kelompok})</option>`).join('');
    
    modalArea.innerHTML = `
        <div class="modal-backdrop active" id="keluarga-modal-backdrop">
            <div class="modal-container" style="max-width: 450px;">
                <div class="modal-header">
                    <h2>Buat Keluarga Baru</h2>
                    <button class="btn-close-modal" id="btn-close-keluarga-modal">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p style="font-size:0.9rem; color:var(--color-grey-700); margin-bottom:16px;">
                        Keluarga baru akan dinamai otomatis berdasarkan <strong>Kepala Keluarga</strong> yang dipilih.
                    </p>
                    <form id="keluarga-form">
                        <div class="form-group">
                            <label for="form-fam-kk">Pilih Kepala Keluarga</label>
                            <select id="form-fam-kk" class="form-control" required>
                                <option value="" disabled selected>-- Pilih Jamaah --</option>
                                ${selectOptions}
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="btn-close-keluarga-modal-cancel">Batal</button>
                            <button type="submit" class="btn btn-primary">Simpan</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    const backdrop = document.getElementById('keluarga-modal-backdrop');
    
    const closeModal = () => {
        backdrop.classList.remove('active');
        setTimeout(() => modalArea.innerHTML = '', 300);
    };
    
    document.getElementById('btn-close-keluarga-modal').addEventListener('click', closeModal);
    document.getElementById('btn-close-keluarga-modal-cancel').addEventListener('click', closeModal);
    
    document.getElementById('keluarga-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            kepala_keluarga_id: document.getElementById('form-fam-kk').value
        };
        
        try {
            const res = await fetch('/api/keluarga', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message, "success");
                closeModal();
                activeTab = 'keluarga';
                refreshData();
            } else {
                showToast(data.error, "error");
            }
        } catch (err) {
            showToast("Gagal membuat keluarga", "error");
        }
    });
}

// 3. TAMBAH ANGGOTA KELUARGA MODAL
function openAddMemberModal(keluargaId) {
    const modalArea = document.getElementById('modal-container-area');
    const keluarga = localKeluargaList.find(f => f.id === keluargaId);
    
    // Cari jamaah yang tidak sedang berada di keluarga lain
    const associatedJamaahIds = localKeluargaList.flatMap(f => f.anggota.map(m => m.jamaah_id));
    const unassociatedJamaah = localJamaahList.filter(j => !associatedJamaahIds.includes(j.id) && j.status_kehidupan === 'Hidup');
    
    if (unassociatedJamaah.length === 0) {
        showToast("Semua jamaah aktif sudah terdaftar di unit keluarga.", "warning");
        return;
    }
    
    let selectOptions = unassociatedJamaah.map(j => `<option value="${j.id}">${j.nama_lengkap} (${j.desa} - ${j.kelompok})</option>`).join('');
    const hasKK = keluarga.anggota.some(m => m.jenis_anggota === 'Kepala Keluarga');
    
    modalArea.innerHTML = `
        <div class="modal-backdrop active" id="member-modal-backdrop">
            <div class="modal-container" style="max-width: 450px;">
                <div class="modal-header">
                    <h2>Tambah Anggota Keluarga</h2>
                    <button class="btn-close-modal" id="btn-close-member-modal">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <h4 style="margin-bottom: 12px; font-weight:700;">${keluarga.nama_keluarga}</h4>
                    <form id="member-form">
                        <div class="form-group">
                            <label for="form-memb-jamaah">Pilih Jamaah</label>
                            <select id="form-memb-jamaah" class="form-control" required>
                                <option value="" disabled selected>-- Pilih Jamaah --</option>
                                ${selectOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="form-memb-rel">Hubungan / Jenis Anggota</label>
                            <select id="form-memb-rel" class="form-control" required>
                                ${!hasKK ? '<option value="Kepala Keluarga">Kepala Keluarga</option>' : ''}
                                <option value="Istri">Istri</option>
                                <option value="Anak" selected>Anak</option>
                                <option value="Ayah">Ayah</option>
                                <option value="Ibu">Ibu</option>
                                <option value="Ayah Mertua">Ayah Mertua</option>
                                <option value="Ibu Mertua">Ibu Mertua</option>
                                <option value="Famili Lain">Famili Lain</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="btn-close-member-modal-cancel">Batal</button>
                            <button type="submit" class="btn btn-primary">Simpan</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    const backdrop = document.getElementById('member-modal-backdrop');
    
    const closeModal = () => {
        backdrop.classList.remove('active');
        setTimeout(() => modalArea.innerHTML = '', 300);
    };
    
    document.getElementById('btn-close-member-modal').addEventListener('click', closeModal);
    document.getElementById('btn-close-member-modal-cancel').addEventListener('click', closeModal);
    
    document.getElementById('member-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            jamaah_id: document.getElementById('form-memb-jamaah').value,
            jenis_anggota: document.getElementById('form-memb-rel').value
        };
        
        try {
            const res = await fetch(`/api/keluarga/${keluargaId}/anggota`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message, "success");
                closeModal();
                refreshData();
            } else {
                showToast(data.error, "error");
            }
        } catch (err) {
            showToast("Gagal menambahkan anggota", "error");
        }
    });
}
