'use strict';

/* =========================================================
   ДОПОМІЖНІ ФУНКЦІЇ
   ========================================================= */

const $  = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const formatPrice = (n) => `${n} PLN`;
const priceFor    = (basePrice, weight) => Math.round(basePrice * weight);

const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
    '<rect width="200" height="200" fill="#f1e9e2"/>' +
    '<text x="100" y="120" font-size="64" text-anchor="middle">☕</text></svg>'
);

/* =========================================================
   ДАНІ ТОВАРІВ — зчитуються з карток у index.html
   (id, назва, ціна за 1 кг, стара ціна, фото)
   ========================================================= */

const catalog = new Map();   // id -> { id, name, price, oldPrice, image }
let weights = [];            // [{ value: 0.5, label: '500 g' }, ...]

function readCatalog() {
    $$('.product-card').forEach((card) => {
        const id = card.dataset.id;
        if (!id) return;

        const imageEl = $('img', card);
        catalog.set(id, {
            id,
            name: $('h3', card).textContent.trim(),
            price: parseFloat(card.dataset.basePrice),
            oldPrice: card.dataset.oldPrice ? parseFloat(card.dataset.oldPrice) : null,
            image: imageEl ? imageEl.getAttribute('src') : ''
        });
    });

    // Варіанти ваги беремо з першого списку на сторінці
    const firstSelect = $('.select-weight');
    weights = firstSelect
        ? Array.from(firstSelect.options).map((o) => ({
            value: parseFloat(o.value),
            label: o.textContent.trim()
        }))
        : [];
}

const isValidWeight = (w) => weights.some((x) => x.value === w);
const weightLabel   = (w) => (weights.find((x) => x.value === w) || { label: '' }).label;

/* =========================================================
   СТАН + LOCALSTORAGE
   ========================================================= */

const STORAGE_KEYS = { cart: 'cafemaster.cart', wishlist: 'cafemaster.wishlist' };

function loadList(key) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveList(key, list) {
    try {
        localStorage.setItem(key, JSON.stringify(list));
    } catch {
        /* localStorage недоступний (приватний режим тощо) — працюємо без збереження */
    }
}

// Кошик: [{ id, weight, qty }]   Обране: [{ id, weight }]
let cart = [];
let wishlist = [];

function loadState() {
    cart = loadList(STORAGE_KEYS.cart).filter((i) =>
        i && catalog.has(i.id) && isValidWeight(i.weight) && Number.isInteger(i.qty) && i.qty > 0);

    wishlist = loadList(STORAGE_KEYS.wishlist).filter((i, idx, arr) =>
        i && catalog.has(i.id) && isValidWeight(i.weight) &&
        arr.findIndex((x) => x && x.id === i.id) === idx);
}

const saveCart     = () => saveList(STORAGE_KEYS.cart, cart);
const saveWishlist = () => saveList(STORAGE_KEYS.wishlist, wishlist);

/* =========================================================
   КАРТКИ ТОВАРІВ
   ========================================================= */

function getCardWeight(card) {
    const select = $('.select-weight', card);
    const value = select ? parseFloat(select.value) : NaN;
    if (isValidWeight(value)) return value;
    return weights.length ? weights[0].value : 1;
}

// Ціна (і стара ціна) на картці при зміні ваги
function updateCardPrice(card) {
    const product = catalog.get(card.dataset.id);
    if (!product) return;
    const weight = getCardWeight(card);

    $('.price', card).textContent = formatPrice(priceFor(product.price, weight));

    const oldEl = $('.old-price', card);
    if (oldEl && product.oldPrice) {
        oldEl.textContent = formatPrice(priceFor(product.oldPrice, weight));
    }
}

// Сердечка на картках відповідають стану обраного
function syncHearts() {
    $$('.product-card').forEach((card) => {
        const active = wishlist.some((i) => i.id === card.dataset.id);
        const btn = $('.btn-wishlist', card);
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
        btn.title = active ? 'Usuń z ulubionych' : 'Dodaj do ulubionych';
    });
}

