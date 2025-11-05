// Глобальные переменные
let currentSection = 'new'; // Текущий раздел навигации
let newParts = [];
let usedParts = [];
let appliances = [];
let currentImageData = []; // Массив для хранения нескольких изображений
let cameraStream = null;
let currentUser = null;

// Проверка авторизации (необязательная - для просмотра не требуется)
function checkAuth() {
    const session = localStorage.getItem('currentSession');
    
    if (!session) {
        // Пользователь не авторизован - работаем как гость
        currentUser = null;
        updateGuestDisplay();
        return false;
    }
    
    try {
        currentUser = JSON.parse(session);
        // Обновить отображение имени пользователя
        updateUserDisplay();
        return true;
    } catch (e) {
        currentUser = null;
        updateGuestDisplay();
        return false;
    }
}

// Обновить отображение пользователя
function updateUserDisplay() {
    const display = document.getElementById('usernameDisplay');
    const profileBtn = document.querySelector('.btn-profile');
    const logoutBtn = document.querySelector('.btn-logout');
    
    if (currentUser) {
        const role = currentUser.isAdmin ? ' (Администратор)' : '';
        display.textContent = `👤 ${currentUser.username}${role}`;
        if (profileBtn) profileBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    }
}

// Обновить отображение для гостя
function updateGuestDisplay() {
    const display = document.getElementById('usernameDisplay');
    const profileBtn = document.querySelector('.btn-profile');
    const logoutBtn = document.querySelector('.btn-logout');
    
    display.innerHTML = '<a href="auth.html" class="btn-login">🔑 Войти</a>';
    if (profileBtn) profileBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
}

// Обновить интерфейс в зависимости от авторизации
function updateUIforAuth(isAuth) {
    const addTabButton = document.getElementById('addTabButton');
    const addSection = document.getElementById('addSection');
    
    if (!isAuth) {
        // Скрыть кнопку "Добавить товар" для гостей
        if (addTabButton) {
            addTabButton.style.display = 'none';
        }
        
        // Скрыть форму добавления
        if (addSection) {
            addSection.style.display = 'none';
        }
        
        // Переключиться на раздел "Новые запчасти" если открыт "Добавить"
        if (currentSection === 'add') {
            switchSection('new', true);
            // Активировать кнопку "Новые запчасти"
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            const buttons = document.querySelectorAll('.tab-button');
            // Найти кнопку "Новые запчасти" (может быть на индексе 0 или 1 в зависимости от видимости кнопки добавления)
            for (let btn of buttons) {
                if (btn.textContent.includes('Новые запчасти')) {
                    btn.classList.add('active');
                    break;
                }
            }
        }
    } else {
        // Показать кнопку "Добавить товар" для авторизованных
        if (addTabButton) {
            addTabButton.style.display = 'inline-block';
        }
    }
}

// Выход из системы
function handleLogout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('currentSession');
        window.location.href = 'index.html';
    }
}

// Загрузка данных при старте
document.addEventListener('DOMContentLoaded', function() {
    // Проверить авторизацию (необязательно для просмотра)
    const isAuth = checkAuth();
    
    loadData();
    renderParts();
    updateEmptyMessages();
    
    // Скрыть/показать элементы в зависимости от авторизации
    updateUIforAuth(isAuth);
    
    // Заполнить поле контакта из профиля пользователя при загрузке (приоритет телефону)
    if (isAuth && currentUser) {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const currentUserData = users.find(u => u.id === currentUser.userId);
        const contactInput = document.getElementById('partPhone');
        if (contactInput && currentUserData) {
            // Приоритет телефону, если его нет - берем email
            if (currentUserData.phone) {
                contactInput.value = currentUserData.phone;
            } else if (currentUserData.email) {
                contactInput.value = currentUserData.email;
            }
        }
    }
    
    // Обработчик отправки формы
    document.getElementById('partForm').addEventListener('submit', addPart);
    
    // Обработчик изменения категории - поле типа техники всегда видимо и обязательно
    // (не нужно скрывать для новых и б/у запчастей)
    
    // Обработчики загрузки изображения
    document.getElementById('partImage').addEventListener('change', handleImageUpload);
    document.getElementById('partImageCamera').addEventListener('change', handleImageUpload);
    
    // Закрытие дропдауна фильтра по клику вне
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('filterDropdown');
        const toggleBtn = document.getElementById('filterToggleBtn');
        if (!dropdown || !toggleBtn) return;
        const clickedInside = dropdown.contains(e.target) || toggleBtn.contains(e.target);
        if (!clickedInside) dropdown.style.display = 'none';
    });
    
    // Установить метку на кнопке фильтра если уже выбран
    updateFilterToggleLabel();
});

