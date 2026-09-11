/* ==================== STATE ==================== */
const API = '';
const CATEGORIES = ['All','Electronics','Fashion','Home appliance','Beauty','Sports','Groceries','Toys'];
const state = {
    mode: 'signup',
    user: null,
    products: [],
    cart: JSON.parse(localStorage.getItem('em_cart') || '[]'),
    wishlist: JSON.parse(localStorage.getItem('em_wishlist') || '[]'),
    selectedProduct: null,
    category: 'All',
    reviewRating: 5
};

/* ==================== INIT (page-aware: shop vs auth pages) ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initCookies();
    initScrollTop();
    initReveal();

    if (document.getElementById('loginForm')) initLoginPage();
    else if (document.getElementById('registerForm')) initRegisterPage();
    else if (document.getElementById('forgotForm')) initForgotPage();
    else if (document.getElementById('productGrid')) initShopPage();
});

function initReveal() {
    const els = document.querySelectorAll('.animate-in');
    if (!els.length || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } });
    }, { threshold: 0.1 });
    els.forEach(el => observer.observe(el));
}

function initShopPage() {
    if (!localStorage.getItem('em_user')) {
        sessionStorage.setItem('em_next', 'everest.html');
        window.location.href = 'login.html';
        return;
    }
    initCategories();
    loadProducts();
    updateCartUI();
    updateWishlistUI();

    const savedUser = localStorage.getItem('em_user');
    if (savedUser) restoreSession(savedUser);
    else showShop();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); renderProducts(); }
    });
    const faqLink = document.getElementById('faqLink');
    if (faqLink) faqLink.addEventListener('click', e => { e.preventDefault(); openFaq(); });
    const faqLinkFooter = document.getElementById('faqLinkFooter');
    if (faqLinkFooter) faqLinkFooter.addEventListener('click', e => { e.preventDefault(); openFaq(); });
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) logoutLink.addEventListener('click', e => { e.preventDefault(); logout(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeFaq(); closeTerms(); closeProductModal(); closeAccountModal(); }
    });
}

/* ==================== AUTH (separate login / register / forgot pages) ==================== */
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    if (btn) btn.innerHTML = '<i class="fa-regular fa-eye' + (show ? '-slash' : '') + '"></i>';
    input.focus();
}

function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    if (text) text.classList.toggle('hidden', loading);
    if (loader) loader.classList.toggle('hidden', !loading);
}

function isValidGmail(email) {
    return /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@gmail\.com$/i.test(email);
}

function showError(msg) {
    const el = document.getElementById('errorMsg');
    if (!el) { showToast(msg); return; }
    el.textContent = msg;
    el.classList.add('show');
    const box = el.closest('.auth-card') || el.closest('.form-box');
    if (box) { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); }
}

function clearError() {
    const el = document.getElementById('errorMsg');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show');
}

function showSuccess(msg) {
    const el = document.getElementById('successMsg');
    if (!el) { showToast(msg); return; }
    el.textContent = msg;
    el.classList.add('show');
}

/* ---------- LOGIN PAGE ---------- */
function initLoginPage() {
    if (localStorage.getItem('em_user')) { window.location.href = sessionStorage.getItem('em_next') || 'everest.html'; return; }
    const remembered = localStorage.getItem('em_remember');
    if (remembered) {
        try {
            const creds = JSON.parse(remembered);
            document.getElementById('emailInput').value = creds.email || '';
            document.getElementById('passwordInput').value = creds.password || '';
            document.getElementById('rememberMeCheckbox').checked = true;
        } catch (e) { localStorage.removeItem('em_remember'); }
    }
    document.getElementById('loginForm').addEventListener('submit', e => { e.preventDefault(); handleLogin(); });
}

async function handleLogin() {
    const email = document.getElementById('emailInput').value.trim().toLowerCase();
    const password = document.getElementById('passwordInput').value;
    const remember = document.getElementById('rememberMeCheckbox').checked;
    clearError();

    if (!isValidGmail(email)) return showError('Please enter a valid @gmail.com email address.');
    if (!password || password.length < 8) return showError('Password must be at least 8 characters long.');

    const submitBtn = document.getElementById('submitBtn');
    setLoading(submitBtn, true);
    try {
        const res = await fetch(API + '/api/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) {
            showError(data.notice ? data.error + ' ' + data.notice : (data.error || 'Sign in failed.'));
            return;
        }

        if (remember) localStorage.setItem('em_remember', JSON.stringify({ email, password }));
        else localStorage.removeItem('em_remember');

        state.user = { name: data.name, email };
        localStorage.setItem('em_user', JSON.stringify(state.user));
        sessionStorage.setItem('em_fresh', '1');
        const nextPage = sessionStorage.getItem('em_next');
        sessionStorage.removeItem('em_next');
        window.location.href = nextPage || 'everest.html';
    } catch (err) {
        showError('Unable to connect to server. Please check your connection and try again.');
    } finally {
        setLoading(submitBtn, false);
    }
}

