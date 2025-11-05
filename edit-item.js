// Глобальные переменные
let currentItem = null;
let itemType = null;
let itemId = null;
let currentUser = null;
let returnUrl = 'index.html';
let newImageData = []; // Массив для новых изображений
let cameraStream = null;

// Получить параметры из URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    itemId = parseInt(params.get('id'));
    itemType = params.get('type');
    returnUrl = params.get('return') || 'index.html';
}

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

// Загрузить данные товара
function loadItemData() {
    if (!itemId || !itemType) {
        showError('Ошибка: не указан товар для редактирования');
        setTimeout(() => goBack(), 2000);
        return;
    }

    // Получить все товары из localStorage
    let items = [];
    if (itemType === 'new') {
        items = JSON.parse(localStorage.getItem('newParts') || '[]');
    } else if (itemType === 'used') {
        items = JSON.parse(localStorage.getItem('usedParts') || '[]');
    } else if (itemType === 'appliances') {
        items = JSON.parse(localStorage.getItem('appliances') || '[]');
    }

    // Найти нужный товар
    currentItem = items.find(item => item.id === itemId);

    if (!currentItem) {
        showError('Товар не найден');
        setTimeout(() => goBack(), 2000);
        return;
    }

    // Проверка прав доступа
    if (!currentUser.isAdmin && currentItem.userId !== currentUser.userId) {
        showError('❌ У вас нет прав для редактирования этого объявления');
        setTimeout(() => goBack(), 2000);
        return;
    }

    // Заполнить форму текущими данными
    fillForm();
}

// Заполнить форму данными
function fillForm() {
    document.getElementById('itemName').value = currentItem.name;
    document.getElementById('itemQuantity').value = currentItem.quantity;
    document.getElementById('itemPrice').value = currentItem.price;
    // Заполнить контакт (приоритет телефону, если его нет - берем email)
    const contactValue = currentItem.phone || currentItem.email || '';
    document.getElementById('itemPhone').value = contactValue;
    document.getElementById('itemDescription').value = currentItem.description || '';
    document.getElementById('itemCharacteristics').value = currentItem.characteristics || '';

    // Заполнить категорию техники, если она есть
    // Если у старого объявления нет категории, оставляем пустым (пользователь должен выбрать)
    const applianceTypeSelect = document.getElementById('itemApplianceType');
    if (currentItem.applianceType && currentItem.applianceType !== '') {
        applianceTypeSelect.value = currentItem.applianceType;
    } else {
        // Если категория не указана, оставляем поле пустым
        applianceTypeSelect.value = '';
    }

    // Показать текущие изображения
    const imageContainer = document.getElementById('currentImageContainer');
    const images = currentItem.images && Array.isArray(currentItem.images) && currentItem.images.length > 0 
        ? currentItem.images 
        : (currentItem.image ? [currentItem.image] : []);
    
    if (images.length > 0) {
        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">';
        images.forEach((imgSrc, index) => {
            html += `<img src="${imgSrc}" class="current-image-preview" alt="Фото ${index + 1}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;">`;
        });
        html += '</div>';
        imageContainer.innerHTML = html;
    } else {
        imageContainer.innerHTML = '<span class="no-image-text">Изображение не загружено</span>';
    }
}

// Переключить видимость секции загрузки изображения
function toggleImageUpload() {
    const checkbox = document.getElementById('changeImageCheckbox');
    const uploadSection = document.getElementById('imageUploadSection');
    
    if (checkbox.checked) {
        uploadSection.style.display = 'block';
    } else {
        uploadSection.style.display = 'none';
        // Сбросить новые изображения
        newImageData = [];
        document.getElementById('newImagePreview').style.display = 'none';
        document.getElementById('newImage').value = '';
    }
}

// Обработка загрузки изображения (несколько файлов)
async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Обрабатываем каждый файл с компрессией
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.match('image.*')) continue;
        try {
            const compressed = await compressImageFile(file, 1280, 1280, 0.7);
            newImageData.push(compressed);
        } catch (e) {
            console.warn('Не удалось сжать изображение, добавляю оригинал', e);
            const fallback = await readFileAsDataURL(file);
            newImageData.push(fallback);
        }
    }
    updateNewImagesPreview();
}

// Обновление превью новых изображений
function updateNewImagesPreview() {
    const previewContainer = document.getElementById('newImagesGrid');
    const previewSection = document.getElementById('newImagePreview');
    
    if (newImageData.length === 0) {
        previewSection.style.display = 'none';
        return;
    }
    
    let html = '';
    newImageData.forEach((imageData, index) => {
        html += `
            <div style="position: relative; border-radius: 8px; overflow: hidden; border: 2px solid #e1e8ed;">
                <img src="${imageData}" alt="Превью ${index + 1}" style="width: 100%; height: 150px; object-fit: cover; display: block;">
                <button type="button" onclick="removeNewImage(${index})" style="position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.8); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 14px;">✕</button>
            </div>
        `;
    });
    
    previewContainer.innerHTML = html;
    previewSection.style.display = 'block';
}

// Удалить конкретное новое изображение
function removeNewImage(index) {
    newImageData.splice(index, 1);
    updateNewImagesPreview();
    if (newImageData.length === 0) {
        document.getElementById('newImage').value = '';
    }
}

// Удалить все новые изображения
function removeAllNewImages() {
    newImageData = [];
    document.getElementById('newImagePreview').style.display = 'none';
    document.getElementById('newImage').value = '';
}

// Проверка мобильного устройства
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Открыть камеру для редактирования
function openCameraForEdit() {
    if (isMobileDevice()) {
        // На мобильных устройствах использовать нативную камеру
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = handleImageUpload;
        input.click();
    } else {
        // На десктопе открыть веб-камеру
        openCameraModal();
    }
}