// Переключение разделов навигации
function switchSection(section, skipButtonUpdate = false) {
    currentSection = section;
    
    // Обновление активной кнопки
    if (!skipButtonUpdate && (event || window.event)) {
        const evt = event || window.event;
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        if (evt.target) {
            evt.target.classList.add('active');
        }
    }
    
    // Скрыть все разделы
    document.getElementById('addSection').style.display = 'none';
    document.getElementById('newPartsSection').style.display = 'none';
    document.getElementById('usedPartsSection').style.display = 'none';
    document.getElementById('appliancesSection').style.display = 'none';
    
    // Показать/скрыть фильтры
    const filtersSection = document.querySelector('.appliance-filters');
    
    // Показать выбранный раздел
    if (section === 'add') {
        document.getElementById('addSection').style.display = 'block';
        // Скрыть фильтры при открытии формы добавления
        if (filtersSection) filtersSection.style.display = 'none';
        // Поле типа техники всегда видимо и обязательно для всех разделов
        const applianceTypeGroup = document.getElementById('applianceTypeGroup');
        const applianceTypeSelect = document.getElementById('applianceType');
        if (applianceTypeGroup) {
            applianceTypeGroup.style.display = 'block';
            applianceTypeSelect.required = true;
            applianceTypeSelect.setAttribute('required', 'required');
        }
    } else {
        // Показать фильтры для всех остальных разделов
        if (filtersSection) filtersSection.style.display = 'block';
        
        if (section === 'new') {
            document.getElementById('newPartsSection').style.display = 'block';
            clearSearch('new');
        } else if (section === 'used') {
            document.getElementById('usedPartsSection').style.display = 'block';
            clearSearch('used');
        } else if (section === 'appliances') {
            document.getElementById('appliancesSection').style.display = 'block';
            clearSearch('appliances');
        }
        
        // Применить фильтры ко всем разделам, если фильтр выбран
        const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
        if (selectedRadio) {
            applyFiltersToAllSections();
        }
    }
    
    // Обновить активную кнопку вручную если нужно
    if (skipButtonUpdate) {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            const btnSection = btn.getAttribute('onclick').match(/'([^']+)'/);
            if (btnSection && btnSection[1] === section) {
                btn.classList.add('active');
            }
        });
    }
}

// Выбор изображения из галереи
function selectFromGallery() {
    document.getElementById('partImage').click();
}

// Сделать фото с камеры
async function takePhoto() {
    // Проверяем, поддерживает ли браузер getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Ваш браузер не поддерживает доступ к камере. Используйте кнопку "Выбрать из галереи".');
        return;
    }

    // Для мобильных устройств - открываем нативную камеру
    if (isMobileDevice()) {
        document.getElementById('partImageCamera').click();
        return;
    }

    // Для десктопа - открываем модальное окно с веб-камерой
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraStream');
    const errorDiv = document.getElementById('cameraError');
    
    modal.style.display = 'block';
    errorDiv.style.display = 'none';

    try {
        // Запрашиваем доступ к камере
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        video.srcObject = cameraStream;
    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        errorDiv.textContent = 'Не удалось получить доступ к камере. Проверьте разрешения браузера.';
        errorDiv.style.display = 'block';
    }
}

// Проверка, является ли устройство мобильным
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Сделать снимок с веб-камеры
function capturePhoto() {
    const video = document.getElementById('cameraStream');
    const canvas = document.getElementById('cameraCanvas');
    const preview = document.getElementById('imagePreview');

    if (!video.srcObject) {
        alert('Камера не активна');
        return;
    }

    // Устанавливаем размер canvas равным размеру видео
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Рисуем текущий кадр из видео на canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Конвертируем canvas в base64 и добавляем к массиву
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    currentImageData.push(imageData);
    
    // Обновляем превью
    updateImagePreview();

    // Закрываем модальное окно
    closeCameraModal();

    // Показываем уведомление
    showSuccessMessage('Фото сделано!');
}

// Закрыть модальное окно камеры
function closeCameraModal() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraStream');

    // Останавливаем поток камеры
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    video.srcObject = null;
    modal.style.display = 'none';
}

// Удаление конкретного изображения
function removeImage(index) {
    currentImageData.splice(index, 1);
    updateImagePreview();
}