/* ---------- REGISTER PAGE ---------- */
function initRegisterPage() {
    if (localStorage.getItem('em_user')) { window.location.href = sessionStorage.getItem('em_next') || 'everest.html'; return; }
    const pwInput = document.getElementById('passwordInput');
    if (pwInput) pwInput.addEventListener('input', () => updateStrengthMeter(pwInput.value));
    document.getElementById('registerForm').addEventListener('submit', e => { e.preventDefault(); handleRegister(); });
}

function updateStrengthMeter(pw) {
    const fill = document.getElementById('strengthBar');
    const text = document.getElementById('strengthText');
    if (!fill || !text) return;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [
        { cls: '', label: 'Password strength' },
        { cls: 'weak', label: 'Weak' },
        { cls: 'weak', label: 'Weak' },
        { cls: 'fair', label: 'Fair' },
        { cls: 'good', label: 'Good' },
        { cls: 'strong', label: 'Strong' }
    ];
    const level = levels[Math.min(score, 5)];
    fill.className = 'strength-fill ' + level.cls;
    text.textContent = pw ? level.label : 'Password strength';
}

async function handleRegister() {
    const name = document.getElementById('nameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim().toLowerCase();
    const password = document.getElementById('passwordInput').value;
    const confirm = document.getElementById('confirmPasswordInput').value;
    const terms = document.getElementById('termsCheckbox').checked;
    clearError();

    if (!name) return showError('Please enter your full name.');
    if (!isValidGmail(email)) return showError('Please enter a valid @gmail.com email address.');
    if (!password || password.length < 8) return showError('Password must be at least 8 characters long.');
    if (password !== confirm) return showError('Passwords do not match.');
    if (!terms) return showError('Please accept the Terms & Conditions to continue.');

    const submitBtn = document.getElementById('submitBtn');
    setLoading(submitBtn, true);
    try {
        const res = await fetch(API + '/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error || 'Registration failed.'); return; }

        state.user = { name: data.name, email };
        localStorage.setItem('em_user', JSON.stringify(state.user));
        sessionStorage.setItem('em_fresh', '1');
        const nextPage = sessionStorage.getItem('em_next');
        sessionStorage.removeItem('em_next');
        window.location.href = nextPage || 'everest.html';
    } catch (err) {
        showError('Unable to connect to server. Please check your connection and try again.');
    } finally {
        setLoading(submitBtn, false);
    }
}

/* ---------- FORGOT PASSWORD PAGE ---------- */
function initForgotPage() {
    document.getElementById('forgotForm').addEventListener('submit', e => { e.preventDefault(); handleForgot(); });
}

async function handleForgot() {
    const email = document.getElementById('emailInput').value.trim().toLowerCase();
    clearError();
    if (!isValidGmail(email)) return showError('Please enter a valid @gmail.com email address.');

    const submitBtn = document.getElementById('submitBtn');
    setLoading(submitBtn, true);
    try {
        const res = await fetch(API + '/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error || 'Request failed. Please try again.'); return; }
        showSuccess(data.message || 'If an account exists for that email, a reset link has been sent.');
        document.getElementById('forgotForm').reset();
    } catch (err) {
        showError('Unable to connect to server. Please check your connection and try again.');
    } finally {
        setLoading(submitBtn, false);
    }
}



async function restoreSession(savedUser) {
    let cached = null;
    try {
        cached = JSON.parse(savedUser);
    } catch (e) {
        localStorage.removeItem('em_user');
        showShop();
        return;
    }
    if (sessionStorage.getItem('em_fresh')) {
        sessionStorage.removeItem('em_fresh');
        state.user = cached;
        showShop();
        showToast('Welcome, ' + state.user.name + '!');
        return;
    }
    try {
        const res = await fetch(API + '/api/track-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cached.email })
        });
        if (res.ok) {
            const data = await res.json();
            state.user = { name: data.name, email: cached.email };
            localStorage.setItem('em_user', JSON.stringify(state.user));
        } else {
            localStorage.removeItem('em_user');
            sessionStorage.setItem('em_next', 'everest.html');
            window.location.href = 'login.html';
            return;
        }
    } catch (err) {
        state.user = cached;
    }
    showShop();
    showToast('Welcome back, ' + state.user.name + '!');
}

function showShop() {
    const greeting = document.getElementById('greeting');
    const greetingShort = document.getElementById('greetingShort');
    const logoutLink = document.getElementById('logoutLink');
    const topSignIn = document.getElementById('topSignIn');
    if (state.user) {
        if (greeting) greeting.innerHTML = '<i class="fa-solid fa-user" style="margin-right:6px"></i>Hi, <strong>' + state.user.name + '</strong> — welcome to Everest Mart!';
        if (greetingShort) greetingShort.textContent = state.user.name.split(' ')[0];
        if (logoutLink) logoutLink.classList.remove('hidden');
        if (topSignIn) topSignIn.style.display = 'none';
    } else {
        if (greeting) greeting.textContent = 'Free delivery on orders over Rs. 2000 • Easy returns within 7 days';
        if (logoutLink) logoutLink.classList.add('hidden');
        if (topSignIn) topSignIn.style.display = '';
    }
}

function logout() {
    state.user = null;
    localStorage.removeItem('em_user');
    localStorage.removeItem('em_remember');
    showToast('Logged out successfully');
    setTimeout(() => { window.location.href = 'login.html'; }, 600);
}

/* ==================== MY ACCOUNT ==================== */
function openAccountModal() {
    if (!state.user) { window.location.href = 'login.html'; return; }
    document.getElementById('accountName').textContent = state.user.name;
    document.getElementById('accountEmail').textContent = state.user.email;
    document.getElementById('accountNameInput').value = state.user.name;
    const msg = document.getElementById('accountMsg');
    if (msg) { msg.textContent = ''; msg.className = 'account-msg'; }
    document.getElementById('accountModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeAccountModal(e) {
    if (e && e.target !== e.currentTarget) return;
    const m = document.getElementById('accountModal');
    if (!m) return;
    m.classList.remove('show');
    if (!cartOpen()) document.body.style.overflow = '';
}

async function saveAccountName() {
    const msg = document.getElementById('accountMsg');
    const input = document.getElementById('accountNameInput');
    const name = input ? input.value.trim() : '';
    if (!state.user) { window.location.href = 'login.html'; return; }
    if (!name) { if (msg) { msg.textContent = 'Username cannot be empty.'; msg.className = 'account-msg error'; } return; }
    try {
        const res = await fetch(API + '/api/account', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.user.email, name })
        });
        const data = await res.json();
        if (!res.ok) { if (msg) { msg.textContent = data.error || 'Update failed.'; msg.className = 'account-msg error'; } return; }
        state.user.name = data.name;
        localStorage.setItem('em_user', JSON.stringify(state.user));
        document.getElementById('accountName').textContent = data.name;
        showShop();
        if (msg) { msg.textContent = 'Username updated successfully.'; msg.className = 'account-msg success'; }
        showToast('Username updated');
    } catch (err) { if (msg) { msg.textContent = 'Unable to connect to server.'; msg.className = 'account-msg error'; } }
}

