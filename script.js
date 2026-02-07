// Счетчик желания запуска проекта
const WISH_STORAGE_KEY = 'reminko_wish_clicked';
const WISH_COUNT_KEY = 'reminko_wish_count';

// Счетчики соцсетей
const SOCIAL_STORAGE_PREFIX = 'reminko_social_clicked_';
const SOCIAL_COUNT_PREFIX = 'reminko_social_count_';

// Получить уникальный идентификатор устройства/браузера
// Каждое устройство получает уникальный fingerprint, который сохраняется в Supabase
// Это позволяет каждому пользователю голосовать только один раз с одного устройства
function getUserFingerprint() {
    let fingerprint = localStorage.getItem('reminko_fingerprint');
    if (!fingerprint) {
        // Создаем уникальный идентификатор на основе различных параметров браузера и устройства
        // Это гарантирует, что каждый пользователь с устройства может голосовать только один раз
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Fingerprint', 2, 2);
        
        fingerprint = btoa(
            navigator.userAgent +
            navigator.language +
            screen.width + 'x' + screen.height +
            new Date().getTimezoneOffset() +
            canvas.toDataURL()
        ).substring(0, 32);
        
        localStorage.setItem('reminko_fingerprint', fingerprint);
    }
    return fingerprint;
}

// Получить Supabase клиент
function getSupabaseClient() {
    // Проверяем глобальный клиент
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
        return window.supabaseClient;
    }
    
    // Fallback: инициализация если еще не загружен
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        const SUPABASE_URL = 'https://wafktbtftohicolecxcc.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_MwdTBz9gf5k0TeAl9paAbA_eE5Agynj';
        try {
            window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return window.supabaseClient;
        } catch (error) {
            console.error('Ошибка создания Supabase клиента:', error);
            return null;
        }
    }
    
    // Если Supabase еще не загружен, возвращаем null
    return null;
}

// Загрузить счетчик из Supabase
async function loadCounterFromSupabase(counterType) {
    const client = getSupabaseClient();
    if (!client) {
        // Fallback на localStorage если Supabase недоступен
        const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
        return parseFloat(localStorage.getItem(localKey) || '0');
    }
    
    try {
        const { data, error } = await client
            .from('startzero_counters')
            .select('count')
            .eq('counter_type', counterType)
            .maybeSingle();
        
        if (error || !data) {
            // Fallback на localStorage
            const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
            return parseFloat(localStorage.getItem(localKey) || '0');
        }
        
        const count = data?.count || 0;
        return count;
    } catch (error) {
        console.error('Ошибка загрузки счетчика:', error);
        // Fallback на localStorage
        const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
        return parseFloat(localStorage.getItem(localKey) || '0');
    }
}

// Установить начальные значения счетчиков
async function initializeCounters() {
    const initialValues = {
        wish: 132843,
        telegram: 32342,
        instagram: 16324,
        tiktok: 20163
    };
    
    const client = getSupabaseClient();
    if (!client) {
        // Fallback на localStorage - устанавливаем начальные значения если их нет
        Object.keys(initialValues).forEach(key => {
            const localKey = key === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + key;
            const currentValue = parseFloat(localStorage.getItem(localKey) || '0');
            // Устанавливаем начальное значение если текущее меньше начального
            if (currentValue < initialValues[key]) {
                localStorage.setItem(localKey, initialValues[key].toString());
            }
        });
        return;
    }
    
    try {
        // Используем upsert для установки начальных значений
        // Устанавливаем начальные значения если счетчик меньше начального или равен 0
        for (const [counterType, initialCount] of Object.entries(initialValues)) {
            const { data: existing } = await client
                .from('startzero_counters')
                .select('count')
                .eq('counter_type', counterType)
                .maybeSingle();
            
            // Устанавливаем начальное значение если записи нет или счетчик меньше начального
            if (!existing || existing.count < initialCount) {
                await client
                    .from('startzero_counters')
                    .upsert({ 
                        counter_type: counterType,
                        count: initialCount, 
                        updated_at: new Date().toISOString() 
                    }, {
                        onConflict: 'counter_type'
                    });
            }
        }
    } catch (error) {
        console.error('Ошибка инициализации счетчиков:', error);
        // Fallback на localStorage при ошибке
        Object.keys(initialValues).forEach(key => {
            const localKey = key === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + key;
            const currentValue = parseFloat(localStorage.getItem(localKey) || '0');
            if (currentValue < initialValues[key]) {
                localStorage.setItem(localKey, initialValues[key].toString());
            }
        });
    }
}