// Удаление всех изображений
function removeAllImages() {
    currentImageData = [];
    updateImagePreview();
    document.getElementById('partImage').value = '';
    document.getElementById('partImageCamera').value = '';
}

// Обновление превью изображений
function updateImagePreview() {
    const preview = document.getElementById('imagePreview');
    
    if (currentImageData.length === 0) {
        preview.innerHTML = '';
        preview.classList.remove('show');
        return;
    }
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">';
    
    currentImageData.forEach((imageData, index) => {
        html += `
            <div style="position: relative; border-radius: 8px; overflow: hidden; border: 2px solid #e1e8ed;">
                <img src="${imageData}" alt="Превью ${index + 1}" style="width: 100%; height: 150px; object-fit: cover; display: block;">
                <button type="button" class="remove-image" onclick="removeImage(${index})" title="Удалить изображение" style="position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.8); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 14px;">✕</button>
            </div>
        `;
    });
    
    html += '</div>';
    html += `<button type="button" onclick="removeAllImages()" style="margin-top: 10px; padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">Удалить все фото</button>`;
    
    preview.innerHTML = html;
    preview.classList.add('show');
}

// Обработка загрузки изображения (несколько файлов)
function handleImageUpload(event) {
    const files = event.target.files;
    const preview = document.getElementById('imagePreview');
    
    if (!files || files.length === 0) {
        return;
    }
    
    // Обрабатываем каждый файл
    Array.from(files).forEach((file, fileIndex) => {
        if (!file.type.match('image.*')) {
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            currentImageData.push(e.target.result);
            
            // Обновляем превью после загрузки каждого файла
            if (fileIndex === files.length - 1) {
                updateImagePreview();
            }
        };
        reader.readAsDataURL(file);
    });
}

// Добавление новой запчасти
function addPart(event) {
    event.preventDefault();
    
    // Проверить авторизацию
    if (!currentUser) {
        alert('Для добавления объявления необходимо войти в систему');
        window.location.href = 'auth.html';
        return;
    }
    
    const category = document.getElementById('partCategory').value;
    const name = document.getElementById('partName').value.trim();
    const quantityInput = document.getElementById('partQuantity').value.trim();
    const quantity = quantityInput === '' ? 0 : parseInt(quantityInput) || 0;
    const price = parseFloat(document.getElementById('partPrice').value);
    const description = document.getElementById('partDescription').value.trim();
    const characteristics = document.getElementById('partCharacteristics').value.trim();
    const applianceType = document.getElementById('applianceType').value.trim();
    const contact = document.getElementById('partPhone').value.trim();
    
    // Валидация полей
    if (!name || quantity < 0 || price < 0) {
        alert('Пожалуйста, заполните все обязательные поля корректно!');
        return;
    }
    
    // Проверка выбора категории техники (обязательно для всех разделов)
    if (!applianceType) {
        alert('Пожалуйста, выберите категорию техники!');
        document.getElementById('applianceType').focus();
        return;
    }
    
    // Получить контактную информацию пользователя
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const currentUserData = users.find(u => u.id === currentUser.userId);
    
    // Определить тип контакта (телефон или email) и сохранить в соответствующем поле
    let contactPhone = '';
    let contactEmail = '';
    
    if (contact) {
        // Проверяем, является ли контакт email (содержит @)
        if (contact.includes('@')) {
            contactEmail = contact;
            contactPhone = currentUserData ? currentUserData.phone : '';
        } else {
            // Это телефон
            contactPhone = contact;
            contactEmail = currentUserData ? currentUserData.email : '';
        }
    } else {
        // Используем контакты из профиля пользователя
        contactPhone = currentUserData ? currentUserData.phone : '';
        contactEmail = currentUserData ? currentUserData.email : '';
    }
    
    const part = {
        id: Date.now(),
        name: name,
        quantity: quantity,
        price: price,
        description: description,
        characteristics: characteristics,
        images: currentImageData, // Массив изображений
        dateAdded: new Date().toISOString(),
        userId: currentUser.userId,
        username: currentUser.username,
        phone: contactPhone,
        email: contactEmail,
        applianceType: applianceType // Добавляем тип техники
    };
    
    // Добавление в соответствующий массив
    if (category === 'new') {
        newParts.push(part);
    } else if (category === 'used') {
        usedParts.push(part);
    } else if (category === 'appliances') {
        appliances.push(part);
    }
    
    // Сохранение и отображение
    saveData();
    renderParts();
    updateEmptyMessages();
    
    // Очистка формы
    document.getElementById('partForm').reset();
    document.getElementById('partImage').value = '';
    document.getElementById('partImageCamera').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imagePreview').classList.remove('show');
    currentImageData = [];
    
    // Очистить поле типа техники не нужно - оно всегда видимо
    
    // Анимация успеха
    const successMsg = category === 'appliances' ? 'Техника успешно добавлена!' : 'Запчасть успешно добавлена!';
    showSuccessMessage(successMsg);
    
    // Автоматически переключиться на раздел, куда был добавлен товар
    setTimeout(() => {
        switchSection(category, true);
    }, 1000);
}