async function saveAccountPassword() {
    const msg = document.getElementById('accountMsg');
    const current = document.getElementById('accountCurrentPw');
    const next = document.getElementById('accountNewPw');
    const confirm = document.getElementById('accountConfirmPw');
    if (!state.user) { window.location.href = 'login.html'; return; }
    const currentPassword = current ? current.value : '';
    const newPassword = next ? next.value : '';
    const confirmPassword = confirm ? confirm.value : '';
    if (!currentPassword) { if (msg) { msg.textContent = 'Please enter your current password.'; msg.className = 'account-msg error'; } return; }
    if (!newPassword || newPassword.length < 8) { if (msg) { msg.textContent = 'New password must be at least 8 characters.'; msg.className = 'account-msg error'; } return; }
    if (newPassword !== confirmPassword) { if (msg) { msg.textContent = 'New passwords do not match.'; msg.className = 'account-msg error'; } return; }
    try {
        const res = await fetch(API + '/api/account/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.user.email, currentPassword, newPassword })
        });
        const data = await res.json();
        if (!res.ok) { if (msg) { msg.textContent = data.error || 'Update failed.'; msg.className = 'account-msg error'; } return; }
        if (current) current.value = '';
        if (next) next.value = '';
        if (confirm) confirm.value = '';
        if (msg) { msg.textContent = 'Password changed successfully.'; msg.className = 'account-msg success'; }
        showToast('Password changed');
    } catch (err) { if (msg) { msg.textContent = 'Unable to connect to server.'; msg.className = 'account-msg error'; } }
}

