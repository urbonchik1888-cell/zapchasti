// Глобальные переменные
let currentUser = null;
let currentListingsTab = 'all';
let userNewParts = [];
let userUsedParts = [];
let userAppliances = [];
// --- GitHub storage (users) ---
const GH_REPO = 'urbonchik1888-cell/zapchasti';
const GH_FILE = 'data.json';
const GH_CONTENTS_URL = `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;
const GH_RAW_URL = `https://raw.githubusercontent.com/${GH_REPO}/main/${GH_FILE}`;
function ghGetToken() { return localStorage.getItem('githubToken'); }
function ghSetToken(t) { localStorage.setItem('githubToken', t); }
async function ghRequestTokenIfNeeded() { let t = ghGetToken(); if (t) return t; t = prompt('Для синхронизации пользователей нужен GitHub токен (repo). Вставьте сюда:'); if (t) ghSetToken(t); return t || null; }
async function ghLoadAllData(){ try{ const r=await fetch(GH_RAW_URL+'?t='+Date.now()); if(!r.ok) throw 0; return await r.json(); }catch(_){ return null; } }
async function ghSaveUsers(users){ try{ const token=await ghRequestTokenIfNeeded(); if(!token) return false; const getRes=await fetch(GH_CONTENTS_URL,{headers:{'Authorization':'token '+token,'Accept':'application/vnd.github.v3+json'}}); let sha=null; let current={newParts:[],usedParts:[],appliances:[],users:[]}; if(getRes.ok){ const fd=await getRes.json(); sha=fd.sha; const raw=await ghLoadAllData(); if(raw) current=raw; } current.users=users; const content=btoa(unescape(encodeURIComponent(JSON.stringify(current,null,2)))); const body={message:'Update users',content,...(sha&&{sha})}; const putRes=await fetch(GH_CONTENTS_URL,{method:'PUT',headers:{'Authorization':'token '+token,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(body)}); return putRes.ok; }catch(e){ console.error('Save users to GitHub failed:',e); return false; }}
async function loadUsersFromStorage(){
  const local = JSON.parse(localStorage.getItem('users')||'[]');
  const hasToken = !!ghGetToken();
  if(!hasToken){
    if(local.length>0) return local;
    const data=await ghLoadAllData();
    return (data&&Array.isArray(data.users))?data.users:[];
  }
  const data=await ghLoadAllData();
  const remote=(data&&Array.isArray(data.users))?data.users:[];
  const byId=new Map();
  remote.forEach(u=>byId.set(u.id||`u:${u.username}`,u));
  local.forEach(u=>byId.set(u.id||`u:${u.username}`,u));
  return Array.from(byId.values());
}
async function persistUsers(users){ localStorage.setItem('users', JSON.stringify(users)); await ghSaveUsers(users); }

// Крипто-хэширование PBKDF2 (как в auth.js)
async function pbkdf2Hash(password, saltBytes, iterations = 200000) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
    );
    const derivedKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'HMAC', hash: 'SHA-256', length: 256 },
        true,
        ['sign']
    );
    const raw = await crypto.subtle.exportKey('raw', derivedKey);
    return new Uint8Array(raw);
}

function randomSalt(len = 16) { const s = new Uint8Array(len); crypto.getRandomValues(s); return s; }
function bytesToBase64(bytes) { let b=''; bytes.forEach(x=>b+=String.fromCharCode(x)); return btoa(b); }
function base64ToBytes(b64) { const b=atob(b64); const a=new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; }
function timingSafeEqual(a,b){ if(a.length!==b.length) return false; let r=0; for(let i=0;i<a.length;i++) r|=a[i]^b[i]; return r===0; }

// Проверка авторизации
function checkAuth() {
    const session = localStorage.getItem('currentSession');
    
    if (!session) {
        window.location.href = 'auth.html';
        return false;
    }
    
    try {
        currentUser = JSON.parse(session);
        return true;
    } catch (e) {
        window.location.href = 'auth.html';
        return false;
    }
}

