// PRESENSI / DAFTAR KEHADIRAN PAGE MODULE (presensi.js)

import { state, showToast } from '../app.js';

let sessionsList = [];
let activeSessionId = null;
let activeSessionData = null;
let currentGroupFilter = ''; // Only for Super Admin

export async function renderPresensi(container) {
    if (activeSessionId) {
        await renderAttendanceGrid(container);
    } else {
        await renderSessionsList(container);
    }
}

// ==========================================================================
// VIEW 1: SESSIONS LIST
// ==========================================================================
async function renderSessionsList(container) {
    let scopeLabel = '';
    if (state.user.role === 'Admin') {
        scopeLabel = ` (Desa ${state.user.desa})`;
    } else if (state.user.role === 'Moderator') {
        scopeLabel = ` (Kelompok ${state.user.kelompok})`;
    }

    container.innerHTML = `
        <div class="page-header">
            <div class="page-title-area">
                <h1>Sesi Pengajian & Kehadiran${scopeLabel}</h1>
                <p class="page-subtitle">Pilih sesi pengajian untuk melakukan presensi jamaah</p>
            </div>
            <button id="btn-new-session" class="btn btn-primary">
                <i data-lucide="plus-circle"></i>
                <span>Buat Sesi Baru</span>
            </button>
        </div>

        <div id="sessions-content-area">
            <!-- Spinner -->
            <div style="display:flex; justify-content:center; padding: 40px;">
                <div class="spinner"></div>
            </div>
        </div>
        
        <!-- Modal Area -->
        <div id="presensi-modal-area"></div>
    `;
    
    lucide.createIcons();
    document.getElementById('btn-new-session').addEventListener('click', openNewSessionModal);
    
    await fetchSessions();
}

async function fetchSessions() {
    const content = document.getElementById('sessions-content-area');
    try {
        const res = await fetch('/api/sesi');
        if (res.ok) {
            sessionsList = await res.json();
            renderSessionsGrid(content);
        } else {
            showToast("Gagal memuat sesi pengajian", "error");
        }
    } catch (err) {
        showToast("Kesalahan koneksi server", "error");
    }
}

function renderSessionsGrid(container) {
    if (sessionsList.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px; color: var(--color-grey-500);">
                <i data-lucide="calendar" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;"></i>
                <p>Belum ada sesi presensi pengajian dibuat. Silakan buat sesi baru.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;">`;
    
    sessionsList.forEach(s => {
        const dateObj = new Date(s.tanggal);
        const formattedDate = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        
        const typeBadge = s.jenis_pengajian === 'Pengajian Desa' 
            ? `<span class="badge" style="background-color: var(--color-earth-green-light); color: var(--color-earth-green-hover); font-size:0.7rem;">Desa</span>`
            : `<span class="badge" style="background-color: var(--color-primary-light); color: var(--color-primary); font-size:0.7rem;">Kelompok (${s.kelompok || '-'})</span>`;
            
        // Hak Penghapusan: Hanya pengguna dengan kelompok/desa yang sama dan peran yang sesuai
        const deleteButton = s.can_edit ? `
            <button class="btn-delete-session" data-id="${s.id}" style="background:none; border:none; color:var(--color-grey-500); cursor:pointer; padding: 2px;" title="Hapus Sesi">
                <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
        ` : '';
            
        html += `
            <div class="card glass-card session-card" style="cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; min-height: 190px;" data-id="${s.id}">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-primary); display: flex; align-items: center; gap: 4px;">
                            <i data-lucide="calendar" style="width: 14px; height: 14px;"></i> ${formattedDate}
                        </span>
                        <div style="display:flex; align-items:center; gap: 6px;">
                            ${typeBadge}
                            ${deleteButton}
                        </div>
                    </div>
                    <h4 class="session-card-title" style="font-weight: 700; font-size: 1.15rem; color: var(--color-bg-dark); margin-bottom: 8px;">${s.nama_sesi}</h4>
                    <p style="font-size: 0.85rem; color: var(--color-grey-700); line-height: 1.4;">${s.keterangan || '<em>Tidak ada keterangan</em>'}</p>
                </div>
                <div style="margin-top: 16px; display:flex; align-items:center; gap: 4px; font-weight: 600; font-size: 0.85rem; color: var(--color-earth-green);">
                    <span>Buka Lembar Presensi</span>
                    <i data-lucide="chevron-right" style="width:16px; height:16px;"></i>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
    lucide.createIcons();
    
    container.querySelectorAll('.session-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-session')) return;
            const id = card.getAttribute('data-id');
            openSession(id);
        });
    });
    
    container.querySelectorAll('.btn-delete-session').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-id');
            if (confirm("Hapus sesi pengajian ini? Semua catatan kehadiran di sesi ini akan dihapus.")) {
                try {
                    const res = await fetch(`/api/sesi/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        showToast("Sesi berhasil dihapus", "success");
                        fetchSessions();
                    } else {
                        const data = await res.json();
                        showToast(data.error, "error");
                    }
                } catch (err) {
                    showToast("Gagal menghapus sesi", "error");
                }
            }
        });
    });
}