/* ==================== PRODUCTS ==================== */
async function loadProducts() {
    const grid = document.getElementById('productGrid');
    if (grid) grid.innerHTML = Array(8).fill('<div class="skeleton-card"><div class="skeleton-img shimmer"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-btn"></div></div>').join('');
    try {
        const res = await fetch(`${API}/api/products`);
        state.products = await res.json();
        renderProducts();
    } catch (err) {
        document.getElementById('productGrid').innerHTML = '<div class="empty-state"><i class="fa-solid fa-cloud-bolt"></i><p>Unable to load products. Make sure the server is running on port 5000.</p></div>';
    }
}

function renderProducts(list) {
    const products = list || getFilteredProducts();
    const grid = document.getElementById('productGrid');
    document.getElementById('productCount').textContent = products.length + ' products';

    if (products.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-search"></i><p>No products found matching your criteria.</p></div>';
        return;
    }

    grid.innerHTML = products.map((p, i) => {
        const discount = Math.round((1 - p.price / p.oldPrice) * 100);
        const stars = getStars(p.rating);
        const isWished = state.wishlist.includes(p.id);
        return '<div class="product-card animate-in" style="animation-delay:' + (i * 0.04) + 's">' +
            '<div class="card-img" onclick="openDetail(' + p.id + ')">' +
                '<img src="' + p.image + '" alt="' + p.title + '" loading="lazy" onload="this.classList.add(\'loaded\')" onerror="this.classList.add(\'loaded\')">' +
                '<span class="discount-tag">-' + discount + '%</span>' +
                '<button class="wish-btn' + (isWished ? ' active' : '') + '" data-id="' + p.id + '" onclick="event.stopPropagation();toggleWishlist(' + p.id + ')"><i class="fa-' + (isWished ? 'solid' : 'regular') + ' fa-heart"></i></button>' +
            '</div>' +
            '<div class="card-body">' +
                '<span class="card-category">' + p.category + '</span>' +
                '<h3 class="card-title" onclick="openDetail(' + p.id + ')">' + p.title + '</h3>' +
                '<div class="card-rating">' + stars + ' <span>' + p.rating + '</span> <span class="sold">(' + p.sold + ' sold)</span></div>' +
                '<div class="card-price"><span class="price-now">Rs. ' + p.price.toLocaleString() + '</span><span class="price-old">Rs. ' + p.oldPrice.toLocaleString() + '</span></div>' +
                '<button class="add-btn" onclick="addToCart(' + p.id + ')"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>' +
            '</div></div>';
    }).join('');
}

function getFilteredProducts() {
    let products = state.products;
    if (state.category !== 'All') products = products.filter(p => p.category === state.category);
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    if (query) products = products.filter(p => p.title.toLowerCase().includes(query) || p.category.toLowerCase().includes(query) || p.description.toLowerCase().includes(query));
    return products;
}

function getStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '<i class="fa-solid fa-star"></i>'.repeat(full) + '<i class="fa-solid fa-star-half-stroke"></i>'.repeat(half) + '<i class="fa-regular fa-star"></i>'.repeat(empty);
}

function initCategories() {
    document.getElementById('catRow').innerHTML = CATEGORIES.map(cat =>
        '<button class="cat-btn' + (cat === 'All' ? ' active' : '') + '" onclick="filterCategory(\'' + cat + '\')">' + cat + '</button>'
    ).join('');
}

function filterCategory(cat) {
    state.category = cat;
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.toggle('active', btn.textContent === cat));
    renderProducts();
}