// Удаление запчасти/техники
function deletePart(id, type) {
    // Найти запчасть
    let parts;
    if (type === 'new') parts = newParts;
    else if (type === 'used') parts = usedParts;
    else if (type === 'appliances') parts = appliances;
    
    const part = parts.find(p => p.id === id);
    
    // Проверка прав доступа
    if (part && !currentUser.isAdmin && part.userId !== currentUser.userId) {
        alert('❌ У вас нет прав для удаления этого объявления.\nВы можете удалять только свои объявления.');
        return;
    }
    
    const message = type === 'appliances' ? 'Вы уверены, что хотите удалить эту технику?' : 'Вы уверены, что хотите удалить эту запчасть?';
    if (!confirm(message)) {
        return;
    }
    
    if (type === 'new') {
        newParts = newParts.filter(part => part.id !== id);
    } else if (type === 'used') {
        usedParts = usedParts.filter(part => part.id !== id);
    } else if (type === 'appliances') {
        appliances = appliances.filter(part => part.id !== id);
    }
    
    saveData();
    renderParts();
    updateEmptyMessages();
    const successMsg = type === 'appliances' ? 'Техника удалена!' : 'Запчасть удалена!';
    showSuccessMessage(successMsg);
}

// Отображение запчастей
function renderParts() {
    renderPartsTable('new', newParts, 'newPartsBody');
    renderPartsTable('used', usedParts, 'usedPartsBody');
    
    // Для техники применяем фильтры если они выбраны
    if (currentSection === 'appliances') {
        applyApplianceFilters();
    } else {
        renderPartsTable('appliances', appliances, 'appliancesBody');
    }
}

function renderPartsTable(type, parts, bodyId) {
    const tbody = document.getElementById(bodyId);
    tbody.innerHTML = '';
    
    if (parts.length === 0) {
        return;
    }
    
    parts.forEach(part => {
        const row = document.createElement('tr');
        
        // Добавить обработчик клика для перехода на страницу просмотра
        row.addEventListener('click', (e) => {
            // Проверяем, что клик не был по кнопке удаления или изображению
            if (!e.target.closest('.btn-delete') && !e.target.closest('.part-image')) {
                openItemDetail(part.id, type);
            }
        });
        
        row.style.cursor = 'pointer';
        
        // Колонка с изображением
        const imageCell = document.createElement('td');
        // Поддержка старого формата (одно изображение) и нового (массив)
        const images = part.images && Array.isArray(part.images) && part.images.length > 0 
            ? part.images 
            : (part.image ? [part.image] : []);
        
        if (images.length > 0) {
            const img = document.createElement('img');
            img.src = images[0]; // Показываем первое изображение
            img.alt = part.name;
            img.className = 'part-image';
            if (images.length > 1) {
                img.title = `Фото 1 из ${images.length}. Кликните для просмотра всех фото.`;
            }
            img.onclick = (e) => {
                e.stopPropagation();
                if (images.length === 1) {
                    openModal(images[0]);
                } else {
                    openImagesGallery(images);
                }
            };
            imageCell.style.position = 'relative';
            imageCell.appendChild(img);
            if (images.length > 1) {
                const badge = document.createElement('span');
                badge.textContent = `+${images.length - 1}`;
                badge.style.cssText = 'position: absolute; bottom: 5px; right: 5px; background: #667eea; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';
                imageCell.appendChild(badge);
            }
        } else {
            const noImage = document.createElement('div');
            noImage.className = 'no-image';
            noImage.textContent = '📷';
            imageCell.appendChild(noImage);
        }
        row.appendChild(imageCell);
        
        // Колонка с названием
        const nameCell = document.createElement('td');
        nameCell.textContent = part.name;
        row.appendChild(nameCell);
        
        // Колонка с количеством
        const quantityCell = document.createElement('td');
        
        // Для новых запчастей показывать статус наличия обычным пользователям и гостям
        if (type === 'new' && (!currentUser || !currentUser.isAdmin)) {
            if (part.quantity > 0) {
                quantityCell.textContent = '✅ Есть в наличии';
                quantityCell.style.color = '#28a745';
                quantityCell.style.fontWeight = '600';
            } else {
                quantityCell.textContent = '❌ Нет в наличии';
                quantityCell.style.color = '#dc3545';
                quantityCell.style.fontWeight = '600';
            }
        } else {
            // Администратору и для других категорий показывать точное количество
            quantityCell.textContent = part.quantity;
        }
        
        row.appendChild(quantityCell);
        
        // Колонка с ценой
        const priceCell = document.createElement('td');
        priceCell.textContent = part.price.toFixed(2) + ' Br';
        row.appendChild(priceCell);
        
        // Колонка с автором
        const authorCell = document.createElement('td');
        authorCell.textContent = part.username || 'Неизвестно';
        authorCell.style.fontSize = '0.9em';
        authorCell.style.color = '#666';
        row.appendChild(authorCell);
        
        // Колонка с действиями (только для авторизованных)
        const actionsCell = document.createElement('td');
        
        if (currentUser) {
            // Кнопка редактирования (только для своих объявлений или администратора)
            if (currentUser.isAdmin || part.userId === currentUser.userId) {
                const editBtn = document.createElement('button');
                editBtn.className = 'btn-edit';
                editBtn.textContent = 'Редактировать';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    openItemEdit(part.id, type);
                };
                actionsCell.appendChild(editBtn);
            }
            
            // Кнопка удаления
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.textContent = 'Удалить';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deletePart(part.id, type);
            };
            actionsCell.appendChild(deleteBtn);
        } else {
            // Для гостей показываем сообщение
            actionsCell.textContent = '—';
            actionsCell.style.textAlign = 'center';
            actionsCell.style.color = '#999';
        }
        
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
    });
}

