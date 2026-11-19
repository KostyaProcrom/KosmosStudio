# KosmosStudio

Сайт независимой студии KosmosStudio: визитка и витрина проектов.
Первый проект в портфолио — [BritonLauncher](https://kostyaprocrom.github.io/BritonLauncher/),
лаунчер Minecraft для Windows.

## Структура

```
index.html                  страница сайта
assets/css/style.css        стили (дизайн-система в :root)
assets/js/main.js           меню, анимации появления, звёздный фон
assets/js/auth.js           регистрация, вход и профиль (Supabase)
assets/js/config.js         URL и anon key проекта Supabase
supabase/schema.sql         таблица профилей, RLS и триггеры
assets/img/                 логотип, favicon, скриншоты проектов
```

Сайт статический: без сборки и зависимостей. Достаточно открыть
`index.html` в браузере или положить папку на любой статический хостинг
(GitHub Pages, Netlify, Cloudflare Pages).

## Аккаунты (Supabase)

Регистрация и вход работают через [Supabase](https://supabase.com):
сайт остаётся статическим, а пользователи и профили хранятся в облачном
Postgres. Пока `assets/js/config.js` пуст, кнопка «Войти» скрыта и сайт
работает как обычная визитка.

Настройка один раз:

1. Создайте бесплатный проект на [supabase.com](https://supabase.com).
2. Откройте **SQL Editor**, вставьте содержимое `supabase/schema.sql`
   и нажмите **Run**.
3. Откройте **Project Settings → API** и скопируйте **Project URL** и
   **anon public key**.
4. Впишите их в `assets/js/config.js`:

   ```js
   window.KOSMOS_CONFIG = {
     SUPABASE_URL: "https://xxxxxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi...",
   };
   ```

5. В **Authentication → URL Configuration** укажите Site URL
   (`https://kostyaprocrom.github.io/KosmosStudio/`) и добавьте его же
   в Redirect URLs — это нужно для подтверждения почты и сброса пароля.
6. Закоммитьте `config.js` и запушьте — на GitHub Pages появятся
   регистрация и вход.

`anon key` публичный: доступ к строкам ограничен RLS-политиками, пароли
хранит Supabase Auth в зашифрованном виде. Ник уникален без учёта
регистра и хранится в таблице `profiles`.

## Как добавить проект

1. Скопируйте блок `<article class="card">` из секции `#projects` в `index.html`.
2. Замените иконку, заголовок, описание, теги и ссылку `card__link`.
3. Если у проекта есть скриншот, положите его в `assets/img/` и используйте
   разметку большого блока `.project--featured` как в BritonLauncher.

## Особенности

- Тёмная «космическая» тема, звёздное небо на `<canvas>`.
- Адаптив от 320 px, мобильное меню, доступная навигация с клавиатуры.
- Поддержка `prefers-reduced-motion`: анимации отключаются.
- Контент виден без JavaScript (класс `.js` ставится инлайн-скриптом).

## Контакты

- GitHub: [github.com/KostyaProcrom](https://github.com/KostyaProcrom)
- BritonLauncher: [сайт](https://kostyaprocrom.github.io/BritonLauncher/) ·
  [исходники](https://github.com/KostyaProcrom/BritonLauncher) ·
  [релизы](https://github.com/KostyaProcrom/BritonLauncher/releases/latest)
