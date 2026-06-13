// HOME/DASHBOARD PAGE MODULE (home.js)

import { state, showToast } from '../app.js';

let filterStartDate = '';
let filterEndDate = '';

export async function renderHome(container) {
    let scopeText = "Akses Global (Seluruh Desa & Kelompok)";
    if (state.user.role === 'Admin') {
        scopeText = `Akses Tingkat Desa (Desa ${state.user.desa})`;
    } else if (state.user.role === 'Moderator' || state.user.role === 'Member') {
        scopeText = `Akses Tingkat Kelompok (Desa ${state.user.desa}, Kelompok ${state.user.kelompok || '-'})`;
    }

    container.innerHTML = `
        <div class="page-header" style="flex-direction: column; align-items: flex-start; gap: 16px;">
            <div class="page-title-area" style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                <div>
                    <h1 id="welcome-message">Mendapatkan data...</h1>
                    <p class="page-subtitle" style="display:flex; align-items:center; gap:8px;">
                        <span id="welcome-sub">Ringkasan statistik Desa Andara</span>
                        <span class="badge" style="background-color: var(--color-earth-green-light); color: var(--color-earth-green-hover); font-weight:700; font-size:0.75rem;">
                            ${scopeText}
                        </span>
                    </p>
                </div>
                
                <!-- Date Range Filter Area -->
                <div class="glass-card" style="display:flex; align-items:center; gap:12px; padding:10px 16px; border-radius: var(--radius-sm); border: var(--border-light);">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <label for="filter-start-date" style="font-size:0.8rem; font-weight:700; color:var(--color-grey-700);">Mulai:</label>
                        <input type="date" id="filter-start-date" class="form-control" style="padding:6px 10px; font-size:0.8rem; height:32px; width:135px;" value="${filterStartDate}">
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <label for="filter-end-date" style="font-size:0.8rem; font-weight:700; color:var(--color-grey-700);">Selesai:</label>
                        <input type="date" id="filter-end-date" class="form-control" style="padding:6px 10px; font-size:0.8rem; height:32px; width:135px;" value="${filterEndDate}">
                    </div>
                    <button id="btn-apply-date" class="btn btn-primary" style="padding:4px 12px; font-size:0.8rem; height:32px;">Saring</button>
                    <button id="btn-clear-date" class="btn btn-secondary" style="padding:4px 12px; font-size:0.8rem; height:32px; background:transparent; border:1px solid var(--color-grey-300);">Reset</button>
                </div>
            </div>
        </div>

        <!-- Metric Grid -->
        <div class="dashboard-grid">
            <div class="card metric-card glass-card">
                <div class="metric-icon green">
                    <i data-lucide="users"></i>
                </div>
                <div class="metric-info">
                    <span id="metric-total-jamaah" class="metric-value">-</span>
                    <span class="metric-label">Total Jamaah</span>
                </div>
            </div>
            
            <div class="card metric-card glass-card">
                <div class="metric-icon blue">
                    <i data-lucide="home"></i>
                </div>
                <div class="metric-info">
                    <span id="metric-total-keluarga" class="metric-value">-</span>
                    <span class="metric-label">Total Keluarga</span>
                </div>
            </div>
            
            <div class="card metric-card glass-card">
                <div class="metric-icon yellow">
                    <i data-lucide="calendar"></i>
                </div>
                <div class="metric-info">
                    <span id="metric-attendance-pct" class="metric-value">-</span>
                    <span class="metric-label" id="attendance-metric-label">Kehadiran Terakhir</span>
                </div>
            </div>
        </div>

        <!-- Main Dashboard Content -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-top: 24px;" class="dashboard-content-layout">
            <!-- Left panel: Charts & Stats -->
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 350px;">
                <div style="border-bottom: 1px solid var(--color-grey-100); padding-bottom: 16px; margin-bottom: 16px;">
                    <h3 style="font-weight: 700; color: var(--color-bg-dark);">Sebaran Kelompok Jamaah</h3>
                </div>
                <div class="chart-container" id="distribution-chart-container">
                    <div class="spinner"></div>
                </div>
            </div>

            <!-- Right panel: Last Session & Quick Actions -->
            <div style="display: flex; flex-direction: column; gap: 24px;">
                <!-- Last Session Card -->
                <div class="card" style="flex: 1;">
                    <h3 style="font-weight: 700; color: var(--color-bg-dark); margin-bottom: 16px; border-bottom: 1px solid var(--color-grey-100); padding-bottom: 12px;" id="attendance-card-header">Pengajian Terakhir</h3>
                    <div id="last-session-details">
                        <p style="color: var(--color-grey-500); text-align: center; padding: 20px 0;">Belum ada sesi pengajian.</p>
                    </div>
                </div>
                
                <!-- Quick Actions Card -->
                <div class="card">
                    <h3 style="font-weight: 700; color: var(--color-bg-dark); margin-bottom: 16px; border-bottom: 1px solid var(--color-grey-100); padding-bottom: 12px;">Aksi Cepat</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${state.user.role !== 'Member' ? `
                            <a href="#presensi" class="btn btn-primary" style="width: 100%;">
                                <i data-lucide="clipboard-check"></i>
                                <span>Mulai Presensi</span>
                            </a>
                        ` : ''}
                        ${state.user.role === 'Admin' || state.user.role === 'Super Admin' ? `
                            <a href="#database" class="btn btn-secondary" style="width: 100%;">
                                <i data-lucide="user-plus"></i>
                                <span>Tambah Data Jamaah</span>
                            </a>
                        ` : ''}
                        <a href="#home" id="btn-refresh-stats" class="btn btn-secondary" style="width: 100%; background: transparent; border: 1px solid var(--color-grey-300); color: var(--color-grey-700);">
                            <i data-lucide="refresh-cw"></i>
                            <span>Muat Ulang Statistik</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    setWelcomeGreeting();
    
    // Fetch stats on render
    await fetchStats(filterStartDate, filterEndDate);
    
    // Bind Saring / Settle Date button
    document.getElementById('btn-apply-date').addEventListener('click', () => {
        const startVal = document.getElementById('filter-start-date').value;
        const endVal = document.getElementById('filter-end-date').value;
        
        if (startVal && endVal) {
            if (new Date(startVal) > new Date(endVal)) {
                showToast("Tanggal mulai tidak boleh melebihi tanggal selesai", "warning");
                return;
            }
            filterStartDate = startVal;
            filterEndDate = endVal;
            fetchStats(filterStartDate, filterEndDate);
        } else {
            showToast("Wajib memilih kedua tanggal untuk melakukan penyaringan", "warning");
        }
    });
    
    // Bind Reset button
    document.getElementById('btn-clear-date').addEventListener('click', () => {
        document.getElementById('filter-start-date').value = '';
        document.getElementById('filter-end-date').value = '';
        filterStartDate = '';
        filterEndDate = '';
        fetchStats();
    });

    // Bind Refresh Action
    const btnRefresh = document.getElementById('btn-refresh-stats');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', (e) => {
            e.preventDefault();
            fetchStats(filterStartDate, filterEndDate);
        });
    }
}

function setWelcomeGreeting() {
    const welcome = document.getElementById('welcome-message');
    if (!welcome) return;
    
    const now = new Date();
    const hours = now.getHours();
    let greeting = "Selamat Datang";
    
    if (hours >= 5 && hours < 11) {
        greeting = "Selamat Pagi";
    } else if (hours >= 11 && hours < 15) {
        greeting = "Selamat Siang";
    } else if (hours >= 15 && hours < 18) {
        greeting = "Selamat Sore";
    } else {
        greeting = "Selamat Malam";
    }
    
    const displayName = state.user.email.split('@')[0];
    welcome.textContent = `${greeting}, ${displayName}!`;
}

async function fetchStats(startDate = '', endDate = '') {
    const totalJamaahEl = document.getElementById('metric-total-jamaah');
    const totalKeluargaEl = document.getElementById('metric-total-keluarga');
    const attendancePctEl = document.getElementById('metric-attendance-pct');
    const attendanceMetricLabel = document.getElementById('attendance-metric-label');
    const attendanceCardHeader = document.getElementById('attendance-card-header');
    const chartContainer = document.getElementById('distribution-chart-container');
    const lastSessionEl = document.getElementById('last-session-details');
    
    try {
        let url = '/api/stats';
        if (startDate && endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
            attendanceMetricLabel.textContent = "Agregat Kehadiran";
            attendanceCardHeader.textContent = "Rekapitulasi Kehadiran";
        } else {
            attendanceMetricLabel.textContent = "Kehadiran Terakhir";
            attendanceCardHeader.textContent = "Pengajian Terakhir";
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
            showToast(data.error || "Gagal memuat statistik", "error");
            return;
        }
        
        // Update Metrics
        totalJamaahEl.textContent = data.total_jamaah;
        totalKeluargaEl.textContent = data.total_keluarga;
        
        // Update Kehadiran Terakhir Metric & Card
        if (data.sesi_terakhir) {
            const stats = data.sesi_terakhir.stats;
            const sesi = data.sesi_terakhir.sesi;
            const total = stats.hadir + stats.ijin + stats.tidak_hadir;
            const attendancePct = total > 0 ? Math.round((stats.hadir / total) * 100) : 0;
            
            attendancePctEl.textContent = `${attendancePct}%`;
            
            // Format Date / Range Text
            let dateText = '';
            if (sesi.id === 'range_summary') {
                dateText = sesi.tanggal; // Rentang: YYYY-MM-DD s/d YYYY-MM-DD
            } else {
                const sessionDate = new Date(sesi.tanggal);
                dateText = sessionDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            }
            
            lastSessionEl.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div>
                        <h4 style="font-weight: 600; color: var(--color-grey-900); font-size: 1.05rem;">${sesi.nama_sesi}</h4>
                        <span style="font-size: 0.75rem; color: var(--color-grey-500); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                            <i data-lucide="calendar" style="width: 14px; height: 14px;"></i> ${dateText}
                        </span>
                        ${sesi.id !== 'range_summary' ? `
                            <span style="display:block; font-size:0.75rem; color:var(--color-primary); font-weight:600; margin-top:2px;">
                                Tipe: ${sesi.jenis_pengajian} ${sesi.kelompok ? '(' + sesi.kelompok + ')' : ''}
                            </span>
                        ` : ''}
                    </div>
                    
                    <div style="margin-top: 8px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">
                            <span>Tingkat Kehadiran</span>
                            <span>${attendancePct}% (${stats.hadir}/${total} Jamaah)</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${attendancePct}%;"></div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 12px; text-align: center;">
                        <div style="background-color: var(--color-pastel-green); padding: 8px; border-radius: var(--radius-sm);">
                            <span style="font-size: 1.2rem; font-weight: 700; color: var(--color-pastel-green-text); display: block;">${stats.hadir}</span>
                            <span style="font-size: 0.75rem; font-weight: 600; color: var(--color-pastel-green-text);">Hadir</span>
                        </div>
                        <div style="background-color: var(--color-pastel-yellow); padding: 8px; border-radius: var(--radius-sm);">
                            <span style="font-size: 1.2rem; font-weight: 700; color: var(--color-pastel-yellow-text); display: block;">${stats.ijin}</span>
                            <span style="font-size: 0.75rem; font-weight: 600; color: var(--color-pastel-yellow-text);">Ijin</span>
                        </div>
                        <div style="background-color: var(--color-pastel-red); padding: 8px; border-radius: var(--radius-sm);">
                            <span style="font-size: 1.2rem; font-weight: 700; color: var(--color-pastel-red-text); display: block;">${stats.tidak_hadir}</span>
                            <span style="font-size: 0.75rem; font-weight: 600; color: var(--color-pastel-red-text);">Tidak Hadir</span>
                        </div>
                    </div>
                </div>
            `;
            lucide.createIcons();
        } else {
            attendancePctEl.textContent = "0%";
            lastSessionEl.innerHTML = `<p style="color: var(--color-grey-500); text-align: center; padding: 20px 0;">Tidak ada data pengajian dalam rentang ini.</p>`;
        }
        
        // Render SVG Donut Chart
        renderDonutChart(chartContainer, data.distribusi_kelompok);
        
    } catch (err) {
        console.error(err);
        showToast("Koneksi gagal ke server", "error");
    }
}

