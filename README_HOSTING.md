# Інструкція з розгортання проекту UniTax на хостингу

Цей архів містить повністю налаштований проект, включаючи конфігураційний файл `.env`, який підключений до вашої бази даних на Fly.io. Вам не потрібно нічого редагувати у файлах.

Оберіть один із двох варіантів встановлення залежно від типу вашого хостингу:

---

## Варіант 1. У вас VPS / VDS (сервер з доступом по SSH) — РЕКОМЕНДОВАНО

Проект повністю спакований у Docker-контейнери. Для його запуску виконайте такі кроки:

### 1. Встановлення Docker та Docker Compose (якщо вони ще не встановлені)
Увійдіть на ваш сервер через SSH та виконайте команди:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
```

### 2. Запуск проекту
Перейдіть у папку з розпакованим проектом та запустіть його:
```bash
docker-compose up -d --build
```
*Це запустить Frontend на порту `3000`, Backend на порту `8000` та Telegram-бота.*

### 3. Налаштування Nginx (веб-сервера)
Створіть конфігураційний файл Nginx для вашого домену:
```bash
sudo nano /etc/nginx/sites-available/unitax.pro
```
Вставте туди такий текст (замініть домен, якщо потрібно):
```nginx
server {
    listen 80;
    server_name www.unitax.pro unitax.pro;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.unitax.pro;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Збережіть файл (`Ctrl+O`, `Enter`, `Ctrl+X`) та активуйте його:
```bash
sudo ln -s /etc/nginx/sites-available/unitax.pro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Отримання безкоштовного SSL-сертифіката (HTTPS)
```bash
sudo certbot --nginx -d unitax.pro -d www.unitax.pro -d api.unitax.pro
```
*Дотримуйтесь інструкцій на екрані. Сертифікат буде встановлено автоматично.*

---

## Варіант 2. У вас звичайний віртуальний хостинг (cPanel, Plesk, BrainyCP тощо)

Якщо ваш хостинг не має SSH або Docker, ви можете запустити додатки через вбудовані менеджери хостингу:

### 1. Налаштування Frontend (Next.js)
1. Знайдіть у панелі керування хостингом розділ **«Setup Node.js App»** (або «Налаштування Node.js додатків»).
2. Натисніть **«Create Application»** (Створити додаток):
   * **Node.js version**: оберіть `18.x` або `20.x`.
   * **Application mode**: `production`.
   * **Application root**: вкажіть шлях до папки `frontend`.
   * **Application URL**: оберіть `www.unitax.pro`.
3. Збережіть та запустіть додаток. Хостинг автоматично переспрямує домен на додаток Next.js.

### 2. Налаштування Backend (FastAPI)
1. Знайдіть розділ **«Setup Python App»** (або «Налаштування Python додатків»).
2. Натисніть **«Create Application»** (Створити додаток):
   * **Python version**: оберіть `3.10.x` або `3.11.x`.
   * **Application root**: вкажіть шлях до папки `backend`.
   * **Application URL**: оберіть `api.unitax.pro`.
   * **Application startup file**: `api/main.py`.
3. Збережіть та запустіть.
