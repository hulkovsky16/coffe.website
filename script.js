// Потрібні products.js (PRODUCTS, WEIGHTS), підключений перед цим файлом

const STORAGE_KEYS = { cart: 'nuverra_cart', wishlist: 'nuverra_wishlist' };

let cart = [];      // [{ id, kg, quantity }]
let wishlist = [];  // [id, id, ...]

// Вартість доставки (PLN)
const DELIVERY = { courier: 15, locker: 12, pickup: 0 };
const DELIVERY_NAMES = { courier: 'Kurier', locker: 'Paczkomat', pickup: 'Odbiór osobisty (Warszawa)' };

// ВСТАВТЕ СВІЙ URL З FORMSPREE (формат: https://formspree.io/f/abcdwxyz)
const FORMSPREE_URL = 'https://formspree.io/f/mnpjljaj';

// Надсилає дані на Formspree, а той пересилає їх вам на e-mail
async function sendToFormspree(data) {
    if (FORMSPREE_URL.includes('XXXXXXXX')) {
        throw new Error('Formspree URL не налаштовано');
    }
    const response = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        throw new Error('Formspree відповів зі статусом ' + response.status);
    }
}

// --- Допоміжні функції ---
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// 79 → "79 PLN", 39.5 → "39.50 PLN"
function formatPrice(n) {
    const rounded = Math.round(n * 100) / 100;
    return (Number.isInteger(rounded) ? rounded : rounded.toFixed(2)) + ' PLN';
}

const findProduct = (id) => PRODUCTS.find(p => p.id === id);
const findWeight = (kg) => WEIGHTS.find(w => w.kg === kg);
const unitPrice = (product, kg) => product.price * findWeight(kg).factor;

// Заглушка, якщо фото не вказано або не завантажилось
function placeholderImage() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400" viewBox="0 0 500 400">'
        + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        + '<stop offset="0" stop-color="#d4a373"/><stop offset="1" stop-color="#6f4e37"/></linearGradient></defs>'
        + '<rect width="500" height="400" fill="url(#g)"/>'
        + '<text x="250" y="210" font-size="110" text-anchor="middle">☕</text>'
        + '<text x="250" y="320" font-size="26" fill="#fff" text-anchor="middle" font-family="sans-serif">Zdjęcie wkrótce</text>'
        + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Збереження в браузері (localStorage)