// Обновление сообщений о пустых таблицах
function updateEmptyMessages() {
    const newEmpty = document.getElementById('newPartsEmpty');
    const usedEmpty = document.getElementById('usedPartsEmpty');
    const appliancesEmpty = document.getElementById('appliancesEmpty');
    const newTable = document.getElementById('newPartsTable');
    const usedTable = document.getElementById('usedPartsTable');
    const appliancesTable = document.getElementById('appliancesTable');
    
    if (newParts.length === 0) {
        newEmpty.style.display = 'block';
        newTable.style.display = 'none';
    } else {
        newEmpty.style.display = 'none';
        newTable.style.display = 'table';
    }
    
    if (usedParts.length === 0) {
        usedEmpty.style.display = 'block';
        usedTable.style.display = 'none';
    } else {
        usedEmpty.style.display = 'none';
        usedTable.style.display = 'table';
    }
    
    if (appliances.length === 0) {
        appliancesEmpty.style.display = 'block';
        appliancesTable.style.display = 'none';
    } else {
        appliancesEmpty.style.display = 'none';
        appliancesTable.style.display = 'table';
    }
}

// Модальное окно для просмотра изображений
function openModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.style.display = 'flex';
    modalImg.src = imageSrc;
}

// Открыть галерею изображений
let currentGalleryImages = [];
let currentGalleryIndex = 0;

function openImagesGallery(images) {
    currentGalleryImages = images;
    currentGalleryIndex = 0;
    
    const modal = document.getElementById('imageModal');
    
    // Очистить модальное окно и добавить навигацию
    modal.innerHTML = `
        <span class="close">&times;</span>
        ${images.length > 1 ? `
            <span class="gallery-nav gallery-prev" onclick="event.stopPropagation(); changeGalleryImage(-1)">‹</span>
            <span class="gallery-nav gallery-next" onclick="event.stopPropagation(); changeGalleryImage(1)">›</span>
            <div class="gallery-counter">1 / ${images.length}</div>
        ` : ''}
        <img class="modal-content" id="modalImage" src="${images[0]}" onclick="event.stopPropagation()">
    `;
    
    modal.style.display = 'flex';
    updateGalleryCounter();
    
    // Добавить обработчик клавиатуры для навигации стрелками
    document.addEventListener('keydown', handleGalleryKeyboard);
}