function renderDonutChart(container, dist) {
    if (!container) return;
    
    if (!dist || dist.length === 0) {
        container.innerHTML = `<p style="color: var(--color-grey-500); text-align:center; padding: 20px 0;">Tidak ada sebaran data kelompok.</p>`;
        return;
    }
    
    dist.sort((a, b) => b.count - a.count);
    const total = dist.reduce((sum, item) => sum + item.count, 0);
    
    const colorMap = {
        "Andara 1": "#4f6f52",
        "Andara 2": "#1d70b8",
        "Andara 3": "#e07a5f",
        "Andara 4": "#f4d068",
        "Andara 5": "#81b29a",
        "Lain-lain": "#adb5bd"
    };
    
    let chartHtml = `
        <div style="display: flex; align-items: center; justify-content: space-around; width: 100%; flex-wrap: wrap; gap: 20px;">
            <svg class="svg-donut" viewBox="0 0 100 100">
                <circle class="donut-hole" cx="50" cy="50" r="30"></circle>
    `;
    
    let accumulatedPercent = 0;
    
    dist.forEach((item, index) => {
        const percent = (item.count / total) * 100;
        const color = colorMap[item.kelompok] || "#adb5bd";
        
        const circumference = 188.495;
        const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
        const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
        
        chartHtml += `
            <circle class="donut-segment" cx="50" cy="50" r="30"
                    stroke="${color}"
                    stroke-dasharray="${strokeDasharray}"
                    stroke-dashoffset="${strokeDashoffset}">
            </circle>
        `;
        
        accumulatedPercent += percent;
    });
    
    chartHtml += `
                <g class="chart-text" transform="rotate(90 50 50)">
                    <text x="50" y="48" style="font-size: 10px; font-weight: 700; fill: var(--color-grey-900); text-anchor: middle;">${total}</text>
                    <text x="50" y="60" style="font-size: 5px; font-weight: 600; fill: var(--color-grey-500); text-anchor: middle; text-transform: uppercase; letter-spacing: 0.5px;">Jamaah</text>
                </g>
            </svg>
            <div class="chart-legend">
    `;
    
    dist.forEach((item) => {
        const color = colorMap[item.kelompok] || "#adb5bd";
        const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
        chartHtml += `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${color}"></span>
                <span style="font-weight: 600;">${item.kelompok}:</span>
                <span>${item.count} (${percent}%)</span>
            </div>
        `;
    });
    
    chartHtml += `
            </div>
        </div>
    `;
    
    container.innerHTML = chartHtml;
}
