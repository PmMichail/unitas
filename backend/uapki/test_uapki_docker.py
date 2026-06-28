#!/usr/bin/env python3
"""
Тестування UAPKI в Docker контейнері
"""

import ctypes
import json
import logging
import os
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_uapki_library():
    """Тестування завантаження UAPKI бібліотеки"""
    logger.info("[TEST] Testing UAPKI library loading")
    
    try:
        # Set library path
        os.environ['LD_LIBRARY_PATH'] = '/usr/local/lib'
        
        lib = ctypes.CDLL("/usr/local/lib/libuapki.so.2")
        logger.info("[TEST] UAPKI library loaded successfully")
        
        # Define function signatures
        lib.process.restype = ctypes.c_char_p
        lib.process.argtypes = [ctypes.c_char_p]
        
        lib.json_free.restype = None
        lib.json_free.argtypes = [ctypes.c_char_p]
        
        return lib
    except Exception as e:
        logger.error(f"[TEST] Failed to load UAPKI library: {e}")
        return None

def call_uapki_method(lib, method, parameters=None):
    """Виклик методу UAPKI з обробкою помилок"""
    request = {"method": method}
    if parameters:
        request["parameters"] = parameters
    
    request_json = json.dumps(request)
    logger.info(f"[UAPKI] Request: {method}")
    
    result_ptr = lib.process(request_json.encode('utf-8'))
    
    if not result_ptr:
        raise Exception(f"UAPKI process returned null for method: {method}")
    
    try:
        result_str = result_ptr.decode('utf-8')
        result = json.loads(result_str)
        
        if result.get("errorCode") != 0:
            error_msg = result.get("error", result.get("errorMessage", "Unknown error"))
            logger.error(f"[UAPKI] Error in {method}: {error_msg}")
            raise Exception(f"UAPKI error in {method}: {error_msg}")
        
        logger.info(f"[UAPKI] {method} succeeded")
        return result
        
    finally:
        lib.json_free(result_ptr)

