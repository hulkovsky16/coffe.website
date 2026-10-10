let cart = [];
let wishlist = [];

document.addEventListener('DOMContentLoaded', () => {

    // 1. Зміна ціни при виборі ваги
    document.querySelectorAll('.product-card').forEach(card => {
        const selectWeight = card.querySelector('.select-weight');
        const priceElement = card.querySelector('.price');
        const oldPriceElement = card.querySelector('.old-price');
        const basePrice = parseFloat(card.dataset.basePrice);

        if (selectWeight && priceElement) {
            selectWeight.addEventListener('change', () => {
                const multiplier = parseFloat(selectWeight.value);
                const calculatedPrice = Math.round(basePrice * multiplier);
                priceElement.textContent = `${calculatedPrice} PLN`;

                if (oldPriceElement) {
                    const oldBasePrice = Math.round(basePrice * 1.3);
                    oldPriceElement.textContent = `${Math.round(oldBasePrice * multiplier)} PLN`;
                }
            });
        }
    });

    // 2. Додавання в кошик
    document.querySelectorAll('.btn-add').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const card = btn.closest('.product-card');
            const title = card.querySelector('h3').textContent;
            const selectWeight = card.querySelector('.select-weight');
            const selectedOptionText = selectWeight ? selectWeight.options[selectWeight.selectedIndex].text : '1 kg';
            const priceText = card.querySelector('.price').textContent;
            const numericPrice = parseFloat(priceText.replace(' PLN', '').trim());

            const itemTitleWithWeight = `${title} (${selectedOptionText})`;
            const existingItem = cart.find(item => item.title === itemTitleWithWeight);

            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({ title: itemTitleWithWeight, price: numericPrice, quantity: 1 });
            }

            updateCart();
        };
    });

    // 3. Додавання в обране
    document.querySelectorAll('.btn-wishlist').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const card = btn.closest('.product-card');
            const title = card.querySelector('h3').textContent;
            const price = card.querySelector('.price').textContent;
            const img = card.querySelector('img').src;

            const index = wishlist.findIndex(item => item.title === title);

            if (index > -1) {
                wishlist.splice(index, 1);
                btn.classList.remove('active');
            } else {
                wishlist.push({ title, price, img });
                btn.classList.add('active');
            }

            updateWishlist();
        };
    });

    // 4. Оновлення кошика
    function updateCart() {
        const cartCount = document.getElementById('cart-count');
        const cartItems = document.getElementById('cart-items');
        const cartTotalPrice = document.getElementById('cart-total-price');

        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (cartCount) cartCount.textContent = totalCount;
        if (cartTotalPrice) cartTotalPrice.textContent = `${totalPrice.toFixed(0)} PLN`;

        if (cartItems) {
            if (cart.length === 0) {
                cartItems.innerHTML = '<p style="text-align:center; padding: 20px; color: #777;">Koszyk jest pusty.</p>';
            } else {
                cartItems.innerHTML = cart.map((item, index) => `
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:8px;">
                        <div>
                            <strong style="font-size:0.95rem;">${item.title}</strong>
                            <div style="color:#d4a373; font-weight:bold;">${item.price} PLN x ${item.quantity}</div>
                        </div>
                        <button onclick="removeFromCart(${index})" style="background:#ff4d4d; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Usuń</button>
                    </div>
                `).join('');
            }
        }
    }

    // 5. Оновлення обраного
    function updateWishlist() {
        const wishlistCount = document.getElementById('wishlist-count');
        const container = document.getElementById('wishlist-items');

        if (wishlistCount) wishlistCount.textContent = wishlist.length;
        if (!container) return;

        if (wishlist.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding: 20px; color: #777;">Brak ulubionych produktów.</p>';
            return;
        }

        container.innerHTML = wishlist.map((item, i) => `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <img src="${item.img}" style="width:50px; height:50px; object-fit:cover; border-radius:6px;">
                <div style="flex-grow: 1; margin-left: 15px;">
                    <h4 style="margin:0; font-size: 0.95rem;">${item.title}</h4>
                    <span style="color:#d4a373; font-weight:bold;">${item.price}</span>
                </div>
                <button class="btn-move-to-cart" onclick="moveToCart(${i})">🛒 Do koszyka</button>
            </div>
        `).join('');
    }

    window.removeFromCart = function(index) {
        cart.splice(index, 1);
        updateCart();
    };

    window.moveToCart = function(index) {
        const item = wishlist[index];
        if (item) {
            const numericPrice = parseFloat(item.price.replace(' PLN', '').trim());
            const existingItem = cart.find(c => c.title === item.title);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({ title: item.title, price: numericPrice, quantity: 1 });
            }
            wishlist.splice(index, 1);
            updateCart();
            updateWishlist();
        }
    };

    // 6. Модальні вікна
    const bindModal = (triggerSelector, modalId, closeId) => {
        const trigger = document.querySelector(triggerSelector);
        const modal = document.getElementById(modalId);
        const close = document.getElementById(closeId);

        if (trigger && modal) {
            trigger.onclick = (e) => {
                e.preventDefault();
                modal.style.display = 'block';
            };
        }
        if (close && modal) {
            close.onclick = () => {
                modal.style.display = 'none';
            };
        }
    };

    bindModal('.cart-link', 'cart-modal', 'close-cart');
    bindModal('#wishlist-btn', 'wishlist-modal', 'close-wishlist');
    bindModal('#about-link', 'about-modal', 'close-about');
    bindModal('#contact-link', 'contact-modal', 'close-contact');

    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    };

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.onsubmit = (e) => {
            e.preventDefault();
            alert('Dziękujemy za wiadomość! Odpowiemy najszybciej jak to możliwe.');
            contactForm.reset();
            document.getElementById('contact-modal').style.display = 'none';
        };
    }
});