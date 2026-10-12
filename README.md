# Iwoho Launcher — Iwoho Visuals
Только лаунчер (мод/клиент Iwoho в этом репозитории не хранится).

## Запуск
1. Node.js 18+ и Java 17+.
2. `npm install`, затем `npm start`.

## Сборка .exe
Автоматически: каждый push в `main` запускает GitHub Actions → вкладка Actions → последний запуск → Artifacts → `Iwoho-Launcher-Setup`.
Локально: `npm run build` (результат в `dist/`).

## Свой логотип
Замени `assets/logo.svg`. Для иконки .exe добавь `assets/icon.ico` и в `package.json` в `build.win` пропиши `"icon": "assets/icon.ico"`.