/* ==================== PRODUCT DETAIL ==================== */
function openDetail(id) {
    const product = state.products.find(p => p.id === id);
    if (!product) return;
    state.selectedProduct = product;
    const discount = Math.round((1 - product.price / product.oldPrice) * 100);
    const stars = getStars(product.rating);

    document.getElementById('pmTitle').textContent = product.title;
    document.getElementById('productModalBody').innerHTML =
        '<div class="detail-grid">' +
            '<div class="detail-img"><img src="' + product.image + '" alt="' + product.title + '"><span class="discount-badge">-' + discount + '% OFF</span></div>' +
            '<div>' +
                '<span class="detail-category">' + product.category + '</span>' +
                '<h1 class="detail-title">' + product.title + '</h1>' +
                '<div class="detail-rating">' + stars + ' <span>' + product.rating + ' / 5</span> <span class="review-count">(' + product.reviews.length + ' reviews)</span></div>' +
                '<div class="detail-price-row"><span class="detail-price">Rs. ' + product.price.toLocaleString() + '</span><span class="detail-old-price">Rs. ' + product.oldPrice.toLocaleString() + '</span><span class="detail-save">Save Rs. ' + (product.oldPrice - product.price).toLocaleString() + '</span></div>' +
                '<p class="detail-desc">' + product.description + '</p>' +
                '<ul class="detail-features"><li><i class="fa-solid fa-check"></i> Authentic manufacturer warranty included</li><li><i class="fa-solid fa-check"></i> Free delivery on orders over Rs. 2000</li><li><i class="fa-solid fa-check"></i> Easy 7-day return policy</li></ul>' +
                '<div class="detail-actions"><button class="btn-primary btn-lg" onclick="buyNow(' + product.id + ')"><i class="fa-solid fa-bolt"></i> Buy Now</button><button class="btn-outline btn-lg" onclick="addToCart(' + product.id + ')"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button></div>' +
            '</div>' +
        '</div>' +
        '<div class="reviews-section"><h2><i class="fa-solid fa-comments"></i> Customer Reviews</h2>' +
            '<div id="reviewsList">' + renderReviews(product.reviews) + '</div>' +
            '<div class="review-form"><h4>Leave a Review</h4>' +
                '<div class="star-input" id="starSelector">' + [1,2,3,4,5].map(n => '<i class="fa-solid fa-star" onclick="setReviewRating(' + n + ')"></i>').join('') + '</div>' +
                '<textarea id="reviewText" placeholder="Share your experience with this product..." rows="3"></textarea>' +
                '<button class="btn-primary btn-sm" onclick="postReview()"><i class="fa-solid fa-paper-plane"></i> Post Review</button>' +
            '</div>' +
        '</div>';

    setReviewRating(5);
    document.getElementById('productModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeProductModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('productModal').classList.remove('show');
    if (!document.getElementById('cartDrawer').classList.contains('open')) document.body.style.overflow = '';
}

function renderReviews(reviews) {
    if (!reviews.length) return '<p class="no-reviews">No reviews yet. Be the first to share your experience!</p>';
    return reviews.map(r =>
        '<div class="review-card"><div class="review-header"><div class="review-user"><div class="avatar">' + r.name.charAt(0) + '</div><div><span class="review-name">' + r.name + '</span><span class="review-date">' + r.date + '</span></div></div><div class="review-stars">' + '<i class="fa-solid fa-star"></i>'.repeat(r.rating) + '</div></div><p class="review-text">' + r.comment + '</p></div>'
    ).join('');
}

function setReviewRating(stars) {
    state.reviewRating = stars;
    document.querySelectorAll('#starSelector i').forEach((el, i) => el.classList.toggle('active', i < stars));
}

function postReview() {
    const text = document.getElementById('reviewText').value.trim();
    if (!text) return showToast('Please write a review comment.');
    state.selectedProduct.reviews.unshift({
        name: state.user ? state.user.name : 'Guest User',
        date: 'Today',
        rating: state.reviewRating,
        comment: text
    });
    document.getElementById('reviewsList').innerHTML = renderReviews(state.selectedProduct.reviews);
    document.getElementById('reviewText').value = '';
    showToast('Review posted successfully!');
}

/* ==================== CART ==================== */
function addToCart(id) {
    const product = state.products.find(p => p.id === id);
    if (!product) return;
    const existing = state.cart.find(item => item.id === id);
    if (existing) { existing.qty += 1; } else { state.cart.push({ ...product, qty: 1 }); }
    saveCart();
    updateCartUI();
    showToast(product.title.substring(0, 30) + (product.title.length > 30 ? '...' : '') + ' added to cart');
    const badge = document.getElementById('cartCount');
    badge.classList.add('pulse');
    setTimeout(() => badge.classList.remove('pulse'), 400);
}

function removeFromCart(id) {
    state.cart = state.cart.filter(item => item.id !== id);
    saveCart();
    updateCartUI();
    showToast('Item removed from cart');
}

function changeQty(id, delta) {
    const item = state.cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) { removeFromCart(id); return; }
    saveCart();
    updateCartUI();
}

