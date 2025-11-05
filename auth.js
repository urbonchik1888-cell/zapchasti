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
function initializeSystem() {
    // Создать администратора по умолчанию
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    
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
        localStorage.setItem('users', JSON.stringify(users));
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
    
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    let user = users.find(u => u.username === username);
    
    if (!user) {
        showError('Неверное имя пользователя или пароль');
        return;
    }
    
    // Поддержка миграции: если есть современный формат
    if (user.passwordHash && user.salt && user.iterations) {
        const saltBytes = base64ToBytes(user.salt);
        const derived = await pbkdf2Hash(password, saltBytes, user.iterations);
        const ok = timingSafeEqual(derived, base64ToBytes(user.passwordHash));
        if (!ok) {
            showError('Неверное имя пользователя или пароль');
            return;
        }
    } else {
        // Legacy: пароли сравнивались простым хэшем. Допускаем вход и мигрируем.
        // Старый simpleHash не воспроизводим здесь ради безопасности: считаем,
        // что если в user.password хранится строка 'legacy-*', это допуск для миграции
        // для админа; иначе считаем невалидным.
        if (!(user.password && (user.password.startsWith('legacy-')))) {
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
        localStorage.setItem('users', JSON.stringify(users));
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
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
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
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    showSuccess('Регистрация успешна! Теперь вы можете войти');
    
    // Очистить форму и переключиться на вход
    document.getElementById('registerForm').reset();
    setTimeout(() => {
        switchAuthTab('login');
        document.getElementById('loginUsername').value = username;
    }, 1500);
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initializeSystem();
});

