# backend/services/tax_iban_updater.py

import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict

logger = logging.getLogger(__name__)

class TaxIBANUpdater:
    """
    Сервіс для динамічного оновлення IBAN податкової через API ДПС.
    Оновлюється раз на тиждень.
    """
    
    def __init__(self):
        self.base_url = "https://cabinet.tax.gov.ua/api"
        self.last_update = None
        self.cached_iban = None
        self.cache_expiry_hours = 168  # 7 днів
    
    def _is_mock(self, token: str) -> bool:
        """Перевіряє, чи є токен демонстраційним (mock)"""
        return not token or token.strip().lower().startswith("mock")
    
    async def get_tax_iban(self, tax_id: str, token: str, force_refresh: bool = False) -> Optional[str]:
        """
        Отримати актуальний IBAN податкової.
        
        Args:
            tax_id: Податковий номер
            token: Токен авторизації
            force_refresh: Примусове оновлення без кешу
            
        Returns:
            IBAN податкової або None
        """
        # Перевіряємо кеш
        if not force_refresh and self.cached_iban and self.last_update:
            if datetime.now() - self.last_update < timedelta(hours=self.cache_expiry_hours):
                logger.info(f"[TaxIBANUpdater] Using cached IBAN (age: {(datetime.now() - self.last_update).total_seconds() / 3600:.1f}h)")
                return self.cached_iban
        
        if self._is_mock(token):
            logger.info(f"[TaxIBANUpdater] Mock get_tax_iban for tax_id={tax_id}")
            # Повертаємо демонстраційний IBAN ДПС
            mock_iban = "UA908050000000000000260000000"
            self.cached_iban = mock_iban
            self.last_update = datetime.now()
            return mock_iban
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/tax-iban",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"tax_id": tax_id},
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    iban = data.get("iban")
                    if iban:
                        self.cached_iban = iban
                        self.last_update = datetime.now()
                        logger.info(f"[TaxIBANUpdater] Updated tax IBAN: {iban}")
                        return iban
                else:
                    logger.warning(f"DPS API returned status code {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Failed to query real DPS tax-iban: {e}")
        
        # Fallback to cached value if available
        if self.cached_iban:
            logger.warning(f"[TaxIBANUpdater] Using cached IBAN due to API error")
            return self.cached_iban
        
        return None
    
    async def get_tax_iban_by_region(self, region_code: str, token: str) -> Optional[str]:
        """
        Отримати IBAN податкової за кодом регіону.
        
        Args:
            region_code: Код регіону (наприклад, "80" для Києва)
            token: Токен авторизації
            
        Returns:
            IBAN податкової або None
        """
        if self._is_mock(token):
            logger.info(f"[TaxIBANUpdater] Mock get_tax_iban_by_region for region={region_code}")
            # Демонстраційні IBAN за регіонами
            region_ibans = {
                "80": "UA908050000000000000260000000",  # Київ
                "63": "UA938050000000000000260000001",  # Львів
                "57": "UA958050000000000000260000002",  # Одеса
                "59": "UA978050000000000000260000003",  # Харків
            }
            return region_ibans.get(region_code, "UA908050000000000000260000000")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/tax-iban-by-region",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"region_code": region_code},
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("iban")
        except Exception as e:
            logger.error(f"Failed to query tax-iban-by-region: {e}")
        
        return None
    
    def clear_cache(self):
        """Очистити кеш IBAN"""
        self.cached_iban = None
        self.last_update = None
        logger.info("[TaxIBANUpdater] Cache cleared")


# Глобальний екземпляр оновлювача
tax_iban_updater = TaxIBANUpdater()
