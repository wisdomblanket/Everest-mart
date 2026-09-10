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

/* ==================== INIT ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initCategories();
    initCookies();
    initScrollTop();
    loadProducts();
    updateCartUI();
    updateWishlistUI();

    const remembered = localStorage.getItem('em_remember');
    if (remembered) {
        try {
            const creds = JSON.parse(remembered);
            document.getElementById('emailInput').value = creds.email || '';
            document.getElementById('passwordInput').value = creds.password || '';
            document.getElementById('rememberMeCheckbox').checked = true;
        } catch (e) {
            document.getElementById('emailInput').value = remembered;
            document.getElementById('rememberMeCheckbox').checked = true;
        }
    }

    const savedUser = localStorage.getItem('em_user');
    if (savedUser) {
        try {
            state.user = JSON.parse(savedUser);
            showShop();
            showToast('Welcome back, ' + state.user.name + '!');
        } catch (e) {
            localStorage.removeItem('em_user');
        }
    }

    document.getElementById('searchInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); renderProducts(); }
    });
    document.getElementById('faqLink').addEventListener('click', e => { e.preventDefault(); openFaq(); });
    document.getElementById('faqLinkFooter').addEventListener('click', e => { e.preventDefault(); openFaq(); });
    document.getElementById('topSignIn').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('shopScreen').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
    });
    document.getElementById('logoutLink').addEventListener('click', e => { e.preventDefault(); logout(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeFaq(); closeTerms(); closeProductModal(); }
    });

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.animate-in').forEach(el => observer.observe(el));
});

/* ==================== AUTH ==================== */
function initAuth() {
    document.getElementById('signupBtn').addEventListener('click', () => switchAuthMode('signup'));
    document.getElementById('signinBtn').addEventListener('click', () => switchAuthMode('signin'));
    document.getElementById('switchModeLink').addEventListener('click', e => {
        e.preventDefault();
        switchAuthMode(state.mode === 'signup' ? 'signin' : 'signup');
    });
    document.getElementById('authForm').addEventListener('submit', e => { e.preventDefault(); handleAuth(); });
}

function switchAuthMode(mode) {
    state.mode = mode;
    const signupBtn = document.getElementById('signupBtn');
    const signinBtn = document.getElementById('signinBtn');
    const nameField = document.getElementById('nameField');
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('submitBtn');
    const switchText = document.getElementById('switchModeText');
    const switchLink = document.getElementById('switchModeLink');
    const note = document.getElementById('validationNote');

    if (mode === 'signup') {
        signupBtn.classList.add('active');
        signinBtn.classList.remove('active');
        nameField.style.maxHeight = '60px';
        nameField.style.opacity = '1';
        nameField.style.marginBottom = '0';
        title.textContent = 'Sign Up';
        submitBtn.textContent = 'Create Account';
        switchText.textContent = 'Already have an account?';
        switchLink.textContent = 'Sign In';
        note.style.display = '';
    } else {
        signinBtn.classList.add('active');
        signupBtn.classList.remove('active');
        nameField.style.maxHeight = '0';
        nameField.style.opacity = '0';
        nameField.style.marginBottom = '0';
        title.textContent = 'Sign In';
        submitBtn.textContent = 'Sign In';
        switchText.textContent = "Don't have an account?";
        switchLink.textContent = 'Sign Up';
        note.style.display = 'none';
    }
    clearError();
}

async function handleAuth() {
    const name = document.getElementById('nameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim().toLowerCase();
    const password = document.getElementById('passwordInput').value;
    const remember = document.getElementById('rememberMeCheckbox').checked;

    if (!email || !/^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@gmail\.com$/i.test(email)) {
        return showError('Please enter a valid @gmail.com email address.');
    }
    if (!password || password.length < 8) {
        return showError('Password must be at least 8 characters long.');
    }
    if (state.mode === 'signup' && !name) {
        return showError('Please enter your full name.');
    }

    const endpoint = state.mode === 'signup' ? '/api/signup' : '/api/signin';
    const payload = state.mode === 'signup' ? { name, email, password } : { email, password };

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait...';

    try {
        const res = await fetch(`${API}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Authentication failed.');
            return;
        }

        if (remember) {
            localStorage.setItem('em_remember', JSON.stringify({ email: email, password: password }));
        } else {
            localStorage.removeItem('em_remember');
        }

        state.user = { name: data.name, email };
        localStorage.setItem('em_user', JSON.stringify({ name: data.name, email }));
        clearError();
        showShop();
        showToast(`Welcome, ${data.name}!`);
    } catch (err) {
        showError('Unable to connect to server. Make sure it is running on port 5000.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = state.mode === 'signup' ? 'Create Account' : 'Sign In';
    }
}

function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.classList.add('show');
    const formBox = el.closest('.form-box');
    if (formBox) { formBox.classList.remove('shake'); void formBox.offsetWidth; formBox.classList.add('shake'); }
}

function clearError() {
    const el = document.getElementById('errorMsg');
    el.textContent = '';
    el.classList.remove('show');
}

function showShop() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('shopScreen').classList.remove('hidden');
    if (state.user) {
        document.getElementById('greeting').innerHTML = '<i class="fa-solid fa-user" style="margin-right:6px"></i>Hi, <strong>' + state.user.name + '</strong> — welcome to Everest Mart!';
        document.getElementById('greetingShort').textContent = state.user.name.split(' ')[0];
        document.getElementById('logoutLink').classList.remove('hidden');
        document.getElementById('topSignIn').style.display = 'none';
    } else {
        document.getElementById('greeting').textContent = 'Free delivery on orders over Rs. 2000 • Easy returns within 7 days';
        document.getElementById('logoutLink').classList.add('hidden');
        document.getElementById('topSignIn').style.display = '';
    }
}

function logout() {
    state.user = null;
    localStorage.removeItem('em_user');
    document.getElementById('shopScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('authForm').reset();
    showToast('Logged out successfully');
}

/* ==================== PRODUCTS ==================== */
async function loadProducts() {
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
                '<img src="' + p.image + '" alt="' + p.title + '" loading="lazy">' +
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
    if (localStorage.getItem('em_cookies')) {
        document.getElementById('cookieBanner').classList.add('hidden');
        return;
    }
    document.getElementById('acceptCookies').addEventListener('click', () => {
        localStorage.setItem('em_cookies', 'accepted');
        document.getElementById('cookieBanner').classList.add('hidden');
        showToast('Cookies accepted. Thank you!');
    });
    document.getElementById('declineCookies').addEventListener('click', () => {
        localStorage.setItem('em_cookies', 'declined');
        document.getElementById('cookieBanner').classList.add('hidden');
    });
}

/* ==================== MODALS ==================== */
function openFaq() { document.getElementById('faqOverlay').classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeFaq(e) { if (e && e.target !== e.currentTarget) return; document.getElementById('faqOverlay').classList.remove('show'); if (!document.getElementById('cartDrawer').classList.contains('open')) document.body.style.overflow = ''; }
function openTerms() { document.getElementById('termsOverlay').classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeTerms(e) { if (e && e.target !== e.currentTarget) return; document.getElementById('termsOverlay').classList.remove('show'); if (!document.getElementById('cartDrawer').classList.contains('open')) document.body.style.overflow = ''; }

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
    toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function initScrollTop() {
    window.addEventListener('scroll', () => {
        document.getElementById('scrollTopBtn').classList.toggle('visible', window.scrollY > 400);
    });
}
