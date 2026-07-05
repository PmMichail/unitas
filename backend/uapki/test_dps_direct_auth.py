#!/usr/bin/env python3
"""
Тест DPS API з прямою авторизацією через Authorization header
Згідно з офіційною документацією: https://cabinet.tax.gov.ua/help/api-registers-int.html
"""

import subprocess
import json
import logging
import httpx
import base64
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def call_uapki_wrapper(json_file):
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

def test_dps_direct_auth(signature, edrpou):
    """Тестування прямої авторизації через Authorization header"""
    logger.info("[TEST] Testing DPS direct authorization via Authorization header")

    try:
        # API endpoint for tax accounts
        api_url = "https://cabinet.tax.gov.ua/ws/public_api/ta/splatp?year=2024"

        # Clean signature from newlines and spaces
        signature_clean = signature.replace('\n', '').replace('\r', '').replace(' ', '')

        # According to DPS documentation:
        # Authorization: ЄДРПОУ/РНОКПП підписаний внутрішнім підписом з додаванням сертифікату в BASE64
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": signature_clean,  # Base64 signature with embedded certificate
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Host": "cabinet.tax.gov.ua",
            "Origin": "https://cabinet.tax.gov.ua",
            "Referer": "https://cabinet.tax.gov.ua/"
        }

        logger.info(f"[TEST] API request to: {api_url}")
        logger.info(f"[TEST] Authorization header length: {len(signature_clean)}")
        logger.info(f"[TEST] Authorization header (first 100 chars): {signature_clean[:100]}...")

        response = httpx.get(api_url, headers=headers, timeout=30)

        logger.info(f"[TEST] API response status: {response.status_code}")
        logger.info(f"[TEST] API response: {response.text[:1000]}")

        if response.status_code == 200:
            api_data = response.json()
            logger.info(f"[TEST] Data received successfully")
            return api_data
        else:
            logger.error(f"[TEST] API failed with status {response.status_code}")
            return None

    except Exception as e:
        logger.error(f"[TEST] Direct auth failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

def update_sign_json(edrpou):
    """Оновлення test_sign.json з ЄДРПОУ + timestamp для підпису"""
    try:
        with open("/app/test_sign.json", "r") as f:
            data = json.load(f)

        # Знайти SIGN task і оновити дані для підпису
        for task in data.get("tasks", []):
            if task.get("method") == "SIGN":
                # Підписуємо ЄДРПОУ + timestamp для запобігання replay атак
                import time
                timestamp_ms = int(time.time() * 1000)
                data_to_sign = f"{edrpou}-{timestamp_ms}"
                data_b64 = base64.b64encode(data_to_sign.encode("utf-8")).decode("utf-8")
                task["parameters"]["dataTbs"][0]["bytes"] = data_b64
                logger.info(f"[TEST] Updated sign data to EDRPOU+timestamp: {data_to_sign}")
                break

        with open("/app/test_sign.json", "w") as f:
            json.dump(data, f, indent=2)

        return True
    except Exception as e:
        logger.error(f"[TEST] Failed to update sign JSON: {e}")
        return False

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("DPS API Direct Authorization Test")
    logger.info("=" * 60)

    # Реальний ЄДРПОУ з сертифіката в JKS файлі
    edrpou = "2800003498"

    # Step 1: Update sign JSON with EDRPOU
    logger.info("\n--- Step 1: Update Sign Data ---")
    if not update_sign_json(edrpou):
        logger.error("[TEST] Failed to update sign JSON")
        sys.exit(1)

    # Step 2: Sign EDRPOU using UAPKI
    logger.info("\n--- Step 2: UAPKI Signing ---")
    signature = call_uapki_wrapper("/app/test_sign.json")

    if not signature:
        logger.error("[TEST] UAPKI signing failed")
        sys.exit(1)

    logger.info(f"[TEST] Signature generated, length: {len(signature)}")

    # Step 3: Test direct authorization
    logger.info("\n--- Step 3: DPS Direct Authorization ---")
    data = test_dps_direct_auth(signature, edrpou)

    if not data:
        logger.error("[TEST] DPS direct authorization failed")
        sys.exit(1)

    logger.info("\n" + "=" * 60)
    logger.info("DPS Direct Authorization test PASSED!")
    logger.info("=" * 60)