/* =========================================================
   КОШИК
   ========================================================= */

function addToCart(id, weight) {
    const existing = cart.find((i) => i.id === id && i.weight === weight);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id, weight, qty: 1 });
    }
    saveCart();
    updateCart();
}

function changeQty(index, delta) {
    const item = cart[index];
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart.splice(index, 1);
    saveCart();
    updateCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCart();
}

function updateCart() {
    const lines = cart.map((item) => {
        const product = catalog.get(item.id);
        return { item, product, unit: priceFor(product.price, item.weight) };
    });

    const totalCount = cart.reduce((sum, i) => sum + i.qty, 0);
    const totalPrice = lines.reduce((sum, l) => sum + l.unit * l.item.qty, 0);

    $('#cart-count').textContent = totalCount;
    $('#cart-total-price').textContent = formatPrice(totalPrice);

    const container = $('#cart-items');
    if (lines.length === 0) {
        container.innerHTML = '<p class="empty-msg">Koszyk jest pusty.</p>';
        return;
    }

    container.innerHTML = lines.map((l, index) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <strong class="cart-item-title">${escapeHtml(l.product.name)} (${weightLabel(l.item.weight)})</strong>
                <div class="cart-item-price">${formatPrice(l.unit)} × ${l.item.qty}</div>
            </div>
            <div class="cart-item-actions">
                <button type="button" class="qty-btn" data-action="cart-dec" data-index="${index}" aria-label="Zmniejsz ilość">−</button>
                <span class="qty-value">${l.item.qty}</span>
                <button type="button" class="qty-btn" data-action="cart-inc" data-index="${index}" aria-label="Zwiększ ilość">+</button>
                <button type="button" class="btn-remove" data-action="cart-remove" data-index="${index}">Usuń</button>
            </div>
        </div>
    `).join('');
}

function checkout() {
    if (cart.length === 0) {
        setStatus('cart-status', 'Koszyk jest pusty – dodaj produkty, aby złożyć zamówienie.', true);
        return;
    }
    cart = [];
    saveCart();
    updateCart();
    setStatus('cart-status', 'Dziękujemy za zamówienie! Skontaktujemy się z Tobą w sprawie realizacji.');
}

/* =========================================================
   ОБРАНЕ
   ========================================================= */

function toggleWishlist(id, weight) {
    const index = wishlist.findIndex((i) => i.id === id);
    if (index > -1) {
        wishlist.splice(index, 1);
    } else {
        wishlist.push({ id, weight });
    }
    saveWishlist();
    updateWishlist();
    syncHearts();
}

function removeFromWishlist(index) {
    wishlist.splice(index, 1);
    saveWishlist();
    updateWishlist();
    syncHearts();
}

function moveToCart(index) {
    const item = wishlist[index];
    if (!item) return;
    addToCart(item.id, item.weight);
    wishlist.splice(index, 1);
    saveWishlist();
    updateWishlist();
    syncHearts();
}

function updateWishlist() {
    $('#wishlist-count').textContent = wishlist.length;
    const container = $('#wishlist-items');

    if (wishlist.length === 0) {
        container.innerHTML = '<p class="empty-msg">Brak ulubionych produktów.</p>';
        return;
    }

    container.innerHTML = wishlist.map((item, index) => {
        const product = catalog.get(item.id);
        return `
            <div class="wishlist-item">
                <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
                <div class="wishlist-item-info">
                    <h4>${escapeHtml(product.name)} (${weightLabel(item.weight)})</h4>
                    <span class="cart-item-price">${formatPrice(priceFor(product.price, item.weight))}</span>
                </div>
                <div class="cart-item-actions">
                    <button type="button" class="btn-move-to-cart" data-action="wishlist-move" data-index="${index}">🛒 Do koszyka</button>
                    <button type="button" class="btn-remove" data-action="wishlist-remove" data-index="${index}">Usuń</button>
                </div>
            </div>`;
    }).join('');
}

/* =========================================================
   МОДАЛЬНІ ВІКНА
   ========================================================= */

let lastTrigger = null;

function setStatus(elementId, text, isError = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', isError);
}

function openModal(id, trigger) {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (id === 'cart-modal') setStatus('cart-status', '');
    if (id === 'contact-modal') setStatus('contact-status', '');

    lastTrigger = trigger || null;
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');

    const closeBtn = $('.close-btn', modal);
    if (closeBtn) closeBtn.focus();
}

function closeModal(modal) {
    modal.classList.remove('is-open');
    if (!$('.modal.is-open')) {
        document.body.classList.remove('modal-open');
        if (lastTrigger) lastTrigger.focus();
        lastTrigger = null;
    }
}

/* =========================================================
   ОБРОБНИКИ ПОДІЙ
   ========================================================= */

document.addEventListener('click', (e) => {
    // Клік по затемненому фону закриває вікно
    if (e.target.classList.contains('modal')) {
        closeModal(e.target);
        return;
    }

    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;
    const index = Number(el.dataset.index);
    const card = el.closest('.product-card');

    switch (action) {
        case 'open-modal':
            e.preventDefault();
            openModal(el.dataset.modal, el);
            break;

        case 'close-modal':
            closeModal(el.closest('.modal'));
            break;

        case 'add-to-cart':
            addToCart(card.dataset.id, getCardWeight(card));
            el.textContent = 'Dodano ✓';
            clearTimeout(el.resetTimer);
            el.resetTimer = setTimeout(() => { el.textContent = 'Dodaj do koszyka'; }, 1200);
            break;

        case 'toggle-wishlist':
            e.stopPropagation();
            toggleWishlist(card.dataset.id, getCardWeight(card));
            break;

        case 'cart-inc':        changeQty(index, 1); break;
        case 'cart-dec':        changeQty(index, -1); break;
        case 'cart-remove':     removeFromCart(index); break;
        case 'wishlist-move':   moveToCart(index); break;
        case 'wishlist-remove': removeFromWishlist(index); break;
        case 'checkout':        checkout(); break;
    }
});

// Зміна ваги на картці → нова ціна (+ оновлення ваги в обраному, якщо товар там є)
document.addEventListener('change', (e) => {
    if (!e.target.matches('.select-weight')) return;

    const card = e.target.closest('.product-card');
    updateCardPrice(card);

    const wished = wishlist.find((i) => i.id === card.dataset.id);
    if (wished) {
        wished.weight = getCardWeight(card);
        saveWishlist();
        updateWishlist();
    }
});

// Esc закриває вікно; Tab не виходить за межі відкритого вікна
document.addEventListener('keydown', (e) => {
    const modal = $('.modal.is-open');
    if (!modal) return;

    if (e.key === 'Escape') {
        closeModal(modal);
        return;
    }

    if (e.key === 'Tab') {
        const focusable = $$('button:not([disabled]), input, textarea, select, a[href]', modal);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
});

// Запасна картинка, якщо фото не завантажилось
document.addEventListener('error', (e) => {
    const target = e.target;
    if (target.tagName === 'IMG' && !target.dataset.fallback) {
        target.dataset.fallback = '1';
        target.src = PLACEHOLDER_IMG;
    }
}, true);

// Форма контактів
const contactForm = $('#contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Тут немає сервера, тому відправка імітується.
        // Для реальної відправки підключіть бекенд або сервіс форм (Formspree, EmailJS тощо).
        contactForm.reset();
        setStatus('contact-status', 'Dziękujemy za wiadomość! Odpowiemy najszybciej jak to możliwe.');
    });
}

/* =========================================================
   СТАРТ
   ========================================================= */

function init() {
    readCatalog();
    loadState();

    // Браузер може відновити вибрану вагу після перезавантаження — оновлюємо ціни
    $$('.product-card').forEach(updateCardPrice);

    syncHearts();
    updateCart();
    updateWishlist();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