function saveCart() { localStorage.setItem('em_cart', JSON.stringify(state.cart)); }

function updateCartUI() {
    const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
    document.getElementById('cartCount').textContent = count;
    const container = document.getElementById('cartItemsContainer');
    if (state.cart.length === 0) {
        container.innerHTML = '<div class="empty-cart"><i class="fa-solid fa-cart-shopping"></i><p>Your cart is empty</p></div>';
    } else {
        container.innerHTML = state.cart.map(item =>
            '<div class="cart-item"><img src="' + item.image + '" alt="' + item.title + '">' +
            '<div class="cart-item-info"><h4>' + item.title + '</h4><span class="cart-item-price">Rs. ' + item.price.toLocaleString() + '</span>' +
            '<div class="qty-controls"><button onclick="changeQty(' + item.id + ',-1)"><i class="fa-solid fa-minus"></i></button><span>' + item.qty + '</span><button onclick="changeQty(' + item.id + ',1)"><i class="fa-solid fa-plus"></i></button><button class="remove-btn" onclick="removeFromCart(' + item.id + ')"><i class="fa-solid fa-trash"></i></button></div></div></div>'
        ).join('');
    }
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    document.getElementById('cartDrawerSubtotal').textContent = 'Rs. ' + subtotal.toLocaleString();
}

function toggleCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    } else {
        drawer.classList.add('open');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
        updateCartUI();
    }
}

/* ==================== CHECKOUT (SEPARATE PAGE) ==================== */
function proceedToCheckout() {
    if (state.cart.length === 0) return showToast('Your cart is empty!');
    toggleCartDrawer();
    localStorage.setItem('em_checkout', JSON.stringify(state.cart));
    window.location.href = 'checkout.html';
}

function buyNow(id) {
    const product = state.products.find(p => p.id === id);
    if (!product) return;
    localStorage.setItem('em_checkout', JSON.stringify([{ ...product, qty: 1 }]));
    window.location.href = 'checkout.html';
}

/* ==================== COOKIES ==================== */
function initCookies() {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;
    if (localStorage.getItem('em_cookies')) {
        banner.classList.add('hidden');
        return;
    }
    const acceptBtn = document.getElementById('acceptCookies');
    const declineBtn = document.getElementById('declineCookies');
    if (acceptBtn) acceptBtn.addEventListener('click', () => {
        localStorage.setItem('em_cookies', 'accepted');
        banner.classList.add('hidden');
        showToast('Cookies accepted. Thank you!');
    });
    if (declineBtn) declineBtn.addEventListener('click', () => {
        localStorage.setItem('em_cookies', 'declined');
        banner.classList.add('hidden');
    });
}

/* ==================== MODALS ==================== */
function cartOpen() { const d = document.getElementById('cartDrawer'); return !!(d && d.classList.contains('open')); }
function openFaq() { const m = document.getElementById('faqOverlay'); if (!m) return; m.classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeFaq(e) { if (e && e.target !== e.currentTarget) return; const m = document.getElementById('faqOverlay'); if (!m) return; m.classList.remove('show'); if (!cartOpen()) document.body.style.overflow = ''; }
function openTerms() { const m = document.getElementById('termsOverlay'); if (!m) return; m.classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeTerms(e) { if (e && e.target !== e.currentTarget) return; const m = document.getElementById('termsOverlay'); if (!m) return; m.classList.remove('show'); if (!cartOpen()) document.body.style.overflow = ''; }

/* ==================== UI HELPERS ==================== */
function goHome() { switchView('cardView'); renderProducts(); }

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToProducts() { document.getElementById('productGrid').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

function toggleWishlist(id) {
    const index = state.wishlist.indexOf(id);
    const isNowWished = index === -1;
    if (isNowWished) { state.wishlist.push(id); showToast('Added to wishlist'); }
    else { state.wishlist.splice(index, 1); showToast('Removed from wishlist'); }
    localStorage.setItem('em_wishlist', JSON.stringify(state.wishlist));
    updateWishlistUI();
    const btn = document.querySelector('.wish-btn[data-id="' + id + '"]');
    if (btn) {
        btn.classList.toggle('active', isNowWished);
        btn.innerHTML = '<i class="fa-' + (isNowWished ? 'solid' : 'regular') + ' fa-heart"></i>';
    }
}

function updateWishlistUI() {
    document.getElementById('wishlistCount').textContent = state.wishlist.length;
}

function toggleWishlistView() {
    window.location.href = 'wishlist.html';
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function initScrollTop() {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
}
