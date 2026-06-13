// ANDARA SUPER APPS - FRONTEND ENTRY POINT (app.js)

import { renderLogin } from './pages/login.js';
import { renderHome } from './pages/home.js';
import { renderDatabase } from './pages/database.js';
import { renderPresensi } from './pages/presensi.js';
import { renderUserAccess } from './pages/user_access.js';

// Global Application State
export const state = {
    user: null,
    activePage: 'home'
};

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);
    lucide.createIcons(); // render icon

    // Slide in is handled by CSS animation
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// ==========================================================================
// AUTHENTICATION CHECK
// ==========================================================================
export async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        if (data.user) {
            state.user = data.user;
            setupAppLayout(true);
            return true;
        } else {
            state.user = null;
            setupAppLayout(false);
            return false;
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        state.user = null;
        setupAppLayout(false);
        return false;
    }
}

// Switch between full screen login and sidebar dashboard layout
function setupAppLayout(isLoggedIn) {
    const appContainer = document.getElementById('app-container');
    const sidebar = document.getElementById('sidebar');
    
    if (isLoggedIn) {
        appContainer.classList.remove('login-layout');
        sidebar.classList.remove('hidden');
        sidebar.classList.add('active');
        
        // Update user profile info in sidebar footer
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const roleBadge = document.getElementById('user-role-badge');
        
        userName.textContent = state.user.email.split('@')[0];
        roleBadge.textContent = state.user.role;
        roleBadge.className = `badge user-role-badge badge-${state.user.role.toLowerCase().replace(' ', '-')}`;
        
        // Google custom avatar fallback
        userAvatar.src = `https://api.dicebear.com/7.x/initials/svg?seed=${state.user.email}&backgroundColor=4f6f52,1d70b8`;
        
        renderSidebarNav();
    } else {
        appContainer.classList.add('login-layout');
        sidebar.classList.add('hidden');
        sidebar.classList.remove('active');
    }
}

// ==========================================================================
// SIDEBAR NAVIGATION GENERATION
// ==========================================================================
function renderSidebarNav() {
    const navLinks = document.getElementById('sidebar-nav-links');
    if (!navLinks) return;
    
    const role = state.user.role;
    let menuHtml = '';
    
    // Member: Home only
    // Moderator: Home, Presensi, User Access
    // Admin & Super Admin: Home, Database, Presensi, User Access
    
    // 1. Home (All Roles)
    menuHtml += `
        <a href="#home" class="nav-item ${state.activePage === 'home' ? 'active' : ''}" data-page="home">
            <i data-lucide="layout-dashboard"></i>
            <span>Dashboard</span>
        </a>
    `;
    
    // 2. Database Jamaah (Admin, Super Admin)
    if (role === 'Admin' || role === 'Super Admin') {
        menuHtml += `
            <a href="#database" class="nav-item ${state.activePage === 'database' ? 'active' : ''}" data-page="database">
                <i data-lucide="users"></i>
                <span>Database Jamaah</span>
            </a>
        `;
    }
    
    // 3. Daftar Kehadiran (Moderator, Admin, Super Admin)
    if (role === 'Moderator' || role === 'Admin' || role === 'Super Admin') {
        menuHtml += `
            <a href="#presensi" class="nav-item ${state.activePage === 'presensi' ? 'active' : ''}" data-page="presensi">
                <i data-lucide="clipboard-check"></i>
                <span>Daftar Kehadiran</span>
            </a>
        `;
    }
    
    // 4. User Access Management (Moderator, Admin, Super Admin)
    if (role === 'Moderator' || role === 'Admin' || role === 'Super Admin') {
        menuHtml += `
            <a href="#user-access" class="nav-item ${state.activePage === 'user-access' ? 'active' : ''}" data-page="user-access">
                <i data-lucide="shield-check"></i>
                <span>User Access</span>
            </a>
        `;
    }
    
    navLinks.innerHTML = menuHtml;
    lucide.createIcons();
}

// ==========================================================================
// ROUTER & VIEW RENDERING
// ==========================================================================
export function renderActivePage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    if (!state.user) {
        window.location.hash = '#login';
        renderLogin(mainContent);
        return;
    }
    
    const hash = window.location.hash || '#home';
    state.activePage = hash.substring(1);
    
    // Update active class in sidebar links
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('data-page') === state.activePage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Route matching & access check
    const role = state.user.role;
    
    switch (state.activePage) {
        case 'home':
            renderHome(mainContent);
            break;
            
        case 'database':
            if (role === 'Admin' || role === 'Super Admin') {
                renderDatabase(mainContent);
            } else {
                showToast("Akses Ditolak: Anda tidak memiliki akses ke Database Jamaah", "error");
                window.location.hash = '#home';
            }
            break;
            
        case 'presensi':
            if (role === 'Moderator' || role === 'Admin' || role === 'Super Admin') {
                renderPresensi(mainContent);
            } else {
                showToast("Akses Ditolak: Anda tidak memiliki akses ke Daftar Kehadiran", "error");
                window.location.hash = '#home';
            }
            break;
            
        case 'user-access':
            if (role === 'Moderator' || role === 'Admin' || role === 'Super Admin') {
                renderUserAccess(mainContent);
            } else {
                showToast("Akses Ditolak: Anda tidak memiliki akses ke User Access Management", "error");
                window.location.hash = '#home';
            }
            break;
            
        case 'login':
            // If already logged in, redirect to home
            window.location.hash = '#home';
            break;
            
        default:
            mainContent.innerHTML = `<div class="card glass-card"><h2>Halaman Tidak Ditemukan (404)</h2></div>`;
    }
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Show spinner during loading
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('hidden');
    
    const isLoggedIn = await checkAuth();
    
    if (spinner) spinner.classList.add('hidden');
    
    // Setup Navigation Listeners
    window.addEventListener('hashchange', renderActivePage);
    
    // Setup Logout Button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/auth/logout', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    state.user = null;
                    setupAppLayout(false);
                    showToast("Anda berhasil keluar dari sistem", "info");
                    window.location.hash = '#login';
                }
            } catch (err) {
                showToast("Gagal melakukan logout", "error");
            }
        });
    }
    
    // Render initial page
    renderActivePage();
});
