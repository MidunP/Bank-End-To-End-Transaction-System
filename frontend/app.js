/* =========================================================
   NeoBank Ledger — Frontend Application Logic
   Connects to Express backend at http://localhost:3000
   ========================================================= */

'use strict';

// =========================================================
// CONFIG
// =========================================================
const API_BASE = 'http://localhost:3000/api';

// =========================================================
// STATE
// =========================================================
const state = {
    user: null,
    token: null,
    accounts: [],
    currentPage: 'dashboard'
};

// =========================================================
// API HELPER
// =========================================================
async function api(method, path, body = null) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
        },
        credentials: 'include'
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
}

// =========================================================
// AUTH
// =========================================================
function switchTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
    }
    clearErrors();
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');
    clearError(err);
    setLoading(btn, true);

    try {
        const data = await api('POST', '/auth/login', {
            email: document.getElementById('login-email').value.trim(),
            password: document.getElementById('login-password').value
        });
        onAuthSuccess(data);
    } catch (ex) {
        showError(err, ex.message);
    } finally {
        setLoading(btn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    const err = document.getElementById('register-error');
    clearError(err);
    setLoading(btn, true);

    try {
        const data = await api('POST', '/auth/register', {
            name: document.getElementById('reg-name').value.trim(),
            email: document.getElementById('reg-email').value.trim(),
            password: document.getElementById('reg-password').value
        });
        onAuthSuccess(data);
        showToast('Account created! Welcome to NeoBank 🎉', 'success');
    } catch (ex) {
        showError(err, ex.message);
    } finally {
        setLoading(btn, false);
    }
}

function onAuthSuccess(data) {
    state.user = data.user;
    state.token = data.token;

    // Persist
    sessionStorage.setItem('nb_token', data.token);
    sessionStorage.setItem('nb_user', JSON.stringify(data.user));

    initApp();
}

async function handleLogout() {
    try {
        await api('POST', '/auth/logout');
    } catch (ex) { /* best-effort */ }
    sessionStorage.clear();
    state.user = null;
    state.token = null;
    state.accounts = [];
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    showToast('Signed out successfully', 'info');
}

// =========================================================
// APP INIT
// =========================================================
function initApp() {
    // Update UI with user info
    const name = state.user.name || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    document.getElementById('user-name-sidebar').textContent = name;
    document.getElementById('user-email-sidebar').textContent = state.user.email;
    document.getElementById('user-avatar-sidebar').textContent = initials;
    document.getElementById('topbar-avatar').textContent = initials;

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('topbar-greeting').textContent = `${greeting}, ${name.split(' ')[0]} 👋`;

    // Show app
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');

    // Pre-generate idempotency key
    generateIdempotencyKey();

    // Navigate to dashboard
    navigateTo('dashboard');
}

// =========================================================
// NAVIGATION
// =========================================================
function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`page-${page}`).classList.add('active');
    document.getElementById(`nav-${page}`).classList.add('active');
    state.currentPage = page;

    // Close sidebar on mobile
    if (window.innerWidth < 768) closeSidebar();

    // Load page data
    if (page === 'dashboard') loadDashboard();
    if (page === 'accounts') loadAccounts();
    if (page === 'transfer') loadTransferSelects();
    if (page === 'history') loadHistory();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('open')) {
        closeSidebar();
    } else {
        sidebar.classList.add('open');
        overlay.classList.remove('hidden');
    }
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.add('hidden');
}

// =========================================================
// DASHBOARD
// =========================================================
async function loadDashboard() {
    try {
        const data = await api('GET', '/accounts');
        state.accounts = data.accounts || [];

        const count = state.accounts.length;
        document.getElementById('stat-active-accounts').textContent = state.accounts.filter(a => a.status === 'ACTIVE').length;
        document.getElementById('stat-accounts-count').textContent = `Across ${count} account${count !== 1 ? 's' : ''}`;

        // Load balances for all accounts
        let totalBalance = 0;
        const balancePromises = state.accounts.map(a =>
            api('GET', `/accounts/balance/${a._id}`)
                .then(b => { a._balance = b.balance; return b.balance; })
                .catch(() => { a._balance = 0; return 0; })
        );
        const balances = await Promise.all(balancePromises);
        totalBalance = balances.reduce((s, b) => s + b, 0);

        document.getElementById('stat-total-balance').textContent = formatCurrency(totalBalance, 'INR');

        renderAccountsMini();
        populateHistoryAccountFilter();
    } catch (ex) {
        showToast('Failed to load dashboard: ' + ex.message, 'error');
    }
}

