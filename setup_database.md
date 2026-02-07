# Инструкция по подключению базы данных для StartZero

## Шаги для подключения Supabase к странице StartZero

### 1. Выполните SQL скрипт в Supabase

Откройте Supabase Dashboard → SQL Editor и выполните следующий SQL код:

```sql
-- Таблица для хранения глобальных счетчиков
CREATE TABLE IF NOT EXISTS public.startzero_counters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  counter_type TEXT NOT NULL UNIQUE, -- 'wish', 'telegram', 'instagram', 'tiktok'
  count INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Таблица для отслеживания пользователей которые уже нажали
CREATE TABLE IF NOT EXISTS public.startzero_user_clicks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_fingerprint TEXT NOT NULL, -- Уникальный идентификатор устройства/браузера
  counter_type TEXT NOT NULL, -- 'wish', 'telegram', 'instagram', 'tiktok'
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_fingerprint, counter_type)
);

-- RLS политики для счетчиков (публичный доступ для чтения, только создание для кликов)
ALTER TABLE public.startzero_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startzero_user_clicks ENABLE ROW LEVEL SECURITY;

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

-- Инициализация счетчиков
INSERT INTO public.startzero_counters (counter_type, count) 
VALUES 
  ('wish', 0),
  ('telegram', 0),
  ('instagram', 0),
  ('tiktok', 0)
ON CONFLICT (counter_type) DO NOTHING;
```

### 2. Проверьте подключение

После выполнения SQL скрипта:

1. Откройте страницу `StartZero/index.html` в браузере
2. Откройте консоль разработчика (F12)
3. Должно появиться сообщение: `✅ Supabase клиент инициализирован для StartZero`
4. Счетчики должны загрузиться из базы данных (если база пустая, будут показываться 0)

### 3. Проверка работы счетчиков

1. Нажмите кнопку "Ждёмс!" - счетчик должен увеличиться
2. Обновите страницу - счетчик должен сохраниться
3. Откройте страницу с другого устройства - счетчик должен быть таким же
4. Попробуйте нажать еще раз - кнопка должна быть неактивна

### 4. Проверка в Supabase Dashboard

Вы можете проверить данные в Supabase Dashboard:

- **Table Editor** → `startzero_counters` - здесь хранятся значения счетчиков
- **Table Editor** → `startzero_user_clicks` - здесь хранятся записи о кликах пользователей

### 5. Если что-то не работает

**Проблема:** Счетчики не загружаются, показывается 0
- **Решение:** Проверьте что SQL скрипт выполнен полностью и таблицы созданы

**Проблема:** Ошибка в консоли "Supabase SDK не загружен"
- **Решение:** Проверьте подключение к интернету и что CDN доступен

**Проблема:** Счетчики не синхронизируются между устройствами
- **Решение:** Убедитесь что RLS политики созданы правильно и разрешают чтение/запись

### 6. Текущие настройки Supabase

- **URL:** `https://nzwvynxiaccqomyzmorv.supabase.co`
- **Anon Key:** `sb_publishable_FODWXSmBupBawbN8EverLw_1NyZ_oBq`

Эти настройки уже прописаны в `index.html` и `script.js`, менять их не нужно.

---

## Что делает система счетчиков

1. **Глобальные счетчики** (`startzero_counters`):
   - Хранят общее количество кликов по каждому типу (wish, telegram, instagram, tiktok)
   - Видны всем пользователям в реальном времени

2. **Отслеживание кликов** (`startzero_user_clicks`):
   - Сохраняет информацию о том, какие пользователи уже нажали
   - Использует fingerprint браузера для идентификации устройства
   - Предотвращает повторные клики с одного устройства

3. **Синхронизация**:
   - Все счетчики синхронизируются через Supabase
   - Изменения видны всем пользователям сразу
   - Есть fallback на localStorage если Supabase недоступен
