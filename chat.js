// ЧАТ NUVERRA (без ШІ, безкоштовний): кнопки з готовими відповідями,
// розпізнавання ключових слів і передача розмови людині через форму.
// Відповіді збираються з products.js (PRODUCTS, WEIGHTS, SHOP_INFO) і script.js (DELIVERY),
// тож після заміни товарів і цін бот оновлюється сам.
(function () {
    const STORAGE_KEY = 'nuverra_chat';
    const WELCOME = 'Cześć! 👋 Wybierz temat poniżej lub napisz pytanie: odpowiem o kawach, wagach, cenach i dostawie. W razie potrzeby połączę Cię z naszym zespołem.';
    const FALLBACK = 'Nie jestem pewien, jak odpowiedzieć na to pytanie 🙂 Wybierz temat poniżej albo połącz się z zespołem przyciskiem „👤 Konsultant”.';
    const HUMAN_SAY = 'Jasne, połączę Cię z naszym zespołem. Zostaw proszę dane kontaktowe poniżej.';
    const UNKNOWN_SAY = 'Tej informacji nie mam w systemie, więc najlepiej zapytać nasz zespół. Zostaw proszę dane kontaktowe poniżej.';

    const TOPICS = [
        { id: 'coffees',  label: 'Jaką kawę wybrać?' },
        { id: 'prices',   label: 'Wagi i ceny' },
        { id: 'delivery', label: 'Dostawa i koszty' },
        { id: 'order',    label: 'Jak złożyć zamówienie?' },
        { id: 'contact',  label: 'Godziny i adres' },
        { id: 'human',    label: 'Porozmawiać z człowiekiem' }
    ];

    const priceLine = (p) => WEIGHTS.map(w => `${w.label} – ${formatPrice(p.price * w.factor)}`).join(', ');

    // Готові відповіді: тексти збираються з даних сайту
    const ANSWERS = {
        coffees: () => 'Nasze kawy (ziarnista, 100% Arabica):\n'
            + PRODUCTS.map(p => `• ${p.name}: ${p.description}`).join('\n')
            + '\n\nNie możesz się zdecydować? Kliknij „👤 Konsultant”, a nasz zespół doradzi.',
        prices: () => 'Ceny zależą od gramatury:\n'
            + PRODUCTS.map(p => `• ${p.name}: ${priceLine(p)}`).join('\n'),
        delivery: () => 'Koszty dostawy:\n'
            + Object.keys(DELIVERY).map(k => `• ${DELIVERY_NAMES[k]}: ${DELIVERY[k] === 0 ? 'gratis' : formatPrice(DELIVERY[k])}`).join('\n')
            + '\n\nCzasu dostawy nie mam w systemie. Zapytaj konsultanta przyciskiem „👤 Konsultant”.',
        order: () => 'Wybierz kawę i gramaturę (' + WEIGHTS.map(w => w.label).join(' / ')
            + '), kliknij „Dodaj do koszyka”, a potem w koszyku „Złóż zamówienie”. Uzupełnij dane i wybierz dostawę. Po wysłaniu nasz zespół skontaktuje się z Tobą, aby potwierdzić szczegóły.',
        contact: () => `Adres: ${SHOP_INFO.address}\nTelefon: ${SHOP_INFO.phone}\nGodziny otwarcia: ${SHOP_INFO.hours}`
    };

    // Для пошуку: без великих літер і польських діакритиків (ą → a, ł → l ...)
    const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');

    // Питання, на які в даних сайту немає відповіді, одразу передаємо людині.
    // Коли замовник надасть умови (оплата, повернення, терміни), можна додати їх у ANSWERS.
    const RULE_UNKNOWN = /platnosc|zaplac|blik|przelew|faktur|termin dostaw|ile trwa|kiedy (dotrze|przyjdzie|dostan)|zwrot|zwroc|reklamac|rabat|promoc|kupon|certyfikat|sklad|ekolog/;
    const RULE_HUMAN = /czlowiek|konsultant|pracownik|sprzedawc|rozmow|skarg|problem|hurt|wspolprac|zespol/;
    const RULES = [
        { id: 'delivery', re: /dostaw|kurier|paczkomat|wysyl|przesy|odbior/ },
        { id: 'prices',   re: /\bcen|kosztuj|\bkoszt|\bpln\b|\bzl\b|wag[aiy]|\bkg\b|gram/ },
        { id: 'order',    re: /zamow|koszyk|kupi|kupow|zakup/ },
        { id: 'contact',  re: /godzin|otwar|adres|gdzie|telefon|kontakt|zadzwon|numer/ },
        { id: 'coffees',  re: /kaw|polec|wybra|smak|kwasow|mocn|goryc|czekolad|owoc/ }
    ];

    // Основа назви для пошуку у відмінках: «Brazylii» → «brazy»
    const stem = (name) => { const n = norm(name); return n.length > 5 ? n.slice(0, 5) : n; };

    function route(text) {
        const t = norm(text);
        if (RULE_UNKNOWN.test(t)) return { kind: 'human', say: UNKNOWN_SAY, reason: 'Pytanie wymagające odpowiedzi pracownika: ' + text };
        if (RULE_HUMAN.test(t)) return { kind: 'human', say: HUMAN_SAY, reason: 'Klient poprosił o kontakt z konsultantem' };

        const product = PRODUCTS.find(p => t.includes(stem(p.name)));
        if (product) return { kind: 'answer', say: `${product.name}: ${product.description}\nCeny: ${priceLine(product)}.` };

        const rule = RULES.find(r => r.re.test(t));
        if (rule) return { kind: 'answer', say: ANSWERS[rule.id]() };

        return { kind: 'unknown' };
    }

    function topicResult(id) {
        if (id === 'human') return { kind: 'human', say: HUMAN_SAY, reason: 'Klient poprosił o kontakt z konsultantem' };
        return { kind: 'answer', say: ANSWERS[id]() };
    }

    let history = [];   // [{ role: 'user' | 'assistant', content }]
    const els = {};

    const loadHistory = () => {
        try {
            const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
            return Array.isArray(data) ? data.slice(-30) : [];
        } catch (e) {
            return [];
        }
    };

    const saveHistory = () => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30)));
        } catch (e) { /* без збереження */ }
    };

    const scrollDown = () => { els.messages.scrollTop = els.messages.scrollHeight; };

    // --- Інтерфейс ---
    function build() {
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <button type="button" id="chat-toggle" class="chat-toggle" aria-label="Otwórz czat">💬</button>
            <section id="chat-panel" class="chat-panel" role="dialog" aria-label="Czat NUVERRA" hidden>
                <header class="chat-header">
                    <div><strong>Asystent NUVERRA</strong><span>Szybkie odpowiedzi i kontakt z zespołem</span></div>
                    <div class="chat-header-actions">
                        <button type="button" id="chat-human" class="chat-human" title="Połącz z konsultantem">👤 Konsultant</button>
                        <button type="button" id="chat-close" class="chat-close" aria-label="Zamknij czat">&times;</button>
                    </div>
                </header>
                <div id="chat-messages" class="chat-messages" aria-live="polite"></div>
                <div id="chat-chips" class="chat-chips"></div>
                <form id="chat-form" class="chat-form">
                    <input id="chat-input" type="text" maxlength="300" placeholder="Napisz pytanie..." autocomplete="off" required>
                    <button type="submit" aria-label="Wyślij">➤</button>
                </form>
            </section>`;
        document.body.append(...wrap.children);

        els.toggle = document.getElementById('chat-toggle');
        els.panel = document.getElementById('chat-panel');
        els.messages = document.getElementById('chat-messages');
        els.chips = document.getElementById('chat-chips');
        els.form = document.getElementById('chat-form');
        els.input = document.getElementById('chat-input');
    }

    function addMessage(role, text) {
        const div = document.createElement('div');
        div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'bot');
        div.textContent = text;
        els.messages.appendChild(div);
        scrollDown();
        return div;
    }

    function userSay(text) {
        addMessage('user', text);
        history.push({ role: 'user', content: text });
        saveHistory();
    }

    function botSay(text) {
        addMessage('bot', text);
        history.push({ role: 'assistant', content: text });
        saveHistory();
    }

    // Коротка «пауза на друк», потім відповідь
    function deliver(getResult) {
        const typing = addMessage('bot', '…');
        typing.classList.add('typing');
        setTimeout(() => {
            typing.remove();
            const result = getResult();
            if (result.kind === 'human') {
                botSay(result.say);
                showHandoff(result.reason);
            } else if (result.kind === 'answer') {
                botSay(result.say);
            } else {
                botSay(FALLBACK);
            }
        }, 350);
    }

    function renderChips() {
        TOPICS.forEach(topic => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = topic.label;
            btn.onclick = () => {
                userSay(topic.label);
                deliver(() => topicResult(topic.id));
            };
            els.chips.appendChild(btn);
        });
    }

    // --- Передача людині: форма із контактами; розмова йде вам на e-mail через Formspree ---
    function showHandoff(reason) {
        if (els.messages.querySelector('.chat-handoff')) { scrollDown(); return; }

        const form = document.createElement('form');
        form.className = 'chat-handoff';
        form.innerHTML = `
            <p><strong>Rozmowa z zespołem</strong><br>
            Zostaw dane, a odpowiemy w godzinach pracy (${escapeHtml(SHOP_INFO.hours)}).
            Możesz też zadzwonić: <a href="tel:${escapeHtml(SHOP_INFO.phone.replace(/[^+\d]/g, ''))}">${escapeHtml(SHOP_INFO.phone)}</a>.</p>
            <input type="text" data-field="name" placeholder="Imię" required maxlength="80" autocomplete="name">
            <input type="text" data-field="contact" placeholder="E-mail lub telefon" required maxlength="120" autocomplete="off">
            <button type="submit" class="btn-primary">Wyślij do zespołu</button>`;

        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            const name = form.querySelector('[data-field="name"]').value.trim();
            const contact = form.querySelector('[data-field="contact"]').value.trim();

            btn.disabled = true;
            btn.textContent = 'Wysyłanie...';

            const data = {
                _subject: 'Czat NUVERRA: prośba o kontakt z konsultantem',
                imie: name,
                kontakt: contact,
                powod: reason || 'Klient poprosił o kontakt z konsultantem',
                rozmowa: history.map(m => `${m.role === 'user' ? 'Klient' : 'Asystent'}: ${m.content}`).join('\n')
            };
            if (contact.includes('@')) data.email = contact; // Formspree використає як адресу для відповіді

            try {
                await sendToFormspree(data);
                form.remove();
                botSay(`Dziękujemy, ${name}! Przekazaliśmy Twoje pytanie zespołowi NUVERRA. Odezwiemy się na ${contact} w godzinach pracy.`);
            } catch (err) {
                console.error(err);
                btn.disabled = false;
                btn.textContent = 'Wyślij do zespołu';
                addMessage('bot', `Nie udało się wysłać wiadomości. Spróbuj ponownie lub zadzwoń: ${SHOP_INFO.phone}.`);
            }
        };

        els.messages.appendChild(form);
        scrollDown();
        form.querySelector('input').focus();
    }

    // --- Відкриття / закриття ---
    function openChat() {
        els.panel.hidden = false;
        els.input.focus();
        scrollDown();
    }

    function closeChat() {
        els.panel.hidden = true;
    }

    function init() {
        build();
        history = loadHistory();

        addMessage('bot', WELCOME);
        history.forEach(m => addMessage(m.role, m.content));
        renderChips();

        els.toggle.onclick = () => (els.panel.hidden ? openChat() : closeChat());
        document.getElementById('chat-close').onclick = closeChat;
        document.getElementById('chat-human').onclick = () => deliver(() => topicResult('human'));

        els.form.onsubmit = (e) => {
            e.preventDefault();
            const text = els.input.value.trim();
            if (!text) return;
            els.input.value = '';
            userSay(text);
            deliver(() => route(text));
        };

        // Будь-яка кнопка з атрибутом data-open-chat (наприклад, у футері) відкриває чат
        document.querySelectorAll('[data-open-chat]').forEach(btn => { btn.onclick = openChat; });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeChat();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