function renderAccountsMini() {
    const container = document.getElementById('accounts-mini-list');

    if (!state.accounts.length) {
        container.innerHTML = `<div class="empty-state-sm">No accounts yet. <button class="copy-btn" onclick="navigateTo('accounts')" style="margin-left:8px">Create one →</button></div>`;
        return;
    }

    container.innerHTML = state.accounts.map(account => `
        <div class="account-mini-item" onclick="openAccountDetail('${account._id}')">
            <div class="account-mini-icon">${account.currency}</div>
            <div class="account-mini-info">
                <div class="account-mini-currency">${account.currency} Account</div>
                <div class="account-mini-id">${account._id}</div>
            </div>
            <span class="account-mini-status status--${account.status}">${account.status}</span>
            <div class="account-mini-balance">${formatCurrency(account._balance ?? 0, account.currency)}</div>
        </div>
    `).join('');
}

// =========================================================
// ACCOUNTS PAGE
// =========================================================
async function loadAccounts() {
    const grid = document.getElementById('accounts-grid');
    grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading accounts...</p></div>`;

    try {
        const data = await api('GET', '/accounts');
        state.accounts = data.accounts || [];

        if (!state.accounts.length) {
            grid.innerHTML = `
                <div class="empty-state-sm" style="grid-column:1/-1">
                    <p style="margin-bottom:1rem;font-size:1rem">No accounts found</p>
                    <p>Create your first account to start banking</p>
                </div>`;
            return;
        }

        // Render cards with loading balances
        grid.innerHTML = state.accounts.map(account => `
            <div class="account-card" onclick="openAccountDetail('${account._id}')">
                <div class="account-card-header">
                    <div>
                        <div class="account-card-currency">${account.currency}</div>
                        <div class="account-card-type">Bank Account</div>
                    </div>
                    <span class="account-mini-status status--${account.status}">${account.status}</span>
                </div>
                <div class="account-card-body">
                    <div class="account-card-balance-label">Available Balance</div>
                    <div class="account-card-balance account-card-balance-loading" id="balance-${account._id}">
                        <div class="spinner" style="width:20px;height:20px;border-width:2px"></div>
                    </div>
                </div>
                <div class="account-card-footer">
                    <div class="account-card-id">${account._id}</div>
                    <div class="account-card-date">Created ${formatDate(account.createdAt)}</div>
                </div>
            </div>
        `).join('');

        // Load balances async
        state.accounts.forEach(account => {
            api('GET', `/accounts/balance/${account._id}`)
                .then(b => {
                    account._balance = b.balance;
                    const el = document.getElementById(`balance-${account._id}`);
                    if (el) {
                        el.className = 'account-card-balance';
                        el.textContent = formatCurrency(b.balance, account.currency);
                    }
                })
                .catch(() => {
                    const el = document.getElementById(`balance-${account._id}`);
                    if (el) { el.className = 'account-card-balance'; el.textContent = 'Error'; }
                });
        });

    } catch (ex) {
        grid.innerHTML = `<div class="empty-state-sm" style="grid-column:1/-1">Failed to load accounts: ${ex.message}</div>`;
    }
}

function openCreateAccountModal() {
    document.getElementById('create-account-error').classList.add('hidden');
    document.getElementById('modal-create-account').classList.remove('hidden');
}

async function handleCreateAccount(e) {
    e.preventDefault();
    const btn = document.getElementById('create-account-btn');
    const err = document.getElementById('create-account-error');
    clearError(err);
    setLoading(btn, true);

    try {
        const currency = document.getElementById('account-currency').value;
        await api('POST', '/accounts', { currency });
        closeModal('modal-create-account');
        showToast(`✅ ${currency} account created successfully!`, 'success');
        loadAccounts();
        // Refresh dashboard stats too
        if (state.currentPage === 'dashboard') loadDashboard();
    } catch (ex) {
        showError(err, ex.message);
    } finally {
        setLoading(btn, false);
    }
}

async function openAccountDetail(accountId) {
    document.getElementById('modal-account-detail').classList.remove('hidden');
    document.getElementById('account-detail-body').innerHTML = `<div class="spinner-center"><div class="spinner"></div></div>`;

    try {
        const account = state.accounts.find(a => a._id === accountId) || {};
        const balanceData = await api('GET', `/accounts/balance/${accountId}`);
        const balance = balanceData.balance;

        document.getElementById('account-detail-body').innerHTML = `
            <div class="balance-big">${formatCurrency(balance, account.currency || 'INR')}</div>
            <div style="display:flex;flex-direction:column">
                <div class="detail-row">
                    <span class="detail-label">Account ID</span>
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="detail-value mono">${short(accountId)}</span>
                        <button class="copy-btn" onclick="copyText('${accountId}', this)">Copy</button>
                    </div>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Currency</span>
                    <span class="detail-value">${account.currency || 'INR'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="account-mini-status status--${account.status || 'ACTIVE'}">${account.status || 'ACTIVE'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Created</span>
                    <span class="detail-value">${formatDate(account.createdAt)}</span>
                </div>
            </div>
            <button class="btn-primary btn-full" onclick="navigateTo('transfer');closeModal('modal-account-detail')">
                <svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px"><path d="M12 5v14m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Transfer From This Account
            </button>
        `;
    } catch (ex) {
        document.getElementById('account-detail-body').innerHTML = `<div style="color:var(--red);text-align:center;padding:2rem">${ex.message}</div>`;
    }
}

// =========================================================
// TRANSFER PAGE
// =========================================================
async function loadTransferSelects() {
    const sel = document.getElementById('tx-from');
    sel.innerHTML = `<option value="">Loading accounts...</option>`;

    try {
        if (!state.accounts.length) {
            const data = await api('GET', '/accounts');
            state.accounts = data.accounts || [];
        }

        sel.innerHTML = `<option value="">Select source account...</option>` +
            state.accounts.map(a => `<option value="${a._id}">${a.currency} — ...${a._id.slice(-8)}</option>`).join('');
    } catch {
        sel.innerHTML = `<option value="">Failed to load accounts</option>`;
    }
}

function generateIdempotencyKey() {
    const key = 'txn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    document.getElementById('tx-idem').value = key;
}

async function handleTransfer(e) {
    e.preventDefault();
    const btn = document.getElementById('transfer-btn');
    const errEl = document.getElementById('transfer-error');
    const succEl = document.getElementById('transfer-success');
    clearError(errEl);
    succEl.classList.add('hidden');
    setLoading(btn, true);

    const fromAccount = document.getElementById('tx-from').value.trim();
    const toAccount = document.getElementById('tx-to').value.trim();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const idempotencyKey = document.getElementById('tx-idem').value.trim();

    if (fromAccount === toAccount) {
        showError(errEl, 'Source and destination accounts cannot be the same.');
        setLoading(btn, false);
        return;
    }

    try {
        const data = await api('POST', '/transactions', { fromAccount, toAccount, amount, idempotencyKey });
        const txId = data.transaction?._id || idempotencyKey;
        const txStatus = data.transaction?.status || 'COMPLETED';

        succEl.textContent = `✅ ${data.message} — Transaction ID: ${txId.slice(-8)}`;
        succEl.classList.remove('hidden');
        showToast(`₹${amount.toLocaleString()} sent successfully! 🎉`, 'success');

        // Record in session history
        recordHistory({ txId, fromAccount, toAccount, amount, status: txStatus, date: new Date().toISOString() });

        // Reset form
        document.getElementById('tx-to').value = '';
        document.getElementById('tx-amount').value = '';
        generateIdempotencyKey();

        // Refresh accounts & balances
        const acctData = await api('GET', '/accounts');
        state.accounts = acctData.accounts || [];
    } catch (ex) {
        showError(errEl, ex.message);
        showToast('Transfer failed: ' + ex.message, 'error');
    } finally {
        setLoading(btn, false);
    }
}

// =========================================================
// HISTORY PAGE
// =========================================================
function populateHistoryAccountFilter() {
    const sel = document.getElementById('history-account-filter');
    const currentVal = sel.value;
    sel.innerHTML = `<option value="">All Accounts</option>` +
        state.accounts.map(a => `<option value="${a._id}" ${currentVal === a._id ? 'selected' : ''}>${a.currency} — ...${a._id.slice(-8)}</option>`).join('');
}

async function loadHistory() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = `<tr><td colspan="6" class="table-loading"><div class="spinner" style="margin:0 auto 0.5rem"></div>Loading transactions...</td></tr>`;

    try {
        // Ensure accounts are loaded
        if (!state.accounts.length) {
            const data = await api('GET', '/accounts');
            state.accounts = data.accounts || [];
            populateHistoryAccountFilter();
        }

        const filterAccountId = document.getElementById('history-account-filter').value;
        const accountsToQuery = filterAccountId
            ? [state.accounts.find(a => a._id === filterAccountId)].filter(Boolean)
            : state.accounts;

        if (!accountsToQuery.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-loading">No accounts found. Create an account first.</td></tr>`;
            return;
        }

        // Fetch ledger entries for each account via balance inquiry (we derive from ledger)
        // Since the backend doesn't expose a /transactions GET, we build history from balance endpoint
        // and the frontend tracks transfer confirmations in sessionStorage for display

        const stored = getStoredHistory();
        const rows = renderHistoryFromStored(stored, filterAccountId, accountsToQuery);

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-loading">No transactions recorded in this session.<br><small style="color:var(--text-muted)">Complete a transfer to see it here.</small></td></tr>`;
        } else {
            tbody.innerHTML = rows;
        }
    } catch (ex) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-loading" style="color:var(--red)">${ex.message}</td></tr>`;
    }
}

