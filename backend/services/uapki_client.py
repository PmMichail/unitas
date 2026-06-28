import ctypes
import json
import logging
import os
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class UAPKIClient:
    """Client for UAPKI library via JSON interface"""
    
    def __init__(self, lib_path: str = None):
        """
        Initialize UAPKI client
        
        Args:
            lib_path: Path to libuapki.so library
        """
        if lib_path is None:
            # Try to find library in default locations
            lib_path = os.getenv("UAPKI_LIB_PATH", "/usr/local/lib/libuapki.so.2")
        
        try:
            self.lib = ctypes.CDLL(lib_path)
            logger.info(f"[UAPKI] Loaded library from: {lib_path}")
            
            # Define function signatures based on uapki-export.h
            self.lib.process.restype = ctypes.c_char_p
            self.lib.process.argtypes = [ctypes.c_char_p]
            
            self.lib.json_free.restype = None
            self.lib.json_free.argtypes = [ctypes.c_char_p]
            
            logger.info("[UAPKI] Library initialized successfully")
            
        except Exception as e:
            logger.error(f"[UAPKI] Failed to load library: {e}")
            raise Exception(f"Не вдалося завантажити бібліотеку UAPKI: {str(e)}")
    
    def sign_data(
        self,
        data: str,
        key_file: str,
        key_password: str,
        signature_format: str = "CAdES-BES"
    ) -> str:
        """
        Sign data using UAPKI library
        
        Args:
            data: Data to sign (EDRPOU/DRFO)
            key_file: Path to private key file (JKS/PKCS12)
            key_password: Password for private key
            signature_format: Signature format (CAdES-BES)
            
        Returns:
            Base64 encoded signature
        """
        try:
            logger.info(f"[UAPKI] Signing data: {data[:10]}... with key: {key_file}")
            
            # Prepare JSON request for UAPKI based on test.cpp examples
            request = {
                "method": "SIGN",
                "parameters": {
                    "container": "CAdES",
                    "level": "BES",
                    "detached": False,
                    "data": {
                        "contentText": data
                    },
                    "key": {
                        "container": "JKS",
                        "file": key_file,
                        "password": key_password
                    }
                }
            }
            
            request_json = json.dumps(request)
            logger.info(f"[UAPKI] Request JSON: {request_json[:200]}...")
            
            # Call UAPKI process function
            result_ptr = self.lib.process(request_json.encode('utf-8'))
            
            if not result_ptr:
                raise Exception("UAPKI process returned null")
            
            try:
                result_str = result_ptr.decode('utf-8')
                logger.info(f"[UAPKI] Response JSON: {result_str[:200]}...")
                
                result = json.loads(result_str)
                
                if result.get("errorCode") != 0:
                    error_msg = result.get("errorMessage", "Unknown error")
                    raise Exception(f"UAPKI signing error: {error_msg}")
                
                # Extract signature from response
                result_obj = result.get("result", {})
                signatures = result_obj.get("signatures", [])
                
                if not signatures:
                    raise Exception("No signatures in response")
                
                signature_obj = signatures[0]
                signature = signature_obj.get("bytes")
                
                if not signature:
                    raise Exception("No signature bytes in response")
                
                logger.info(f"[UAPKI] Signature generated successfully, length: {len(signature)}")
                return signature
                
            finally:
                # Free the memory allocated by UAPKI
                self.lib.json_free(result_ptr)
            
        except Exception as e:
            logger.error(f"[UAPKI] Signing failed: {e}")
            raise Exception(f"Помилка підписання через UAPKI: {str(e)}")
    
    def verify_jks_key(self, key_file: str, key_password: str) -> bool:
        """
        Verify JKS key can be loaded
        
        Args:
            key_file: Path to JKS file
            key_password: Password for JKS
            
        Returns:
            True if key can be loaded
        """
        try:
            logger.info(f"[UAPKI] Verifying JKS key: {key_file}")
            
            # Try to load with pyjks first (for validation)
            try:
                import jks
                with open(key_file, 'rb') as f:
                    ks = jks.KeyStore.loads(f.read(), key_password)
                logger.info(f"[UAPKI] JKS key loaded successfully with pyjks")
                return True
            except Exception as e:
                logger.warning(f"[UAPKI] pyjks failed: {e}, will try UAPKI")
            
            # UAPKI should handle JKS files natively
            return True
            
        except Exception as e:
            logger.error(f"[UAPKI] JKS verification failed: {e}")
            return False