// Загрузка данных пользователя
function loadUserData() {
    // Загрузить все запчасти
    const newParts = JSON.parse(localStorage.getItem('newParts') || '[]');
    const usedParts = JSON.parse(localStorage.getItem('usedParts') || '[]');
    const appliances = JSON.parse(localStorage.getItem('appliances') || '[]');
    
    // Фильтровать только объявления текущего пользователя
    userNewParts = newParts.filter(part => part.userId === currentUser.userId);
    userUsedParts = usedParts.filter(part => part.userId === currentUser.userId);
    userAppliances = appliances.filter(part => part.userId === currentUser.userId);
}

// Обновление информации профиля
async function updateProfileInfo() {
    // Получить данные пользователя из базы
    const users = await loadUsersFromStorage();
    const userData = users.find(u => u.id === currentUser.userId);
    
    if (!userData) {
        window.location.href = 'auth.html';
        return;
    }
    
    // Отображение роли
    const roleHTML = currentUser.isAdmin 
        ? '<span class="profile-role">👑 Администратор</span>'
        : '<span class="profile-role">👤 Пользователь</span>';
    
    document.getElementById('profileUserInfo').innerHTML = `
        <h2 style="color: #667eea; margin: 10px 0;">${currentUser.username}</h2>
        ${roleHTML}
    `;
    
    // Заполнить текущий логин
    document.getElementById('currentUsername').value = currentUser.username;
}

// Обновление счетчиков в табах
function updateStats() {
    const totalNew = userNewParts.length;
    const totalUsed = userUsedParts.length;
    const totalAppliances = userAppliances.length;
    const total = totalNew + totalUsed + totalAppliances;
    
    // Обновить счетчики в табах
    document.getElementById('countAll').textContent = total;
    document.getElementById('countNew').textContent = totalNew;
    document.getElementById('countUsed').textContent = totalUsed;
    document.getElementById('countAppliances').textContent = totalAppliances;
}

// Переключение вкладок объявлений
function switchListingsTab(tab) {
    currentListingsTab = tab;
    
    // Обновить активную вкладку
    document.querySelectorAll('.listings-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.listings-tab').classList.add('active');
    
    // Показать нужный контент
    document.querySelectorAll('.listings-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById('listings' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
}

// Отображение объявлений
function renderUserListings() {
    renderListingsTable('all');
    renderListingsTable('new');
    renderListingsTable('used');
    renderListingsTable('appliances');
}

// Отображение таблицы объявлений
function renderListingsTable(type) {
    let parts = [];
    let bodyId = '';
    let noDataId = '';
    let includeCategory = false;
    
    if (type === 'all') {
        parts = [
            ...userNewParts.map(p => ({...p, category: 'Новые запчасти'})),
            ...userUsedParts.map(p => ({...p, category: 'Б/У запчасти'})),
            ...userAppliances.map(p => ({...p, category: 'Б/У техника'}))
        ].sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
        bodyId = 'listingsAllBody';
        noDataId = 'noListingsAll';
        includeCategory = true;
    } else if (type === 'new') {
        parts = userNewParts;
        bodyId = 'listingsNewBody';
        noDataId = 'noListingsNew';
    } else if (type === 'used') {
        parts = userUsedParts;
        bodyId = 'listingsUsedBody';
        noDataId = 'noListingsUsed';
    } else if (type === 'appliances') {
        parts = userAppliances;
        bodyId = 'listingsAppliancesBody';
        noDataId = 'noListingsAppliances';
    }
    
    const tbody = document.getElementById(bodyId);
    const noData = document.getElementById(noDataId);
    
    if (parts.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
    }
    
    noData.style.display = 'none';
    tbody.innerHTML = '';
    
    parts.forEach(part => {
        const row = document.createElement('tr');
        
        // Добавить обработчик клика для перехода на страницу просмотра
        row.addEventListener('click', (e) => {
            // Проверяем, что клик не был по кнопке удаления или изображению
            if (!e.target.closest('.btn-delete') && !e.target.closest('.part-image')) {
                openItemDetail(part.id, type === 'all' ? getCategoryType(part) : type);
            }
        });
        
        row.style.cursor = 'pointer';
        
        // Колонка с изображением
        const imgCell = document.createElement('td');
        if (part.image) {
            const img = document.createElement('img');
            img.src = part.image;
            img.className = 'part-image';
            img.onclick = () => openImageModal(part.image);
            imgCell.appendChild(img);
        } else {
            imgCell.textContent = '—';
            imgCell.style.textAlign = 'center';
        }
        row.appendChild(imgCell);
        
        // Колонка с названием
        const nameCell = document.createElement('td');
        nameCell.textContent = part.name;
        row.appendChild(nameCell);
        
        // Колонка с категорией (только для вкладки "Все")
        if (includeCategory) {
            const categoryCell = document.createElement('td');
            categoryCell.textContent = part.category;
            categoryCell.style.fontSize = '0.9em';
            categoryCell.style.color = '#666';
            row.appendChild(categoryCell);
        }
        
        // Колонка с количеством
        const quantityCell = document.createElement('td');
        quantityCell.textContent = part.quantity;
        row.appendChild(quantityCell);
        
        // Колонка с ценой
        const priceCell = document.createElement('td');
        priceCell.textContent = part.price.toFixed(2) + ' Br';
        row.appendChild(priceCell);
        
        // Колонка с датой
        const dateCell = document.createElement('td');
        if (part.dateAdded) {
            const date = new Date(part.dateAdded);
            dateCell.textContent = date.toLocaleDateString('ru-RU');
            dateCell.style.fontSize = '0.9em';
        } else {
            dateCell.textContent = '—';
        }
        row.appendChild(dateCell);
        
        // Колонка с действиями
        const actionsCell = document.createElement('td');
        
        // Кнопка редактирования
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = 'Редактировать';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openItemEdit(part.id, type === 'all' ? getCategoryType(part) : type);
        };
        actionsCell.appendChild(editBtn);
        
        // Кнопка удаления
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = 'Удалить';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteUserListing(part.id, type === 'all' ? getCategoryType(part) : type);
        };
        actionsCell.appendChild(deleteBtn);
        
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
    });
}

