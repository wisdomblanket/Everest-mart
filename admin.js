const API = '';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
    document.getElementById('adminLogout').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('adminDashboard').classList.add('hidden');
        document.getElementById('adminLogin').classList.remove('hidden');
        document.getElementById('adminLoginForm').reset();
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            showSection(item.dataset.section, item);
        });
    });
});

async function handleAdminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errEl = document.getElementById('adminError');
    errEl.textContent = '';

    try {
        const res = await fetch(`${API}/api/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'Login failed'; return; }
        if (data.role !== 'admin') { errEl.textContent = 'Not an admin account. Only admin users can access this panel.'; return; }
        document.getElementById('adminLogin').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        document.getElementById('adminGreeting').textContent = `Welcome, ${data.name}`;
        loadAdminData();
    } catch (err) {
        errEl.textContent = 'Unable to connect to server. Is it running on port 5000?';
    }
}

async function loadAdminData() {
    await Promise.all([loadStats(), loadUsers(), loadOrders()]);
}

async function loadStats() {
    try {
        const res = await fetch(`${API}/api/admin/stats`);
        const data = await res.json();
        document.getElementById('totalUsers').textContent = data.totalUsers;
        document.getElementById('totalOrders').textContent = data.totalOrders;
        document.getElementById('totalRevenue').textContent = `Rs. ${data.totalRevenue.toLocaleString()}`;
        if (data.popularProducts.length > 0) {
            document.getElementById('topProduct').textContent = data.popularProducts[0][0].length > 28 ? data.popularProducts[0][0].substring(0, 28) + '...' : data.popularProducts[0][0];
            document.getElementById('popularProductsList').innerHTML = data.popularProducts.map(([name, qty], i) => `
                <div class="popular-item">
                    <span class="rank">#${i + 1}</span>
                    <span class="name">${name}</span>
                    <span class="qty">${qty} sold</span>
                    <div class="bar" style="width:${(qty / data.popularProducts[0][1]) * 100}%"></div>
                </div>`).join('');
            document.getElementById('productPerformance').innerHTML = data.popularProducts.map(([name, qty], i) => `
                <div class="performance-item">
                    <div class="perf-rank">${i + 1}</div>
                    <div class="perf-info"><h4>${name}</h4><p>${qty} units sold</p></div>
                    <div class="perf-bar-container"><div class="perf-bar" style="width:${(qty / data.popularProducts[0][1]) * 100}%"></div></div>
                </div>`).join('');
        } else {
            document.getElementById('popularProductsList').innerHTML = '<p style="color:var(--muted);font-size:13px;padding:16px 0">No orders placed yet. Popular products will appear here once customers start ordering.</p>';
            document.getElementById('productPerformance').innerHTML = '<p style="color:var(--muted);font-size:13px;padding:16px 0">No product data available yet.</p>';
        }
    } catch (err) { console.error('Stats error:', err); }
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadUsers() {
    try {
        const res = await fetch(`${API}/api/admin/users`);
        const users = await res.json();
        const pending = users.filter(u => u.passwordRequestPending);
        const alertBox = document.getElementById('resetAlert');
        if (alertBox) {
            alertBox.innerHTML = pending.length
                ? `<div class="reset-banner"><i class="fa-solid fa-bell"></i><span><strong>${pending.length}</strong> password reset request${pending.length === 1 ? '' : 's'} pending: ${pending.map(u => escapeHtml(u.email)).join(', ')}</span></div>`
                : '';
        }
        document.getElementById('usersTableBody').innerHTML = users.length ? users.map(u => `
            <tr${u.passwordRequestPending ? ' class="row-pending"' : ''}>
                <td><span class="uname" id="uname-${u._id}"><strong>${escapeHtml(u.name)}</strong></span>${u.passwordRequestPending ? ' <span class="badge reset">Reset requested</span>' : ''}</td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="badge ${u.role === 'admin' ? 'admin' : 'user'}">${u.role}</span></td>
                <td>${u.loginCount || 0}</td>
                <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</td>
                <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                <td class="row-actions">
                    <button class="mini-btn" onclick="editUserName('${u._id}')" title="Edit name"><i class="fa-solid fa-pen"></i></button>
                    <button class="mini-btn warn" onclick="resetUserPassword('${u._id}', '${escapeHtml(u.email)}')" title="Set new password"><i class="fa-solid fa-key"></i></button>
                </td>
            </tr>`).join('') : '<tr><td colspan="7" class="empty">No users registered yet</td></tr>';
    } catch (err) { console.error('Users error:', err); }
}

function editUserName(id) {
    const cell = document.getElementById('uname-' + id);
    if (!cell || cell.querySelector('input')) return;
    const current = cell.textContent;
    cell.innerHTML = `<input class="inline-edit" id="uedit-${id}" value="${escapeHtml(current).replace(/"/g, '&quot;')}" maxlength="60"> ` +
        `<button class="mini-btn ok" onclick="saveUserName('${id}')" title="Save"><i class="fa-solid fa-check"></i></button> ` +
        `<button class="mini-btn" onclick="loadUsers()" title="Cancel"><i class="fa-solid fa-xmark"></i></button>`;
    const input = document.getElementById('uedit-' + id);
    input.focus();
    input.select();
}

