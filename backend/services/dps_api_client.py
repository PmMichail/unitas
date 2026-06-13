import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class DPSAPIClient:
    def __init__(self):
        self.base_url = "https://cabinet.tax.gov.ua/api"
    
    async def get_settlement_status(self, token: str, tax_id: str) -> dict:
        """
        Отримати стан розрахунків з бюджетом через API ДПС
        Документація: https://cabinet.tax.gov.ua/help/api-registers-int.html
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/settlement-status",
                headers={"Authorization": f"Bearer {token}"},
                params={"tax_id": tax_id},
                timeout=10
            )
            # Raise exception if non-2xx status code
            response.raise_for_status()
            return response.json()
    
    async def get_tax_debt(self, token: str, tax_id: str) -> dict:
        """
        Отримати податковий борг (заборгованість)
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/tax-debt",
                headers={"Authorization": f"Bearer {token}"},
                params={"tax_id": tax_id},
                timeout=10
            )
            response.raise_for_status()
            return response.json()
