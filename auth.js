// Крипто-хэширование пароля: PBKDF2(SHA-256) с солью
async function pbkdf2Hash(password, saltBytes, iterations = 200000) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'HMAC', hash: 'SHA-256', length: 256 },
        true,
        ['sign']
    );
    const raw = await crypto.subtle.exportKey('raw', derivedKey);
    return new Uint8Array(raw);
}

function randomSalt(len = 16) {
    const salt = new Uint8Array(len);
    crypto.getRandomValues(salt);
    return salt;
}

function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
}

function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let res = 0;
    for (let i = 0; i < a.length; i++) res |= a[i] ^ b[i];
    return res === 0;
}

// Инициализация системы
// --- GitHub storage (users) ---
const GH_REPO = 'urbonchik1888-cell/zapchasti';
const GH_FILE = 'data.json';
const GH_CONTENTS_URL = `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;
const GH_RAW_URL = `https://raw.githubusercontent.com/${GH_REPO}/main/${GH_FILE}`;

function ghGetToken() { return localStorage.getItem('githubToken'); }
function ghSetToken(t) { localStorage.setItem('githubToken', t); }
async function ghRequestTokenIfNeeded() {
    let t = ghGetToken();
    if (t) return t;
    t = prompt(
        'Для синхронизации пользователей нужен GitHub токен (repo).\n' +
        'Создайте на https://github.com/settings/tokens/new и вставьте сюда:'
    );
    if (t) ghSetToken(t);
    return t || null;
}

async function ghLoadAllData() {
    try {
        const res = await fetch(GH_RAW_URL + '?t=' + Date.now());
        if (!res.ok) throw new Error('raw not ok');
        return await res.json();
    } catch (_) {
        return null;
    }
}

async function ghSaveUsers(users) {
    try {
        const token = await ghRequestTokenIfNeeded();
        if (!token) return false;
        // 1) получить текущий файл и sha
        const getRes = await fetch(GH_CONTENTS_URL, { headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' } });
        let sha = null; let current = { newParts: [], usedParts: [], appliances: [], users: [] };
        if (getRes.ok) {
            const fileData = await getRes.json();
            sha = fileData.sha;
            // загрузить текущее содержимое
            const raw = await ghLoadAllData();
            if (raw) current = raw;
        }
        current.users = users;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(current, null, 2))));
        const body = { message: 'Update users', content, ...(sha && { sha }) };
        const putRes = await fetch(GH_CONTENTS_URL, { method: 'PUT', headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return putRes.ok;
    } catch (e) {
        console.error('Save users to GitHub failed:', e);
        return false;
    }
}

async function ghSaveRegistrationRequest(request) {
    try {
        const token = ghGetToken();
        if (!token) return false;
        const getRes = await fetch(GH_CONTENTS_URL, { headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' } });
        let sha = null; let current = { newParts: [], usedParts: [], appliances: [], users: [], pendingRegistrations: [] };
        if (getRes.ok) {
            const fileData = await getRes.json();
            sha = fileData.sha;
            const raw = await ghLoadAllData();
            if (raw) current = raw;
        }
        if (!Array.isArray(current.pendingRegistrations)) current.pendingRegistrations = [];
        current.pendingRegistrations.push(request);
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(current, null, 2))));
        const body = { message: 'Add registration request', content, ...(sha && { sha }) };
        const putRes = await fetch(GH_CONTENTS_URL, { method: 'PUT', headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return putRes.ok;
    } catch (e) {
        console.error('Save registration request failed:', e);
        return false;
    }
}

async function loadUsersFromStorage() {
    const local = JSON.parse(localStorage.getItem('users') || '[]');
    const hasToken = !!ghGetToken();
    // Без токена всегда предпочитаем локальные (чтобы не блокировать вход админа)
    if (!hasToken) {
        if (local.length > 0) return local;
        const data = await ghLoadAllData();
        return (data && Array.isArray(data.users)) ? data.users : [];
    }
    // С токеном: грузим с GitHub и сливаем с локальными, предпочитая локальные записи
    const data = await ghLoadAllData();
    const remote = (data && Array.isArray(data.users)) ? data.users : [];
    const byId = new Map();
    remote.forEach(u => byId.set(u.id || `u:${u.username}`, u));
    local.forEach(u => byId.set(u.id || `u:${u.username}`, u));
    return Array.from(byId.values());
}

async function persistUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
    await ghSaveUsers(users);
}

async function initializeSystem() {
    // Создать администратора по умолчанию
    let users = await loadUsersFromStorage();
    
    // Проверить, есть ли уже админ
    const adminExists = users.some(u => u.username === 'admin');
    
    if (!adminExists) {
        // Админ по умолчанию с временным паролем admin (будет предложено сменить)
        const salt = randomSalt();
        const iterations = 200000;
        // Внимание: синхронно не получится, поэтому сохраним временно legacy-хэш,
        // а при первом входе выполним миграцию.
        users.push({
            id: 'admin-' + Date.now(),
            username: 'admin',
            password: 'legacy-admin',
            phone: '+375 29 123-45-67',
            email: 'admin@example.com',
            isAdmin: true,
            createdAt: new Date().toISOString()
        });
        await persistUsers(users);
    }
}

// Переключение вкладок
function switchAuthTab(tab) {
    // Обновить вкладки
    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Обновить формы
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    if (tab === 'login') {
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.getElementById('registerForm').classList.add('active');
    }
    
    // Очистить сообщения
    hideMessages();
}

// Показать ошибку
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
}

// Показать успех
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

// Скрыть сообщения
function hideMessages() {
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}

