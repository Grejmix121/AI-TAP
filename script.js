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
        
        // Добавляем больше параметров для уникальности
        const fingerprintData = 
            navigator.userAgent +
            navigator.language +
            navigator.platform +
            screen.width + 'x' + screen.height +
            screen.colorDepth +
            new Date().getTimezoneOffset() +
            navigator.hardwareConcurrency || '0' +
            navigator.deviceMemory || '0' +
            canvas.toDataURL() +
            Math.random().toString(36).substring(2, 15); // Добавляем случайность для уникальности
        
        fingerprint = btoa(fingerprintData).substring(0, 64);
        
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
        // Fallback на localStorage если Supabase недоступен (кроме Telegram)
        if (counterType === 'telegram') {
            return 0; // Для Telegram не используем localStorage
        }
        const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
        return parseFloat(localStorage.getItem(localKey) || '0');
    }
    
    try {
        // Для Telegram всегда получаем свежие данные из Supabase (без кеша)
        // Используем order и limit чтобы получить последнее обновленное значение
        const { data, error } = await client
            .from('startzero_counters')
            .select('count, updated_at')
            .eq('counter_type', counterType)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (error || !data) {
            console.warn(`Счетчик ${counterType} не найден в Supabase`);
            // Для Telegram не используем localStorage fallback
            if (counterType === 'telegram') {
                return 0;
            }
            const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
            return parseFloat(localStorage.getItem(localKey) || '0');
        }
        
        const count = data?.count || 0;
        
        // Для Telegram логируем информацию для отладки
        if (counterType === 'telegram') {
            console.log(`📊 Telegram: ${count.toLocaleString('ru-RU')} подписчиков (обновлено: ${data.updated_at ? new Date(data.updated_at).toLocaleString('ru-RU') : 'N/A'})`);
        }
        
        return count;
    } catch (error) {
        console.error(`Ошибка загрузки счетчика ${counterType}:`, error);
        // Для Telegram не используем localStorage fallback
        if (counterType === 'telegram') {
            return 0;
        }
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
        tiktok: 20163,
        project_progress: Math.round(INITIAL_PROGRESS * 10) // Умножаем на 10 для хранения в Supabase
    };
    
    const client = getSupabaseClient();
    if (!client) {
        // Fallback на localStorage - устанавливаем начальные значения если их нет
        Object.keys(initialValues).forEach(key => {
            if (key === 'project_progress') {
                const currentValue = parseFloat(localStorage.getItem(PROGRESS_STORAGE_KEY) || '0');
                // Для localStorage храним как обычное число (не умноженное на 10)
                if (currentValue < INITIAL_PROGRESS) {
                    localStorage.setItem(PROGRESS_STORAGE_KEY, INITIAL_PROGRESS.toString());
                }
            } else {
                const localKey = key === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + key;
                const currentValue = parseFloat(localStorage.getItem(localKey) || '0');
                // Устанавливаем начальное значение если текущее меньше начального
                if (currentValue < initialValues[key]) {
                    localStorage.setItem(localKey, initialValues[key].toString());
                }
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
            // Для project_progress сравниваем как целые числа
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
            if (key === 'project_progress') {
                const currentValue = parseFloat(localStorage.getItem(PROGRESS_STORAGE_KEY) || '0');
                // Для localStorage храним как обычное число (не умноженное на 10)
                if (currentValue < INITIAL_PROGRESS) {
                    localStorage.setItem(PROGRESS_STORAGE_KEY, INITIAL_PROGRESS.toString());
                }
            } else {
                const localKey = key === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + key;
                const currentValue = parseFloat(localStorage.getItem(localKey) || '0');
                if (currentValue < initialValues[key]) {
                    localStorage.setItem(localKey, initialValues[key].toString());
                }
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
    
    // Ждем инициализации Supabase клиента (максимум 3 секунды)
    let client = getSupabaseClient();
    let attempts = 0;
    while (!client && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        client = getSupabaseClient();
        attempts++;
    }
    
    if (!client) {
        // Если Supabase недоступен после ожидания, очищаем localStorage и возвращаем false
        // Это гарантирует, что новый пользователь не увидит "уже поддержал"
        localStorage.removeItem(localKey);
        return false;
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
        
        if (error) {
            console.error('Ошибка запроса к Supabase:', error);
            // При ошибке очищаем localStorage и возвращаем false
            localStorage.removeItem(localKey);
            return false;
        }
        
        const hasClicked = !!data;
        
        // Обновляем localStorage на основе реальных данных из Supabase
        if (hasClicked) {
            localStorage.setItem(localKey, 'true');
        } else {
            // Если в Supabase нет записи, но в localStorage есть - очищаем localStorage
            // Это предотвращает показ "уже поддержал" новым пользователям
            if (localStorage.getItem(localKey) === 'true') {
                localStorage.removeItem(localKey);
            }
        }
        
        return hasClicked;
    } catch (error) {
        console.error('Ошибка проверки клика:', error);
        // При ошибке очищаем localStorage и возвращаем false
        localStorage.removeItem(localKey);
        return false;
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

// Константы для прогресса проекта
const PROGRESS_STORAGE_KEY = 'reminko_project_progress';
const PROGRESS_LAST_UPDATE_KEY = 'reminko_progress_last_update';
const INITIAL_PROGRESS = 85; // Начальный прогресс в процентах
const DAILY_PROGRESS_INCREASE = 0.3; // Увеличение каждый день в процентах
const TARGET_PROGRESS = 100; // Целевой прогресс в процентах
const UPDATE_HOUR_MSC = 4; // Время обновления
const DAYS_TO_RELEASE = Math.ceil((TARGET_PROGRESS - INITIAL_PROGRESS) / DAILY_PROGRESS_INCREASE); // ~50 дней

// Получить текущий прогресс из Supabase или localStorage
async function getCurrentProgress() {
    const client = getSupabaseClient();
    
    if (client) {
        try {
            const { data, error } = await client
                .from('startzero_counters')
                .select('count')
                .eq('counter_type', 'project_progress')
                .maybeSingle();
            
            if (!error && data) {
                // В Supabase храним как целое число (умноженное на 10 для точности до 0.1%)
                // Например, 85.3% хранится как 853, 85.6% как 856
                return parseFloat(data.count) / 10 || INITIAL_PROGRESS;
            }
        } catch (error) {
            console.error('Ошибка загрузки прогресса:', error);
        }
    }
    
    // Fallback на localStorage
    const storedProgress = localStorage.getItem(PROGRESS_STORAGE_KEY);
    return storedProgress ? parseFloat(storedProgress) : INITIAL_PROGRESS;
}

// Сохранить прогресс в Supabase и localStorage
async function saveProgress(progress) {
    const client = getSupabaseClient();
    
    // Ограничиваем прогресс до 100%
    const clampedProgress = Math.min(progress, TARGET_PROGRESS);
    
    if (client) {
        try {
            // Сохраняем как целое число умноженное на 10 (для точности до 0.1%)
            // Например, 85.3% сохраняется как 853, 85.6% как 856
            await client
                .from('startzero_counters')
                .upsert({
                    counter_type: 'project_progress',
                    count: Math.round(clampedProgress * 10),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'counter_type'
                });
        } catch (error) {
            console.error('Ошибка сохранения прогресса:', error);
        }
    }
    
    // Сохраняем в localStorage как fallback (с точным значением)
    localStorage.setItem(PROGRESS_STORAGE_KEY, clampedProgress.toString());
}

// Получить текущее время в МСК (UTC+3)
function getMoscowTime() {
    const now = new Date();
    const moscowOffset = 3 * 60; // минуты
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const moscowTime = new Date(utcTime + (moscowOffset * 60000));
    return moscowTime;
}

// Получить дату последнего обновления прогресса
function getLastProgressUpdate() {
    const lastUpdate = localStorage.getItem(PROGRESS_LAST_UPDATE_KEY);
    return lastUpdate ? new Date(lastUpdate) : null;
}

// Сохранить дату последнего обновления прогресса
function saveLastProgressUpdate() {
    localStorage.setItem(PROGRESS_LAST_UPDATE_KEY, new Date().toISOString());
}

// Проверить, нужно ли обновить прогресс
function shouldUpdateProgress() {
    const lastUpdate = getLastProgressUpdate();
    
    if (!lastUpdate) {
        // Если никогда не обновляли, проверяем текущее время
        const moscowTime = getMoscowTime();
        const currentHour = moscowTime.getHours();
        return currentHour >= UPDATE_HOUR_MSC;
    }
    
    const moscowTime = getMoscowTime();
    const lastUpdateMSC = new Date(lastUpdate.getTime() + (3 * 60 * 60 * 1000));
    
    const lastUpdateDate = new Date(lastUpdateMSC.getFullYear(), lastUpdateMSC.getMonth(), lastUpdateMSC.getDate());
    const lastUpdateHour = lastUpdateMSC.getHours();
    
    const currentDate = new Date(moscowTime.getFullYear(), moscowTime.getMonth(), moscowTime.getDate());
    const currentHour = moscowTime.getHours();
    
    const daysSinceUpdate = Math.floor((currentDate - lastUpdateDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceUpdate > 0) {
        return true;
    }
    
    if (daysSinceUpdate === 0 && currentHour >= UPDATE_HOUR_MSC && lastUpdateHour < UPDATE_HOUR_MSC) {
        return true;
    }
    
    return false;
}

// Увеличить прогресс на фиксированное значение каждый день
function increaseProgress(currentProgress) {
    // Увеличиваем на фиксированное значение каждый день
    const newProgress = Math.min(currentProgress + DAILY_PROGRESS_INCREASE, TARGET_PROGRESS); // Не больше 100%
    
    return Math.round(newProgress * 10) / 10; // Округляем до 1 знака после запятой
}

// Вычислить дату релиза на основе текущего прогресса
function calculateReleaseDate() {
    const currentProgress = parseFloat(localStorage.getItem(PROGRESS_STORAGE_KEY)) || INITIAL_PROGRESS;
    const remainingProgress = TARGET_PROGRESS - currentProgress;
    const daysRemaining = Math.ceil(remainingProgress / DAILY_PROGRESS_INCREASE);
    
    // Устанавливаем дату релиза
    const moscowTime = getMoscowTime();
    const releaseDate = new Date(moscowTime);
    releaseDate.setDate(releaseDate.getDate() + daysRemaining);
    releaseDate.setHours(UPDATE_HOUR_MSC, 0, 0, 0);
    
    return releaseDate;
}

// Обновить таймер обратного отсчета
function updateCountdownTimer() {
    const releaseDate = calculateReleaseDate();
    const moscowTime = getMoscowTime();
    const timeLeft = releaseDate - moscowTime;
    
    if (timeLeft <= 0) {
        // Если время вышло, показываем что релиз уже состоялся
        const countdownElement = document.getElementById('countdownTimer');
        if (countdownElement) {
            countdownElement.innerHTML = '<span class="countdown-text">🎉 Релиз состоялся! 🎉</span>';
        }
        return;
    }
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    const countdownElement = document.getElementById('countdownTimer');
    if (countdownElement) {
        countdownElement.innerHTML = `
            <div class="countdown-item">
                <span class="countdown-number">${days}</span>
                <span class="countdown-label">дней</span>
            </div>
            <div class="countdown-separator">:</div>
            <div class="countdown-item">
                <span class="countdown-number">${hours.toString().padStart(2, '0')}</span>
                <span class="countdown-label">часов</span>
            </div>
            <div class="countdown-separator">:</div>
            <div class="countdown-item">
                <span class="countdown-number">${minutes.toString().padStart(2, '0')}</span>
                <span class="countdown-label">минут</span>
            </div>
            <div class="countdown-separator">:</div>
            <div class="countdown-item">
                <span class="countdown-number">${seconds.toString().padStart(2, '0')}</span>
                <span class="countdown-label">секунд</span>
            </div>
        `;
    }
}

// Обновить визуальное отображение прогресса
function updateProgressDisplay(progress) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill) {
        progressFill.style.width = progress + '%';
    }
    
    if (progressText) {
        progressText.textContent = progress.toFixed(1) + '% готово';
    }
}

// Загрузить и обновить прогресс проекта
async function loadAndUpdateProgress() {
    try {
        let currentProgress = await getCurrentProgress();
        
        // Проверяем, нужно ли обновить прогресс
        if (shouldUpdateProgress()) {
            // Увеличиваем прогресс на 0.3%
            currentProgress = increaseProgress(currentProgress);
            
            // Сохраняем новый прогресс
            await saveProgress(currentProgress);
            
            // Сохраняем дату обновления
            saveLastProgressUpdate();
            
            console.log('Прогресс проекта обновлен до:', currentProgress + '%');
        }
        
        // Обновляем визуальное отображение
        updateProgressDisplay(currentProgress);
        
        // Обновляем таймер обратного отсчета
        updateCountdownTimer();
        
        // Запускаем обновление таймера каждую секунду
        setInterval(updateCountdownTimer, 1000);
        
        // Проверяем обновление прогресса каждую минуту (на случай если пользователь оставил страницу открытой)
        setInterval(async () => {
            if (shouldUpdateProgress()) {
                let progress = await getCurrentProgress();
                progress = increaseProgress(progress);
                await saveProgress(progress);
                saveLastProgressUpdate();
                updateProgressDisplay(progress);
                console.log('Прогресс автоматически обновлен до:', progress + '%');
            }
        }, 60000); // Проверяем каждую минуту
    } catch (error) {
        console.error('Ошибка обновления прогресса:', error);
        // При ошибке используем значение по умолчанию
        updateProgressDisplay(INITIAL_PROGRESS);
        updateCountdownTimer();
        setInterval(updateCountdownTimer, 1000);
    }
}

// Инициализация счетчиков
document.addEventListener('DOMContentLoaded', async () => {
    // Прокручиваем страницу в начало сразу
    scrollToTop();
    
    // Показываем загрузочный экран при загрузке страницы
    showLoadingScreen();
    
    // Ждем инициализации Supabase клиента (до 2 секунд)
    let client = getSupabaseClient();
    let attempts = 0;
    while (!client && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        client = getSupabaseClient();
        attempts++;
    }
    
    // Инициализируем начальные значения счетчиков
    await initializeCounters();
    
    // Загружаем и обновляем прогресс проекта
    await loadAndUpdateProgress();
    
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
    // ВАЖНО: Проверяем статус пользователя ПОСЛЕ загрузки счетчиков
    // Это гарантирует, что Supabase клиент готов
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
    try {
        // Всегда проверяем онлайн в Supabase, не полагаясь на localStorage
        const hasClicked = await hasUserClicked('wish');
        const wishBtn = document.getElementById('wishBtn');
        const wishNote = document.getElementById('wishNote');
        
        // Показываем статус только если пользователь действительно голосовал
        if (hasClicked && wishBtn) {
            wishBtn.disabled = true;
            wishBtn.classList.add('clicked');
            wishBtn.innerHTML = '<span class="wish-btn-text">Спасибо за поддержку!</span><span class="wish-btn-emoji">💜</span>';
            
            if (wishNote) {
                wishNote.textContent = 'Ты уже поддержал(а) нас! Спасибо! 💜';
                wishNote.style.display = 'block';
            }
        } else {
            // Если пользователь не голосовал, убеждаемся что кнопка активна
            if (wishBtn) {
                wishBtn.disabled = false;
                wishBtn.classList.remove('clicked');
            }
            if (wishNote) {
                wishNote.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Ошибка проверки статуса:', error);
        // При ошибке оставляем кнопку активной
        const wishBtn = document.getElementById('wishBtn');
        if (wishBtn) {
            wishBtn.disabled = false;
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

// Получить реальное количество подписчиков Telegram канала
// Бот обновляет данные в Supabase, сайт просто читает их оттуда
async function getTelegramSubscribers() {
    // Просто читаем данные из Supabase, которые обновляет бот
    // Бот работает на сервере и обновляет значение каждые 5 минут
    const count = await loadCounterFromSupabase('telegram');
    return count;
}

// Загрузить счетчики соцсетей
async function loadSocialCounts() {
    // Для Telegram получаем реальное количество подписчиков из Supabase
    // (бот обновляет это значение каждые 5 минут)
    console.log('🔄 Загрузка счетчика Telegram из Supabase...');
    const telegramCount = await getTelegramSubscribers();
    const telegramCountElement = document.getElementById('telegramCount');
    if (telegramCountElement) {
        // Всегда обновляем значение, даже если оно 0 (чтобы показать актуальные данные)
        animateNumber(telegramCountElement, 0, telegramCount, 800);
        console.log(`✅ Telegram счетчик обновлен на странице: ${telegramCount.toLocaleString('ru-RU')}`);
    }
    
    // Для остальных соцсетей пока используем счетчики из Supabase
    const otherSocials = ['instagram', 'tiktok'];
    for (const social of otherSocials) {
        const count = await loadCounterFromSupabase(social);
        const countElement = document.getElementById(social + 'Count');
        if (countElement) {
            animateNumber(countElement, 0, count, 800);
        }
    }
    
    // Обновляем счетчик Telegram каждую минуту (бот обновляет в Supabase каждые 5 минут)
    // Это нужно чтобы показывать актуальные данные, которые бот уже сохранил
    setInterval(async () => {
        const newTelegramCount = await getTelegramSubscribers();
        const telegramCountElement = document.getElementById('telegramCount');
        if (telegramCountElement) {
            // Получаем текущее значение из элемента (уже отформатированное)
            const currentText = telegramCountElement.textContent.replace(/\./g, '').replace(/,/g, '');
            const currentCount = parseInt(currentText) || 0;
            
            // Обновляем только если значение изменилось
            if (newTelegramCount !== currentCount) {
                console.log(`🔄 Обновление Telegram счетчика: ${currentCount} → ${newTelegramCount}`);
                animateNumber(telegramCountElement, currentCount, newTelegramCount, 500);
            }
        }
    }, 60 * 1000); // Обновляем каждую минуту
}

// Правильные URL для соцсетей (всегда используем эти значения)
const SOCIAL_URLS = {
    telegram: 'https://t.me/re_minko_anime',
    instagram: 'https://www.instagram.com/re.minko?utm_source=qr&igsh=ZG1xMmN0YWVrNW96',
    tiktok: 'https://www.tiktok.com/@re.minko?_r=1&_t=ZN-93f3tJJ2cdC'
};

// Обработка нажатия на кнопку соцсети
async function handleSocialClick(event, socialName) {
    try {
        event.preventDefault();
        event.stopPropagation();
        
        // ВАЖНО: Всегда используем правильный URL из константы, а не из элемента
        const url = SOCIAL_URLS[socialName];
        
        if (!url || url === '#') {
            console.error('Неизвестная соцсеть:', socialName);
            return; // Не можем перейти без URL
        }
        
        // Для Telegram больше не увеличиваем счетчик при клике, так как используем реальные данные
        // Для остальных соцсетей пока оставляем старую логику
        if (socialName !== 'telegram') {
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
        } else {
            // Для Telegram просто показываем уведомление о переходе
            showSocialNotification(socialName);
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
        
        // Переходим на правильную ссылку через 3 секунды
        setTimeout(() => {
            if (url && url !== '#') {
                // Открываем ссылку в новой вкладке
                const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
                if (!newWindow) {
                    // Если всплывающее окно заблокировано, открываем в той же вкладке
                    window.location.href = url;
                }
            }
            // Скрываем загрузочный экран через небольшую задержку
            setTimeout(() => {
                hideLoadingScreen();
            }, 500);
        }, 3000);
    } catch (error) {
        console.error('Ошибка при обработке клика соцсети:', error);
        // В случае ошибки все равно открываем ссылку
        const url = SOCIAL_URLS[socialName];
        if (url && url !== '#') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
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