// Получить тип категории по объявлению
function getCategoryType(part) {
    if (userNewParts.find(p => p.id === part.id)) return 'new';
    if (userUsedParts.find(p => p.id === part.id)) return 'used';
    if (userAppliances.find(p => p.id === part.id)) return 'appliances';
    return 'new';
}

// Удаление объявления
function deleteUserListing(id, type) {
    if (!confirm('Вы уверены, что хотите удалить это объявление?')) {
        return;
    }
    
    // Удалить из localStorage
    if (type === 'new') {
        let newParts = JSON.parse(localStorage.getItem('newParts') || '[]');
        newParts = newParts.filter(part => part.id !== id);
        localStorage.setItem('newParts', JSON.stringify(newParts));
    } else if (type === 'used') {
        let usedParts = JSON.parse(localStorage.getItem('usedParts') || '[]');
        usedParts = usedParts.filter(part => part.id !== id);
        localStorage.setItem('usedParts', JSON.stringify(usedParts));
    } else if (type === 'appliances') {
        let appliances = JSON.parse(localStorage.getItem('appliances') || '[]');
        appliances = appliances.filter(part => part.id !== id);
        localStorage.setItem('appliances', JSON.stringify(appliances));
    }
    
    // Перезагрузить данные и обновить отображение
    loadUserData();
    updateStats();
    renderUserListings();
    
    showMessage('Объявление успешно удалено!', 'success');
}

// Изменение логина
function handleChangeUsername(event) {
    event.preventDefault();
    
    const newUsername = document.getElementById('newUsername').value.trim();
    
    if (newUsername.length < 3) {
        showMessage('Логин должен содержать минимум 3 символа', 'error');
        return;
    }
    
    // Проверить, не занят ли логин
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.some(u => u.username === newUsername && u.id !== currentUser.userId)) {
        showMessage('Этот логин уже занят', 'error');
        return;
    }
    
    // Обновить логин в базе пользователей
    const userIndex = users.findIndex(u => u.id === currentUser.userId);
    if (userIndex !== -1) {
        users[userIndex].username = newUsername;
        localStorage.setItem('users', JSON.stringify(users));
    }
    
    // Обновить логин в объявлениях
    updateUsernameInListings(currentUser.username, newUsername);
    
    // Обновить сессию
    currentUser.username = newUsername;
    localStorage.setItem('currentSession', JSON.stringify(currentUser));
    
    // Обновить отображение
    updateProfileInfo();
    document.getElementById('newUsername').value = '';
    
    showMessage('Логин успешно изменен!', 'success');
}