// Увеличить счетчик в Supabase
async function incrementCounterInSupabase(counterType) {
    const client = getSupabaseClient();
    if (!client) {
        // Fallback на localStorage
        const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
        const currentCount = parseFloat(localStorage.getItem(localKey) || '0');
        const newCount = currentCount + 1;
        localStorage.setItem(localKey, newCount.toString());
        return newCount;
    }
    
    try {
        // Получаем текущее значение
        const { data: currentData, error: fetchError } = await client
            .from('startzero_counters')
            .select('count')
            .eq('counter_type', counterType)
            .maybeSingle();
        
        const currentCount = currentData?.count || 0;
        const newCount = currentCount + 1;
        
        // Используем upsert для создания или обновления записи
        const { error: upsertError } = await client
            .from('startzero_counters')
            .upsert({ 
                counter_type: counterType,
                count: newCount, 
                updated_at: new Date().toISOString() 
            }, {
                onConflict: 'counter_type'
            });
        
        if (upsertError) {
            console.error('Ошибка обновления счетчика:', upsertError);
            // Fallback на localStorage
            const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
            localStorage.setItem(localKey, newCount.toString());
        }
        
        return newCount;
    } catch (error) {
        console.error('Ошибка при увеличении счетчика:', error);
        // Fallback на localStorage
        const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
        const currentCount = parseFloat(localStorage.getItem(localKey) || '0');
        const newCount = currentCount + 1;
        localStorage.setItem(localKey, newCount.toString());
        return newCount;
    }
}

// Проверить, нажимал ли пользователь уже на кнопку (всегда проверяем онлайн в Supabase)
async function hasUserClicked(counterType) {
    const localKey = counterType === 'wish' ? WISH_STORAGE_KEY : SOCIAL_STORAGE_PREFIX + counterType;
    
    const client = getSupabaseClient();
    if (!client) {
        // Если Supabase недоступен, используем только localStorage
        return localStorage.getItem(localKey) === 'true';
    }
    
    try {
        const fingerprint = getUserFingerprint();
        
        // ВСЕГДА проверяем в Supabase для реальной онлайн проверки
        const { data, error } = await client
            .from('startzero_user_clicks')
            .select('id')
            .eq('user_fingerprint', fingerprint)
            .eq('counter_type', counterType)
            .maybeSingle();
        
        const hasClicked = !!data;
        
        // Обновляем localStorage на основе реальных данных из Supabase
        if (hasClicked) {
            localStorage.setItem(localKey, 'true');
        } else {
            // Если в Supabase нет записи, но в localStorage есть - очищаем localStorage
            // Это предотвращает обход ограничений через очистку кеша
            if (localStorage.getItem(localKey) === 'true') {
                localStorage.removeItem(localKey);
            }
        }
        
        return hasClicked;
    } catch (error) {
        console.error('Ошибка проверки клика:', error);
        // При ошибке используем localStorage как fallback
        return localStorage.getItem(localKey) === 'true';
    }
}