function changeGalleryImage(direction) {
    currentGalleryIndex += direction;
    
    if (currentGalleryIndex < 0) {
        currentGalleryIndex = currentGalleryImages.length - 1;
    } else if (currentGalleryIndex >= currentGalleryImages.length) {
        currentGalleryIndex = 0;
    }
    
    const modalImg = document.getElementById('modalImage');
    const counter = document.querySelector('.gallery-counter');
    
    if (modalImg) {
        modalImg.src = currentGalleryImages[currentGalleryIndex];
        if (counter && currentGalleryImages.length > 1) {
            counter.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
        }
    }
}

function updateGalleryCounter() {
    const counter = document.querySelector('.gallery-counter');
    if (counter && currentGalleryImages.length > 1) {
        counter.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
    }
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    // Восстановить оригинальную структуру модального окна
    modal.innerHTML = `
        <span class="close">&times;</span>
        <img class="modal-content" id="modalImage">
    `;
    currentGalleryImages = [];
    currentGalleryIndex = 0;
    
    // Удалить обработчик клавиатуры при закрытии галереи
    document.removeEventListener('keydown', handleGalleryKeyboard);
}

// Обработчик навигации по галерее с помощью клавиатуры
function handleGalleryKeyboard(event) {
    // Проверяем, открыта ли галерея
    const modal = document.getElementById('imageModal');
    if (!modal || modal.style.display !== 'flex' || currentGalleryImages.length <= 1) {
        return;
    }
    
    // Обрабатываем только стрелки влево и вправо
    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        changeGalleryImage(-1);
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        changeGalleryImage(1);
    }
}

// Закрытие модального окна при нажатии Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
        closeCameraModal();
    }
});

// Сохранение данных в localStorage
function saveData() {
    try {
        localStorage.setItem('newParts', JSON.stringify(newParts));
        localStorage.setItem('usedParts', JSON.stringify(usedParts));
        localStorage.setItem('appliances', JSON.stringify(appliances));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            alert('Превышен лимит хранилища! Возможно, слишком много изображений. Попробуйте удалить старые записи.');
        } else {
            console.error('Ошибка сохранения данных:', e);
        }
    }
}

// Загрузка данных из localStorage
function loadData() {
    try {
        const savedNewParts = localStorage.getItem('newParts');
        const savedUsedParts = localStorage.getItem('usedParts');
        const savedAppliances = localStorage.getItem('appliances');
        
        if (savedNewParts) {
            newParts = JSON.parse(savedNewParts);
        }
        
        if (savedUsedParts) {
            usedParts = JSON.parse(savedUsedParts);
        }
        
        if (savedAppliances) {
            appliances = JSON.parse(savedAppliances);
        }
    } catch (e) {
        console.error('Ошибка загрузки данных:', e);
        newParts = [];
        usedParts = [];
        appliances = [];
    }
}

// Показ сообщения об успехе
function showSuccessMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 2000);
}

// Поиск по запчастям/технике
function searchParts(type) {
    let searchInput, parts, tbody;
    
    // Определяем, в каком разделе ищем
    if (type === 'new') {
        searchInput = document.getElementById('searchNew');
        parts = newParts;
        tbody = 'newPartsBody';
    } else if (type === 'used') {
        searchInput = document.getElementById('searchUsed');
        parts = usedParts;
        tbody = 'usedPartsBody';
    } else if (type === 'appliances') {
        searchInput = document.getElementById('searchAppliances');
        parts = appliances;
        tbody = 'appliancesBody';
    }
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    // Фильтруем запчасти/технику
    let filteredParts = parts.filter(part => 
        part.name.toLowerCase().includes(searchTerm)
    );
    
    // Применяем фильтры по категории техники ко всем разделам, если фильтр выбран
    const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
    if (selectedRadio) {
        filteredParts = applyApplianceTypeFilters(filteredParts);
    }
    
    // Отображаем отфильтрованные результаты
    renderPartsTable(type, filteredParts, tbody);
    
    // Обновляем сообщения о пустых таблицах
    updateSearchResults(type, filteredParts.length, parts.length);
}