function loadState(key) {
    try {
        const data = JSON.parse(localStorage.getItem(key));
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function saveState(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        /* сховище недоступне, працюємо без збереження */
    }
}

function init() {
    const $ = (id) => document.getElementById(id);
    // Для пошуку: без великих літер і польських діакритиків (ą → a, ł → l ...)
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
    const openModal = (id) => { $(id).style.display = 'block'; };
    const closeModal = (id) => { $(id).style.display = 'none'; };
    const defaultKg = (WEIGHTS.find(w => w.kg === 1) || WEIGHTS[0]).kg;

    // Відновлюємо збережене; прибираємо товари й ваги, яких уже немає в каталозі
    cart = loadState(STORAGE_KEYS.cart)
        .filter(i => findProduct(i.id) && findWeight(i.kg) && i.quantity > 0);
    wishlist = loadState(STORAGE_KEYS.wishlist).filter(id => findProduct(id));

    // --- 0. ПОВІДОМЛЕННЯ (toast) ---
    function showToast(text) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = text;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // --- 1. КАТАЛОГ (малюється з products.js) ---
    const grid = $('product-grid');

    grid.innerHTML = PRODUCTS.map(p => `
        <div class="product-card" data-id="${escapeHtml(p.id)}">
            <button class="btn-wishlist${wishlist.includes(p.id) ? ' active' : ''}" title="Dodaj do ulubionych">❤️</button>
            <img src="${escapeHtml(p.image || placeholderImage())}" alt="${escapeHtml(p.name)}"
                 onerror="this.onerror=null;this.src=placeholderImage()">
            <h3>${escapeHtml(p.name)}</h3>
            <p class="description">${escapeHtml(p.description)}</p>
            <div class="weight-options" role="group" aria-label="Waga">
                ${WEIGHTS.map(w => `<button type="button" class="weight-btn${w.kg === defaultKg ? ' active' : ''}" data-kg="${w.kg}">${w.label}</button>`).join('')}
            </div>
            <div class="card-footer">
                <span class="price">${formatPrice(unitPrice(p, defaultKg))}</span>
                <button class="btn-add">Dodaj do koszyka</button>
            </div>
        </div>
    `).join('');

    // Один обробник на всю сітку: вага, обране, додавання в кошик
    grid.onclick = (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        const product = findProduct(card.dataset.id);
        const selectedKg = () => Number(card.querySelector('.weight-btn.active').dataset.kg);

        const weightBtn = e.target.closest('.weight-btn');
        if (weightBtn) {
            card.querySelectorAll('.weight-btn').forEach(b => b.classList.toggle('active', b === weightBtn));
            card.querySelector('.price').textContent = formatPrice(unitPrice(product, selectedKg()));
            return;
        }

        const wishBtn = e.target.closest('.btn-wishlist');
        if (wishBtn) {
            const index = wishlist.indexOf(product.id);
            if (index > -1) wishlist.splice(index, 1);
            else wishlist.push(product.id);
            wishBtn.classList.toggle('active', index === -1);
            updateWishlist();
            return;
        }

        if (e.target.closest('.btn-add')) {
            const kg = selectedKg();
            addToCart(product.id, kg);
            showToast(`✅ Dodano do koszyka: ${product.name} (${findWeight(kg).label})`);
        }
    };

    // --- 2. КОШИК ---
    function addToCart(id, kg) {
        const existing = cart.find(i => i.id === id && i.kg === kg);
        if (existing) {
            existing.quantity = Math.min(existing.quantity + 1, 99);
        } else {
            cart.push({ id, kg, quantity: 1 });
        }
        updateCart();
    }

    const cartTotal = () => cart.reduce((sum, i) => sum + unitPrice(findProduct(i.id), i.kg) * i.quantity, 0);

    function updateCart() {
        saveState(STORAGE_KEYS.cart, cart);
        $('cart-count').textContent = cart.reduce((sum, i) => sum + i.quantity, 0);
        $('cart-total-price').textContent = formatPrice(cartTotal());

        if (cart.length === 0) {
            $('cart-items').innerHTML = '<p class="empty-msg">Koszyk jest pusty.</p>';
            return;
        }

        $('cart-items').innerHTML = cart.map((item, index) => {
            const p = findProduct(item.id);
            const unit = unitPrice(p, item.kg);
            return `
                <div class="cart-row">
                    <div class="cart-info">
                        <strong>${escapeHtml(p.name)}</strong>
                        <div class="cart-meta">${findWeight(item.kg).label} · ${formatPrice(unit)} / szt.</div>
                    </div>
                    <div class="qty">
                        <button class="qty-btn" data-action="dec" data-index="${index}" aria-label="Mniej" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
                        <span class="qty-value">${item.quantity}</span>
                        <button class="qty-btn" data-action="inc" data-index="${index}" aria-label="Więcej">+</button>
                    </div>
                    <div class="cart-line-total">${formatPrice(unit * item.quantity)}</div>
                    <button class="remove-btn" data-action="remove" data-index="${index}">Usuń</button>
                </div>`;
        }).join('');
    }

    $('cart-items').onclick = (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;
        const index = Number(btn.dataset.index);
        const item = cart[index];
        if (!item) return;

        if (btn.dataset.action === 'inc' && item.quantity < 99) item.quantity += 1;
        if (btn.dataset.action === 'dec' && item.quantity > 1) item.quantity -= 1;
        if (btn.dataset.action === 'remove') cart.splice(index, 1);
        updateCart();
    };

    // --- 3. ОБРАНЕ ---
    function updateWishlist() {
        saveState(STORAGE_KEYS.wishlist, wishlist);
        $('wishlist-count').textContent = wishlist.length;
        const container = $('wishlist-items');

        if (wishlist.length === 0) {
            container.innerHTML = '<p class="empty-msg">Brak ulubionych produktów.</p>';
            return;
        }

        container.innerHTML = wishlist.map(id => {
            const p = findProduct(id);
            return `
                <div class="wishlist-row">
                    <img src="${escapeHtml(p.image || placeholderImage())}" alt="" onerror="this.onerror=null;this.src=placeholderImage()">
                    <div class="wishlist-info">
                        <h4>${escapeHtml(p.name)}</h4>
                        <span>${formatPrice(p.price)} / kg</span>
                    </div>
                    <button class="btn-move-to-cart" data-id="${escapeHtml(p.id)}">🛒 Do koszyka</button>
                </div>`;
        }).join('');
    }

    // «Do koszyka» в обраному: додаємо 1 кг і прибираємо з обраного
    $('wishlist-items').onclick = (e) => {
        const btn = e.target.closest('.btn-move-to-cart');
        if (!btn) return;
        const id = btn.dataset.id;

        addToCart(id, defaultKg);
        wishlist = wishlist.filter(x => x !== id);

        const card = grid.querySelector(`.product-card[data-id="${CSS.escape(id)}"]`);
        if (card) card.querySelector('.btn-wishlist').classList.remove('active');

        updateWishlist();
        showToast(`✅ Dodano do koszyka: ${findProduct(id).name} (${findWeight(defaultKg).label})`);
    };

    // --- 4. ПОШУК, СОРТУВАННЯ, ФІЛЬТР ЗА ЦІНОЮ ---
    const range = $('price-range');
    const cards = [...grid.querySelectorAll('.product-card')];
    const items = PRODUCTS.map((product, i) => ({
        product,
        i,
        el: cards[i],
        text: norm(product.name + ' ' + product.description)
    }));

    // Межі повзунка беремо з цін каталогу (за 1 кг)
    const prices = PRODUCTS.map(p => p.price);
    range.min = Math.floor(Math.min(...prices) / 10) * 10;
    range.max = Math.ceil(Math.max(...prices) / 10) * 10;
    range.value = range.max;

    const sorters = {
        'default': (a, b) => a.i - b.i,
        'price-asc': (a, b) => a.product.price - b.product.price,
        'price-desc': (a, b) => b.product.price - a.product.price,
        'name': (a, b) => a.product.name.localeCompare(b.product.name, 'pl')
    };

    function applyFilters() {
        const query = norm($('search-input').value.trim());
        const maxPrice = Number(range.value);
        let visible = 0;

        $('price-range-value').textContent = `${maxPrice} PLN`;

        [...items].sort(sorters[$('sort-select').value]).forEach(item => {
            const show = item.text.includes(query) && item.product.price <= maxPrice;
            item.el.style.display = show ? '' : 'none';
            if (show) visible++;
            grid.appendChild(item.el); // переставляємо картку у потрібному порядку
        });

        $('no-results').hidden = visible > 0;
    }

    $('search-input').oninput = applyFilters;
    $('sort-select').onchange = applyFilters;
    range.oninput = applyFilters;
    $('reset-filters').onclick = () => {
        $('search-input').value = '';
        $('sort-select').value = 'default';
        range.value = range.max;
        applyFilters();
    };

    // --- 5. ОФОРМЛЕННЯ ЗАМОВЛЕННЯ ---
    const checkoutForm = $('checkout-form');
    const getDelivery = () => checkoutForm.querySelector('input[name="delivery"]:checked').value;

    function renderCheckout() {
        const shipping = DELIVERY[getDelivery()];

        $('checkout-items').innerHTML = cart.map(item => {
            const p = findProduct(item.id);
            return `<li><span>${escapeHtml(p.name)} (${findWeight(item.kg).label}) × ${item.quantity}</span>
                    <span>${formatPrice(unitPrice(p, item.kg) * item.quantity)}</span></li>`;
        }).join('');
        $('checkout-shipping').textContent = shipping === 0 ? 'Gratis' : formatPrice(shipping);
        $('checkout-total').textContent = formatPrice(cartTotal() + shipping);
    }

    // Для самовивозу адреса не потрібна
    function onDeliveryChange() {
        const needsAddress = getDelivery() !== 'pickup';
        $('address-fields').hidden = !needsAddress;
        $('address-fields').querySelectorAll('input').forEach(input => { input.required = needsAddress; });
        renderCheckout();
    }

    checkoutForm.querySelectorAll('input[name="delivery"]').forEach(radio => {
        radio.onchange = onDeliveryChange;
    });

    $('checkout-btn').onclick = () => {
        if (cart.length === 0) {
            showToast('Koszyk jest pusty — dodaj kawę, aby złożyć zamówienie');
            return;
        }
        closeModal('cart-modal');
        checkoutForm.hidden = false;
        $('checkout-success').hidden = true;
        onDeliveryChange();
        openModal('checkout-modal');
    };

    checkoutForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = checkoutForm.querySelector('button[type="submit"]');
        const name = $('order-name').value.trim();
        const email = $('order-email').value.trim();
        const type = getDelivery();
        const orderNumber = 'NV-' + Date.now().toString().slice(-6);

        const order = {
            _subject: `Nowe zamówienie ${orderNumber}`,
            numer_zamowienia: orderNumber,
            imie_nazwisko: name,
            email: email,
            telefon: $('order-phone').value.trim(),
            dostawa: DELIVERY_NAMES[type],
            adres: type === 'pickup'
                ? 'Odbiór osobisty'
                : `${$('order-street').value.trim()}, ${$('order-zip').value.trim()} ${$('order-city').value.trim()}`,
            produkty: cart.map(item => {
                const p = findProduct(item.id);
                return `${p.name} (${findWeight(item.kg).label}) × ${item.quantity} = ${formatPrice(unitPrice(p, item.kg) * item.quantity)}`;
            }).join('\n'),
            koszt_dostawy: formatPrice(DELIVERY[type]),
            razem: formatPrice(cartTotal() + DELIVERY[type])
        };

        submitBtn.disabled = true;
        submitBtn.textContent = 'Wysyłanie...';

        try {
            await sendToFormspree(order);

            $('success-text').textContent =
                `Dziękujemy, ${name}! Zamówienie ${orderNumber} zostało przyjęte. Skontaktujemy się z Tobą na adres ${email}, aby potwierdzić szczegóły.`;

            cart = [];
            updateCart();
            checkoutForm.reset();
            onDeliveryChange();
            checkoutForm.hidden = true;
            $('checkout-success').hidden = false;
        } catch (error) {
            console.error(error);
            showToast('❌ Nie udało się wysłać zamówienia. Spróbuj ponownie.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Potwierdź zamówienie';
        }
    };

    $('success-close').onclick = () => closeModal('checkout-modal');

    // --- 6. МОДАЛЬНІ ВІКНА ---
    const bindModal = (triggerSelector, modalId, closeId) => {
        const trigger = document.querySelector(triggerSelector);
        if (trigger) {
            trigger.onclick = (e) => {
                e.preventDefault();
                openModal(modalId);
            };
        }
        $(closeId).onclick = () => closeModal(modalId);
    };

    bindModal('.cart-link', 'cart-modal', 'close-cart');
    bindModal('#wishlist-btn', 'wishlist-modal', 'close-wishlist');
    bindModal('#about-link', 'about-modal', 'close-about');
    $('close-checkout').onclick = () => closeModal('checkout-modal');

    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
        }
    });

    // --- 7. ФУТЕР: контакти беруться з SHOP_INFO (products.js) ---
    $('shop-address').textContent = SHOP_INFO.address;
    $('shop-hours').textContent = SHOP_INFO.hours;
    const phoneLink = $('shop-phone');
    phoneLink.textContent = SHOP_INFO.phone;
    phoneLink.href = 'tel:' + SHOP_INFO.phone.replace(/[^+\d]/g, '');

    // --- 8. ПОЧАТКОВИЙ СТАН ---
    updateCart();
    updateWishlist();
    applyFilters();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