// Сохранить информацию о клике пользователя (сначала в Supabase, потом в localStorage)
async function saveUserClick(counterType) {
    const localKey = counterType === 'wish' ? WISH_STORAGE_KEY : SOCIAL_STORAGE_PREFIX + counterType;
    
    const client = getSupabaseClient();
    if (!client) {
        // Если Supabase недоступен, сохраняем только в localStorage
        localStorage.setItem(localKey, 'true');
        return;
    }
    
    try {
        const fingerprint = getUserFingerprint();
        
        // Сначала проверяем, не голосовал ли уже пользователь
        const { data: existing } = await client
            .from('startzero_user_clicks')
            .select('id')
            .eq('user_fingerprint', fingerprint)
            .eq('counter_type', counterType)
            .maybeSingle();
        
        // Если уже есть запись, не создаем дубликат
        if (existing) {
            localStorage.setItem(localKey, 'true');
            return;
        }
        
        // Сохраняем в Supabase (реальная онлайн база данных)
        const { error } = await client
            .from('startzero_user_clicks')
            .insert({
                user_fingerprint: fingerprint,
                counter_type: counterType,
                clicked_at: new Date().toISOString()
            });
        
        if (error) {
            console.error('Ошибка сохранения клика:', error);
            // Если ошибка уникальности (уже существует), это нормально
            if (error.code !== '23505') {
                throw error;
            }
        }
        
        // Только после успешного сохранения в Supabase сохраняем в localStorage
        localStorage.setItem(localKey, 'true');
    } catch (error) {
        console.error('Ошибка при сохранении клика:', error);
        // При ошибке все равно сохраняем в localStorage как fallback
        localStorage.setItem(localKey, 'true');
    }
}

// Прокрутка в начало страницы
function scrollToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) {
        document.documentElement.scrollTop = 0;
    }
    if (document.body) {
        document.body.scrollTop = 0;
    }
    // Дополнительные методы для разных браузеров
    if (window.pageYOffset !== undefined) {
        window.pageYOffset = 0;
    }
}

// Прокрутка в начало при обновлении страницы
window.addEventListener('beforeunload', () => {
    scrollToTop();
});

// Прокрутка в начало сразу при загрузке скрипта
scrollToTop();

