// Простое хэширование пароля (для демонстрации)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

// Инициализация системы
function initializeSystem() {
    // Создать администратора по умолчанию
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // Проверить, есть ли уже админ
    const adminExists = users.some(u => u.username === 'admin');
    
    if (!adminExists) {
        users.push({
            id: 'admin-' + Date.now(),
            username: 'admin',
            password: simpleHash('admin'),
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
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const hashedPassword = simpleHash(password);
    
    const user = users.find(u => u.username === username && u.password === hashedPassword);
    
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
function handleRegister(event) {
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
    
    if (password.length < 4) {
        showError('Пароль должен быть не менее 4 символов');
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
    
    // Создать нового пользователя
    const newUser = {
        id: 'user-' + Date.now(),
        username: username,
        password: simpleHash(password),
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