// Применение фильтров по типу техники
function applyApplianceFilters() {
    // Показываем/скрываем кнопку сброса фильтра
    const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
    const clearBtn = document.getElementById('clearFilterBtn');
    if (clearBtn) {
        clearBtn.style.display = selectedRadio ? 'inline-block' : 'none';
    }
    
    // Обновить подпись на кнопке и скрыть дропдаун
    updateFilterToggleLabel();
    const dropdown = document.getElementById('filterDropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    // Если фильтр не выбран, просто показываем текущий раздел
    if (!selectedRadio) {
        // Применяем обычный поиск в текущем разделе
        if (currentSection === 'new') {
            searchParts('new');
        } else if (currentSection === 'used') {
            searchParts('used');
        } else if (currentSection === 'appliances') {
            searchParts('appliances');
        }
        return;
    }
    
    // Применяем фильтры ко всем разделам
    applyFiltersToAllSections();
}

// Переключить показ дропдауна фильтра
function toggleFilterDropdown() {
    const dropdown = document.getElementById('filterDropdown');
    if (!dropdown) return;
    dropdown.style.display = dropdown.style.display === 'none' || dropdown.style.display === '' ? 'block' : 'none';
}

// Обновить текст на кнопке фильтра
function updateFilterToggleLabel() {
    const btn = document.getElementById('filterToggleBtn');
    if (!btn) return;
    const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
    if (selectedRadio) {
        const label = selectedRadio.parentElement?.querySelector('span')?.textContent || selectedRadio.value;
        btn.textContent = `${label} ▾`;
    } else {
        btn.textContent = 'Выбрать категорию ▾';
    }
}

// Применение фильтров ко всем разделам
function applyFiltersToAllSections() {
    const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
    if (!selectedRadio) return;
    
    const selectedType = selectedRadio.value.trim().toLowerCase();
    
    // Получаем поисковые запросы из всех разделов
    const searchNew = document.getElementById('searchNew').value.toLowerCase().trim();
    const searchUsed = document.getElementById('searchUsed').value.toLowerCase().trim();
    const searchAppliances = document.getElementById('searchAppliances').value.toLowerCase().trim();
    
    // Фильтруем новые запчасти
    let filteredNew = applyApplianceTypeFilters(newParts);
    if (searchNew) {
        filteredNew = filteredNew.filter(part => part.name.toLowerCase().includes(searchNew));
    }
    renderPartsTable('new', filteredNew, 'newPartsBody');
    updateSearchResults('new', filteredNew.length, newParts.length);
    
    // Фильтруем Б/У запчасти
    let filteredUsed = applyApplianceTypeFilters(usedParts);
    if (searchUsed) {
        filteredUsed = filteredUsed.filter(part => part.name.toLowerCase().includes(searchUsed));
    }
    renderPartsTable('used', filteredUsed, 'usedPartsBody');
    updateSearchResults('used', filteredUsed.length, usedParts.length);
    
    // Фильтруем Б/У технику
    let filteredAppliances = applyApplianceTypeFilters(appliances);
    if (searchAppliances) {
        filteredAppliances = filteredAppliances.filter(part => part.name.toLowerCase().includes(searchAppliances));
    }
    renderPartsTable('appliances', filteredAppliances, 'appliancesBody');
    updateSearchResults('appliances', filteredAppliances.length, appliances.length);
}

// Сброс фильтра техники
function clearApplianceFilter() {
    const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
    if (selectedRadio) {
        selectedRadio.checked = false;
        applyApplianceFilters();
    }
    // Сбросить подпись и показать дропдаун кнопку
    updateFilterToggleLabel();
}

// Фильтрация техники по выбранным типам
function applyApplianceTypeFilters(parts) {
    // Получаем выбранную радиокнопку
    const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
    
    // Если ни один фильтр не выбран, показываем все
    if (!selectedRadio) {
        return parts;
    }
    
    // Получаем выбранный тип техники
    const selectedType = selectedRadio.value.trim().toLowerCase();
    
    // Создаем ключевые слова для поиска по названию в зависимости от типа техники
    const searchKeywords = {
        'варочные панели': ['варочн', 'панел'],
        'духовые шкафы': ['духов', 'шкаф'],
        'другая техника': [],
        'кофемашины': ['кофемашин', 'кофе-машин'],
        'кондиционеры': ['кондиционер'],
        'посудомоечная машина': ['посудомоечн', 'посудомойк'],
        'стиральные машины': ['стиральн', 'стирк'],
        'телевизоры': ['телевизор', 'тв ', ' tv '],
        'холодильники': ['холодильник', 'морозильник']
    };
    
    const keywords = searchKeywords[selectedType] || [selectedType];
    
    // Фильтруем технику по выбранному типу
    return parts.filter(part => {
        const partName = (part.name || '').toLowerCase();
        
        // Если у товара указан тип техники - проверяем его
        if (part.applianceType && part.applianceType !== '' && part.applianceType !== null && part.applianceType !== undefined) {
            const partType = String(part.applianceType).trim().toLowerCase();
            if (partType === selectedType) {
                return true;
            }
        }
        
        // Также ищем по названию товара
        for (const keyword of keywords) {
            if (partName.includes(keyword)) {
                return true;
            }
        }
        
        // Для "другая техника" показываем только те, у которых нет совпадений с другими типами
        if (selectedType === 'другая техника') {
            // Проверяем, не подходит ли товар под другие категории
            const otherCategories = ['варочн', 'панел', 'духов', 'шкаф', 'кофемашин', 'кондиционер', 
                                    'посудомоечн', 'посудомойк', 'стиральн', 'стирк', 'телевизор', 'тв ', ' tv ',
                                    'холодильник', 'морозильник'];
            
            // Если название содержит ключевые слова других категорий - не показываем
            const matchesOtherCategory = otherCategories.some(keyword => partName.includes(keyword));
            
            // Если у товара указан другой тип техники - не показываем
            if (part.applianceType && part.applianceType !== '' && 
                String(part.applianceType).trim().toLowerCase() !== 'другая техника') {
                return false;
            }
            
            // Показываем только если нет совпадений с другими категориями
            return !matchesOtherCategory;
        }
        
        return false;
    });
}

// Обновление отображения результатов поиска
function updateSearchResults(type, filteredCount, totalCount) {
    let emptyDiv, tableElement;
    
    if (type === 'new') {
        emptyDiv = document.getElementById('newPartsEmpty');
        tableElement = document.getElementById('newPartsTable');
    } else if (type === 'used') {
        emptyDiv = document.getElementById('usedPartsEmpty');
        tableElement = document.getElementById('usedPartsTable');
    } else if (type === 'appliances') {
        emptyDiv = document.getElementById('appliancesEmpty');
        tableElement = document.getElementById('appliancesTable');
    }
    
    if (filteredCount === 0) {
        tableElement.style.display = 'none';
        emptyDiv.style.display = 'block';
        
        // Меняем сообщение в зависимости от ситуации
        if (totalCount === 0) {
            emptyDiv.innerHTML = '<p>📦 Пока нет запчастей в этом разделе</p>';
        } else {
            emptyDiv.innerHTML = '<p>🔍 Ничего не найдено по вашему запросу</p>';
        }
    } else {
        tableElement.style.display = 'table';
        emptyDiv.style.display = 'none';
    }
}

// Очистка поиска
function clearSearch(type) {
    if (type === 'new') {
        document.getElementById('searchNew').value = '';
        // Применить фильтры, если они выбраны
        const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
        if (selectedRadio) {
            let filtered = applyApplianceTypeFilters(newParts);
            renderPartsTable('new', filtered, 'newPartsBody');
            updateSearchResults('new', filtered.length, newParts.length);
        } else {
            renderPartsTable('new', newParts, 'newPartsBody');
            updateSearchResults('new', newParts.length, newParts.length);
        }
    } else if (type === 'used') {
        document.getElementById('searchUsed').value = '';
        // Применить фильтры, если выбраны
        const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
        if (selectedRadio) {
            let filtered = applyApplianceTypeFilters(usedParts);
            renderPartsTable('used', filtered, 'usedPartsBody');
            updateSearchResults('used', filtered.length, usedParts.length);
        } else {
            renderPartsTable('used', usedParts, 'usedPartsBody');
            updateSearchResults('used', usedParts.length, usedParts.length);
        }
    } else if (type === 'appliances') {
        document.getElementById('searchAppliances').value = '';
        // Очистить фильтры техники
        const selectedRadio = document.querySelector('.appliance-filters input[type="radio"]:checked');
        if (selectedRadio) {
            selectedRadio.checked = false;
        }
        const clearBtn = document.getElementById('clearFilterBtn');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        renderPartsTable('appliances', appliances, 'appliancesBody');
        updateSearchResults('appliances', appliances.length, appliances.length);
    }
    updateEmptyMessages();
}

// Открыть страницу с деталями товара
function openItemDetail(itemId, itemType) {
    window.location.href = `item-detail.html?id=${itemId}&type=${itemType}&return=index.html`;
}

// Открыть страницу редактирования товара
function openItemEdit(itemId, itemType) {
    window.location.href = `edit-item.html?id=${itemId}&type=${itemType}&return=index.html`;
}

// Добавление CSS анимаций
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

