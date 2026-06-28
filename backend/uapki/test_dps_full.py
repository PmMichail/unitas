#!/usr/bin/env python3
"""
Повний тест DPS API з UAPKI підписанням через C++ wrapper
"""

import subprocess
import json
import logging
import httpx
import base64
import sys
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def call_uapki_wrapper(json_file, jks_file):
    """Виклик C++ wrapper для UAPKI з передачею шляху до JSON файлу"""
    try:
        logger.info(f"[TEST] Calling UAPKI wrapper with JSON file path: {json_file}")

        cmd = [
            "/app/uapki_wrapper",
            json_file
        ]

        env = {
            "LD_LIBRARY_PATH": "/usr/local/lib"
        }

        result = subprocess.run(cmd, capture_output=True, text=True, env=env)

        if result.returncode != 0:
            logger.error(f"UAPKI wrapper failed: {result.stderr}")
            return None

        logger.info(f"UAPKI wrapper output: {result.stdout[:500]}")

        # Parse multi-line JSON response - find SIGN response
        lines = result.stdout.split('\n')
        for line in lines:
            if '"method":"SIGN"' in line or '"method": "SIGN"' in line:
                try:
                    # Clean up the line - remove "Response:" prefix if present
                    clean_line = line.split("Response:")[-1].strip()
                    response = json.loads(clean_line)
                    signatures = response.get("result", {}).get("signatures", [])
                    if signatures:
                        signature = signatures[0].get("bytes")
                        logger.info(f"Signature extracted, length: {len(signature)}")
                        return signature
                except Exception as e:
                    logger.error(f"Failed to parse SIGN response: {e}")
                    logger.error(f"Line: {line}")

        logger.error("No signature found in UAPKI wrapper output")
        return None

    except Exception as e:
        logger.error(f"UAPKI wrapper failed: {e}")
        return None

def test_dps_oauth(signature, username):
    """Тестування OAuth токен обміну"""
    logger.info("[TEST] Testing DPS OAuth token exchange")

    try:
        oauth_url = "https://cabinet.tax.gov.ua/ws/auth/oauth/token"

        # Prepare request according to DPS API documentation with proper headers
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "Host": "cabinet.tax.gov.ua",
            "Origin": "https://cabinet.tax.gov.ua",
            "Referer": "https://cabinet.tax.gov.ua/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Authorization": "Basic QUU2ODY3NjY0QzA5NkM4M3UwNTMwMTAxMDA3RjQ1RjQ6QUU2ODY3NjY0QzA5NkM4M3UwNTMwMTAxMDA3RjQ1RjQ="
        }

        # Clean signature from newlines and spaces
        signature_clean = signature.replace('\n', '').replace('\r', '').replace(' ', '')

        # Form data with signature (correct DPS OAuth format)
        data = {
            "grant_type": "password",
            "username": username,  # Dynamic username: [РНОКПП]-[ЄДРПОУ]-[TIMESTAMP]
            "password": signature_clean  # Base64 signature from UAPKI
        }

        logger.info(f"[TEST] OAuth request to: {oauth_url}")
        logger.info(f"[TEST] Username: {username}")
        logger.info(f"[TEST] Signature length: {len(signature_clean) if signature_clean else 0}")

        response = httpx.post(oauth_url, headers=headers, data=data, timeout=30)

        logger.info(f"[TEST] OAuth response status: {response.status_code}")
        logger.info(f"[TEST] OAuth response: {response.text[:500]}")

        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data.get("access_token")
            logger.info(f"[TEST] Access token received: {access_token[:50] if access_token else None}...")
            return access_token
        else:
            logger.error(f"[TEST] OAuth failed with status {response.status_code}")
            return None

    except Exception as e:
        logger.error(f"[TEST] OAuth failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

def test_dps_api(token):
    """Тестування DPS API для отримання даних"""
    logger.info("[TEST] Testing DPS API data fetch")
    
    try:
        api_url = "https://cabinet.tax.gov.ua/ws/public_api/ta/splatp"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Request data for EDRPOU 9883657
        data = {
            "edrpou": "9883657"
        }
        
        logger.info(f"[TEST] API request to: {api_url}")
        
        response = httpx.post(api_url, headers=headers, json=data, timeout=30)
        
        logger.info(f"[TEST] API response status: {response.status_code}")
        logger.info(f"[TEST] API response: {response.text[:500]}")
        
        if response.status_code == 200:
            api_data = response.json()
            logger.info(f"[TEST] Data received successfully")
            return api_data
        else:
            logger.error(f"[TEST] API failed with status {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"[TEST] API failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

def generate_dps_username(edrpou):
    """Генерація username для DPS OAuth"""
    # Використовуємо динамічний timestamp
    timestamp_ms = int(time.time() * 1000)
    # Формат: [ЄДРПОУ]-[TIMESTAMP]
    username = f"{edrpou}-{timestamp_ms}"
    logger.info(f"[TEST] Generated dynamic username: {username}")
    return username

def update_sign_json(username):
    """Оновлення test_sign.json з динамічним username для старого формату"""
    try:
        with open("/app/test_sign.json", "r") as f:
            data = json.load(f)

        # Знайти SIGN task і оновити дані для підпису
        for task in data.get("tasks", []):
            if task.get("method") == "SIGN":
                # Підписуємо повний username
                username_b64 = base64.b64encode(username.encode("utf-8")).decode("utf-8")
                task["parameters"]["dataTbs"][0]["bytes"] = username_b64
                logger.info(f"[TEST] Updated sign data to full username: {username_b64}")
                break

        with open("/app/test_sign.json", "w") as f:
            json.dump(data, f, indent=2)

        return True
    except Exception as e:
        logger.error(f"[TEST] Failed to update sign JSON: {e}")
        return False

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("DPS API Full Test with UAPKI Signing")
    logger.info("=" * 60)

    # Generate dynamic username
    # Реальний ЄДРПОУ з сертифіката в JKS файлі
    edrpou = "2800003498"
    username = generate_dps_username(edrpou)

    # Update sign JSON with dynamic username
    logger.info("\n--- Step 1: Update Sign Data ---")
    if not update_sign_json(username):
        logger.error("[TEST] Failed to update sign JSON")
        sys.exit(1)

    # Step 2: Sign data using UAPKI
    logger.info("\n--- Step 2: UAPKI Signing ---")
    signature = call_uapki_wrapper("/app/test_sign.json", "/app/test_key.jks")

    if not signature:
        logger.error("[TEST] UAPKI signing failed")
        sys.exit(1)

    logger.info(f"[TEST] Signature generated, length: {len(signature)}")

    # Step 3: Exchange signature for OAuth token
    logger.info("\n--- Step 3: DPS OAuth ---")
    token = test_dps_oauth(signature, username)

    if not token:
        logger.error("[TEST] DPS OAuth failed")
        sys.exit(1)

    # Step 4: Fetch data using token
    logger.info("\n--- Step 4: DPS API ---")
    data = test_dps_api(token)

    if not data:
        logger.error("[TEST] DPS API failed")
        sys.exit(1)

    logger.info("\n" + "=" * 60)
    logger.info("Full DPS API test PASSED!")
    logger.info("=" * 60)
