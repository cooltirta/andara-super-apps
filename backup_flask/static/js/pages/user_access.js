// USER ACCESS MANAGEMENT PAGE MODULE (user_access.js)

import { state, showToast } from '../app.js';

let usersList = [];

export async function renderUserAccess(container) {
    let scopeLabel = '';
    if (state.user.role === 'Admin') {
        scopeLabel = ` (Desa ${state.user.desa})`;
    } else if (state.user.role === 'Moderator') {
        scopeLabel = ` (Kelompok ${state.user.kelompok})`;
    }

    container.innerHTML = `
        <div class="page-header">
            <div class="page-title-area">
                <h1>Manajemen Akses Pengguna${scopeLabel}</h1>
                <p class="page-subtitle">Atur hak akses akun Google jamaah (Super Admin, Admin, Moderator, Member)</p>
            </div>
            <button id="btn-modal-user" class="btn btn-primary">
                <i data-lucide="user-check"></i>
                <span>Tambah User Akses</span>
            </button>
        </div>

        <div id="users-content-area">
            <!-- Spinner -->
            <div style="display:flex; justify-content:center; padding: 40px;">
                <div class="spinner"></div>
            </div>
        </div>
        
        <!-- Modal Area -->
        <div id="user-access-modal-area"></div>
    `;
    
    lucide.createIcons();
    document.getElementById('btn-modal-user').addEventListener('click', () => openUserModal());
    
    await fetchUsers();
}

async function fetchUsers() {
    const content = document.getElementById('users-content-area');
    try {
        const res = await fetch('/api/users');
        if (res.ok) {
            usersList = await res.json();
            renderUsersTable(content);
        } else {
            showToast("Gagal memuat daftar user akses", "error");
        }
    } catch (err) {
        showToast("Kesalahan koneksi database", "error");
    }
}

