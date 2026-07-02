FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    fonts-dejavu-core \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install psycopg2-binary==2.9.9

COPY backend/ .

EXPOSE 8000

CMD ["sh", "-c", \
    "if [ -f /app/dps-nodejs/package.json ] && [ ! -d /app/dps-nodejs/node_modules ]; then echo '[STARTUP] Installing dps-nodejs npm packages...'; cd /app/dps-nodejs && npm install --production; fi && \
    uvicorn api.main:app --host 0.0.0.0 --port 8000"]
