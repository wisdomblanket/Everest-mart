const API = '';
let checkoutItems = [];
let checkoutTotal = 0;

document.addEventListener('DOMContentLoaded', () => {
    try { checkoutItems = JSON.parse(localStorage.getItem('em_checkout') || '[]'); } catch (e) { checkoutItems = []; }

    if (checkoutItems.length === 0) {
        document.getElementById('checkoutMain').innerHTML =
            '<div class="empty-state"><i class="fa-solid fa-cart-shopping"></i><p>No items to checkout.</p><a href="everest.html" class="empty-link">Go Shopping</a></div>';
        return;
    }

    renderSummary();
    onPaymentChange();
});

function renderSummary() {
    const subtotal = checkoutItems.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = subtotal >= 2000 ? 0 : 150;
    checkoutTotal = subtotal + shipping;

    document.getElementById('summaryItems').innerHTML = checkoutItems.map(item =>
        '<div class="summary-item"><img src="' + item.image + '" alt="' + item.title + '">' +
        '<div class="summary-item-info"><h4>' + item.title + '</h4><p>Qty: ' + item.qty + ' x Rs. ' + item.price.toLocaleString() + '</p></div>' +
        '<span class="summary-item-price">Rs. ' + (item.price * item.qty).toLocaleString() + '</span></div>'
    ).join('');

    document.getElementById('summarySubtotal').textContent = 'Rs. ' + subtotal.toLocaleString();
    document.getElementById('summaryShipping').innerHTML = shipping === 0 ? '<span style="color:var(--success);font-weight:700">FREE</span>' : 'Rs. ' + shipping.toLocaleString();
    document.getElementById('summaryTotal').textContent = 'Rs. ' + checkoutTotal.toLocaleString();
}

function onPaymentChange() {
    const method = document.getElementById('paymentMethod').value;
    const section = document.getElementById('paymentSection');

    if (method === 'card') {
        section.innerHTML =
            '<div class="card-payment-panel">' +
                '<h3 class="panel-title"><i class="fa-solid fa-credit-card"></i> Pay with Card</h3>' +
                '<div class="credit-card-preview">' +
                    '<div class="card-visual">' +
                        '<div class="card-chip"></div>' +
                        '<div class="card-contactless"><i class="fa-solid fa-wifi"></i></div>' +
                        '<div class="card-number" id="cardPreviewNumber">&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull;</div>' +
                        '<div class="card-bottom-row">' +
                            '<div><span class="card-label">CARD HOLDER</span><span class="card-value" id="cardPreviewName">YOUR NAME</span></div>' +
                            '<div><span class="card-label">EXPIRES</span><span class="card-value" id="cardPreviewExpiry">MM/YY</span></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<form id="cardForm" onsubmit="submitCardPayment(event)">' +
                    '<div class="form-group"><label>Cardholder Name</label><input type="text" id="cardName" placeholder="John Doe" required></div>' +
                    '<div class="form-group"><label>Card Number</label><input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" maxlength="19" required></div>' +
                    '<div class="form-row">' +
                        '<div class="form-group"><label>Expiry Date</label><input type="text" id="cardExpiry" placeholder="MM/YY" maxlength="5" required></div>' +
                        '<div class="form-group"><label>CVV</label><input type="password" id="cardCVV" placeholder="&bull;&bull;&bull;" maxlength="4" required></div>' +
                    '</div>' +
                    '<div class="form-group"><label>Amount to Pay</label><div class="amount-display" id="cardAmount">Rs. ' + checkoutTotal.toLocaleString() + '</div></div>' +
                    '<button type="submit" class="pay-btn"><i class="fa-solid fa-shield-halved"></i> Pay Now</button>' +
                    '<p class="secure-note"><i class="fa-solid fa-lock"></i> Your payment information is encrypted and secure</p>' +
                '</form>' +
            '</div>';
        initCardForm();
    } else {
        section.innerHTML = '<button type="button" class="btn-primary btn-lg btn-full" onclick="placeOrder()"><i class="fa-solid fa-check"></i> Place Order</button>';
    }
}

function initCardForm() {
    const nameInput = document.getElementById('cardName');
    const numberInput = document.getElementById('cardNumber');
    const expiryInput = document.getElementById('cardExpiry');

    nameInput.addEventListener('input', () => {
        document.getElementById('cardPreviewName').textContent = nameInput.value || 'YOUR NAME';
    });

    numberInput.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '');
        v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
        e.target.value = v;
        document.getElementById('cardPreviewNumber').textContent = v || '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022';
    });

    expiryInput.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2);
        e.target.value = v;
        document.getElementById('cardPreviewExpiry').textContent = v || 'MM/YY';
    });
}

function submitCardPayment(e) {
    e.preventDefault();
    const number = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const expiry = document.getElementById('cardExpiry').value;
    const cvv = document.getElementById('cardCVV').value;

    if (!/^\d{16}$/.test(number)) return showToast('Please enter a valid 16-digit card number.');
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return showToast('Please enter a valid expiry date (MM/YY).');
    if (!/^\d{3,4}$/.test(cvv)) return showToast('Please enter a valid CVV.');

    const payBtn = e.target.querySelector('.pay-btn');
    payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Payment...';
    payBtn.disabled = true;
    setTimeout(() => placeOrder('Credit/Debit Card', payBtn), 1500);
}

async function placeOrder(method, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...'; }

    const paymentMethod = method || document.getElementById('paymentMethod').selectedOptions[0].text;
    const customerName = document.getElementById('shipName').value.trim();
    const phone = document.getElementById('shipPhone').value.trim();
    const address = document.getElementById('shipAddress').value.trim();
    const city = document.getElementById('shipCity').value.trim();

    if (!customerName || !phone || !address || !city) {
        showToast('Please fill in all shipping details.');
        if (btn) resetBtn(btn);
        return;
    }
    if (!/^\d{10}$/.test(phone)) {
        showToast('Phone number must be exactly 10 digits.');
        if (btn) resetBtn(btn);
        return;
    }

    const orderData = {
        customerName: customerName,
        phone: phone,
        address: address,
        city: city,
        paymentMethod: paymentMethod,
        items: checkoutItems.map(i => ({ title: i.title, price: i.price, qty: i.qty })),
        totalAmount: checkoutTotal
    };

    try {
        const res = await fetch(API + '/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        if (res.ok) {
            localStorage.removeItem('em_cart');
            localStorage.removeItem('em_checkout');
            showToast('Order placed successfully! Thank you for shopping with Everest Mart.');
            setTimeout(() => window.location.href = 'everest.html', 2000);
        } else {
            showToast('Failed to place order. Please try again.');
            if (btn) resetBtn(btn);
        }
    } catch (err) {
        showToast('Unable to connect to server. Please try again.');
        if (btn) resetBtn(btn);
    }
}

function resetBtn(btn) {
    btn.disabled = false;
    const isCard = document.getElementById('paymentMethod').value === 'card';
    btn.innerHTML = isCard
        ? '<i class="fa-solid fa-shield-halved"></i> Pay Now'
        : '<i class="fa-solid fa-check"></i> Place Order';
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}