function renderUsersTable(container) {
    if (usersList.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px; color: var(--color-grey-500);">
                <i data-lucide="shield-alert" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;"></i>
                <p>Tidak ada data user terdaftar dalam wewenang Anda.</p>
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
                        <th>Email Pengguna</th>
                        <th>Wilayah Desa</th>
                        <th>Role Akses</th>
                        <th>Kelompok Terpantau</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    const currentUser = state.user;
    
    usersList.forEach(u => {
        const isSelf = u.email === currentUser.email;
        const isPrimarySuperAdmin = u.email === 'cooltirta@gmail.com';
        
        let canEdit = false;
        let canDelete = false;
        
        if (currentUser.role === 'Super Admin') {
            canEdit = !isSelf && !isPrimarySuperAdmin;
            canDelete = !isSelf && !isPrimarySuperAdmin;
        } else if (currentUser.role === 'Admin') {
            canEdit = u.role === 'Member' || u.role === 'Moderator';
            canDelete = u.role === 'Member' || u.role === 'Moderator';
        }
        
        const roleBadgeClass = `badge-status badge-${u.role.toLowerCase().replace(' ', '-')}`;
        const groupText = u.role === 'Moderator' || u.role === 'Admin' 
            ? (u.kelompok || '<em style="color:var(--color-grey-500)">Semua Kelompok</em>') 
            : '-';
            
        html += `
            <tr id="row-user-${u.id}">
                <td style="font-weight: 600;">
                    ${u.email} ${isSelf ? ' <span style="font-size:0.75rem; color:var(--color-primary); font-weight:700;">(Anda)</span>' : ''}
                </td>
                <td style="font-weight: 600; color:var(--color-earth-green);">${u.desa}</td>
                <td><span class="badge ${roleBadgeClass}" style="text-transform: capitalize; padding:4px 10px; font-weight:600;">${u.role}</span></td>
                <td style="font-weight: 500;">${groupText}</td>
                <td>
                    <div class="actions-cell">
                        ${canEdit ? `
                            <button class="btn btn-secondary btn-icon btn-edit-user" data-id="${u.id}" title="Ubah Role">
                                <i data-lucide="shield" style="width: 16px; height: 16px;"></i>
                            </button>
                        ` : ''}
                        ${canDelete ? `
                            <button class="btn btn-danger btn-icon btn-delete-user" data-id="${u.id}" title="Hapus User">
                                <i data-lucide="user-x" style="width: 16px; height: 16px;"></i>
                            </button>
                        ` : ''}
                        ${!canEdit && !canDelete ? '<span style="font-size:0.8rem; color:var(--color-grey-500); font-style:italic;">Tidak ada aksi</span>' : ''}
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
    
    container.innerHTML = html;
    lucide.createIcons();
    
    container.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            openUserModal(id);
        });
    });
    
    container.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            handleDeleteUser(id);
        });
    });
}

async function handleDeleteUser(id) {
    if (!confirm("Hapus hak akses user ini? Jamaah tersebut tidak akan bisa menggunakan fitur-fitur khusus lagi.")) return;
    
    try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
            fetchUsers();
        } else {
            showToast(data.error, "error");
        }
    } catch (err) {
        showToast("Gagal menghapus user", "error");
    }
}

// ==========================================================================
// MODAL: ADD/EDIT USER ACCESS
// ==========================================================================
function openUserModal(id = null) {
    const modalArea = document.getElementById('user-access-modal-area');
    const isEdit = id !== null;
    const targetUser = isEdit ? usersList.find(u => u.id === id) : null;
    const currentUser = state.user;
    
    let roleOptions = '';
    if (currentUser.role === 'Moderator') {
        roleOptions = '<option value="Member" selected>Member</option>';
    } else if (currentUser.role === 'Admin') {
        roleOptions = `
            <option value="Member" ${isEdit && targetUser.role === 'Member' ? 'selected' : ''}>Member</option>
            <option value="Moderator" ${isEdit && targetUser.role === 'Moderator' ? 'selected' : 'selected'}>Moderator</option>
        `;
    } else if (currentUser.role === 'Super Admin') {
        roleOptions = `
            <option value="Member" ${isEdit && targetUser.role === 'Member' ? 'selected' : ''}>Member</option>
            <option value="Moderator" ${isEdit && targetUser.role === 'Moderator' ? 'selected' : ''}>Moderator</option>
            <option value="Admin" ${isEdit && targetUser.role === 'Admin' ? 'selected' : ''}>Admin</option>
            <option value="Super Admin" ${isEdit && targetUser.role === 'Super Admin' ? 'selected' : ''}>Super Admin</option>
        `;
    }
    
    // Desa field control based on role:
    let desaInputHtml = '';
    if (currentUser.role === 'Super Admin') {
        desaInputHtml = `
            <select id="form-user-desa" class="form-control" required>
                <option value="Andara" ${isEdit && targetUser.desa === 'Andara' ? 'selected' : 'selected'}>Andara</option>
                <option value="Bojong" ${isEdit && targetUser.desa === 'Bojong' ? 'selected' : ''}>Bojong</option>
                <option value="Cisadane" ${isEdit && targetUser.desa === 'Cisadane' ? 'selected' : ''}>Cisadane</option>
            </select>
        `;
    } else {
        desaInputHtml = `
            <input type="text" id="form-user-desa" class="form-control" value="${isEdit ? targetUser.desa : currentUser.desa}" disabled style="background-color: var(--color-grey-100)">
        `;
    }
    
    modalArea.innerHTML = `
        <div class="modal-backdrop active" id="user-modal-backdrop">
            <div class="modal-container" style="max-width: 450px;">
                <div class="modal-header">
                    <h2>${isEdit ? 'Ubah Hak Akses User' : 'Tambah User Akses Baru'}</h2>
                    <button class="btn-close-modal" id="btn-close-user-modal">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="user-access-form">
                        <div class="form-group">
                            <label for="form-user-email">Email Akun Google</label>
                            <input type="email" id="form-user-email" class="form-control" 
                                value="${isEdit ? targetUser.email : ''}" 
                                ${isEdit ? 'disabled style="background-color: var(--color-grey-100)"' : ''} 
                                required placeholder="contoh@gmail.com">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="form-user-desa">Wilayah Desa</label>
                                ${desaInputHtml}
                            </div>
                            <div class="form-group">
                                <label for="form-user-role">Role Akses</label>
                                <select id="form-user-role" class="form-control" required>
                                    ${roleOptions}
                                </select>
                            </div>
                        </div>
                        
                        <!-- Dynamic Kelompok select, only shown for Moderator and Admin -->
                        <div class="form-group" id="form-user-group-group" style="display:none;">
                            <label for="form-user-group">Kelompok yang Diawasi</label>
                            <select id="form-user-group" class="form-control">
                                <option value="" ${isEdit && !targetUser.kelompok ? 'selected' : ''}>Semua Kelompok</option>
                                <option value="Andara 1" ${isEdit && targetUser.kelompok === 'Andara 1' ? 'selected' : ''}>Andara 1</option>
                                <option value="Andara 2" ${isEdit && targetUser.kelompok === 'Andara 2' ? 'selected' : ''}>Andara 2</option>
                                <option value="Andara 3" ${isEdit && targetUser.kelompok === 'Andara 3' ? 'selected' : ''}>Andara 3</option>
                                <option value="Andara 4" ${isEdit && targetUser.kelompok === 'Andara 4' ? 'selected' : ''}>Andara 4</option>
                                <option value="Andara 5" ${isEdit && targetUser.kelompok === 'Andara 5' ? 'selected' : ''}>Andara 5</option>
                                <option value="Lain-lain" ${isEdit && targetUser.kelompok === 'Lain-lain' ? 'selected' : ''}>Lain-lain</option>
                            </select>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="btn-close-user-modal-cancel">Batal</button>
                            <button type="submit" class="btn btn-primary">Simpan</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    const backdrop = document.getElementById('user-modal-backdrop');
    const roleSelect = document.getElementById('form-user-role');
    const groupGroup = document.getElementById('form-user-group-group');
    const groupSelect = document.getElementById('form-user-group');
    
    const toggleGroupSelect = () => {
        const val = roleSelect.value;
        if (val === 'Moderator' || val === 'Admin') {
            groupGroup.style.display = 'flex';
        } else {
            groupGroup.style.display = 'none';
            groupSelect.value = '';
        }
    };
    
    roleSelect.addEventListener('change', toggleGroupSelect);
    toggleGroupSelect();
    
    const closeModal = () => {
        backdrop.classList.remove('active');
        setTimeout(() => modalArea.innerHTML = '', 300);
    };
    
    document.getElementById('btn-close-user-modal').addEventListener('click', closeModal);
    document.getElementById('btn-close-user-modal-cancel').addEventListener('click', closeModal);
    
    document.getElementById('user-access-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            role: roleSelect.value,
            kelompok: groupSelect.value || null,
            desa: document.getElementById('form-user-desa').value
        };
        
        if (!isEdit) {
            payload.email = document.getElementById('form-user-email').value;
        }
        
        try {
            const url = isEdit ? `/api/users/${id}` : '/api/users';
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
                fetchUsers();
            } else {
                showToast(data.error, "error");
            }
        } catch (err) {
            showToast("Gagal menyimpan data user", "error");
        }
    });
}
