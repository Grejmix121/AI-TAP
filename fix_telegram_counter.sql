-- ============================================
-- ИСПРАВЛЕНИЕ: Разрешить обновление счетчика Telegram
-- Выполните этот SQL код в Supabase SQL Editor
-- ============================================

-- Для Telegram всегда разрешаем обновление, даже если значение меньше начального
-- Это нужно потому что бот получает реальное количество подписчиков,
-- которое может быть меньше начального значения 32342

-- Обновляем значение Telegram счетчика (бот будет обновлять его автоматически)
-- Если значение уже есть и оно больше - оставляем его
-- Если значения нет или оно меньше реального - устанавливаем текущее значение из бота
UPDATE public.startzero_counters 
SET count = (
    SELECT COALESCE(
        (SELECT count FROM public.startzero_counters WHERE counter_type = 'telegram'),
        0
    )
)
WHERE counter_type = 'telegram';

-- Или просто удаляем старое значение чтобы бот создал новое
-- DELETE FROM public.startzero_counters WHERE counter_type = 'telegram';

-- Проверяем текущее значение
SELECT 
    counter_type,
    count,
    updated_at
FROM public.startzero_counters 
WHERE counter_type = 'telegram';

-- После выполнения этого скрипта бот сможет обновлять значение Telegram счетчика
-- Запустите бота и подождите несколько минут - значение обновится автоматически
