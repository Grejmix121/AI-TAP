-- ============================================
-- СОЗДАНИЕ ТАБЛИЦ ДЛЯ STARTZERO СЧЕТЧИКОВ
-- Выполните этот SQL код в Supabase SQL Editor
-- ============================================

-- Удаляем таблицы если они существуют (для пересоздания)
DROP TABLE IF EXISTS public.startzero_user_clicks CASCADE;
DROP TABLE IF EXISTS public.startzero_counters CASCADE;

-- Таблица для хранения глобальных счетчиков
CREATE TABLE public.startzero_counters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  counter_type TEXT NOT NULL UNIQUE, -- 'wish', 'telegram', 'instagram', 'tiktok'
  count INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Таблица для отслеживания пользователей которые уже нажали
CREATE TABLE public.startzero_user_clicks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_fingerprint TEXT NOT NULL, -- Уникальный идентификатор устройства/браузера
  counter_type TEXT NOT NULL, -- 'wish', 'telegram', 'instagram', 'tiktok'
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_fingerprint, counter_type)
);

-- Включаем RLS (Row Level Security)
ALTER TABLE public.startzero_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startzero_user_clicks ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если они существуют
DROP POLICY IF EXISTS "Anyone can read counters" ON public.startzero_counters;
DROP POLICY IF EXISTS "Anyone can update counters" ON public.startzero_counters;
DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.startzero_user_clicks;
DROP POLICY IF EXISTS "Anyone can read clicks" ON public.startzero_user_clicks;

-- Политика: все могут читать счетчики
CREATE POLICY "Anyone can read counters" ON public.startzero_counters
  FOR SELECT USING (true);

-- Политика: все могут обновлять счетчики (для увеличения)
CREATE POLICY "Anyone can update counters" ON public.startzero_counters
  FOR UPDATE USING (true);

-- Политика: все могут создавать записи о кликах
CREATE POLICY "Anyone can insert clicks" ON public.startzero_user_clicks
  FOR INSERT WITH CHECK (true);

-- Политика: все могут читать клики (для проверки)
CREATE POLICY "Anyone can read clicks" ON public.startzero_user_clicks
  FOR SELECT USING (true);

-- Инициализация счетчиков (вставляем только если их еще нет)
INSERT INTO public.startzero_counters (counter_type, count) 
VALUES 
  ('wish', 0),
  ('telegram', 0),
  ('instagram', 0),
  ('tiktok', 0)
ON CONFLICT (counter_type) DO NOTHING;

-- Проверка что таблицы созданы
SELECT 'Таблица startzero_counters создана' as status, COUNT(*) as records FROM public.startzero_counters;
SELECT 'Таблица startzero_user_clicks создана' as status, COUNT(*) as records FROM public.startzero_user_clicks;