// We persist transfers made this session in sessionStorage for history display
// (The backend doesn't have a GET /transactions endpoint — ledger is append-only)
function recordHistory(entry) {
    const hist = getStoredHistory();
    hist.unshift(entry);
    sessionStorage.setItem('nb_history', JSON.stringify(hist.slice(0, 100)));
}

function getStoredHistory() {
    try { return JSON.parse(sessionStorage.getItem('nb_history') || '[]'); }
    catch { return []; }
}

function renderHistoryFromStored(history, filterAccountId, userAccounts) {
    const userAccountIds = new Set(userAccounts.map(a => a._id));
    let filtered = history;

    if (filterAccountId) {
        filtered = history.filter(h => h.fromAccount === filterAccountId || h.toAccount === filterAccountId);
    } else {
        filtered = history.filter(h => userAccountIds.has(h.fromAccount) || userAccountIds.has(h.toAccount));
    }

    return filtered.map(h => {
        const isDebit = userAccountIds.has(h.fromAccount);
        const typeClass = isDebit ? 'debit' : 'credit';
        const typeLabel = isDebit ? '↑ Debit' : '↓ Credit';
        const accountId = isDebit ? h.fromAccount : h.toAccount;
        const sign = isDebit ? '-' : '+';
        const statusClass = (h.status || 'COMPLETED').toLowerCase();

        return `
            <tr>
                <td><span class="tx-type-badge ${typeClass}">${typeLabel}</span></td>
                <td><span class="tx-account-id">...${accountId.slice(-8)}</span></td>
                <td><span class="tx-amount ${typeClass}">${sign}${formatCurrency(h.amount, 'INR')}</span></td>
                <td><span class="tx-status-badge ${statusClass}">${h.status || 'COMPLETED'}</span></td>
                <td style="white-space:nowrap;font-size:0.8rem;color:var(--text-secondary)">${formatDate(h.date)}</td>
                <td>
                    <span class="tx-id-short" onclick="copyText('${h.txId}', this)" title="${h.txId}">
                        ...${h.txId ? h.txId.slice(-8) : 'N/A'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// =========================================================
// MODALS
// =========================================================
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// =========================================================
// TOAST NOTIFICATIONS
// =========================================================
function showToast(msg, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

// =========================================================
// FORM HELPERS
// =========================================================
function setLoading(btn, loading) {
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    if (text) text.style.opacity = loading ? '0' : '1';
    if (spinner) spinner.classList.toggle('hidden', !loading);
}

function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
}
function clearError(el) {
    el.textContent = '';
    el.classList.add('hidden');
}
function clearErrors() {
    document.querySelectorAll('.form-error').forEach(e => { e.textContent = ''; e.classList.add('hidden'); });
}

// =========================================================
// UTILITIES
// =========================================================
function formatCurrency(amount, currency = 'INR') {
    const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    const symbol = symbols[currency] || currency + ' ';
    return symbol + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function short(id) {
    return id ? `${id.slice(0, 8)}...${id.slice(-8)}` : '—';
}

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = original; }, 1500);
    });
}

// =========================================================
// BOOT — Check existing session
// =========================================================
(function boot() {
    const token = sessionStorage.getItem('nb_token');
    const user = sessionStorage.getItem('nb_user');

    if (token && user) {
        try {
            state.token = token;
            state.user = JSON.parse(user);
            initApp();
        } catch {
            sessionStorage.clear();
        }
    }
})();

