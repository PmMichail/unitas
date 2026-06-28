#!/usr/bin/env python3
"""
Спрощений тест UAPKI для пошуку проблеми з пам'яттю
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
        os.environ['LD_LIBRARY_PATH'] = '/usr/local/lib'
        
        lib = ctypes.CDLL("/usr/local/lib/libuapki.so.2")
        logger.info("[TEST] UAPKI library loaded successfully")
        
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

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("UAPKI Simple Test")
    logger.info("=" * 60)
    
    # Test 1: Library loading
    logger.info("\n--- Test 1: Library Loading ---")
    lib = test_uapki_library()
    if not lib:
        sys.exit(1)
    
    # Test 2: Initialize
    logger.info("\n--- Test 2: Initialize ---")
    try:
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
        logger.info("[TEST] INIT completed successfully")
    except Exception as e:
        logger.error(f"[TEST] INIT failed: {e}")
        sys.exit(1)
    
    # Test 3: Deinitialize
    logger.info("\n--- Test 3: Deinitialize ---")
    try:
        call_uapki_method(lib, "DEINIT")
        logger.info("[TEST] DEINIT completed successfully")
    except Exception as e:
        logger.error(f"[TEST] DEINIT failed: {e}")
        sys.exit(1)
    
    logger.info("\n" + "=" * 60)
    logger.info("All simple tests PASSED!")
    logger.info("=" * 60)
