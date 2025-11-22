// Глобальные переменные
let currentItem = null;
let itemType = null;
let itemId = null;
let currentUser = null;
let returnUrl = 'index.html';

// Получить параметры из URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    itemId = parseInt(params.get('id'));
    itemType = params.get('type');
    returnUrl = params.get('return') || 'index.html';
}

// Проверка авторизации (необязательная - для просмотра не требуется)
function checkAuth() {
    const session = localStorage.getItem('currentSession');
    
    if (!session) {
        currentUser = null;
        return false;
    }
    
    try {
        currentUser = JSON.parse(session);
        return true;
    } catch (e) {
        currentUser = null;
        return false;
    }
}

// Загрузить данные товара
function loadItemData() {
    if (!itemId || !itemType) {
        alert('Ошибка: не указан товар для просмотра');
        goBack();
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
        alert('Товар не найден');
        goBack();
        return;
    }

    displayItem();
}

// Отобразить товар
function displayItem() {
    // Название
    document.getElementById('itemName').textContent = currentItem.name;

    // Категория
    const categoryNames = {
        'new': 'Новые запчасти',
        'used': 'Б/У запчасти',
        'appliances': 'Б/У техника'
    };
    document.getElementById('itemCategory').textContent = categoryNames[itemType] || 'Товар';

    // Цена
    document.getElementById('itemPrice').textContent = currentItem.price.toFixed(2) + ' Br';

    // Количество
    const quantityElement = document.getElementById('itemQuantity');
    
    // Для новых запчастей показывать статус наличия гостям и обычным пользователям
    if (itemType === 'new' && (!currentUser || !currentUser.isAdmin)) {
        if (currentItem.quantity > 0) {
            quantityElement.textContent = '✅ Есть в наличии';
            quantityElement.style.color = '#28a745';
        } else {
            quantityElement.textContent = '❌ Нет в наличии';
            quantityElement.style.color = '#dc3545';
        }
    } else {
        // Администратору и для других категорий показывать точное количество
        quantityElement.textContent = currentItem.quantity + ' шт.';
        quantityElement.style.color = '#2c3e50';
    }
    
    // Контакты (только для авторизованных пользователей)
    const contactsSection = document.getElementById('contactsSection');
    if (currentUser && (currentItem.phone || currentItem.email)) {
        const contactsContent = document.getElementById('itemContacts');
        let contactsHTML = '';
        
        if (currentItem.phone) {
            contactsHTML += `<p><strong>📞 Телефон:</strong> <a href="tel:${currentItem.phone}">${currentItem.phone}</a></p>`;
        }
        
        if (currentItem.email) {
            contactsHTML += `<p><strong>✉️ Email:</strong> <a href="mailto:${currentItem.email}">${currentItem.email}</a></p>`;
        }
        
        contactsContent.innerHTML = contactsHTML;
        contactsSection.style.display = 'block';
    } else if (!currentUser) {
        // Для гостей показываем сообщение о необходимости входа
        contactsSection.style.display = 'block';
        contactsSection.innerHTML = `
            <h3 class="detail-section-title section-title">📞 Контакты</h3>
            <div style="padding: 20px; text-align: center; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0;">
                <p style="margin: 0 0 15px 0; color: #666;">Чтобы увидеть контакты продавца, необходимо войти в систему</p>
                <a href="auth.html" class="btn-auth-prompt" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: 500;">🔑 Войти</a>
            </div>
        `;
    } else {
        contactsSection.style.display = 'none';
    }

    // Автор
    document.getElementById('itemAuthor').textContent = currentItem.username || 'Неизвестно';

    // Дата добавления
    if (currentItem.dateAdded) {
        const date = new Date(currentItem.dateAdded);
        document.getElementById('itemDate').textContent = 'Добавлено: ' + date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Изображения (поддержка старого формата и нового с массивом)
    const imageContainer = document.getElementById('imageContainer');
    const images = currentItem.images && Array.isArray(currentItem.images) && currentItem.images.length > 0 
        ? currentItem.images 
        : (currentItem.image ? [currentItem.image] : []);
    
    if (images.length > 0) {
        // Показываем первое изображение большим
        const mainImg = document.createElement('img');
        mainImg.src = images[0];
        mainImg.className = 'detail-main-image';
        mainImg.alt = currentItem.name;
        mainImg.onclick = () => {
            if (images.length === 1) {
                openImageModal(images[0]);
            } else {
                openImagesGallery(images);
            }
        };
        imageContainer.appendChild(mainImg);
        
        // Если изображений больше одного, показываем миниатюры
        if (images.length > 1) {
            const thumbnailsContainer = document.createElement('div');
            thumbnailsContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; justify-content: center;';
            
            images.forEach((imgSrc, index) => {
                const thumb = document.createElement('img');
                thumb.src = imgSrc;
                thumb.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 3px solid transparent; transition: all 0.3s ease;';
                if (index === 0) {
                    thumb.style.borderColor = '#667eea';
                }
                thumb.onclick = () => {
                    // Обновить главное изображение
                    mainImg.src = imgSrc;
                    // Обновить границы миниатюр
                    thumbnailsContainer.querySelectorAll('img').forEach((t, i) => {
                        t.style.borderColor = i === index ? '#667eea' : 'transparent';
                    });
                };
                thumb.onmouseenter = () => {
                    thumb.style.transform = 'scale(1.1)';
                    thumb.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                };
                thumb.onmouseleave = () => {
                    thumb.style.transform = 'scale(1)';
                    thumb.style.boxShadow = 'none';
                };
                thumbnailsContainer.appendChild(thumb);
            });
            
            imageContainer.appendChild(thumbnailsContainer);
            
            // Показываем количество фото
            const photoCount = document.createElement('div');
            photoCount.textContent = `Фото: ${images.length}`;
            photoCount.style.cssText = 'margin-top: 10px; color: #666; font-size: 0.9em;';
            imageContainer.appendChild(photoCount);
        }
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'no-image-placeholder';
        placeholder.textContent = '📦';
        imageContainer.appendChild(placeholder);
    }

    // Описание
    const descSection = document.getElementById('descriptionSection');
    const descText = document.getElementById('itemDescription');
    if (currentItem.description && currentItem.description.trim()) {
        descText.innerHTML = '<div>' + currentItem.description.replace(/\n/g, '<br>') + '</div>';
        descSection.style.display = 'block';
    } else {
        descSection.style.display = 'none';
    }

    // Характеристики
    const charSection = document.getElementById('characteristicsSection');
    const charText = document.getElementById('itemCharacteristics');
    if (currentItem.characteristics && currentItem.characteristics.trim()) {
        charText.innerHTML = '<div>' + currentItem.characteristics.replace(/\n/g, '<br>') + '</div>';
        charSection.style.display = 'block';
    } else {
        charSection.style.display = 'none';
    }

    // Кнопки редактирования и удаления (только для авторизованных: своих товаров или администратора)
    if (currentUser && (currentUser.isAdmin || currentItem.userId === currentUser.userId)) {
        document.getElementById('editBtn').style.display = 'inline-block';
        document.getElementById('deleteBtn').style.display = 'inline-block';
    } else {
        document.getElementById('editBtn').style.display = 'none';
        document.getElementById('deleteBtn').style.display = 'none';
    }

    // Обновить заголовок страницы
    document.title = currentItem.name + ' - Каталог запчастей';
}

// Редактировать товар
function editItem() {
    window.location.href = `edit-item.html?id=${itemId}&type=${itemType}&return=${encodeURIComponent(window.location.href)}`;
}

// Удалить товар
function deleteItem() {
    // Проверка прав
    if (!currentUser.isAdmin && currentItem.userId !== currentUser.userId) {
        alert('❌ У вас нет прав для удаления этого объявления.');
        return;
    }

    const categoryName = itemType === 'appliances' ? 'технику' : 'запчасть';
    if (!confirm(`Вы уверены, что хотите удалить эту ${categoryName}?`)) {
        return;
    }

    // Удалить из localStorage
    if (itemType === 'new') {
        let items = JSON.parse(localStorage.getItem('newParts') || '[]');
        items = items.filter(item => item.id !== itemId);
        localStorage.setItem('newParts', JSON.stringify(items));
    } else if (itemType === 'used') {
        let items = JSON.parse(localStorage.getItem('usedParts') || '[]');
        items = items.filter(item => item.id !== itemId);
        localStorage.setItem('usedParts', JSON.stringify(items));
    } else if (itemType === 'appliances') {
        let items = JSON.parse(localStorage.getItem('appliances') || '[]');
        items = items.filter(item => item.id !== itemId);
        localStorage.setItem('appliances', JSON.stringify(items));
    }

    alert('✅ Объявление успешно удалено!');
    goBack();
}

// Вернуться назад
function goBack() {
    window.location.href = returnUrl;
}

// Открыть изображение в модальном окне
function openImageModal(imageSrc) {
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
        <span class="close-modal">&times;</span>
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

// Закрыть модальное окно
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    // Восстановить оригинальную структуру модального окна
    modal.innerHTML = `
        <span class="close-modal">&times;</span>
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

// Обработка нажатия Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeImageModal();
    }
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    checkAuth(); // Проверка не обязательна, просто обновляем currentUser

    getUrlParams();
    loadItemData();
});