// АБСОЛЮТНЫЙ запрет контекстного меню, выделения и взаимодействия с изображениями и видео
(function() {
    'use strict';
    
    // Функция проверки является ли элемент изображением или видео
    function isMediaElement(element) {
        if (!element || !element.classList) return false;
        const tagName = element.tagName;
        return tagName === 'IMG' || tagName === 'VIDEO' || 
               element.classList.contains('feature-icon-image') ||
               element.classList.contains('ai-avatar') ||
               element.classList.contains('site-logo') ||
               (element.closest && element.closest('.feature-icon')) ||
               (element.closest && element.closest('.ai-avatar-section')) ||
               (element.closest && element.closest('.logo-section'));
    }
    
    // Запрещаем контекстное меню (правый клик / долгое нажатие)
    const preventContextMenu = (e) => {
        if (isMediaElement(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
    };
    
    // Запрещаем выделение текста/элементов
    const preventSelection = (e) => {
        if (isMediaElement(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    };
    
    // Запрещаем перетаскивание
    const preventDrag = (e) => {
        if (isMediaElement(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'none';
            e.dataTransfer.dropEffect = 'none';
            return false;
        }
    };
    
    // Запрещаем копирование
    const preventCopy = (e) => {
        if (isMediaElement(e.target) || isMediaElement(document.activeElement)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    };
    
    // Запрещаем сохранение изображения
    const preventSave = (e) => {
        if (isMediaElement(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    };
    
    // Обработка touch событий для мобильных устройств
    let touchStartTime = 0;
    const preventLongPress = (e) => {
        if (isMediaElement(e.target)) {
            touchStartTime = Date.now();
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    };
    
    const preventTouchMove = (e) => {
        if (isMediaElement(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    };
    
    const preventTouchEnd = (e) => {
        if (isMediaElement(e.target)) {
            const touchDuration = Date.now() - touchStartTime;
            // Если нажатие было долгим (более 300мс), предотвращаем действие
            if (touchDuration > 300) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
    };
    
    // Устанавливаем обработчики сразу при загрузке скрипта
    document.addEventListener('contextmenu', preventContextMenu, { capture: true, passive: false });
    document.addEventListener('selectstart', preventSelection, { capture: true, passive: false });
    document.addEventListener('dragstart', preventDrag, { capture: true, passive: false });
    document.addEventListener('drag', preventDrag, { capture: true, passive: false });
    document.addEventListener('copy', preventCopy, { capture: true, passive: false });
    document.addEventListener('cut', preventCopy, { capture: true, passive: false });
    document.addEventListener('touchstart', preventLongPress, { capture: true, passive: false });
    document.addEventListener('touchmove', preventTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', preventTouchEnd, { capture: true, passive: false });
    document.addEventListener('touchcancel', preventTouchEnd, { capture: true, passive: false });
    
    // Дополнительная защита при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Применяем стили через JavaScript для дополнительной защиты
            const mediaElements = document.querySelectorAll('img, video');
            mediaElements.forEach(el => {
                el.setAttribute('draggable', 'false');
                el.style.userSelect = 'none';
                el.style.webkitUserSelect = 'none';
                el.style.mozUserSelect = 'none';
                el.style.msUserSelect = 'none';
                el.style.webkitTouchCallout = 'none';
                el.style.touchAction = 'none';
                el.style.pointerEvents = 'auto';
                
                // Блокируем события напрямую на элементах
                el.addEventListener('contextmenu', preventContextMenu, true);
                el.addEventListener('selectstart', preventSelection, true);
                el.addEventListener('dragstart', preventDrag, true);
                el.addEventListener('copy', preventCopy, true);
                el.addEventListener('touchstart', preventLongPress, { passive: false });
                el.addEventListener('touchmove', preventTouchMove, { passive: false });
            });
        });
    } else {
        // DOM уже загружен
        const mediaElements = document.querySelectorAll('img, video');
        mediaElements.forEach(el => {
            el.setAttribute('draggable', 'false');
            el.style.userSelect = 'none';
            el.style.webkitUserSelect = 'none';
            el.style.webkitTouchCallout = 'none';
            el.style.touchAction = 'none';
        });
    }
    
    // Защита от изменения через DevTools (базовая)
    Object.defineProperty(HTMLImageElement.prototype, 'draggable', {
        get: function() { return false; },
        set: function() { return false; },
        configurable: false
    });
})();

// Инициализация счетчиков
document.addEventListener('DOMContentLoaded', async () => {
    // Прокручиваем страницу в начало сразу
    scrollToTop();
    
    // Показываем загрузочный экран при загрузке страницы
    showLoadingScreen();
    
    // Ждем немного для загрузки Supabase
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Инициализируем начальные значения счетчиков
    await initializeCounters();
    
    // Скрываем загрузочный экран сразу после загрузки DOM
    // Используем requestAnimationFrame для гарантии что DOM готов
    requestAnimationFrame(() => {
        setTimeout(() => {
            hideLoadingScreen();
            // Еще раз прокручиваем после скрытия загрузки
            scrollToTop();
        }, 500); // Минимальная задержка для плавности
    });
    
    // Загружаем счетчики из Supabase
    await loadWishCount();
    await checkUserWishStatus();
    await loadSocialCounts();
});

// Прокрутка в начало при полной загрузке
window.addEventListener('load', () => {
    scrollToTop();
    
    // Дополнительная проверка через небольшую задержку
    setTimeout(() => {
        scrollToTop();
    }, 100);
    
    setTimeout(() => {
        scrollToTop();
    }, 300);
});

// Показать загрузочный экран
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        loadingScreen.classList.remove('hidden');
        loadingScreen.style.opacity = '1';
        // Перезапускаем видео если оно уже загружено
        const video = loadingScreen.querySelector('.loading-video');
        if (video) {
            video.currentTime = 0;
            video.play().catch(() => {
                // Игнорируем ошибки автовоспроизведения
            });
        }
    }
}

// Скрыть загрузочный экран
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        // Останавливаем видео сразу
        const video = loadingScreen.querySelector('.loading-video');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
        
        // Скрываем экран быстро
        loadingScreen.style.opacity = '0';
        loadingScreen.classList.add('hidden');
        
        // Полностью удаляем через короткое время
        setTimeout(() => {
            if (loadingScreen && loadingScreen.parentNode) {
                loadingScreen.style.display = 'none';
                loadingScreen.style.zIndex = '-1';
                loadingScreen.style.visibility = 'hidden';
            }
        }, 300);
    }
}

// Загрузить количество желаний
async function loadWishCount() {
    const count = await loadCounterFromSupabase('wish');
    const wishCountElement = document.getElementById('wishCount');
    if (wishCountElement) {
        animateNumber(wishCountElement, 0, count, 1000);
    }
}

// Проверить статус пользователя
async function checkUserWishStatus() {
    const hasClicked = await hasUserClicked('wish');
    const wishBtn = document.getElementById('wishBtn');
    const wishNote = document.getElementById('wishNote');
    
    if (hasClicked && wishBtn) {
        wishBtn.disabled = true;
        wishBtn.classList.add('clicked');
        wishBtn.innerHTML = '<span class="wish-btn-text">Спасибо за поддержку!</span><span class="wish-btn-emoji">💜</span>';
        
        if (wishNote) {
            wishNote.textContent = 'Ты уже поддержал(а) нас! Спасибо! 💜';
            wishNote.style.display = 'block';
        }
    }
}

// Обработка нажатия на кнопку
async function handleWishClick() {
    try {
        const wishBtn = document.getElementById('wishBtn');
        
        // Блокируем повторные клики
        if (wishBtn && wishBtn.disabled) {
            return;
        }
        
        // ВАЖНО: Проверяем онлайн в Supabase, чтобы каждый пользователь мог голосовать только один раз
        const hasClicked = await hasUserClicked('wish');
        
        if (hasClicked) {
            // Пользователь уже голосовал - показываем сообщение
            const wishNote = document.getElementById('wishNote');
            if (wishNote) {
                wishNote.textContent = 'Ты уже поддержал(а) нас! Спасибо! 💜';
                wishNote.style.display = 'block';
            }
            return; // Уже нажато
        }
        
        // Временно блокируем кнопку для предотвращения повторных кликов
        if (wishBtn) {
            wishBtn.disabled = true;
        }
        
        // Сначала сохраняем информацию о клике в Supabase (реальная онлайн база)
        await saveUserClick('wish');
        
        // Увеличиваем счетчик в Supabase (реальный онлайн счетчик)
        const currentCount = await loadCounterFromSupabase('wish');
        const newCount = await incrementCounterInSupabase('wish');
        
        // Обновляем UI
        const wishCountElement = document.getElementById('wishCount');
        const wishNote = document.getElementById('wishNote');
        
        if (wishCountElement) {
            animateNumber(wishCountElement, currentCount, newCount, 500);
        }
        
        if (wishBtn) {
            wishBtn.classList.add('clicked');
            wishBtn.innerHTML = '<span class="wish-btn-text">Спасибо за поддержку!</span><span class="wish-btn-emoji">💜</span>';
            
            // Анимация успеха
            wishBtn.style.transform = 'scale(1.1)';
            setTimeout(() => {
                wishBtn.style.transform = 'scale(1)';
            }, 200);
        }
        
        if (wishNote) {
            wishNote.textContent = 'Ты уже поддержал(а) нас! Спасибо! 💜';
            wishNote.style.display = 'block';
            wishNote.style.opacity = '0';
            wishNote.style.animation = 'fadeIn 0.5s ease-out forwards';
        }
        
        // Показываем уведомление
        showWishNotification();
    } catch (error) {
        console.error('Ошибка при обработке клика:', error);
        // Разблокируем кнопку в случае ошибки
        const wishBtn = document.getElementById('wishBtn');
        if (wishBtn) {
            wishBtn.disabled = false;
        }
    }
}

// Форматирование числа с точками для разделения тысяч
function formatNumber(num) {
    // Если число меньше 1000, просто возвращаем его
    if (num < 1000) {
        return Math.floor(num).toString();
    }
    
    // Разбиваем число на части
    const parts = num.toString().split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    
    // Форматируем целую часть с точками для разделения тысяч
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Если есть дробная часть, добавляем её
    if (decimalPart) {
        return formattedInteger + ',' + decimalPart;
    }
    
    return formattedInteger;
}

// Анимация числа
function animateNumber(element, from, to, duration) {
    const startTime = performance.now();
    const difference = to - from;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing функция для плавной анимации
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = from + difference * easeOutQuart;
        
        element.textContent = formatNumber(current);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = formatNumber(to);
        }
    }
    
    requestAnimationFrame(update);
}

// Показать уведомление
function showWishNotification() {
    const notification = document.createElement('div');
    notification.className = 'wish-notification';
    notification.innerHTML = '✨ Спасибо за поддержку! Твоё желание учтено! 💜';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Загрузить счетчики соцсетей
async function loadSocialCounts() {
    const socials = ['telegram', 'instagram', 'tiktok'];
    
    for (const social of socials) {
        const count = await loadCounterFromSupabase(social);
        const countElement = document.getElementById(social + 'Count');
        if (countElement) {
            animateNumber(countElement, 0, count, 800);
        }
    }
}

// Обработка нажатия на кнопку соцсети
async function handleSocialClick(event, socialName) {
    try {
        event.preventDefault();
        event.stopPropagation();
        
        // ВАЖНО: Проверяем онлайн в Supabase, чтобы каждый пользователь мог голосовать только один раз
        const hasClicked = await hasUserClicked(socialName);
        
        if (!hasClicked) {
            // Сначала сохраняем информацию о клике в Supabase (реальная онлайн база)
            await saveUserClick(socialName);
            
            // Увеличиваем счетчик в Supabase (реальный онлайн счетчик)
            const currentCount = await loadCounterFromSupabase(socialName);
            const newCount = await incrementCounterInSupabase(socialName);
            
            // Обновляем UI
            const countElement = document.getElementById(socialName + 'Count');
            if (countElement) {
                animateNumber(countElement, currentCount, newCount, 500);
            }
            
            // Показываем уведомление
            showSocialNotification(socialName);
        }
        
        // Получаем URL из ссылки
        let url = null;
        const linkElement = event.currentTarget || event.target.closest('a');
        
        if (linkElement && linkElement.href) {
            url = linkElement.href;
        } else {
            // Fallback: получаем URL из data-атрибута или по типу соцсети
            const socialUrls = {
                telegram: 'https://t.me/re_minko_anime',
                instagram: 'https://www.instagram.com/re.minko?utm_source=qr&igsh=ZG1xMmN0YWVrNW96',
                tiktok: 'https://www.tiktok.com/@re.minko?_r=1&_t=ZN-93f3tJJ2cdC'
            };
            url = socialUrls[socialName] || '#';
        }
        
        if (!url || url === '#') {
            return; // Не можем перейти без URL
        }
        
        // Показываем загрузочный экран
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';
            loadingScreen.classList.remove('hidden');
            loadingScreen.style.zIndex = '10000';
            loadingScreen.style.visibility = 'visible';
            
            // Перезапускаем видео
            const video = loadingScreen.querySelector('.loading-video');
            if (video) {
                video.currentTime = 0;
                video.play().catch(() => {
                    // Игнорируем ошибки автовоспроизведения
                });
            }
        }
        
        // Переходим на ссылку через 3 секунды
        setTimeout(() => {
            if (url && url !== '#') {
                window.open(url, '_blank');
            }
            // Скрываем загрузочный экран через небольшую задержку
            setTimeout(() => {
                hideLoadingScreen();
            }, 500);
        }, 3000);
    } catch (error) {
        console.error('Ошибка при обработке клика соцсети:', error);
    }
}

// Показать уведомление для соцсети
function showSocialNotification(socialName) {
    const socialNames = {
        telegram: 'Telegram',
        instagram: 'Instagram',
        tiktok: 'TikTok'
    };
    
    const notification = document.createElement('div');
    notification.className = 'wish-notification social-notification';
    notification.innerHTML = `✨ Спасибо! Твой голос за ${socialNames[socialName]} учтён! 💜`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Явно экспортируем функции в глобальную область видимости для доступа из HTML
window.handleWishClick = handleWishClick;
window.handleSocialClick = handleSocialClick;
