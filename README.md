# VPN MANAGER k1t0 — GitHub Pages + Supabase

Готовая статическая версия: сайт лежит на GitHub Pages, клиенты сохраняются в Supabase и доступны с телефона/ПК.

## 1. Supabase
1. Создай проект на Supabase.
2. Открой SQL Editor -> New query.
3. Вставь весь файл `supabase_setup.sql` и нажми Run.
4. Открой Authentication -> Users -> Add user -> Create new user.
5. Создай свой email + сложный пароль. Регистрации с сайта специально нет.

## 2. config.js
В Supabase открой Project Settings -> API и возьми:
- Project URL
- anon/public key

Вставь их в `config.js`.

Важно: используй только anon/public key. НЕ вставляй service_role key.

## 3. GitHub
1. Создай репозиторий `vpn-manager`.
2. Загрузи в корень все файлы из архива.
3. Settings -> Pages.
4. Source: Deploy from a branch.
5. Branch: main, folder: / (root), Save.
6. GitHub выдаст адрес вида `https://ТВОЙ_НИК.github.io/vpn-manager/`.

## Что уже есть
- Облачное хранение клиентов.
- Авторизация Supabase.
- RLS: каждый аккаунт видит только свои записи.
- Имя, телефон, дата начала, заметка.
- Автоматический конец подписки.
- Поиск.
- Статусы и остаток дней.
- Продление: 14 дней / 1 / 2 / 6 / 12 месяцев.
- Редактирование и удаление.
- Нормальная мобильная версия.
- Исправленное поле даты на телефоне.

Если подписка активна, продление идёт от текущей даты окончания. Если истекла — от сегодняшней даты.
