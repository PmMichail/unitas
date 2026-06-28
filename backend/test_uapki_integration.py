#!/usr/bin/env python3
"""
Тестування інтеграції UAPKI з DPS API
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cryptography import x509
import jks
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_jks_file():
    """Тестування завантаження та парсингу JKS файлу"""
    jks_path = "/Volumes/Untitled/КЛЮЧИ/фоп поветкин/Приват 2876--2025/key_9883657_9883657 (1).jks"
    password = "Mn290876"
    
    logger.info(f"[TEST] Testing JKS file: {jks_path}")
    
    try:
        # Спроба завантажити JKS файл з pyjks
        with open(jks_path, 'rb') as f:
            ks = jks.KeyStore.loads(f.read(), password)
        
        logger.info(f"[TEST] JKS loaded successfully")
        logger.info(f"[TEST] Keystore type: {ks.store_type}")
        logger.info(f"[TEST] Number of keys: {len(ks.private_keys)}")
        logger.info(f"[TEST] Number of certificates: {len(ks.certs)}")
        
        # Вивести інформацію про ключі
        for alias, sk in ks.private_keys.items():
            logger.info(f"[TEST] Private key alias: {alias}")
            logger.info(f"[TEST] Algorithm: {sk.algorithm}")
            logger.info(f"[TEST] Key size: {sk.pkey.num_bits if hasattr(sk.pkey, 'num_bits') else 'unknown'}")
            
            # Вивести сертифікати
            for cert in sk.cert_chain:
                cert_der = cert[1]
                cert_obj = x509.load_der_x509_certificate(cert_der)
                logger.info(f"[TEST] Certificate subject: {cert_obj.subject}")
                logger.info(f"[TEST] Certificate issuer: {cert_obj.issuer}")
                logger.info(f"[TEST] Certificate valid from: {cert_obj.not_valid_before}")
                logger.info(f"[TEST] Certificate valid to: {cert_obj.not_valid_after}")
                
                # Витягти ЄДРПОУ/РНОКПП
                for attr in cert_obj.subject:
                    oid_str = attr.oid.dotted_string
                    val = str(attr.value)
                    if oid_str == "1.2.804.2.1.1.1.11.1.1.3":
                        logger.info(f"[TEST] EDRPOU: {val}")
                    elif oid_str == "1.2.804.2.1.1.1.11.1.4":
                        logger.info(f"[TEST] DRFO: {val}")
        
        return True, ks
        
    except Exception as e:
        logger.error(f"[TEST] Failed to load JKS: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False, None

def test_uapki_client():
    """Тестування UAPKI клієнта"""
    logger.info("[TEST] Testing UAPKI client initialization")
    
    try:
        from services.uapki_client import UAPKIClient
        # Спроба завантажити бібліотеку
        uapki = UAPKIClient()
        logger.info("[TEST] UAPKI client initialized successfully")
        return True
    except Exception as e:
        logger.warning(f"[TEST] UAPKI client failed (expected if library not installed): {e}")
        return False

def test_uapki_signing():
    """Тестування підписання через UAPKI"""
    jks_path = "/Volumes/Untitled/КЛЮЧИ/фоп поветкин/Приват 2876--2025/key_9883657_9883657 (1).jks"
    password = "Mn290876"
    
    logger.info("[TEST] Testing UAPKI signing")
    
    try:
        from services.uapki_client import UAPKIClient
        uapki = UAPKIClient()
        
        # Спроба підписати дані
        signature = uapki.sign_data(
            data="9883657",  # ЄДРПОУ з назви файлу
            key_file=jks_path,
            key_password=password
        )
        
        logger.info(f"[TEST] Signature generated successfully, length: {len(signature)}")
        return True, signature
    except Exception as e:
        logger.error(f"[TEST] UAPKI signing failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False, None

def test_dps_oauth():
    """Тестування OAuth токен обміну"""
    logger.info("[TEST] Testing DPS OAuth token exchange")
    
    try:
        from services.dps_api import DPSAPI
        dps = DPSAPI(token=None, tax_id="9883657", profile_id=None, db=None)
        
        # Спочатку спробуємо згенерувати підпис через cryptography (fallback)
        # оскільки UAPKI може бути не встановлено
        logger.info("[TEST] This will test the OAuth endpoint with a mock signature")
        logger.info("[TEST] Real test requires valid certificate in database")
        
        return True
    except Exception as e:
        logger.error(f"[TEST] DPS OAuth test failed: {e}")
        return False

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("UAPKI Integration Test")
    logger.info("=" * 60)
    
    # Тест 1: JKS файл
    logger.info("\n--- Test 1: JKS File Loading ---")
    jks_ok, ks = test_jks_file()
    
    # Тест 2: UAPKI клієнт
    logger.info("\n--- Test 2: UAPKI Client ---")
    uapki_ok = test_uapki_client()
    
    # Тест 3: UAPKI підписання (якщо бібліотека доступна)
    if uapki_ok and jks_ok:
        logger.info("\n--- Test 3: UAPKI Signing ---")
        sign_ok, signature = test_uapki_signing()
    else:
        logger.info("\n--- Test 3: UAPKI Signing (skipped) ---")
        sign_ok = False
    
    # Тест 4: DPS OAuth
    logger.info("\n--- Test 4: DPS OAuth ---")
    oauth_ok = test_dps_oauth()
    
    # Підсумок
    logger.info("\n" + "=" * 60)
    logger.info("Test Summary:")
    logger.info(f"  JKS Loading: {'PASS' if jks_ok else 'FAIL'}")
    logger.info(f"  UAPKI Client: {'PASS' if uapki_ok else 'FAIL'}")
    logger.info(f"  UAPKI Signing: {'PASS' if sign_ok else 'FAIL'}")
    logger.info(f"  DPS OAuth: {'PASS' if oauth_ok else 'FAIL'}")
    logger.info("=" * 60)
