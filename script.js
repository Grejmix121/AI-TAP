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
    
    // Для Telegram, Instagram и TikTok не используем localStorage - только Supabase
    const socialNetworks = ['telegram', 'instagram', 'tiktok'];
    const isSocialNetwork = socialNetworks.includes(counterType);
    
    if (!client) {
        // Fallback на localStorage если Supabase недоступен (кроме соцсетей)
        if (isSocialNetwork) {
            return 0; // Для соцсетей не используем localStorage
        }
        const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
        return parseFloat(localStorage.getItem(localKey) || '0');
    }
    
    try {
        // Для соцсетей всегда получаем свежие данные из Supabase (без кеша)
        // Не используем order/limit так как counter_type уникальный
        const { data, error } = await client
            .from('startzero_counters')
            .select('count, updated_at')
            .eq('counter_type', counterType)
            .maybeSingle();
        
        if (error) {
            console.error(`Ошибка загрузки счетчика ${counterType}:`, error);
            if (isSocialNetwork) {
                return 0;
            }
            const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
            return parseFloat(localStorage.getItem(localKey) || '0');
        }
        
        if (!data) {
            console.warn(`Счетчик ${counterType} не найден в Supabase`);
            if (isSocialNetwork) {
                return 0;
            }
            const localKey = counterType === 'wish' ? WISH_COUNT_KEY : SOCIAL_COUNT_PREFIX + counterType;
            return parseFloat(localStorage.getItem(localKey) || '0');
        }
        
        const count = data?.count || 0;
        
        // Для соцсетей логируем информацию для отладки
        if (isSocialNetwork) {
            const updateTime = data.updated_at ? new Date(data.updated_at).toLocaleString('ru-RU') : 'N/A';
            console.log(`📊 ${counterType} из Supabase: ${count.toLocaleString('ru-RU')} подписчиков (обновлено: ${updateTime})`);
        }
        
        return count;
    } catch (error) {
        console.error(`Ошибка загрузки счетчика ${counterType}:`, error);
        // Для соцсетей не используем localStorage fallback
        if (isSocialNetwork) {
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
        // ВАЖНО: Telegram, Instagram и TikTok НЕ включаем - их обновляет бот с реальным количеством подписчиков
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
        // ВАЖНО: Telegram, Instagram и TikTok пропускаем - их обновляет бот с реальным количеством подписчиков
        for (const [counterType, initialCount] of Object.entries(initialValues)) {
            // Пропускаем соцсети - их обновляет бот автоматически
            if (counterType === 'telegram' || counterType === 'instagram' || counterType === 'tiktok') {
                continue;
            }
            
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
        
        // Проверяем что соцсети не были перезаписаны
        const socialNetworks = ['telegram', 'instagram', 'tiktok'];
        for (const social of socialNetworks) {
            const { data: socialCheck } = await client
                .from('startzero_counters')
                .select('count, updated_at')
                .eq('counter_type', social)
                .maybeSingle();
            
            if (socialCheck) {
                console.log(`✅ ${social} счетчик в базе после инициализации: ${socialCheck.count.toLocaleString('ru-RU')} (обновлено: ${new Date(socialCheck.updated_at).toLocaleString('ru-RU')})`);
            } else {
                console.log(`⚠️  ${social} счетчик не найден в базе - бот создаст его при следующем обновлении`);
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
            
            if (!error && data && data.count !== null && data.count !== undefined) {
                // В Supabase храним как целое число (умноженное на 10 для точности до 0.1%)
                // Например, 85.3% хранится как 853, 85.6% как 856, 90% как 900
                const progress = parseFloat(data.count) / 10;
                console.log(`📊 Прогресс из Supabase: count=${data.count}, progress=${progress.toFixed(1)}%`);
                
                // Проверяем валидность значения
                if (progress >= 0 && progress <= 100) {
                    return progress;
                } else {
                    console.warn(`⚠️  Некорректное значение прогресса из базы: ${progress}, используем начальное значение`);
                    return INITIAL_PROGRESS;
                }
            } else {
                console.log(`⚠️  Прогресс не найден в Supabase, используем начальное значение: ${INITIAL_PROGRESS}%`);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки прогресса из Supabase:', error);
        }
    } else {
        console.log('⚠️  Supabase клиент не инициализирован, используем localStorage');
    }
    
    // Fallback на localStorage
    const storedProgress = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (storedProgress) {
        const progress = parseFloat(storedProgress);
        console.log(`📊 Прогресс из localStorage: ${progress.toFixed(1)}%`);
        return progress;
    }
    
    console.log(`📊 Используем начальное значение прогресса: ${INITIAL_PROGRESS}%`);
    return INITIAL_PROGRESS;
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

// Получить дату последнего обновления прогресса из Supabase
async function getLastProgressUpdate() {
    const client = getSupabaseClient();
    
    if (client) {
        try {
            const { data, error } = await client
                .from('startzero_counters')
                .select('updated_at')
                .eq('counter_type', 'project_progress')
                .maybeSingle();
            
            if (!error && data && data.updated_at) {
                return new Date(data.updated_at);
            }
        } catch (error) {
            console.error('Ошибка получения времени обновления прогресса:', error);
        }
    }
    
    // Fallback на localStorage
    const lastUpdate = localStorage.getItem(PROGRESS_LAST_UPDATE_KEY);
    return lastUpdate ? new Date(lastUpdate) : null;
}

// Сохранить дату последнего обновления прогресса
async function saveLastProgressUpdate() {
    // Время обновления уже сохраняется в Supabase через saveProgress()
    // Но также сохраняем в localStorage для fallback
    localStorage.setItem(PROGRESS_LAST_UPDATE_KEY, new Date().toISOString());
}

// Проверить, нужно ли обновить прогресс
// ВАЖНО: Обновление происходит только один раз в день в 4:00 МСК
async function shouldUpdateProgress() {
    const lastUpdate = await getLastProgressUpdate();
    
    if (!lastUpdate) {
        // Если никогда не обновляли, проверяем текущее время
        const moscowTime = getMoscowTime();
        const currentHour = moscowTime.getHours();
        // Обновляем только если уже прошло время обновления сегодня
        return currentHour >= UPDATE_HOUR_MSC;
    }
    
    const moscowTime = getMoscowTime();
    const now = moscowTime.getTime();
    const lastUpdateTime = lastUpdate.getTime();
    
    // Вычисляем разницу в миллисекундах
    const timeDiff = now - lastUpdateTime;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    // ВАЖНО: Обновляем только если прошло минимум 24 часа с последнего обновления
    // И текущее время >= 4:00 МСК
    if (daysDiff < 1) {
        // Прошло меньше суток - не обновляем
        return false;
    }
    
    // Прошло минимум 1 день - проверяем время
    const currentHour = moscowTime.getHours();
    const currentMinute = moscowTime.getMinutes();
    
    // Обновляем только если текущее время >= 4:00 МСК
    if (currentHour < UPDATE_HOUR_MSC) {
        return false;
    }
    
    // Если прошло больше суток и время >= 4:00 - обновляем
    return true;
}

// Увеличить прогресс на фиксированное значение каждый день
function increaseProgress(currentProgress) {
    // Увеличиваем на фиксированное значение каждый день
    const newProgress = Math.min(currentProgress + DAILY_PROGRESS_INCREASE, TARGET_PROGRESS); // Не больше 100%
    
    return Math.round(newProgress * 10) / 10; // Округляем до 1 знака после запятой
}

// Кеш для даты релиза и прогресса
let cachedReleaseDate = null;
let cachedProgress = null;
let releaseDateCacheTime = 0;
const RELEASE_DATE_CACHE_DURATION = 60 * 1000; // Кешируем на 1 минуту

// Вычислить дату релиза на основе текущего прогресса
async function calculateReleaseDate() {
    const now = Date.now();
    
    // Проверяем кеш - если прогресс не изменился и прошло меньше минуты, используем кеш
    if (cachedReleaseDate && cachedProgress !== null && (now - releaseDateCacheTime) < RELEASE_DATE_CACHE_DURATION) {
        return cachedReleaseDate;
    }
    
    // ВАЖНО: Используем актуальное значение из базы, а не localStorage
    const currentProgress = await getCurrentProgress();
    
    // Если прогресс не изменился и кеш еще актуален - используем кеш
    if (cachedProgress === currentProgress && cachedReleaseDate && (now - releaseDateCacheTime) < RELEASE_DATE_CACHE_DURATION) {
        return cachedReleaseDate;
    }
    
    const remainingProgress = TARGET_PROGRESS - currentProgress;
    const daysRemaining = Math.ceil(remainingProgress / DAILY_PROGRESS_INCREASE);
    
    // Устанавливаем дату релиза
    const moscowTime = getMoscowTime();
    const releaseDate = new Date(moscowTime);
    releaseDate.setDate(releaseDate.getDate() + daysRemaining);
    releaseDate.setHours(UPDATE_HOUR_MSC, 0, 0, 0);
    
    // Обновляем кеш
    cachedReleaseDate = releaseDate;
    cachedProgress = currentProgress;
    releaseDateCacheTime = now;
    
    console.log(`📅 Расчет даты релиза: текущий прогресс ${currentProgress.toFixed(1)}%, осталось ${remainingProgress.toFixed(1)}%, дней до релиза: ${daysRemaining}`);
    
    return releaseDate;
}

// Обновить таймер обратного отсчета
async function updateCountdownTimer() {
    // ВАЖНО: Используем актуальное значение прогресса из базы для расчета
    // Функция calculateReleaseDate теперь кеширует результат на 1 минуту
    const releaseDate = await calculateReleaseDate();
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
    
    // Ограничиваем прогресс до 100%
    const clampedProgress = Math.min(Math.max(progress, 0), 100);
    
    if (progressFill) {
        // Убеждаемся, что значение применяется правильно
        progressFill.style.width = clampedProgress.toFixed(1) + '%';
        // Принудительно обновляем стиль для надежности
        progressFill.setAttribute('style', `width: ${clampedProgress.toFixed(1)}%`);
        console.log(`📊 Обновление прогресс-бара: ${clampedProgress.toFixed(1)}%`);
    }
    
    if (progressText) {
        progressText.textContent = clampedProgress.toFixed(1) + '% готово';
        console.log(`📊 Обновление текста прогресса: ${clampedProgress.toFixed(1)}% готово`);
    }
}

// Загрузить и обновить прогресс проекта
async function loadAndUpdateProgress() {
    try {
        // ВАЖНО: Сначала загружаем текущий прогресс из Supabase
        let currentProgress = await getCurrentProgress();
        console.log(`📊 Загружен прогресс из базы: ${currentProgress.toFixed(1)}%`);
        
        // СРАЗУ обновляем визуальное отображение с актуальным значением из базы
        updateProgressDisplay(currentProgress);
        
        // Проверяем, нужно ли обновить прогресс (асинхронно)
        const needsUpdate = await shouldUpdateProgress();
        
        if (needsUpdate) {
            // Получаем время последнего обновления для логирования
            const lastUpdate = await getLastProgressUpdate();
            const lastUpdateStr = lastUpdate ? new Date(lastUpdate).toLocaleString('ru-RU') : 'никогда';
            console.log(`🔄 Последнее обновление: ${lastUpdateStr}`);
            
            // Увеличиваем прогресс на 0.3%
            const newProgress = increaseProgress(currentProgress);
            
            // Сохраняем новый прогресс (время обновления сохранится автоматически)
            await saveProgress(newProgress);
            
            // Сохраняем дату обновления в localStorage
            await saveLastProgressUpdate();
            
            console.log(`✅ Прогресс проекта обновлен: ${currentProgress.toFixed(1)}% → ${newProgress.toFixed(1)}%`);
            
            // Обновляем визуальное отображение с новым значением
            updateProgressDisplay(newProgress);
            
            // Сбрасываем кеш даты релиза при изменении прогресса
            cachedReleaseDate = null;
            cachedProgress = null;
        } else {
            const lastUpdate = await getLastProgressUpdate();
            const lastUpdateStr = lastUpdate ? new Date(lastUpdate).toLocaleString('ru-RU') : 'никогда';
            console.log(`ℹ️  Прогресс не требует обновления. Текущее значение: ${currentProgress.toFixed(1)}% (последнее обновление: ${lastUpdateStr})`);
        }
        
        // Обновляем таймер обратного отсчета (асинхронно)
        await updateCountdownTimer();
        
        // Запускаем обновление таймера каждую секунду
        // calculateReleaseDate теперь кеширует результат, поэтому запросы к Supabase будут реже
        setInterval(async () => {
            await updateCountdownTimer();
        }, 1000);
        
        // Проверяем обновление прогресса каждую минуту (на случай если пользователь оставил страницу открытой)
        setInterval(async () => {
            // Сначала загружаем актуальное значение из базы
            let progress = await getCurrentProgress();
            
            // Обновляем визуальное отображение с актуальным значением из базы
            updateProgressDisplay(progress);
            
            // Проверяем, нужно ли увеличить прогресс (асинхронно)
            const needsUpdate = await shouldUpdateProgress();
            
            if (needsUpdate) {
                const oldProgress = progress;
                progress = increaseProgress(progress);
                await saveProgress(progress);
                await saveLastProgressUpdate();
                updateProgressDisplay(progress);
                
                // Сбрасываем кеш даты релиза при изменении прогресса
                cachedReleaseDate = null;
                cachedProgress = null;
                
                console.log(`✅ Прогресс автоматически обновлен: ${oldProgress.toFixed(1)}% → ${progress.toFixed(1)}%`);
            }
        }, 60000); // Проверяем каждую минуту
    } catch (error) {
        console.error('Ошибка обновления прогресса:', error);
        // При ошибке используем значение по умолчанию
        updateProgressDisplay(INITIAL_PROGRESS);
        await updateCountdownTimer();
        // Запускаем обновление таймера каждую секунду (calculateReleaseDate кеширует результат)
        setInterval(async () => {
            await updateCountdownTimer();
        }, 1000);
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
    
    // Загружаем счетчики соцсетей (включая Telegram)
    await loadSocialCounts();
    
    // Принудительно обновляем Telegram счетчик еще раз через 2 секунды
    // чтобы убедиться что загружены актуальные данные
    setTimeout(async () => {
        console.log('🔄 Повторная проверка Telegram счетчика...');
        const client = getSupabaseClient();
        if (!client) return;
        
        try {
            const { data, error } = await client
                .from('startzero_counters')
                .select('count, updated_at')
                .eq('counter_type', 'telegram')
                .maybeSingle();
            
            const telegramCountElement = document.getElementById('telegramCount');
            if (!telegramCountElement) return;
            
            if (error || !data) {
                // Данных нет - показываем "подсчет..."
                telegramCountElement.textContent = 'подсчет...';
                telegramCountElement.style.opacity = '0.7';
                telegramCountElement.style.fontSize = '1.2rem';
                telegramCountElement.style.fontStyle = 'italic';
                telegramCountElement.classList.add('counting');
                return;
            }
            
            const telegramCount = parseFloat(data.count) || 0;
            const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
            const now = new Date();
            const isDataFresh = updatedAt && (now - updatedAt) < 10 * 60 * 1000; // 10 минут
            
            if (!isDataFresh) {
                // Данные устарели - показываем "подсчет..."
                console.log(`⏳ Данные Telegram устарели (обновлено: ${updatedAt ? updatedAt.toLocaleString('ru-RU') : 'неизвестно'}), показываем "подсчет..."`);
                telegramCountElement.textContent = 'подсчет...';
                telegramCountElement.style.opacity = '0.7';
                telegramCountElement.style.fontSize = '1.2rem';
                telegramCountElement.style.fontStyle = 'italic';
                telegramCountElement.classList.add('counting');
                return;
            }
            
            // Данные свежие - обновляем если нужно
            const currentText = telegramCountElement.textContent.trim();
            if (currentText === 'подсчет...' && telegramCount > 0) {
                telegramCountElement.style.opacity = '1';
                telegramCountElement.style.fontSize = '1.8rem';
                telegramCountElement.style.fontStyle = 'normal';
                telegramCountElement.classList.remove('counting');
                animateNumber(telegramCountElement, 0, telegramCount, 500);
                console.log(`✅ Telegram счетчик обновлен: ${telegramCount.toLocaleString('ru-RU')} подписчиков`);
            } else if (currentText !== 'подсчет...' && telegramCount > 0) {
                const currentCount = parseFloat(currentText.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '')) || 0;
                if (Math.abs(currentCount - telegramCount) > 0) {
                    console.log(`🔄 Обновление Telegram: ${currentCount} → ${telegramCount}`);
                    animateNumber(telegramCountElement, currentCount, telegramCount, 500);
                } else {
                    console.log(`✅ Telegram счетчик актуален: ${telegramCount}`);
                }
            }
        } catch (error) {
            console.error('Ошибка повторной проверки Telegram счетчика:', error);
        }
    }, 2000);
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
        const wishUndoBtn = document.getElementById('wishUndoBtn');
        
        // Показываем статус только если пользователь действительно голосовал
        if (hasClicked && wishBtn) {
            wishBtn.disabled = true;
            wishBtn.classList.add('clicked');
            wishBtn.innerHTML = '<span class="wish-btn-text">Спасибо за поддержку!</span><span class="wish-btn-emoji">💜</span>';
            
            if (wishNote) {
                wishNote.textContent = 'Ты уже поддержал(а) нас! Спасибо! 💜';
                wishNote.style.display = 'block';
            }
            // Показываем кнопку отмены
            if (wishUndoBtn) wishUndoBtn.style.display = 'inline-flex';
        } else {
            // Если пользователь не голосовал, убеждаемся что кнопка активна
            if (wishBtn) {
                wishBtn.disabled = false;
                wishBtn.classList.remove('clicked');
            }
            if (wishNote) {
                wishNote.style.display = 'none';
            }
            // Скрываем кнопку отмены
            if (wishUndoBtn) wishUndoBtn.style.display = 'none';
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
        if (wishBtn && (wishBtn.disabled || wishBtn.dataset.processing === 'true')) {
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
        
        // Блокируем повторные клики через флаг (НЕ через disabled, чтобы не ломать анимацию)
        if (wishBtn) {
            wishBtn.dataset.processing = 'true';
            wishBtn.style.pointerEvents = 'none';
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
            // --- КРАСИВАЯ АНИМАЦИЯ ---
            const btnRect = wishBtn.getBoundingClientRect();
            
            // 1. Текст +1 над кнопкой
            createPlusOne(wishBtn);
            
            // 2. Пульсирующее кольцо
            createWishRing(wishBtn);
            
            // 3. Частицы-эмодзи разлетаются от кнопки
            createWishParticles(btnRect);
            
            // 4. Конфетти сверху
            createWishConfetti();
            
            // 5. Плавная смена кнопки с пружинкой
            wishBtn.style.transition = 'transform 0.15s ease';
            wishBtn.style.transform = 'scale(1.15)';
            wishBtn.classList.add('wish-success-glow');
            
            setTimeout(() => {
                wishBtn.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    wishBtn.style.transform = 'scale(1.05)';
                    setTimeout(() => {
                        wishBtn.style.transform = 'scale(1)';
                    }, 100);
                }, 100);
            }, 150);
            
            // После завершения анимации — меняем текст и блокируем
            setTimeout(() => {
                wishBtn.classList.add('clicked');
                wishBtn.innerHTML = '<span class="wish-btn-text">Спасибо за поддержку!</span><span class="wish-btn-emoji">💜</span>';
                wishBtn.classList.remove('wish-success-glow');
                wishBtn.style.transform = '';
                wishBtn.style.transition = '';
                wishBtn.disabled = true;
                
                // Показываем кнопку отмены
                const wishUndoBtn = document.getElementById('wishUndoBtn');
                if (wishUndoBtn) wishUndoBtn.style.display = 'inline-flex';
            }, 1200);
        }
        
        if (wishNote) {
            setTimeout(() => {
                wishNote.textContent = 'Ты уже поддержал(а) нас! Спасибо! 💜';
                wishNote.style.display = 'block';
                wishNote.style.opacity = '0';
                wishNote.style.animation = 'fadeIn 0.5s ease-out forwards';
            }, 1200);
        }
        
        // Показываем уведомление
        showWishNotification();
    } catch (error) {
        console.error('Ошибка при обработке клика:', error);
        // Разблокируем кнопку в случае ошибки
        const wishBtn = document.getElementById('wishBtn');
        if (wishBtn) {
            wishBtn.disabled = false;
            wishBtn.style.pointerEvents = '';
            delete wishBtn.dataset.processing;
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
    // Если элемент показывает "подсчет..." - начинаем с 0
    const currentText = element.textContent.trim();
    if (currentText === 'подсчет...') {
        from = 0;
        element.style.opacity = '1';
    }
    
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
    const client = getSupabaseClient();
    if (!client) {
        return 0;
    }
    
    try {
        const { data, error } = await client
            .from('startzero_counters')
            .select('count, updated_at')
            .eq('counter_type', 'telegram')
            .maybeSingle();
        
        if (error || !data) {
            return 0;
        }
        
        const count = parseFloat(data.count) || 0;
        const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
        const now = new Date();
        
        // Проверяем свежесть данных (бот обновляет каждые 5 минут)
        const isDataFresh = updatedAt && (now - updatedAt) < 10 * 60 * 1000; // 10 минут
        
        if (!isDataFresh) {
            // Данные устарели
            return 0;
        }
        
        return count;
    } catch (error) {
        console.error('Ошибка получения Telegram подписчиков:', error);
        return 0;
    }
}

// Получить реальное количество подписчиков Instagram
// Бот обновляет данные в Supabase, сайт просто читает их оттуда
async function getInstagramFollowers() {
    const client = getSupabaseClient();
    if (!client) {
        return 0;
    }
    
    try {
        const { data, error } = await client
            .from('startzero_counters')
            .select('count, updated_at')
            .eq('counter_type', 'instagram')
            .maybeSingle();
        
        if (error || !data) {
            return 0;
        }
        
        const count = parseFloat(data.count) || 0;
        
        // Возвращаем значение если оно есть (независимо от свежести)
        return count;
    } catch (error) {
        console.error('Ошибка получения Instagram подписчиков:', error);
        return 0;
    }
}

// Получить реальное количество подписчиков TikTok
// Бот обновляет данные в Supabase, сайт просто читает их оттуда
async function getTikTokFollowers() {
    const client = getSupabaseClient();
    if (!client) {
        return 0;
    }
    
    try {
        const { data, error } = await client
            .from('startzero_counters')
            .select('count, updated_at')
            .eq('counter_type', 'tiktok')
            .maybeSingle();
        
        if (error || !data) {
            return 0;
        }
        
        const count = parseFloat(data.count) || 0;
        
        // Возвращаем значение если оно есть (независимо от свежести)
        return count;
    } catch (error) {
        console.error('Ошибка получения TikTok подписчиков:', error);
        return 0;
    }
}

// Загрузить счетчик Instagram (аналогично Telegram)
async function loadInstagramCount() {
    console.log('🔄 Загрузка счетчика Instagram из Supabase...');
    
    const instagramCountElement = document.getElementById('instagramCount');
    
    // ВСЕГДА сначала показываем "подсчет..." пока данные не загружены
    if (instagramCountElement) {
        instagramCountElement.textContent = 'подсчет...';
        instagramCountElement.style.opacity = '0.7';
        instagramCountElement.style.fontSize = '1.2rem';
        instagramCountElement.style.fontStyle = 'italic';
        instagramCountElement.classList.add('counting');
    }
    
    // Принудительно получаем свежие данные из Supabase с информацией о времени обновления
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase клиент не инициализирован');
        return;
    }
    
    try {
        const { data, error } = await client
            .from('startzero_counters')
            .select('count, updated_at')
            .eq('counter_type', 'instagram')
            .maybeSingle();
        
        if (error) {
            console.error('❌ Ошибка загрузки Instagram счетчика:', error);
            return;
        }
        
        if (!data) {
            // Данных нет в базе - показываем "подсчет..."
            console.log('⏳ Instagram счетчик не найден в базе, показываем "подсчет..."');
            if (instagramCountElement) {
                instagramCountElement.textContent = 'подсчет...';
                instagramCountElement.style.opacity = '0.7';
                instagramCountElement.style.fontSize = '1.2rem';
                instagramCountElement.style.fontStyle = 'italic';
                instagramCountElement.classList.add('counting');
            }
            return;
        }
        
        const instagramCount = parseFloat(data.count) || 0;
        const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
        
        if (instagramCountElement) {
            if (instagramCount > 0) {
                // Данные есть в базе - показываем реальное количество (независимо от свежести)
                console.log(`📊 Получено из Supabase: ${instagramCount.toLocaleString('ru-RU')} подписчиков Instagram (обновлено: ${updatedAt ? updatedAt.toLocaleString('ru-RU') : 'неизвестно'})`);
                instagramCountElement.style.opacity = '1';
                instagramCountElement.style.fontSize = '1.8rem';
                instagramCountElement.style.fontStyle = 'normal';
                instagramCountElement.classList.remove('counting');
                animateNumber(instagramCountElement, 0, instagramCount, 800);
                console.log(`✅ Instagram счетчик обновлен на странице: ${instagramCount.toLocaleString('ru-RU')}`);
            } else {
                // Данных нет (равны 0) - показываем "подсчет..."
                console.log('⏳ Instagram счетчик равен 0, показываем "подсчет..."');
                instagramCountElement.textContent = 'подсчет...';
                instagramCountElement.style.opacity = '0.7';
                instagramCountElement.style.fontSize = '1.2rem';
                instagramCountElement.style.fontStyle = 'italic';
                instagramCountElement.classList.add('counting');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка при загрузке Instagram счетчика:', error);
        if (instagramCountElement) {
            instagramCountElement.textContent = 'подсчет...';
            instagramCountElement.style.opacity = '0.7';
            instagramCountElement.style.fontSize = '1.2rem';
            instagramCountElement.style.fontStyle = 'italic';
            instagramCountElement.classList.add('counting');
        }
    }
}

// Загрузить счетчик TikTok (аналогично Telegram)
async function loadTikTokCount() {
    console.log('🔄 Загрузка счетчика TikTok из Supabase...');
    
    const tiktokCountElement = document.getElementById('tiktokCount');
    
    // ВСЕГДА сначала показываем "подсчет..." пока данные не загружены
    if (tiktokCountElement) {
        tiktokCountElement.textContent = 'подсчет...';
        tiktokCountElement.style.opacity = '0.7';
        tiktokCountElement.style.fontSize = '1.2rem';
        tiktokCountElement.style.fontStyle = 'italic';
        tiktokCountElement.classList.add('counting');
    }
    
    // Принудительно получаем свежие данные из Supabase с информацией о времени обновления
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase клиент не инициализирован');
        return;
    }
    
    try {
        const { data, error } = await client
            .from('startzero_counters')
            .select('count, updated_at')
            .eq('counter_type', 'tiktok')
            .maybeSingle();
        
        if (error) {
            console.error('❌ Ошибка загрузки TikTok счетчика:', error);
            return;
        }
        
        if (!data) {
            // Данных нет в базе - показываем "подсчет..."
            console.log('⏳ TikTok счетчик не найден в базе, показываем "подсчет..."');
            if (tiktokCountElement) {
                tiktokCountElement.textContent = 'подсчет...';
                tiktokCountElement.style.opacity = '0.7';
                tiktokCountElement.style.fontSize = '1.2rem';
                tiktokCountElement.style.fontStyle = 'italic';
                tiktokCountElement.classList.add('counting');
            }
            return;
        }
        
        const tiktokCount = parseFloat(data.count) || 0;
        const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
        
        if (tiktokCountElement) {
            if (tiktokCount > 0) {
                // Данные есть в базе - показываем реальное количество (независимо от свежести)
                console.log(`📊 Получено из Supabase: ${tiktokCount.toLocaleString('ru-RU')} подписчиков TikTok (обновлено: ${updatedAt ? updatedAt.toLocaleString('ru-RU') : 'неизвестно'})`);
                tiktokCountElement.style.opacity = '1';
                tiktokCountElement.style.fontSize = '1.8rem';
                tiktokCountElement.style.fontStyle = 'normal';
                tiktokCountElement.classList.remove('counting');
                animateNumber(tiktokCountElement, 0, tiktokCount, 800);
                console.log(`✅ TikTok счетчик обновлен на странице: ${tiktokCount.toLocaleString('ru-RU')}`);
            } else {
                // Данных нет (равны 0) - показываем "подсчет..."
                console.log('⏳ TikTok счетчик равен 0, показываем "подсчет..."');
                tiktokCountElement.textContent = 'подсчет...';
                tiktokCountElement.style.opacity = '0.7';
                tiktokCountElement.style.fontSize = '1.2rem';
                tiktokCountElement.style.fontStyle = 'italic';
                tiktokCountElement.classList.add('counting');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка при загрузке TikTok счетчика:', error);
        if (tiktokCountElement) {
            tiktokCountElement.textContent = 'подсчет...';
            tiktokCountElement.style.opacity = '0.7';
            tiktokCountElement.style.fontSize = '1.2rem';
            tiktokCountElement.style.fontStyle = 'italic';
            tiktokCountElement.classList.add('counting');
        }
    }
}

// Загрузить счетчики соцсетей
async function loadSocialCounts() {
    // Для Telegram получаем реальное количество подписчиков из Supabase
    // (бот обновляет это значение каждые 5 минут)
    console.log('🔄 Загрузка счетчика Telegram из Supabase...');
    
    const telegramCountElement = document.getElementById('telegramCount');
    
    // ВСЕГДА сначала показываем "подсчет..." пока данные не загружены
    if (telegramCountElement) {
        telegramCountElement.textContent = 'подсчет...';
        telegramCountElement.style.opacity = '0.7';
        telegramCountElement.style.fontSize = '1.2rem';
        telegramCountElement.style.fontStyle = 'italic';
        telegramCountElement.classList.add('counting');
    }
    
    // Принудительно получаем свежие данные из Supabase с информацией о времени обновления
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase клиент не инициализирован');
        return;
    }
    
    try {
        const { data, error } = await client
            .from('startzero_counters')
            .select('count, updated_at')
            .eq('counter_type', 'telegram')
            .maybeSingle();
        
        if (error) {
            console.error('❌ Ошибка загрузки Telegram счетчика:', error);
            return;
        }
        
        if (!data) {
            // Данных нет в базе - показываем "подсчет..."
            console.log('⏳ Telegram счетчик не найден в базе, показываем "подсчет..."');
            if (telegramCountElement) {
                telegramCountElement.textContent = 'подсчет...';
                telegramCountElement.style.opacity = '0.7';
                telegramCountElement.style.fontSize = '1.2rem';
                telegramCountElement.style.fontStyle = 'italic';
                telegramCountElement.classList.add('counting');
            }
            return;
        }
        
        const telegramCount = parseFloat(data.count) || 0;
        const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
        const now = new Date();
        
        // Проверяем, насколько свежие данные (бот обновляет каждые 5 минут)
        // Если данные старше 10 минут - считаем их устаревшими и показываем "подсчет..."
        const isDataFresh = updatedAt && (now - updatedAt) < 10 * 60 * 1000; // 10 минут
        
        if (telegramCountElement) {
            if (telegramCount > 0 && isDataFresh) {
                // Данные свежие - показываем реальное количество
                console.log(`📊 Получено из Supabase: ${telegramCount.toLocaleString('ru-RU')} подписчиков (обновлено: ${updatedAt ? updatedAt.toLocaleString('ru-RU') : 'неизвестно'})`);
                telegramCountElement.style.opacity = '1';
                telegramCountElement.style.fontSize = '1.8rem';
                telegramCountElement.style.fontStyle = 'normal';
                telegramCountElement.classList.remove('counting');
                animateNumber(telegramCountElement, 0, telegramCount, 800);
                console.log(`✅ Telegram счетчик обновлен на странице: ${telegramCount.toLocaleString('ru-RU')}`);
            } else {
                // Данные устарели или их нет - показываем "подсчет..."
                if (!isDataFresh) {
                    console.log(`⏳ Данные Telegram устарели (обновлено: ${updatedAt ? updatedAt.toLocaleString('ru-RU') : 'неизвестно'}), показываем "подсчет..."`);
                } else {
                    console.log('⏳ Данные Telegram еще не загружены, показываем "подсчет..."');
                }
                telegramCountElement.textContent = 'подсчет...';
                telegramCountElement.style.opacity = '0.7';
                telegramCountElement.style.fontSize = '1.2rem';
                telegramCountElement.style.fontStyle = 'italic';
                telegramCountElement.classList.add('counting');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка при загрузке Telegram счетчика:', error);
        if (telegramCountElement) {
            telegramCountElement.textContent = 'подсчет...';
            telegramCountElement.style.opacity = '0.7';
            telegramCountElement.style.fontSize = '1.2rem';
            telegramCountElement.style.fontStyle = 'italic';
            telegramCountElement.classList.add('counting');
        }
    }
    
    // Для Instagram получаем реальное количество подписчиков из Supabase (аналогично Telegram)
    await loadInstagramCount();
    
    // Для TikTok получаем реальное количество подписчиков из Supabase (аналогично Telegram)
    await loadTikTokCount();
    
    // Обновляем счетчики Telegram и Instagram каждую минуту (бот обновляет в Supabase каждые 5 минут)
    // Это нужно чтобы показывать актуальные данные, которые бот уже сохранил
    
    // Интервал для Telegram
    setInterval(async () => {
        const telegramCountElement = document.getElementById('telegramCount');
        if (!telegramCountElement) return;
        
        const client = getSupabaseClient();
        if (!client) return;
        
        try {
            const { data, error } = await client
                .from('startzero_counters')
                .select('count, updated_at')
                .eq('counter_type', 'telegram')
                .maybeSingle();
            
            if (error || !data) {
                // Данных нет - показываем "подсчет..."
                const currentText = telegramCountElement.textContent.trim();
                if (currentText !== 'подсчет...') {
                    telegramCountElement.textContent = 'подсчет...';
                    telegramCountElement.style.opacity = '0.7';
                    telegramCountElement.style.fontSize = '1.2rem';
                    telegramCountElement.style.fontStyle = 'italic';
                    telegramCountElement.classList.add('counting');
                }
                return;
            }
            
            const newTelegramCount = parseFloat(data.count) || 0;
            const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
            const now = new Date();
            const isDataFresh = updatedAt && (now - updatedAt) < 10 * 60 * 1000; // 10 минут
            
            const currentText = telegramCountElement.textContent.trim();
            
            if (!isDataFresh) {
                // Данные устарели - показываем "подсчет..."
                if (currentText !== 'подсчет...') {
                    console.log(`⏳ Данные Telegram устарели (обновлено: ${updatedAt ? updatedAt.toLocaleString('ru-RU') : 'неизвестно'}), показываем "подсчет..."`);
                    telegramCountElement.textContent = 'подсчет...';
                    telegramCountElement.style.opacity = '0.7';
                    telegramCountElement.style.fontSize = '1.2rem';
                    telegramCountElement.style.fontStyle = 'italic';
                    telegramCountElement.classList.add('counting');
                }
                return;
            }
            
            // Данные свежие
            if (currentText === 'подсчет...' && newTelegramCount > 0) {
                // Если показывается "подсчет..." и данные получены - обновляем
                telegramCountElement.style.opacity = '1';
                telegramCountElement.style.fontSize = '1.8rem';
                telegramCountElement.style.fontStyle = 'normal';
                telegramCountElement.classList.remove('counting');
                animateNumber(telegramCountElement, 0, newTelegramCount, 500);
                console.log(`✅ Telegram счетчик обновлен: ${newTelegramCount.toLocaleString('ru-RU')} подписчиков`);
            } 
            // Если данные есть и значение изменилось - обновляем
            else if (currentText !== 'подсчет...' && newTelegramCount > 0) {
                const currentCount = parseFloat(currentText.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '')) || 0;
                if (Math.abs(currentCount - newTelegramCount) > 0) {
                    console.log(`🔄 Обновление Telegram счетчика: ${currentCount} → ${newTelegramCount}`);
                    animateNumber(telegramCountElement, currentCount, newTelegramCount, 500);
                }
            }
            // Если данных еще нет - показываем "подсчет..."
            else if (newTelegramCount === 0) {
                if (currentText !== 'подсчет...') {
                    telegramCountElement.textContent = 'подсчет...';
                    telegramCountElement.style.opacity = '0.7';
                    telegramCountElement.style.fontSize = '1.2rem';
                    telegramCountElement.style.fontStyle = 'italic';
                    telegramCountElement.classList.add('counting');
                }
            }
        } catch (error) {
            console.error('Ошибка обновления Telegram счетчика:', error);
        }
    }, 60 * 1000); // Обновляем каждую минуту
    
    // Интервал для Instagram
    setInterval(async () => {
        const instagramCountElement = document.getElementById('instagramCount');
        if (!instagramCountElement) return;
        
        const client = getSupabaseClient();
        if (!client) return;
        
        try {
            const { data, error } = await client
                .from('startzero_counters')
                .select('count, updated_at')
                .eq('counter_type', 'instagram')
                .maybeSingle();
            
            if (error || !data) {
                // Данных нет - показываем "подсчет..."
                const currentText = instagramCountElement.textContent.trim();
                if (currentText !== 'подсчет...') {
                    instagramCountElement.textContent = 'подсчет...';
                    instagramCountElement.style.opacity = '0.7';
                    instagramCountElement.style.fontSize = '1.2rem';
                    instagramCountElement.style.fontStyle = 'italic';
                    instagramCountElement.classList.add('counting');
                }
                return;
            }
            
            const newInstagramCount = parseFloat(data.count) || 0;
            const currentText = instagramCountElement.textContent.trim();
            
            // Показываем данные если они есть в базе (независимо от свежести)
            if (newInstagramCount > 0) {
                if (currentText === 'подсчет...') {
                    // Если показывается "подсчет..." и данные получены - обновляем
                    instagramCountElement.style.opacity = '1';
                    instagramCountElement.style.fontSize = '1.8rem';
                    instagramCountElement.style.fontStyle = 'normal';
                    instagramCountElement.classList.remove('counting');
                    animateNumber(instagramCountElement, 0, newInstagramCount, 500);
                    console.log(`✅ Instagram счетчик обновлен: ${newInstagramCount.toLocaleString('ru-RU')} подписчиков`);
                } 
                // Если данные есть и значение изменилось - обновляем
                else {
                    const currentCount = parseFloat(currentText.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '')) || 0;
                    if (Math.abs(currentCount - newInstagramCount) > 0) {
                        console.log(`🔄 Обновление Instagram счетчика: ${currentCount} → ${newInstagramCount}`);
                        animateNumber(instagramCountElement, currentCount, newInstagramCount, 500);
                    }
                }
            }
            // Если данных нет (равны 0) - показываем "подсчет..."
            else if (newInstagramCount === 0) {
                if (currentText !== 'подсчет...') {
                    instagramCountElement.textContent = 'подсчет...';
                    instagramCountElement.style.opacity = '0.7';
                    instagramCountElement.style.fontSize = '1.2rem';
                    instagramCountElement.style.fontStyle = 'italic';
                    instagramCountElement.classList.add('counting');
                }
            }
        } catch (error) {
            console.error('Ошибка обновления Instagram счетчика:', error);
        }
    }, 60 * 1000); // Обновляем каждую минуту
    
    // Интервал для TikTok
    setInterval(async () => {
        const tiktokCountElement = document.getElementById('tiktokCount');
        if (!tiktokCountElement) return;
        
        const client = getSupabaseClient();
        if (!client) return;
        
        try {
            const { data, error } = await client
                .from('startzero_counters')
                .select('count, updated_at')
                .eq('counter_type', 'tiktok')
                .maybeSingle();
            
            if (error || !data) {
                // Данных нет - показываем "подсчет..."
                const currentText = tiktokCountElement.textContent.trim();
                if (currentText !== 'подсчет...') {
                    tiktokCountElement.textContent = 'подсчет...';
                    tiktokCountElement.style.opacity = '0.7';
                    tiktokCountElement.style.fontSize = '1.2rem';
                    tiktokCountElement.style.fontStyle = 'italic';
                    tiktokCountElement.classList.add('counting');
                }
                return;
            }
            
            const newTikTokCount = parseFloat(data.count) || 0;
            const currentText = tiktokCountElement.textContent.trim();
            
            // Показываем данные если они есть в базе (независимо от свежести)
            if (newTikTokCount > 0) {
                if (currentText === 'подсчет...') {
                    // Если показывается "подсчет..." и данные получены - обновляем
                    tiktokCountElement.style.opacity = '1';
                    tiktokCountElement.style.fontSize = '1.8rem';
                    tiktokCountElement.style.fontStyle = 'normal';
                    tiktokCountElement.classList.remove('counting');
                    animateNumber(tiktokCountElement, 0, newTikTokCount, 500);
                    console.log(`✅ TikTok счетчик обновлен: ${newTikTokCount.toLocaleString('ru-RU')} подписчиков`);
                } 
                // Если данные есть и значение изменилось - обновляем
                else {
                    const currentCount = parseFloat(currentText.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '')) || 0;
                    if (Math.abs(currentCount - newTikTokCount) > 0) {
                        console.log(`🔄 Обновление TikTok счетчика: ${currentCount} → ${newTikTokCount}`);
                        animateNumber(tiktokCountElement, currentCount, newTikTokCount, 500);
                    }
                }
            }
            // Если данных нет (равны 0) - показываем "подсчет..."
            else if (newTikTokCount === 0) {
                if (currentText !== 'подсчет...') {
                    tiktokCountElement.textContent = 'подсчет...';
                    tiktokCountElement.style.opacity = '0.7';
                    tiktokCountElement.style.fontSize = '1.2rem';
                    tiktokCountElement.style.fontStyle = 'italic';
                    tiktokCountElement.classList.add('counting');
                }
            }
        } catch (error) {
            console.error('Ошибка обновления TikTok счетчика:', error);
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
function handleSocialClick(event, socialName) {
    event.preventDefault();
    event.stopPropagation();
    
    const url = SOCIAL_URLS[socialName];
    if (!url || url === '#') return;
    
    // Определяем тип устройства
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isInAppBrowser = /Telegram|Instagram|TikTok|Line|Kakao|WeChat|FBAN|FBAV/i.test(navigator.userAgent);
    
    if (isMobile || isInAppBrowser) {
        // На мобильных/встроенных браузерах — обычный переход (не дублирует)
        window.location.href = url;
    } else {
        // На ПК — открываем ТОЛЬКО в новой вкладке (не трогаем текущую)
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

// Показать уведомление для соцсети
// Универсальное уведомление
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'wish-notification';
    if (type === 'error') notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    else if (type === 'warning') notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    else if (type === 'success') notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    notification.innerHTML = message;
    document.body.appendChild(notification);
    setTimeout(() => { notification.classList.add('show'); }, 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => { if (document.body.contains(notification)) document.body.removeChild(notification); }, 300);
    }, 4000);
}

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

// ==================== АНИМАЦИЯ КНОПКИ «ЖДЁМС» ====================


// Создаём эффект частиц при нажатии
function createWishParticles(btnRect) {
    const container = document.createElement('div');
    container.className = 'wish-particles-container';
    document.body.appendChild(container);
    
    const emojis = ['✨', '💜', '⭐', '🌟', '💫', '🎉', '🎊', '🔮', '💎', '🦋'];
    const cx = btnRect.left + btnRect.width / 2;
    const cy = btnRect.top + btnRect.height / 2;
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'wish-particle';
        particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        
        const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 0.5;
        const dist = 80 + Math.random() * 120;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        
        particle.style.left = cx + 'px';
        particle.style.top = cy + 'px';
        particle.style.setProperty('--dx', dx + 'px');
        particle.style.setProperty('--dy', dy + 'px');
        particle.style.animationDelay = (Math.random() * 0.3) + 's';
        particle.style.fontSize = (1 + Math.random() * 1.5) + 'rem';
        
        container.appendChild(particle);
    }
    
    setTimeout(() => container.remove(), 2500);
}

// Создаём конфетти
function createWishConfetti() {
    const colors = ['#a855f7', '#ec4899', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4'];
    
    for (let i = 0; i < 40; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'wish-confetti';
        confetti.style.left = (Math.random() * 100) + 'vw';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = (6 + Math.random() * 8) + 'px';
        confetti.style.height = (6 + Math.random() * 8) + 'px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        confetti.style.animationDelay = (Math.random() * 1) + 's';
        confetti.style.animationDuration = (2 + Math.random() * 1.5) + 's';
        
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4000);
    }
}

// Создаём текст "+1" над кнопкой
function createPlusOne(btn) {
    const plusOne = document.createElement('div');
    plusOne.className = 'wish-plus-one';
    plusOne.textContent = '+1';
    btn.style.position = 'relative';
    btn.appendChild(plusOne);
    setTimeout(() => plusOne.remove(), 1200);
}

// Пульсирующее кольцо вокруг кнопки
function createWishRing(btn) {
    const ring = document.createElement('div');
    ring.className = 'wish-btn-ring';
    btn.style.position = 'relative';
    btn.appendChild(ring);
    setTimeout(() => ring.remove(), 800);
}

// Отмена голоса «Ждёмс»
async function handleWishUndo() {
    const wishUndoBtn = document.getElementById('wishUndoBtn');
    const wishBtn = document.getElementById('wishBtn');
    const wishNote = document.getElementById('wishNote');
    const wishCountEl = document.getElementById('wishCount');
    
    if (wishUndoBtn) wishUndoBtn.disabled = true;
    
    try {
        const client = getSupabaseClient();
        if (!client) {
            showNotification('❌ Нет подключения к серверу', 'error');
            if (wishUndoBtn) wishUndoBtn.disabled = false;
            return;
        }
        
        const fingerprint = getUserFingerprint();
        
        // Удаляем запись клика для этого пользователя
        const { error: deleteError } = await client.from('startzero_user_clicks')
            .delete()
            .eq('user_fingerprint', fingerprint)
            .eq('counter_type', 'wish');
        
        if (deleteError) {
            console.error('Ошибка удаления клика:', deleteError);
            throw deleteError;
        }
        
        // Уменьшаем общий счётчик на 1
        const currentCount = await loadCounterFromSupabase('wish');
        if (currentCount > 0) {
            await client.from('startzero_counters')
                .update({ count: currentCount - 1 })
                .eq('counter_type', 'wish');
        }
        
        // Сбрасываем localStorage
        localStorage.removeItem(WISH_STORAGE_KEY);
        
        // Обновляем UI — возвращаем кнопку в исходное состояние
        if (wishBtn) {
            wishBtn.disabled = false;
            wishBtn.classList.remove('clicked');
            wishBtn.innerHTML = '<span class="wish-btn-text">Ждёмс!</span><span class="wish-btn-emoji">✨</span>';
            wishBtn.style.pointerEvents = '';
            delete wishBtn.dataset.processing;
        }
        
        if (wishNote) {
            wishNote.style.display = 'none';
            wishNote.textContent = '';
        }
        
        // Скрываем кнопку отмены
        if (wishUndoBtn) wishUndoBtn.style.display = 'none';
        
        // Обновляем счётчик с анимацией
        const newCount = await loadCounterFromSupabase('wish');
        if (wishCountEl) {
            animateNumber(wishCountEl, currentCount, newCount, 500);
        }
        
        showNotification('↩ Голос отменён', 'info');
    } catch (e) {
        console.error('Ошибка отмены голоса:', e);
        showNotification('❌ Не удалось отменить', 'error');
        if (wishUndoBtn) wishUndoBtn.disabled = false;
    }
}

// Экспорт функций
window.handleWishClick = handleWishClick;
window.handleWishUndo = handleWishUndo;
window.handleSocialClick = handleSocialClick;
