import ctypes
import json
import logging
import os
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class UAPKICtypes:
    """UAPKI library wrapper using ctypes"""
    
    def __init__(self, lib_path: str = None):
        """
        Initialize UAPKI library via ctypes
        
        Args:
            lib_path: Path to libuapki.so library
        """
        if lib_path is None:
            # Try to find library in default locations
            lib_path = os.getenv("UAPKI_LIB_PATH", "/usr/local/lib/libuapki.so.2")
        
        try:
            self.lib = ctypes.CDLL(lib_path)
            logger.info(f"[UAPKI CTYPES] Loaded library from: {lib_path}")
            
            # Define function signatures
            # Note: These are placeholder signatures - actual signatures need to be verified
            # from UAPKI documentation
            self.lib.uapki_init.restype = ctypes.c_int
            self.lib.uapki_init.argtypes = []
            
            self.lib.uapki_cleanup.restype = ctypes.c_int
            self.lib.uapki_cleanup.argtypes = []
            
            # Sign function - signature needs to be verified
            self.lib.uapki_sign_data.restype = ctypes.c_int
            self.lib.uapki_sign_data.argtypes = [
                ctypes.c_char_p,  # data
                ctypes.c_char_p,  # key_file
                ctypes.c_char_p,  # password
                ctypes.c_char_p,  # signature buffer
                ctypes.POINTER(ctypes.c_int)  # signature length
            ]
            
            # Initialize library
            result = self.lib.uapki_init()
            if result != 0:
                raise Exception(f"Failed to initialize UAPKI library: {result}")
            
            logger.info("[UAPKI CTYPES] Library initialized successfully")
            
        except Exception as e:
            logger.error(f"[UAPKI CTYPES] Failed to load library: {e}")
            raise Exception(f"Не вдалося завантажити бібліотеку UAPKI: {str(e)}")
    
    def sign_data(
        self,
        data: str,
        key_file: str,
        key_password: str
    ) -> str:
        """
        Sign data using UAPKI library
        
        Args:
            data: Data to sign (EDRPOU/DRFO)
            key_file: Path to private key file (JKS/PKCS12)
            key_password: Password for private key
            
        Returns:
            Base64 encoded signature
        """
        try:
            logger.info(f"[UAPKI CTYPES] Signing data: {data[:10]}... with key: {key_file}")
            
            # Prepare signature buffer
            sig_buffer = ctypes.create_string_buffer(8192)
            sig_len = ctypes.c_int(8192)
            
            # Call sign function
            result = self.lib.uapki_sign_data(
                data.encode('utf-8'),
                key_file.encode('utf-8'),
                key_password.encode('utf-8'),
                sig_buffer,
                ctypes.byref(sig_len)
            )
            
            if result != 0:
                raise Exception(f"UAPKI sign failed with error code: {result}")
            
            signature = sig_buffer.raw[:sig_len.value]
            logger.info(f"[UAPKI CTYPES] Signature generated successfully, length: {len(signature)}")
            
            # Return as base64 string
            import base64
            return base64.b64encode(signature).decode('utf-8')
            
        except Exception as e:
            logger.error(f"[UAPKI CTYPES] Signing failed: {e}")
            raise Exception(f"Помилка підписання через UAPKI: {str(e)}")
    
    def cleanup(self):
        """Cleanup UAPKI library resources"""
        try:
            self.lib.uapki_cleanup()
            logger.info("[UAPKI CTYPES] Library cleaned up")
        except Exception as e:
            logger.warning(f"[UAPKI CTYPES] Cleanup failed: {e}")
    
    def __del__(self):
        """Cleanup on object destruction"""
        self.cleanup()
