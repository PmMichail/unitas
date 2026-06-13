import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)

class TaxAPIService:
    """
    Сервіс для інтеграції з API Електронного кабінету ДПС України.
    Документація: https://cabinet.tax.gov.ua/help/api-registers-int.html
    """
    
    def __init__(self):
        self.base_url = "https://cabinet.tax.gov.ua/api"
        self.auth_url = "https://cabinet.tax.gov.ua/user/settings"

    async def get_settlement_status(
        self,
        tax_id: str,
        token: str,
        profile_type: str = "fop",
        profile_group: Optional[int] = None,
        profile_name: Optional[str] = None,
        profile_id: Optional[int] = None,
        db: Optional[Any] = None
    ) -> List[Dict]:
        """
        Отримати стан розрахунків з бюджетом.
        Відповідає розділу "Стан розрахунків з бюджетом" в Електронному кабінеті ДПС.
        """
        # Use DPSAPI with KEP authorization
        try:
            from services.dps_api import DPSAPI
            dps_api = DPSAPI(token=token, tax_id=tax_id, profile_id=profile_id, db=db)
            data = await dps_api.get_settlement_status(period=str(datetime.now().year))
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.error(f"Failed to query DPS API via KEP: {e}")
            return []

    async def get_tax_debt(
        self,
        tax_id: str,
        token: str,
        profile_type: str = "fop",
        profile_group: Optional[int] = None,
        profile_name: Optional[str] = None,
        profile_id: Optional[int] = None,
        db: Optional[Any] = None
    ) -> Dict:
        """
        Отримати інформацію про наявний податковий борг (заборгованість).
        """
        try:
            from services.dps_api import DPSAPI
            dps_api = DPSAPI(token=token or "", tax_id=tax_id, profile_id=profile_id, db=db)
            settlements = await dps_api.get_settlement_status(period=str(datetime.now().year))
            total_debt = sum(float(item.get("debt") or 0.0) for item in settlements)
            details = {
                item.get("tax_name", "Невідомий платіж"): float(item.get("debt") or 0.0)
                for item in settlements
                if float(item.get("debt") or 0.0) > 0
            }
            return {
                "total_debt": round(total_debt, 2),
                "details": details
            }
        except Exception as e:
            logger.error(f"Failed to query DPS tax-debt via KEP: {e}")
            
        return {"total_debt": 0.0, "details": {}}

    async def get_accrued_liabilities(self, tax_id: str, token: str) -> List[Dict]:
        """
        Отримати інформацію про нараховані податкові зобов'язання.
        """
        if not token or token.strip().lower().startswith("mock"):
            return []

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/accrued-liabilities",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"tax_id": tax_id},
                    timeout=5
                )
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.error(f"Failed to query accrued-liabilities: {e}")
        return []

    async def get_paid_taxes(self, tax_id: str, token: str, year: int, month: int) -> List[Dict]:
        """
        Отримати сплачені платежі за певний період.
        """
        if not token or token.strip().lower().startswith("mock"):
            return []

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/paid-taxes",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"tax_id": tax_id, "year": year, "month": month},
                    timeout=5
                )
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.error(f"Failed to query paid-taxes: {e}")
        return []

    async def get_report_status(self, tax_id: str, token: str, report_type: str = None) -> Dict:
        """
        Перевірити статус подачі звітів (чи подано звіт).
        """
        try:
            from services.dps_api import DPSAPI
            dps_api = DPSAPI(token=token or "", tax_id=tax_id, db=getattr(self, "_db", None), profile_id=getattr(self, "_profile_id", None))
            return await dps_api.get_report_status(report_type=report_type)
        except Exception as e:
            logger.error(f"Failed to query DPS report-status via KEP: {e}")
        return {"submitted": False, "submission_date": None}

    async def get_certificate_no_debt(self, tax_id: str, token: str) -> bytes:
        """
        Замовити та завантажити довідку про відсутність боргу.
        """
        if not token or token.strip().lower().startswith("mock"):
            return b""

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/certificate-no-debt",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"tax_id": tax_id},
                    timeout=10
                )
                if response.status_code == 200:
                    return response.content
        except Exception as e:
            logger.error(f"Failed to generate certificate-no-debt: {e}")
        return b""