// Открыть модальное окно камеры
function openCameraModal() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    const errorDiv = document.getElementById('cameraError');

    modal.style.display = 'flex';
    errorDiv.style.display = 'none';

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            cameraStream = stream;
            video.srcObject = stream;
        })
        .catch(err => {
            console.error('Ошибка доступа к камере:', err);
            errorDiv.textContent = 'Не удалось получить доступ к камере. Проверьте разрешения.';
            errorDiv.style.display = 'block';
        });
}

// Закрыть модальное окно камеры
function closeCameraModal() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    video.srcObject = null;
    modal.style.display = 'none';
}

// Сделать фото с камеры
function capturePhotoForEdit() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const { targetW, targetH } = getScaledSize(srcW, srcH, 1280, 1280);

    canvas.width = targetW;
    canvas.height = targetH;
    context.drawImage(video, 0, 0, targetW, targetH);

    const imageData = canvas.toDataURL('image/jpeg', 0.7);
    newImageData.push(imageData);

    // Обновить превью
    updateNewImagesPreview();

    closeCameraModal();
}

// Общие вспомогательные функции сжатия (дублируем тут для автономности страницы редактирования)
function getScaledSize(srcW, srcH, maxW, maxH) {
    let targetW = srcW;
    let targetH = srcH;
    const ratio = Math.min(maxW / srcW, maxH / srcH, 1);
    targetW = Math.round(srcW * ratio);
    targetH = Math.round(srcH * ratio);
    return { targetW, targetH };
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function compressImageFile(file, maxW, maxH, quality) {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);
    const { targetW, targetH } = getScaledSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxW, maxH);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', quality);
}

// Обработка отправки формы
function handleSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('itemName').value.trim();
    const quantity = parseInt(document.getElementById('itemQuantity').value);
    const price = parseFloat(document.getElementById('itemPrice').value);
    const contact = document.getElementById('itemPhone').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    const characteristics = document.getElementById('itemCharacteristics').value.trim();
    const applianceType = document.getElementById('itemApplianceType').value.trim();

    // Валидация
    if (!name || quantity < 0 || price < 0) {
        showError('Пожалуйста, заполните все обязательные поля корректно');
        return;
    }
    
    // Проверка выбора категории техники
    if (!applianceType) {
        showError('Пожалуйста, выберите категорию техники!');
        document.getElementById('itemApplianceType').focus();
        return;
    }

    // Обновить данные товара
    currentItem.name = name;
    currentItem.quantity = quantity;
    currentItem.price = price;
    
    // Определить тип контакта и сохранить в соответствующем поле
    if (contact) {
        if (contact.includes('@')) {
            // Это email
            currentItem.email = contact;
            // Сохраняем телефон из профиля, если он был
            if (!currentItem.phone) {
                const users = JSON.parse(localStorage.getItem('users') || '[]');
                const currentUserData = users.find(u => u.id === currentUser.userId);
                currentItem.phone = currentUserData ? currentUserData.phone : '';
            }
        } else {
            // Это телефон
            currentItem.phone = contact;
            // Сохраняем email из профиля, если он был
            if (!currentItem.email) {
                const users = JSON.parse(localStorage.getItem('users') || '[]');
                const currentUserData = users.find(u => u.id === currentUser.userId);
                currentItem.email = currentUserData ? currentUserData.email : '';
            }
        }
    }
    
    currentItem.description = description;
    currentItem.characteristics = characteristics;
    currentItem.applianceType = applianceType;

    // Обновить изображения, если были изменены
    if (document.getElementById('changeImageCheckbox').checked && newImageData.length > 0) {
        // Получаем текущие изображения (поддержка старого и нового формата)
        const currentImages = currentItem.images && Array.isArray(currentItem.images) && currentItem.images.length > 0 
            ? currentItem.images 
            : (currentItem.image ? [currentItem.image] : []);
        
        // Объединяем старые и новые изображения
        currentItem.images = [...currentImages, ...newImageData];
        
        // Удаляем старое поле image для совместимости с новым форматом
        delete currentItem.image;
    }

    // Сохранить в localStorage
    let items = [];
    if (itemType === 'new') {
        items = JSON.parse(localStorage.getItem('newParts') || '[]');
        const index = items.findIndex(item => item.id === itemId);
        if (index !== -1) {
            items[index] = currentItem;
            localStorage.setItem('newParts', JSON.stringify(items));
        }
    } else if (itemType === 'used') {
        items = JSON.parse(localStorage.getItem('usedParts') || '[]');
        const index = items.findIndex(item => item.id === itemId);
        if (index !== -1) {
            items[index] = currentItem;
            localStorage.setItem('usedParts', JSON.stringify(items));
        }
    } else if (itemType === 'appliances') {
        items = JSON.parse(localStorage.getItem('appliances') || '[]');
        const index = items.findIndex(item => item.id === itemId);
        if (index !== -1) {
            items[index] = currentItem;
            localStorage.setItem('appliances', JSON.stringify(items));
        }
    }

    showSuccess('✅ Изменения успешно сохранены!');

    // Перенаправить обратно через 1.5 секунды
    setTimeout(() => {
        window.location.href = returnUrl;
    }, 1500);
}

// Показать сообщение об успехе
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

// Показать сообщение об ошибке
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
}

// Вернуться назад
function goBack() {
    window.location.href = returnUrl;
}

// Обработка нажатия Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        if (document.getElementById('cameraModal').style.display === 'flex') {
            closeCameraModal();
        }
    }
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) {
        return;
    }

    getUrlParams();
    loadItemData();
});

