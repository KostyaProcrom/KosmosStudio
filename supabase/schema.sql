-- =========================================================
--  KosmosStudio — схема базы Supabase
-- =========================================================
--  Выполните этот файл целиком в Supabase Dashboard → SQL Editor.
--  Скрипт можно запускать повторно: он не удаляет данные.
--
--  Что создаётся:
--    • public.profiles — публичные профили (ник, даты)
--    • RLS-политики: читать и менять можно только свой профиль
--    • уникальный ник без учёта регистра
--    • триггер: профиль создаётся автоматически при регистрации
--    • функция username_available() для проверки ника до регистрации
-- =========================================================

-- ---------- Таблица профилей ----------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_length check (char_length(username) between 3 and 24),
  constraint profiles_username_format check (username ~ '^[A-Za-zА-Яа-яЁё0-9_-]+$')
);

-- Ник уникален без учёта регистра: Kosmos и kosmos — один и тот же ник.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- ---------- Обновление updated_at ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Прямая вставка запрещена: профиль создаёт триггер ниже.
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

-- ---------- Создание профиля при регистрации ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_name text;
begin
  desired_name := nullif(trim(new.raw_user_meta_data ->> 'username'), '');

  if desired_name is null then
    desired_name := regexp_replace(
      split_part(coalesce(new.email, 'player'), '@', 1),
      '[^A-Za-zА-Яа-яЁё0-9_-]', '', 'g'
    );

    if char_length(desired_name) < 3 then
      desired_name := 'player';
    end if;

    desired_name := left(desired_name, 18) || '_' || left(new.id::text, 4);
  end if;

  -- Ник из формы регистрации. Если он занят, сработает уникальный индекс,
  -- и Supabase вернёт ошибку — клиент покажет «ник уже занят».
  insert into public.profiles (id, username)
  values (new.id, left(desired_name, 24))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Проверка свободного ника ----------

create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from public.profiles
    where lower(username) = lower(trim(candidate))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- Права доступа ----------

grant select, update on public.profiles to authenticated;

-- =========================================================
--  Готово. Теперь скопируйте Project URL и anon key
--  (Project Settings → API) в assets/js/config.js
-- =========================================================
