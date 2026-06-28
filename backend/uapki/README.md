# UAPKI Integration for DPS API

Цей модуль забезпечує інтеграцію з бібліотекою UAPKI для генерації цифрових підписів та взаємодії з API Державної податкової служби (ДПС).

## Огляд

UAPKI - це відкрита криптографічна бібліотека, що підтримує українські стандарти:
- DSTU 4145-2002 (ДСТУ 4145-2002)
- DSTU 7564
- RSA, ECDSA, EC-GDSA, EC-RDSA
- Підтримка JKS та PKCS12 ключів

## Архітектура

### Компоненти

1. **Docker контейнер** (`/backend/uapki/Dockerfile`)
   - Контейнеризує бібліотеку UAPKI v2.0.12
   - Встановлює необхідні залежності
   - Налаштовує шляхи до бібліотек

2. **Python wrapper** (`/backend/services/uapki_client.py`)
   - Клас `UAPKIClient` для взаємодії з бібліотекою через ctypes
   - Використовує JSON інтерфейс UAPKI (`process` + `json_free`)
   - Підтримує генерацію CAdES-BES підписів

3. **Інтеграція з DPS API** (`/backend/services/dps_api.py`)
   - Метод `_build_authorization_signature_uapki()` для генерації підпису
   - Метод `get_oauth_token()` для обміну підпису на токен
   - Метод `fetch_dps_data_with_token()` для отримання даних з токеном
   - Метод `get_dps_data_with_uapki()` для повного потоку

## Процес інтеграції

### Шаг 1: Генерація підпису через UAPKI

```python
from services.uapki_client import UAPKIClient

# Ініціалізація клієнта
uapki = UAPKIClient(lib_path="/usr/local/lib/libuapki.so.2")

# Генерація підпису
signature = uapki.sign_data(
    data="12345678",  # ЄДРПОУ або РНОКПП
    key_file="/path/to/key.jks",
    key_password="password"
)
```

### Шаг 2: Обмін підпису на токен ДПС

```python
from services.dps_api import DPSAPI

dps = DPSAPI(token=None, tax_id="12345678", profile_id=1, db=db)
token = await dps.get_oauth_token(signature)
```

### Шаг 3: Отримання даних з токеном

```python
data = await dps.fetch_dps_data_with_token(token, year=2024)
```

### Повний потік

```python
data = await dps.get_dps_data_with_uapki(year=2024)
```

## JSON інтерфейс UAPKI

UAPKI використовує простий JSON інтерфейс:

### Запит

```json
{
  "method": "SIGN",
  "parameters": {
    "container": "CAdES",
    "level": "BES",
    "detached": false,
    "data": {
      "contentText": "12345678"
    },
    "key": {
      "container": "JKS",
      "file": "/path/to/key.jks",
      "password": "password"
    }
  }
}
```

### Відповідь

```json
{
  "errorCode": 0,
  "errorMessage": "",
  "result": {
    "signatures": [
      {
        "id": "signature1",
        "bytes": "base64_encoded_signature"
      }
    ]
  }
}
```

## Налаштування

### Змінні середовища

- `UAPKI_LIB_PATH`: Шлях до бібліотеки libuapki.so (за замовчуванням: `/usr/local/lib/libuapki.so.2`)

### Docker контейнер

Побудова контейнера:

```bash
cd backend/uapki
docker build -t uapki:latest .
```

Запуск контейнера:

```bash
docker run -d --name uapki -p 8080:8080 uapki:latest
```

## Підтримувані формати ключів

- **JKS** (Java KeyStore) - з паролем
- **PKCS12** (.p12, .pfx) - з паролем
- **PEM** - для приватних ключів та сертифікатів

## Обробка помилок

Інтеграція включає fallback на бібліотеку `cryptography` якщо UAPKI недоступний:

```python
def _build_authorization_signature(self, cert_record) -> str:
    try:
        return self._build_authorization_signature_uapki(cert_record)
    except Exception as e:
        logger.warning(f"UAPKI signature failed, falling back to cryptography: {e}")
        return self._build_authorization_signature_cryptography(cert_record)
```

## Тестування

### Тестування з JKS файлом ПриватБанку

```python
# Завантаження JKS файлу через API
POST /api/certificates/upload
{
  "profile_id": 1,
  "cert_file": <JKS file>,
  "password": "password"
}

# Використання для підпису
data = await dps.get_dps_data_with_uapki(year=2024)
```

## Вимоги

- Python 3.8+
- ctypes (включено в Python)
- httpx для HTTP запитів
- cryptography для роботи з сертифікатами (fallback)
- pyjks для JKS файлів (опціонально)

## Ліцензія

UAPKI ліцензовано під BSD 2-Clause License: https://github.com/specinfo-ua/UAPKI/blob/main/LICENSE

## Ресурси

- UAPKI GitHub: https://github.com/specinfo-ua/UAPKI
- UAPKI Releases: https://github.com/specinfo-ua/UAPKI/releases
- DPS API Документація: https://cabinet.tax.gov.ua/

## Статус інтеграції

- ✅ Дослідження UAPKI бібліотеки
- ✅ Завантаження UAPKI v2.0.12
- ✅ Створення Dockerfile
- ✅ Виявлення JSON інтерфейсу
- ✅ Створення Python wrapper
- ✅ Інтеграція в dps_api.py
- ✅ Реалізація OAuth токен обміну
- ✅ Реалізація отримання даних з токеном
- ⏳ Тестування з JKS файлом ПриватБанку
