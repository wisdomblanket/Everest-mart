const API = '';
let stateProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    updateCounts();
    loadWishlist();
});

function getWishlistIDs() {
    try { return JSON.parse(localStorage.getItem('em_wishlist') || '[]'); } catch (e) { return []; }
}

function updateCounts() {
    const ids = getWishlistIDs();
    let cart = [];
    try { cart = JSON.parse(localStorage.getItem('em_cart') || '[]'); } catch (e) { cart = []; }
    document.getElementById('pageWishCount').textContent = ids.length;
    document.getElementById('pageCartCount').textContent = cart.reduce((s, i) => s + (i.qty || 1), 0);
}

async function loadWishlist() {
    const ids = getWishlistIDs();
    const grid = document.getElementById('wishlistGrid');
    document.getElementById('wishlistItemCount').textContent = ids.length + ' item' + (ids.length === 1 ? '' : 's');

    if (ids.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fa-regular fa-heart"></i><p>Your wishlist is empty. Tap the heart on any product to save it!</p><a href="everest.html" class="empty-link">Browse Products</a></div>';
        return;
    }

    try {
        const res = await fetch(API + '/api/products');
        stateProducts = await res.json();
        const items = stateProducts.filter(p => ids.includes(p.id));

        if (items.length === 0) {
            grid.innerHTML = '<div class="empty-state"><i class="fa-regular fa-heart"></i><p>No wishlist items found.</p><a href="everest.html" class="empty-link">Browse Products</a></div>';
            return;
        }

        grid.innerHTML = items.map((p, i) => {
            const discount = Math.round((1 - p.price / p.oldPrice) * 100);
            const stars = getStars(p.rating);
            return '<div class="wishlist-card animate-in" style="animation-delay:' + (i * 0.05) + 's">' +
                '<div class="card-img" onclick="location.href=\'everest.html\'"><img src="' + p.image + '" alt="' + p.title + '" loading="lazy"><span class="discount-tag">-' + discount + '%</span></div>' +
                '<div class="card-body">' +
                    '<span class="card-category">' + p.category + '</span>' +
                    '<h3 class="card-title" onclick="location.href=\'everest.html\'">' + p.title + '</h3>' +
                    '<div class="card-rating">' + stars + ' <span>' + p.rating + '</span> <span class="sold">(' + p.sold + ' sold)</span></div>' +
                    '<div class="card-price"><span class="price-now">Rs. ' + p.price.toLocaleString() + '</span><span class="price-old">Rs. ' + p.oldPrice.toLocaleString() + '</span></div>' +
                    '<div class="wishlist-actions">' +
                        '<button class="add-btn" onclick="addToCartFromWishlist(' + p.id + ')"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>' +
                        '<button class="remove-wish-btn" onclick="removeFromWishlist(' + p.id + ')"><i class="fa-solid fa-trash-can"></i></button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    } catch (err) {
        grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-cloud-bolt"></i><p>Unable to load products. Make sure the server is running on port 5000.</p></div>';
    }
}

function addToCartFromWishlist(id) {
    const product = stateProducts.find(p => p.id === id);
    if (!product) return;
    let cart = [];
    try { cart = JSON.parse(localStorage.getItem('em_cart') || '[]'); } catch (e) { cart = []; }
    const existing = cart.find(i => i.id === id);
    if (existing) { existing.qty += 1; } else { cart.push({ ...product, qty: 1 }); }
    localStorage.setItem('em_cart', JSON.stringify(cart));
    updateCounts();
    showToast('Added to cart');
}

function removeFromWishlist(id) {
    const ids = getWishlistIDs().filter(x => x !== id);
    localStorage.setItem('em_wishlist', JSON.stringify(ids));
    updateCounts();
    loadWishlist();
    showToast('Removed from wishlist');
}

function getStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '<i class="fa-solid fa-star"></i>'.repeat(full) + '<i class="fa-solid fa-star-half-stroke"></i>'.repeat(half) + '<i class="fa-regular fa-star"></i>'.repeat(empty);
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}