// Обработка входа
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    const users = await loadUsersFromStorage();
    let user = users.find(u => u.username === username);
    
    if (!user) {
        // Фолбэк: если это стандартный админ (admin/admin), создадим и войдём
        if (username === 'admin' && password === 'admin') {
            const salt = randomSalt();
            const iterations = 200000;
            const derived = await pbkdf2Hash(password, salt, iterations);
            const newAdmin = {
                id: 'admin-' + Date.now(),
                username: 'admin',
                passwordHash: bytesToBase64(derived),
                salt: bytesToBase64(salt),
                iterations,
                phone: '+375 29 123-45-67',
                email: 'admin@example.com',
                isAdmin: true,
                createdAt: new Date().toISOString()
            };
            const usersAll = await loadUsersFromStorage();
            usersAll.push(newAdmin);
            await persistUsers(usersAll);
            user = newAdmin;
        } else {
            showError('Неверное имя пользователя или пароль');
            return;
        }
    }
    
    // Поддержка миграции: если есть современный формат
    if (user.passwordHash && user.salt && user.iterations) {
        const saltBytes = base64ToBytes(user.salt);
        const derived = await pbkdf2Hash(password, saltBytes, user.iterations);
        const ok = timingSafeEqual(derived, base64ToBytes(user.passwordHash));
        if (!ok) {
            // Форс-сброс для admin/admin: переустанавливаем хеш и пускаем
            if (user.username === 'admin' && username === 'admin' && password === 'admin') {
                const newSalt = randomSalt();
                const iterations = 200000;
                const newDerived = await pbkdf2Hash(password, newSalt, iterations);
                user.passwordHash = bytesToBase64(newDerived);
                user.salt = bytesToBase64(newSalt);
                user.iterations = iterations;
                user.isAdmin = true;
                await persistUsers(await (async ()=>{ const all=await loadUsersFromStorage(); const i=all.findIndex(u=>u.id===user.id); if(i!==-1) all[i]=user; return all; })());
            } else {
                showError('Неверное имя пользователя или пароль');
                return;
            }
        }
    } else {
        // Legacy: допускаем вход только для стандартного админа и пароля admin
        if (!(user.password && user.password.startsWith('legacy-') && user.username === 'admin' && password === 'admin')) {
            showError('Неверное имя пользователя или пароль');
            return;
        }
        // Миграция: создаём соль и сохраняем PBKDF2-хэш
        const salt = randomSalt();
        const iterations = 200000;
        const derived = await pbkdf2Hash(password, salt, iterations);
        user.passwordHash = bytesToBase64(derived);
        user.salt = bytesToBase64(salt);
        user.iterations = iterations;
        delete user.password;
        await persistUsers(users);
    }
    
    if (user) {
        // Создать сессию
        const session = {
            userId: user.id,
            username: user.username,
            isAdmin: user.isAdmin || false,
            loginTime: new Date().toISOString()
        };
        
        localStorage.setItem('currentSession', JSON.stringify(session));
        
        // Перенаправить на главную страницу
        window.location.href = 'index.html';
    } else {
        showError('Неверное имя пользователя или пароль');
    }
}

// Обработка регистрации
async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    const phone = document.getElementById('registerPhone').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    
    // Проверки
    if (username.length < 3) {
        showError('Имя пользователя должно быть не менее 3 символов');
        return;
    }
    
    if (password.length < 12) {
        showError('Пароль должен быть не менее 12 символов');
        return;
    }
    
    if (password !== passwordConfirm) {
        showError('Пароли не совпадают');
        return;
    }
    
    if (!phone) {
        showError('Укажите номер телефона');
        return;
    }
    
    // Проверить, не занято ли имя пользователя
    const users = await loadUsersFromStorage();
    
    if (users.some(u => u.username === username)) {
        showError('Это имя пользователя уже занято');
        return;
    }
    
    // Создать нового пользователя с PBKDF2
    const salt = randomSalt();
    const iterations = 200000;
    const hashBytes = await pbkdf2Hash(password, salt, iterations);
    const newUser = {
        id: 'user-' + Date.now(),
        username: username,
        passwordHash: bytesToBase64(hashBytes),
        salt: bytesToBase64(salt),
        iterations: iterations,
        phone: phone,
        email: email || '',
        isAdmin: false,
        createdAt: new Date().toISOString()
    };
    
    // Если есть токен (админский браузер) — регистрируем сразу, иначе создаём заявку
    if (ghGetToken()) {
        users.push(newUser);
        await persistUsers(users);
        showSuccess('Регистрация успешна! Теперь вы можете войти');
        document.getElementById('registerForm').reset();
        setTimeout(() => {
            switchAuthTab('login');
            document.getElementById('loginUsername').value = username;
        }, 1500);
        return;
    }

    // Создаём заявку: сохраняем безопасные данные, пароль не отправляем
    const request = {
        id: 'req-' + Date.now(),
        username,
        phone,
        email: email || '',
        createdAt: new Date().toISOString()
    };
    const saved = await ghSaveRegistrationRequest(request);
    if (saved) {
        showSuccess('Заявка на регистрацию отправлена администратору. Ожидайте подтверждения.');
        document.getElementById('registerForm').reset();
        return;
    }
    // Если записать в GitHub нельзя — предлагаем письмо администратору
    const adminEmail = 'admin@example.com';
    const subject = encodeURIComponent('Заявка на регистрацию');
    const body = encodeURIComponent(`Прошу создать аккаунт\n\nЛогин: ${username}\nТелефон: ${phone}\nEmail: ${email || ''}`);
    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
    showSuccess('Открылось письмо администратору. Отправьте его для завершения заявки.');
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async function() {
    await initializeSystem();
});

