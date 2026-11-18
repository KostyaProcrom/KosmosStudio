# KosmosStudio

Сайт независимой студии KosmosStudio: визитка и витрина проектов.
Первый проект в портфолио — [BritonLauncher](https://kostyaprocrom.github.io/BritonLauncher/),
лаунчер Minecraft для Windows.

## Структура

```
index.html                  страница сайта
assets/css/style.css        стили (дизайн-система в :root)
assets/js/main.js           меню, анимации появления, звёздный фон
assets/img/                 логотип, favicon, скриншоты проектов
```

Сайт статический: без сборки, зависимостей и бэкенда. Достаточно открыть
`index.html` в браузере или положить папку на любой статический хостинг
(GitHub Pages, Netlify, Cloudflare Pages).

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
