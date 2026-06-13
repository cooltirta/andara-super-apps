// LOGIN PAGE MODULE (login.js)

import { state, checkAuth, showToast } from '../app.js';

export function renderLogin(container) {
    container.innerHTML = `
        <div class="login-screen">
            <div class="login-card">
                <div class="login-logo">A</div>
                <h1>Andara Super Apps</h1>
                <p class="login-subtitle">Pendataan & Kehadiran Jamaah Pengajian Desa Andara</p>
                
                <!-- Mock Google Login Button -->
                <button id="btn-google-signin" class="btn-google-login">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google Logo">
                    <span>Masuk dengan Google</span>
                </button>
                
                <div class="login-divider">atau</div>
                
                <!-- Simulation Area for Evaluators -->
                <h3 class="simulation-title">Mode Simulasi (Evaluasi Role & Wilayah)</h3>
                <div class="simulation-grid">
                    <button class="btn-sim" data-email="cooltirta@gmail.com" data-desa="Andara" data-kelompok="">cooltirta (Super Admin)</button>
                    <button class="btn-sim" data-email="admin@andara.com" data-desa="Andara" data-kelompok="">admin (Admin - Desa Andara)</button>
                    <button class="btn-sim" data-email="mod1@andara.com" data-desa="Andara" data-kelompok="Andara 1">mod1 (Mod - Andara 1)</button>
                    <button class="btn-sim" data-email="mod2@andara.com" data-desa="Andara" data-kelompok="Andara 2">mod2 (Mod - Andara 2)</button>
                    <button class="btn-sim" data-email="fulan_a@andara.com" data-desa="Andara" data-kelompok="Andara 2">Fulan A (Mod - Andara 2)</button>
                    <button class="btn-sim" data-email="fulan_b@andara.com" data-desa="Andara" data-kelompok="Andara 2">Fulan B (Mod - Andara 2)</button>
                    <button class="btn-sim" data-email="fulan_c@andara.com" data-desa="Andara" data-kelompok="Andara 1">Fulan C (Admin - Andara 1)</button>
                    <button class="btn-sim" data-email="fulan_d@andara.com" data-desa="Andara" data-kelompok="Andara 2">Fulan D (Admin - Andara 2)</button>
                </div>
                
                <!-- Custom Login Form -->
                <form id="login-form" class="custom-login-form">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label for="login-email">Uji Email Kustom</label>
                        <input type="email" id="login-email" class="form-control" placeholder="nama@gmail.com" required>
                    </div>
                    
                    <div class="form-row" style="margin-bottom: 16px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="login-desa">Pilih Desa</label>
                            <select id="login-desa" class="form-control">
                                <option value="Andara" selected>Andara</option>
                                <option value="Bojong">Bojong</option>
                                <option value="Cisadane">Cisadane</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="login-kelompok">Pilih Kelompok</label>
                            <select id="login-kelompok" class="form-control">
                                <option value="" selected>Tidak Ada (Admin/Member Baru)</option>
                                <option value="Andara 1">Andara 1</option>
                                <option value="Andara 2">Andara 2</option>
                                <option value="Andara 3">Andara 3</option>
                                <option value="Andara 4">Andara 4</option>
                                <option value="Andara 5">Andara 5</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Masuk / Daftar</button>
                </form>
            </div>
        </div>
    `;
    
    // Add Event Listeners
    const btnGoogle = document.getElementById('btn-google-signin');
    btnGoogle.addEventListener('click', () => {
        handleLogin("cooltirta@gmail.com", "Andara", null);
    });
    
    // Listeners for simulation buttons
    document.querySelectorAll('.btn-sim').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const email = e.target.getAttribute('data-email');
            const desa = e.target.getAttribute('data-desa');
            const kelompok = e.target.getAttribute('data-kelompok') || null;
            handleLogin(email, desa, kelompok);
        });
    });
    
    // Custom form submit
    const form = document.getElementById('login-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-email');
        const desaSelect = document.getElementById('login-desa');
        const kelompokSelect = document.getElementById('login-kelompok');
        
        if (emailInput && emailInput.value) {
            handleLogin(emailInput.value, desaSelect.value, kelompokSelect.value || null);
        }
    });
}

async function handleLogin(email, desa, kelompok) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email,
                desa: desa,
                kelompok: kelompok
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            state.user = data;
            await checkAuth(); // reload layout
            showToast(`Masuk sebagai ${data.email} (${data.role} - Desa ${data.desa}${data.kelompok ? ', Kelompok ' + data.kelompok : ''})`, "success");
            window.location.hash = '#home';
        } else {
            showToast(data.error || "Gagal masuk", "error");
        }
    } catch (err) {
        showToast("Terjadi kesalahan koneksi server", "error");
        console.error(err);
    } finally {
        if (spinner) spinner.classList.add('hidden');
    }
}