function openSession(id) {
    activeSessionId = id;
    const container = document.getElementById('main-content');
    renderPresensi(container);
}

// ==========================================================================
// VIEW 2: ATTENDANCE CHECKLIST GRID
// ==========================================================================
async function renderAttendanceGrid(container) {
    container.innerHTML = `
        <div style="display:flex; justify-content:center; padding: 40px;">
            <div class="spinner"></div>
        </div>
    `;
    
    try {
        const res = await fetch(`/api/kehadiran/${activeSessionId}`);
        if (!res.ok) {
            showToast("Gagal memuat detail kehadiran", "error");
            activeSessionId = null;
            renderPresensi(container);
            return;
        }
        
        activeSessionData = await res.json();
        
        const sesi = activeSessionData.sesi;
        const dateObj = new Date(sesi.tanggal);
        const formattedDate = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const isSuperAdmin = state.user.role === 'Super Admin';
        
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-area">
                    <button id="btn-back-to-sessions" class="btn btn-secondary" style="margin-bottom:12px; font-size:0.85rem; padding:6px 12px; align-self: flex-start;">
                        <i data-lucide="chevron-left" style="width:16px; height:16px;"></i>
                        <span>Kembali ke Daftar Sesi</span>
                    </button>
                    <h1>Lembar Presensi Pengajian</h1>
                    <p class="page-subtitle">${sesi.nama_sesi} &mdash; ${formattedDate}</p>
                </div>
            </div>

            <div class="presensi-session-bar">
                <div class="session-info">
                    <span class="session-title" style="display:flex; align-items:center; gap:8px;">
                        Tipe Sesi: 
                        <span class="badge" style="background-color: var(--color-primary-light); color: var(--color-primary); font-weight:700;">
                            ${sesi.jenis_pengajian} ${sesi.kelompok ? '(' + sesi.kelompok + ')' : ''}
                        </span>
                    </span>
                    <span class="session-date">
                        ${isSuperAdmin 
                            ? 'Akses Global: Anda dapat melihat dan mengisi seluruh kelompok jamaah' 
                            : `Akses Terbatas: Anda mengisi data untuk kelompok: <strong>${state.user.kelompok || 'Semua'}</strong> di desa <strong>${state.user.desa}</strong>`
                        }
                    </span>
                    <span style="display:block; font-size:0.75rem; color:var(--color-grey-500); margin-top:2px;">
                        Pembuat Sesi: ${sesi.created_by || 'Sistem'}
                    </span>
                </div>
                
                ${isSuperAdmin && sesi.jenis_pengajian === 'Pengajian Desa' ? `
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <label for="filter-attendance-group" style="font-size:0.9rem; font-weight:600; color:var(--color-earth-green-hover);">Filter Kelompok:</label>
                        <select id="filter-attendance-group" class="filter-select" style="background:#ffffff; border-color:var(--color-earth-green);">
                            <option value="">Semua Kelompok</option>
                            <option value="Andara 1" ${currentGroupFilter === 'Andara 1' ? 'selected' : ''}>Andara 1</option>
                            <option value="Andara 2" ${currentGroupFilter === 'Andara 2' ? 'selected' : ''}>Andara 2</option>
                            <option value="Andara 3" ${currentGroupFilter === 'Andara 3' ? 'selected' : ''}>Andara 3</option>
                            <option value="Andara 4" ${currentGroupFilter === 'Andara 4' ? 'selected' : ''}>Andara 4</option>
                            <option value="Andara 5" ${currentGroupFilter === 'Andara 5' ? 'selected' : ''}>Andara 5</option>
                            <option value="Lain-lain" ${currentGroupFilter === 'Lain-lain' ? 'selected' : ''}>Lain-lain</option>
                        </select>
                    </div>
                ` : ''}
            </div>

            <!-- Attendance List Card -->
            <div id="attendance-list-container">
                <!-- Data will be populated here -->
            </div>
        `;
        
        lucide.createIcons();
        
        document.getElementById('btn-back-to-sessions').addEventListener('click', () => {
            activeSessionId = null;
            activeSessionData = null;
            renderPresensi(container);
        });
        
        if (isSuperAdmin && sesi.jenis_pengajian === 'Pengajian Desa') {
            document.getElementById('filter-attendance-group').addEventListener('change', (e) => {
                currentGroupFilter = e.target.value;
                populateAttendanceRows();
            });
        }
        
        populateAttendanceRows();
        
    } catch (err) {
        showToast("Kesalahan saat memuat detail presensi", "error");
        activeSessionId = null;
        renderPresensi(container);
    }
}

function populateAttendanceRows() {
    const listContainer = document.getElementById('attendance-list-container');
    if (!listContainer) return;
    
    let list = activeSessionData.kehadiran;
    const sesi = activeSessionData.sesi;
    
    if (state.user.role === 'Super Admin' && sesi.jenis_pengajian === 'Pengajian Desa' && currentGroupFilter) {
        list = list.filter(k => k.kelompok === currentGroupFilter);
    }
    
    if (list.length === 0) {
        listContainer.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px; color: var(--color-grey-500);">
                <i data-lucide="users" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;"></i>
                <p>Tidak ada jamaah terdaftar untuk ditampilkan dalam lingkup ini.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    let html = `
        <div class="table-container">
            <table class="responsive-table">
                <thead>
                    <tr>
                        <th>Nama Jamaah</th>
                        <th>Wilayah Desa</th>
                        <th>Kelompok</th>
                        <th>Gander</th>
                        <th style="width: 300px; text-align: center;">Status Kehadiran</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    const canEdit = activeSessionData.sesi.can_edit;
    const disabledAttr = canEdit ? '' : 'disabled style="opacity: 0.6; cursor: not-allowed;"';
    
    list.forEach(k => {
        html += `
            <tr id="row-kehadiran-${k.kehadiran_id}">
                <td style="font-weight: 600;">${k.nama_lengkap}</td>
                <td style="font-weight: 600; color:var(--color-earth-green);">${k.desa}</td>
                <td><span class="badge" style="background-color: var(--color-grey-100); color: var(--color-grey-900); font-weight:600;">${k.kelompok}</span></td>
                <td>${k.jenis_kelamin}</td>
                <td>
                    <div style="display:flex; justify-content:center;">
                        <div class="attendance-toggle-group" ${canEdit ? '' : 'style="opacity: 0.8;"'}>
                            <button class="attendance-toggle-btn btn-hadir ${k.status === 'Hadir' ? 'active-hadir' : ''}" ${disabledAttr} data-id="${k.kehadiran_id}" data-status="Hadir">Hadir</button>
                            <button class="attendance-toggle-btn btn-ijin ${k.status === 'Ijin' ? 'active-ijin' : ''}" ${disabledAttr} data-id="${k.kehadiran_id}" data-status="Ijin">Ijin</button>
                            <button class="attendance-toggle-btn btn-tidak-hadir ${k.status === 'Tidak Hadir' ? 'active-tidak_hadir' : ''}" ${disabledAttr} data-id="${k.kehadiran_id}" data-status="Tidak Hadir">Tidak Hadir</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    listContainer.innerHTML = html;
    lucide.createIcons();
    
    listContainer.querySelectorAll('.attendance-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const kid = btn.getAttribute('data-id');
            const targetStatus = btn.getAttribute('data-status');
            await updateKehadiranStatus(kid, targetStatus, btn);
        });
    });
}

async function updateKehadiranStatus(kehadiranId, status, buttonElement) {
    if (!activeSessionData.sesi.can_edit) {
        showToast("Akses ditolak: Anda tidak memiliki wewenang untuk memperbarui kehadiran di sesi ini.", "error");
        return;
    }
    const parentGroup = buttonElement.closest('.attendance-toggle-group');
    const oldActiveBtn = parentGroup.querySelector('.active-hadir, .active-ijin, .active-tidak_hadir');
    
    if (oldActiveBtn) {
        oldActiveBtn.classList.remove('active-hadir', 'active-ijin', 'active-tidak_hadir');
    }
    
    let activeClass = 'active-hadir';
    if (status === 'Ijin') activeClass = 'active-ijin';
    if (status === 'Tidak Hadir') activeClass = 'active-tidak_hadir';
    
    buttonElement.classList.add(activeClass);
    
    try {
        const res = await fetch('/api/kehadiran', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kehadiran_id: kehadiranId, status: status })
        });
        
        if (res.ok) {
            const record = activeSessionData.kehadiran.find(k => k.kehadiran_id === kehadiranId);
            if (record) record.status = status;
            showToast(`Status ${record ? record.nama_lengkap : 'jamaah'} diubah menjadi ${status}`, "success");
        } else {
            const data = await res.json();
            showToast(data.error || "Gagal memperbarui status", "error");
            
            buttonElement.classList.remove(activeClass);
            if (oldActiveBtn) {
                let oldClass = 'active-hadir';
                if (oldActiveBtn.getAttribute('data-status') === 'Ijin') oldClass = 'active-ijin';
                if (oldActiveBtn.getAttribute('data-status') === 'Tidak Hadir') oldClass = 'active-tidak_hadir';
                oldActiveBtn.classList.add(oldClass);
            }
        }
    } catch (err) {
        showToast("Kesalahan koneksi internet", "error");
        buttonElement.classList.remove(activeClass);
        if (oldActiveBtn) {
            let oldClass = 'active-hadir';
            if (oldActiveBtn.getAttribute('data-status') === 'Ijin') oldClass = 'active-ijin';
            if (oldActiveBtn.getAttribute('data-status') === 'Tidak Hadir') oldClass = 'active-tidak_hadir';
            oldActiveBtn.classList.add(oldClass);
        }
    }
}

// ==========================================================================
// MODAL: CREATE SESSION
// ==========================================================================
function openNewSessionModal() {
    const modalArea = document.getElementById('presensi-modal-area');
    const today = new Date().toISOString().split('T')[0];
    const currentUser = state.user;
    
    let typeOptionsHtml = '';
    if (currentUser.role === 'Moderator') {
        typeOptionsHtml = '<option value="Pengajian Kelompok" selected>Pengajian Kelompok</option>';
    } else {
        typeOptionsHtml = `
            <option value="Pengajian Kelompok" selected>Pengajian Kelompok</option>
            <option value="Pengajian Desa">Pengajian Desa (Tingkat Desa)</option>
        `;
    }
    
    let kelompokInputHtml = '';
    if (currentUser.role === 'Moderator') {
        kelompokInputHtml = `
            <input type="text" id="form-sesi-group" class="form-control" value="${currentUser.kelompok}" disabled style="background-color: var(--color-grey-100)">
        `;
    } else {
        kelompokInputHtml = `
            <select id="form-sesi-group" class="form-control" required>
                <option value="Andara 1">Andara 1</option>
                <option value="Andara 2">Andara 2</option>
                <option value="Andara 3">Andara 3</option>
                <option value="Andara 4">Andara 4</option>
                <option value="Andara 5">Andara 5</option>
                <option value="Lain-lain">Lain-lain</option>
            </select>
        `;
    }
    
    let desaInputHtml = '';
    if (currentUser.role === 'Super Admin') {
        desaInputHtml = `
            <div class="form-group">
                <label for="form-sesi-desa">Wilayah Desa</label>
                <select id="form-sesi-desa" class="form-control" required>
                    <option value="Andara" selected>Andara</option>
                    <option value="Bojong">Bojong</option>
                    <option value="Cisadane">Cisadane</option>
                </select>
            </div>
        `;
    } else {
        desaInputHtml = `
            <input type="hidden" id="form-sesi-desa" value="${currentUser.desa}">
        `;
    }
    
    modalArea.innerHTML = `
        <div class="modal-backdrop active" id="sesi-modal-backdrop">
            <div class="modal-container" style="max-width: 450px;">
                <div class="modal-header">
                    <h2>Buat Sesi Pengajian Baru</h2>
                    <button class="btn-close-modal" id="btn-close-sesi-modal">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="sesi-form">
                        <div class="form-group">
                            <label for="form-sesi-nama">Nama Kegiatan / Sesi</label>
                            <input type="text" id="form-sesi-nama" class="form-control" required placeholder="Contoh: Kajian Rutin Minggu Pertama">
                        </div>
                        
                        <div class="form-group">
                            <label for="form-sesi-type">Jenis Pengajian</label>
                            <select id="form-sesi-type" class="form-control" required>
                                ${typeOptionsHtml}
                            </select>
                        </div>
                        
                        <div class="form-group" id="form-sesi-group-container">
                            <label for="form-sesi-group">Kelompok Pengajian</label>
                            ${kelompokInputHtml}
                        </div>
                        
                        ${desaInputHtml}
                        
                        <div class="form-group">
                            <label for="form-sesi-tanggal">Tanggal Pelaksanaan</label>
                            <input type="date" id="form-sesi-tanggal" class="form-control" value="${today}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="form-sesi-ket">Keterangan (Opsional)</label>
                            <textarea id="form-sesi-ket" class="form-control" rows="2" placeholder="Detail pembahasan..."></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="btn-close-sesi-modal-cancel">Batal</button>
                            <button type="submit" class="btn btn-primary">Simpan Sesi</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    const backdrop = document.getElementById('sesi-modal-backdrop');
    const typeSelect = document.getElementById('form-sesi-type');
    const groupContainer = document.getElementById('form-sesi-group-container');
    const groupSelect = document.getElementById('form-sesi-group');
    
    const toggleGroupSelect = () => {
        if (typeSelect.value === 'Pengajian Desa') {
            groupContainer.style.display = 'none';
            if (groupSelect.tagName === 'SELECT') {
                groupSelect.removeAttribute('required');
            }
        } else {
            groupContainer.style.display = 'flex';
            if (groupSelect.tagName === 'SELECT') {
                groupSelect.setAttribute('required', 'required');
            }
        }
    };
    
    typeSelect.addEventListener('change', toggleGroupSelect);
    toggleGroupSelect();
    
    const closeModal = () => {
        backdrop.classList.remove('active');
        setTimeout(() => modalArea.innerHTML = '', 300);
    };
    
    document.getElementById('btn-close-sesi-modal').addEventListener('click', closeModal);
    document.getElementById('btn-close-sesi-modal-cancel').addEventListener('click', closeModal);
    
    document.getElementById('sesi-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            nama_sesi: document.getElementById('form-sesi-nama').value,
            tanggal: document.getElementById('form-sesi-tanggal').value,
            keterangan: document.getElementById('form-sesi-ket').value || null,
            jenis_pengajian: typeSelect.value,
            desa: document.getElementById('form-sesi-desa').value,
            kelompok: typeSelect.value === 'Pengajian Kelompok' ? groupSelect.value : null
        };
        
        try {
            const res = await fetch('/api/sesi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message, "success");
                closeModal();
                fetchSessions();
            } else {
                showToast(data.error, "error");
            }
        } catch (err) {
            showToast("Gagal membuat sesi pengajian", "error");
        }
    });
}
