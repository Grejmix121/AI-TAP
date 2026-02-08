-- ============================================
-- СОЗДАНИЕ ТАБЛИЦ ДЛЯ STARTZERO СЧЕТЧИКОВ
-- Скопируйте ВЕСЬ этот код и выполните в Supabase SQL Editor
-- ============================================

-- Шаг 1: Создаем таблицу для счетчиков
CREATE TABLE IF NOT EXISTS public.startzero_counters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  counter_type TEXT NOT NULL UNIQUE,
  count INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Шаг 2: Создаем таблицу для отслеживания кликов пользователей
CREATE TABLE IF NOT EXISTS public.startzero_user_clicks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_fingerprint TEXT NOT NULL,
  counter_type TEXT NOT NULL,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_fingerprint, counter_type)
);

-- Шаг 3: Включаем RLS (Row Level Security)
ALTER TABLE public.startzero_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startzero_user_clicks ENABLE ROW LEVEL SECURITY;

-- Шаг 4: Удаляем старые политики если они существуют (чтобы избежать ошибок)
DROP POLICY IF EXISTS "Anyone can read counters" ON public.startzero_counters;
DROP POLICY IF EXISTS "Anyone can insert counters" ON public.startzero_counters;
DROP POLICY IF EXISTS "Anyone can update counters" ON public.startzero_counters;
DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.startzero_user_clicks;
DROP POLICY IF EXISTS "Anyone can read clicks" ON public.startzero_user_clicks;

-- Шаг 5: Создаем политики безопасности (разрешаем всем читать, обновлять и вставлять)
CREATE POLICY "Anyone can read counters" ON public.startzero_counters
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert counters" ON public.startzero_counters
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update counters" ON public.startzero_counters
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can insert clicks" ON public.startzero_user_clicks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read clicks" ON public.startzero_user_clicks
  FOR SELECT USING (true);

-- Шаг 6: Инициализируем счетчики начальными значениями
-- Устанавливаем начальные значения (точки в значениях - это разделители тысяч)
-- Если счетчик уже существует - обновляем только если текущее значение меньше начального
INSERT INTO public.startzero_counters (counter_type, count) 
VALUES 
  ('wish', 132843),
  ('telegram', 32342),
  ('instagram', 16324),
  ('tiktok', 20163),
  ('project_progress', 85)
ON CONFLICT (counter_type) DO UPDATE 
SET count = CASE 
    WHEN startzero_counters.count < EXCLUDED.count THEN EXCLUDED.count
    ELSE startzero_counters.count
  END,
  updated_at = TIMEZONE('utc'::text, NOW());

-- Шаг 7: Публикуем таблицы через PostgREST API (ВАЖНО для Netlify и внешнего доступа!)
-- Это делает таблицы доступными через REST API Supabase
-- Используем DO блок для обработки ошибок, если таблицы уже добавлены
DO $$
BEGIN
    -- Добавляем таблицы в публикацию, если их еще нет
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'startzero_counters'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.startzero_counters;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'startzero_user_clicks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.startzero_user_clicks;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Игнорируем ошибки, если таблицы уже добавлены
        NULL;
END $$;

-- Шаг 8: Даем права на использование таблиц через API
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.startzero_counters TO anon, authenticated;
GRANT ALL ON public.startzero_user_clicks TO anon, authenticated;

-- Шаг 9: Проверяем что все создано правильно
SELECT 
  'Проверка таблиц' as проверка,
  (SELECT COUNT(*) FROM public.startzero_counters) as счетчики_записей,
  (SELECT COUNT(*) FROM public.startzero_user_clicks) as клики_записей;

-- Если вы видите результат с 4 записями в счетчики_записей - все готово! ✅
-- После выполнения подождите 10-30 секунд для обновления кеша схемы