// Обновление логина во всех объявлениях пользователя
function updateUsernameInListings(oldUsername, newUsername) {
    // Обновить в новых запчастях
    let newParts = JSON.parse(localStorage.getItem('newParts') || '[]');
    newParts = newParts.map(part => {
        if (part.userId === currentUser.userId) {
            part.username = newUsername;
        }
        return part;
    });
    localStorage.setItem('newParts', JSON.stringify(newParts));
    
    // Обновить в б/у запчастях
    let usedParts = JSON.parse(localStorage.getItem('usedParts') || '[]');
    usedParts = usedParts.map(part => {
        if (part.userId === currentUser.userId) {
            part.username = newUsername;
        }
        return part;
    });
    localStorage.setItem('usedParts', JSON.stringify(usedParts));
    
    // Обновить в б/у технике
    let appliances = JSON.parse(localStorage.getItem('appliances') || '[]');
    appliances = appliances.map(part => {
        if (part.userId === currentUser.userId) {
            part.username = newUsername;
        }
        return part;
    });
    localStorage.setItem('appliances', JSON.stringify(appliances));
}

// Изменение пароля
async function handleChangePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Проверить текущий пароль
    const users = await loadUsersFromStorage();
    const user = users.find(u => u.id === currentUser.userId);
    
    if (!user) { showMessage('Ошибка пользователя', 'error'); return; }
    // Проверка текущего пароля (поддержка legacy и нового формата)
    if (user.passwordHash && user.salt && user.iterations) {
        const saltBytes = base64ToBytes(user.salt);
        const derived = await pbkdf2Hash(currentPassword, saltBytes, user.iterations);
        const ok = timingSafeEqual(derived, base64ToBytes(user.passwordHash));
        if (!ok) { showMessage('Неверный текущий пароль', 'error'); return; }
    } else {
        // Legacy: допускаем смену, если хранится legacy-поле
        if (!(user.password && user.password.startsWith('legacy-'))) {
            showMessage('Неверный текущий пароль', 'error'); return;
        }
    }
    
    // Проверить новый пароль
    if (newPassword.length < 12) {
        showMessage('Новый пароль должен содержать минимум 12 символов', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage('Новые пароли не совпадают', 'error');
        return;
    }
    
    // Обновить пароль
    const userIndex = users.findIndex(u => u.id === currentUser.userId);
    if (userIndex !== -1) {
        const salt = randomSalt();
        const iterations = 200000;
        const hashBytes = await pbkdf2Hash(newPassword, salt, iterations);
        users[userIndex].passwordHash = bytesToBase64(hashBytes);
        users[userIndex].salt = bytesToBase64(salt);
        users[userIndex].iterations = iterations;
        delete users[userIndex].password;
        await persistUsers(users);
    }
    
    // Очистить форму
    document.getElementById('changePasswordForm').reset();
    
    showMessage('Пароль успешно изменен!', 'success');
}

// Показать сообщение
function showMessage(text, type) {
    const container = document.getElementById('settingsMessages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
    messageDiv.textContent = text;
    messageDiv.style.display = 'block';
    
    container.innerHTML = '';
    container.appendChild(messageDiv);
    
    // Автоматически скрыть через 5 секунд
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Открыть модальное окно с изображением
function openImageModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.style.display = 'flex';
    modalImg.src = imageSrc;
}

// Закрыть модальное окно
function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
}

// Выход из системы
function handleLogout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('currentSession');
        window.location.href = 'index.html';
    }
}

// Открыть страницу с деталями товара
function openItemDetail(itemId, itemType) {
    window.location.href = `item-detail.html?id=${itemId}&type=${itemType}&return=profile.html`;
}

// Открыть страницу редактирования товара
function openItemEdit(itemId, itemType) {
    window.location.href = `edit-item.html?id=${itemId}&type=${itemType}&return=profile.html`;
}

// Переключение видимости настроек
function toggleSettings() {
    const settingsSection = document.getElementById('settingsSection');
    if (settingsSection.style.display === 'none') {
        settingsSection.style.display = 'block';
    } else {
        settingsSection.style.display = 'none';
    }
}

// Переключение видимости пароля
function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) {
        return;
    }
    
    loadUserData();
    updateProfileInfo();
    updateStats(); // Обновить счетчики в табах
    renderUserListings();
});