def test_uapki_signing(lib, jks_path, password, edrpou):
    """Тестування підписання через UAPKI з повним потоком"""
    logger.info(f"[TEST] Testing UAPKI signing for EDRPOU: {edrpou}")
    
    try:
        # Create required directories
        import os
        os.makedirs("/tmp/certs", exist_ok=True)
        os.makedirs("/tmp/crls", exist_ok=True)
        
        # Step 1: Initialize UAPKI
        logger.info("[TEST] Step 1: Initialize UAPKI")
        init_params = {
            "cmProviders": {
                "dir": "",
                "allowedProviders": [
                    {
                        "lib": "cm-pkcs12"
                    }
                ]
            },
            "offline": True
        }
        call_uapki_method(lib, "INIT", init_params)
        
        # Step 2: Open JKS storage
        logger.info("[TEST] Step 2: Open JKS storage")
        open_params = {
            "provider": "PKCS12",
            "storage": jks_path,
            "password": password,
            "mode": "RO"
        }
        call_uapki_method(lib, "OPEN", open_params)
        
        # Step 3: Get keys
        logger.info("[TEST] Step 3: Get keys")
        keys_result = call_uapki_method(lib, "KEYS")
        
        # Step 4: Select first key
        logger.info("[TEST] Step 4: Select key")
        keys = keys_result.get("result", {}).get("keys", [])
        if not keys:
            raise Exception("No keys found in JKS file")
        
        key_id = keys[0].get("id")
        logger.info(f"[TEST] Selected key ID: {key_id}")
        
        select_params = {"id": key_id}
        call_uapki_method(lib, "SELECT_KEY", select_params)
        
        # Step 5: Sign data
        logger.info("[TEST] Step 5: Sign data")
        import base64
        data_bytes = edrpou.encode('utf-8')
        data_base64 = base64.b64encode(data_bytes).decode('utf-8')
        
        sign_params = {
            "signParams": {
                "signatureFormat": "CAdES-BES",
                "detachedData": False,
                "includeCert": True,
                "includeTime": True
            },
            "dataTbs": [
                {
                    "id": "doc-0",
                    "bytes": data_base64
                }
            ]
        }
        
        sign_result = call_uapki_method(lib, "SIGN", sign_params)
        
        # Step 6: Close storage
        logger.info("[TEST] Step 6: Close storage")
        call_uapki_method(lib, "CLOSE")
        
        # Step 7: Deinitialize
        logger.info("[TEST] Step 7: Deinitialize")
        call_uapki_method(lib, "DEINIT")
        
        # Extract signature
        result_obj = sign_result.get("result", {})
        signatures = result_obj.get("signatures", [])
        
        if not signatures:
            raise Exception("No signatures in response")
        
        signature_obj = signatures[0]
        signature = signature_obj.get("bytes")
        
        if not signature:
            raise Exception("No signature bytes in response")
        
        logger.info(f"[TEST] Signature generated successfully, length: {len(signature)}")
        return signature
        
    except Exception as e:
        logger.error(f"[TEST] UAPKI signing failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Try to cleanup
        try:
            call_uapki_method(lib, "CLOSE")
        except:
            pass
        try:
            call_uapki_method(lib, "DEINIT")
        except:
            pass
        
        return None

def test_dps_oauth(signature):
    """Тестування OAuth токен обміну"""
    logger.info("[TEST] Testing DPS OAuth token exchange")
    
    try:
        import httpx
        
        oauth_url = "https://cabinet.tax.gov.ua/ws/auth/oauth/token"
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
        
        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": signature,
            "scope": "tax_api"
        }
        
        logger.info(f"[TEST] Requesting token from {oauth_url}")
        
        with httpx.Client() as client:
            response = client.post(
                oauth_url,
                headers=headers,
                data=data,
                timeout=20
            )
        
        logger.info(f"[TEST] Response status: {response.status_code}")
        logger.info(f"[TEST] Response body: {response.text[:500]}...")
        
        if response.status_code != 200:
            raise Exception(f"DPS OAuth returned status {response.status_code}")
        
        result = response.json()
        
        if "error" in result:
            error_msg = result.get("error_description", result.get("error", "Unknown error"))
            raise Exception(f"DPS OAuth error: {error_msg}")
        
        access_token = result.get("access_token")
        if not access_token:
            raise Exception("No access token in DPS OAuth response")
        
        logger.info(f"[TEST] Token received successfully, length: {len(access_token)}")
        return access_token
        
    except Exception as e:
        logger.error(f"[TEST] DPS OAuth failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

def test_dps_api(token, year=None):
    """Тестування отримання даних з DPS API"""
    logger.info(f"[TEST] Testing DPS API data fetch, year={year}")
    
    try:
        import httpx
        
        api_url = "https://cabinet.tax.gov.ua/ws/public_api/ta/splatp"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        
        params = {}
        if year:
            params["year"] = year
        
        logger.info(f"[TEST] Requesting from {api_url} with params={params}")
        
        with httpx.Client() as client:
            response = client.get(
                api_url,
                headers=headers,
                params=params,
                timeout=20
            )
        
        logger.info(f"[TEST] Response status: {response.status_code}")
        logger.info(f"[TEST] Response body: {response.text[:1000]}...")
        
        if response.status_code != 200:
            raise Exception(f"DPS API returned status {response.status_code}")
        
        result = response.json()
        logger.info(f"[TEST] Data fetched successfully")
        return result
        
    except Exception as e:
        logger.error(f"[TEST] DPS API failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("UAPKI Docker Integration Test")
    logger.info("=" * 60)
    
    # Configuration
    jks_path = "/app/test_key.jks"
    password = "Mn290876"
    edrpou = "9883657"  # From JKS file name
    
    # Check if JKS file exists
    if not os.path.exists(jks_path):
        logger.error(f"[TEST] JKS file not found: {jks_path}")
        sys.exit(1)
    
    # Test 1: UAPKI Library
    logger.info("\n--- Test 1: UAPKI Library ---")
    lib = test_uapki_library()
    if not lib:
        logger.error("[TEST] UAPKI library test failed")
        sys.exit(1)
    
    # Test 2: UAPKI Signing
    logger.info("\n--- Test 2: UAPKI Signing ---")
    try:
        signature = test_uapki_signing(lib, jks_path, password, edrpou)
        if not signature:
            logger.error("[TEST] UAPKI signing test failed")
            sys.exit(1)
    except Exception as e:
        logger.error(f"[TEST] UAPKI signing test failed with exception: {e}")
        sys.exit(1)
    
    # Test 3: DPS OAuth
    logger.info("\n--- Test 3: DPS OAuth ---")
    token = test_dps_oauth(signature)
    if not token:
        logger.error("[TEST] DPS OAuth test failed")
        sys.exit(1)
    
    # Test 4: DPS API
    logger.info("\n--- Test 4: DPS API ---")
    data = test_dps_api(token, year=2024)
    if not data:
        logger.error("[TEST] DPS API test failed")
        sys.exit(1)
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("All tests PASSED!")
    logger.info("=" * 60)
