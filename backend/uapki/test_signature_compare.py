#!/usr/bin/env python3
"""
Порівняння форматів підписів: UAPKI vs cryptography
"""

import subprocess
import json
import logging
import base64
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import pkcs7, load_pem_private_key, Encoding
from cryptography.hazmat.backends import default_backend

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def call_uapki_wrapper(json_file):
    """Виклик C++ wrapper для UAPKI"""
    cmd = ["/app/uapki_wrapper", json_file]
    env = {"LD_LIBRARY_PATH": "/usr/local/lib"}
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    
    if result.returncode != 0:
        logger.error(f"UAPKI wrapper failed: {result.stderr}")
        return None
    
    lines = result.stdout.split('\n')
    for line in lines:
        if '"method":"SIGN"' in line or '"method": "SIGN"' in line:
            try:
                clean_line = line.split("Response:")[-1].strip()
                response = json.loads(clean_line)
                signatures = response.get("result", {}).get("signatures", [])
                if signatures:
                    return signatures[0].get("bytes")
            except Exception as e:
                logger.error(f"Failed to parse SIGN response: {e}")
    return None

def create_cryptography_signature():
    """Створення підпису через cryptography"""
    try:
        # Load JKS file (need to convert to PEM first)
        # For now, just log that we need to implement this
        logger.info("[TEST] Cryptography signature requires JKS to PEM conversion")
        return None
    except Exception as e:
        logger.error(f"[TEST] Cryptography signature failed: {e}")
        return None

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Signature Format Comparison")
    logger.info("=" * 60)
    
    # Step 1: Get UAPKI signature
    logger.info("\n--- Step 1: UAPKI Signature ---")
    uapki_sig = call_uapki_wrapper("/app/test_sign.json")
    
    if uapki_sig:
        logger.info(f"[TEST] UAPKI signature length: {len(uapki_sig)}")
        logger.info(f"[TEST] UAPKI signature (first 100 chars): {uapki_sig[:100]}")
        
        # Try to decode as base64 to check if it's valid
        try:
            decoded = base64.b64decode(uapki_sig)
            logger.info(f"[TEST] UAPKI decoded length: {len(decoded)}")
            logger.info(f"[TEST] UAPKI decoded (first 50 bytes): {decoded[:50].hex()}")
        except Exception as e:
            logger.error(f"[TEST] Failed to decode UAPKI signature: {e}")
    else:
        logger.error("[TEST] Failed to get UAPKI signature")
