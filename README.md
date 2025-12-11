# Система расчета комиссий

MVP система для управления комиссиями менеджеров по предоплатам.

## Функционал

- Загрузка данных по ФГ и предоплатам (CSV)
- Управление менеджерами (Recruiters и Account Managers)
- Настройка правил комиссий с именами
- Milestones с группировкой менеджеров
- Автоматический расчет комиссий и бонусов
- Редактирование источников и менеджеров в отчете
- Фильтры по датам и датам начала работы менеджеров

## Деплой на Netlify

### Вариант 1: Drag & Drop (самый простой)

1. Открыть https://app.netlify.com/drop
2. Перетащить папку `build/` в окно браузера
3. Готово! Netlify даст ссылку на сайт

### Вариант 2: Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=build
```

### Вариант 3: GitHub

1. Создать репозиторий на GitHub
2. Запушить код:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

3. В Netlify:
   - New site from Git
   - Выбрать репозиторий
   - Build command: `npm run build`
   - Publish directory: `build`
   - Deploy site

## Локальная разработка

```bash
npm install
npm start
```

Откроется http://localhost:3000

## Пересборка

```bash
npm run build
```

Результат в папке `build/`

## Структура данных

### CSV с ФГ
Колонки: ФГ, ГЕО, Валюта, Аккаунт на платформе, Номер ФГ, и т.д.

### CSV с предоплатами
Колонки: Номер фин. группы, Фин. группа, Страна, Пополнения $, Количество, Период, Проект

## Технологии

- React 19
- Lucide React (иконки)
- Tailwind CSS (через классы)
- Netlify (хостинг)