async function saveUserName(id) {
    const input = document.getElementById('uedit-' + id);
    const name = input ? input.value.trim() : '';
    if (!name) { alert('Name cannot be empty.'); return; }
    try {
        const res = await fetch(`${API}/api/admin/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Failed to update name.');
            return;
        }
        loadUsers();
    } catch (err) { alert('Unable to connect to server.'); }
}

async function resetUserPassword(id, email) {
    const pw = prompt(`Set a new password for ${email} (min 8 characters):`);
    if (pw === null) return;
    if (pw.length < 8) { alert('Password must be at least 8 characters.'); return; }
    try {
        const res = await fetch(`${API}/api/admin/users/${id}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Failed to reset password.');
            return;
        }
        alert('Password updated successfully.');
    } catch (err) { alert('Unable to connect to server.'); }
}

function editOrderCustomer(id) {
    const cell = document.getElementById('ocust-' + id);
    if (!cell || cell.querySelector('input')) return;
    const current = cell.querySelector('.uname').textContent;
    cell.innerHTML = `<input class="inline-edit" id="oedit-${id}" value="${escapeHtml(current).replace(/"/g, '&quot;')}" maxlength="80"> ` +
        `<button class="mini-btn ok" onclick="saveOrderCustomer('${id}')" title="Save"><i class="fa-solid fa-check"></i></button> ` +
        `<button class="mini-btn" onclick="loadOrders()" title="Cancel"><i class="fa-solid fa-xmark"></i></button>`;
    const input = document.getElementById('oedit-' + id);
    input.focus();
    input.select();
}

async function saveOrderCustomer(id) {
    const input = document.getElementById('oedit-' + id);
    const customerName = input ? input.value.trim() : '';
    if (!customerName) { alert('Customer name cannot be empty.'); return; }
    try {
        const res = await fetch(`${API}/api/admin/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerName })
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Failed to update customer name.');
            return;
        }
        loadOrders();
    } catch (err) { alert('Unable to connect to server.'); }
}

async function loadOrders() {
    try {
        const res = await fetch(`${API}/api/admin/orders`);
        const orders = await res.json();
        document.getElementById('ordersTableBody').innerHTML = orders.length ? orders.map(o => `
            <tr>
                <td><strong>${escapeHtml(o.customerName)}</strong></td>
                <td>${o.phone}</td>
                <td class="order-items-cell">${renderOrderItems(o.items)}</td>
                <td><strong>Rs. ${(o.totalAmount || 0).toLocaleString()}</strong></td>
                <td><span class="badge payment">${o.paymentMethod}</span></td>
                <td>${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'}</td>
            </tr>`).join('') : '<tr><td colspan="6" class="empty">No orders placed yet</td></tr>';
    } catch (err) { console.error('Orders error:', err); }
}

function renderOrderItems(items) {
    const list = items || [];
    if (!list.length) return '<span style="color:var(--muted);font-size:12px">No items</span>';
    const totalQty = list.reduce((s, i) => s + (i.qty || 1), 0);
    return '<div class="order-items-head">' + totalQty + ' item' + (totalQty === 1 ? '' : 's') + '</div>' +
        list.map(i => {
            const unit = i.price || 0;
            const qty = i.qty || 1;
            return '<div class="order-item-row">' +
                '<span class="oi-name">' + i.title + '<span class="oi-unit">@ Rs. ' + unit.toLocaleString() + ' each</span></span>' +
                '<span class="oi-qty">x ' + qty + '</span>' +
                '<span class="oi-price">Rs. ' + (unit * qty).toLocaleString() + '</span>' +
            '</div>';
        }).join('');
}

function showSection(section, navItem) {
    document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`${section}Section`).classList.remove('hidden');
    navItem.classList.add('active');
    const titles = { overview: 'Dashboard Overview', users: 'User Management', orders: 'Order Management', products: 'Product Performance' };
    document.getElementById('sectionTitle').textContent = titles[section] || 'Dashboard';
}
