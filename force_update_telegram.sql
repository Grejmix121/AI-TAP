-- ============================================
-- ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ СЧЕТЧИКА TELEGRAM
-- Выполните этот SQL код в Supabase SQL Editor
-- ============================================

-- Удаляем старое значение чтобы бот мог создать новое с актуальными данными
DELETE FROM public.startzero_counters 
WHERE counter_type = 'telegram';

-- Проверяем что запись удалена
SELECT 
    'Проверка удаления' as статус,
    COUNT(*) as количество_записей
FROM public.startzero_counters 
WHERE counter_type = 'telegram';

-- После выполнения этого скрипта:
-- 1. Бот создаст новую запись с актуальным количеством подписчиков
-- 2. Сайт начнет показывать правильное значение
-- 3. Бот будет обновлять значение каждые 5 минут

-- Если хотите установить конкретное значение вручную, используйте:
-- INSERT INTO public.startzero_counters (counter_type, count) 
-- VALUES ('telegram', 5)
-- ON CONFLICT (counter_type) DO UPDATE SET count = EXCLUDED.count;
