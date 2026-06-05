import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

class TaxAPIService:
    """
    Сервіс для інтеграції з API Електронного кабінету ДПС України.
    Документація: https://cabinet.tax.gov.ua/help/api-registers-int.html
    """
    
    def __init__(self):
        self.base_url = "https://cabinet.tax.gov.ua/api"
        self.auth_url = "https://cabinet.tax.gov.ua/user/settings"
        
    def _is_mock(self, token: str) -> bool:
        """Перевіряє, чи є токен демонстраційним (mock)"""
        return not token or token.strip().lower().startswith("mock")

    async def get_settlement_status(self, tax_id: str, token: str) -> List[Dict]:
        """
        Отримати стан розрахунків з бюджетом.
        Відповідає розділу "Стан розрахунків з бюджетом" в Електронному кабінеті ДПС.
        """
        if self._is_mock(token):
            logger.info(f"[TaxAPIService] Mock get_settlement_status for tax_id={tax_id}")
            # Повертаємо демонстраційні взаєморозрахунки
            has_debt = "debt" in token.lower()
            return [
                {
                    "tax_name": "Єдиний податок (ЄП)",
                    "accrued": 12500.00,
                    "paid": 12500.00,
                    "overpayment": 150.00,
                    "underpayment": 0.0
                },
                {
                    "tax_name": "Єдиний соціальний внесок (ЄСВ)",
                    "accrued": 5280.00,
                    "paid": 4280.00 if has_debt else 5280.00,
                    "overpayment": 0.0,
                    "underpayment": 1000.00 if has_debt else 0.0
                },
                {
                    "tax_name": "Військовий збір (ВЗ)",
                    "accrued": 1250.00,
                    "paid": 800.00 if has_debt else 1250.00,
                    "overpayment": 0.0,
                    "underpayment": 450.00 if has_debt else 0.0
                }
            ]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/settlement-status",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"tax_id": tax_id},
                    timeout=5
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"DPS API returned status code {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Failed to query real DPS settlement-status: {e}")
            
        # Fallback to safe empty state or mock if error
        return []

    async def get_tax_debt(self, tax_id: str, token: str) -> Dict:
        """
        Отримати інформацію про наявний податковий борг (заборгованість).
        """
        if self._is_mock(token):
            logger.info(f"[TaxAPIService] Mock get_tax_debt for tax_id={tax_id}")
            has_debt = "debt" in token.lower()
            if has_debt:
                return {
                    "total_debt": 1450.00,
                    "details": {
                        "Єдиний соціальний внесок (ЄСВ)": 1000.00,
                        "Військовий збір (ВЗ)": 450.00
                    }
                }
            else:
                return {
                    "total_debt": 0.0,
                    "details": {}
                }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/tax-debt",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"tax_id": tax_id},
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "total_debt": data.get("total_debt", 0.0),
                        "details": data.get("details", {})
                    }
        except Exception as e:
            logger.error(f"Failed to query real DPS tax-debt: {e}")
            
        return {"total_debt": 0.0, "details": {}}

    async def get_accrued_liabilities(self, tax_id: str, token: str) -> List[Dict]:
        """
        Отримати інформацію про нараховані податкові зобов'язання.
        """
        if self._is_mock(token):
            return [
                {"tax_name": "Єдиний податок (ЄП)", "amount": 12500.00, "date": "2026-05-20"},
                {"tax_name": "Єдиний соціальний внесок (ЄСВ)", "amount": 5280.00, "date": "2026-04-20"}
            ]

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
        if self._is_mock(token):
            return [
                {"tax_name": "Єдиний податок", "amount": 12500.00, "date": f"{year}-{month:02d}-15"},
                {"tax_name": "Єдиний соціальний внесок", "amount": 5280.00, "date": f"{year}-{month:02d}-18"}
            ]

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
        if self._is_mock(token):
            # Симулюємо випадковий статус подачі звітів
            # Для звітів типу F0103306 повернемо "Подано"
            import random
            submitted = True if report_type != "J0500109" else False
            sub_date = (datetime.now() - timedelta(days=random.randint(1, 10))).strftime("%Y-%m-%d") if submitted else None
            return {
                "submitted": submitted,
                "submission_date": sub_date,
                "status_code": "APPROVED" if submitted else "PENDING"
            }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/report-status",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"tax_id": tax_id, "report_type": report_type},
                    timeout=5
                )
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.error(f"Failed to query report-status: {e}")
        return {"submitted": False, "submission_date": None}

    async def get_certificate_no_debt(self, tax_id: str, token: str) -> bytes:
        """
        Замовити та завантажити довідку про відсутність боргу (mock повертає порожній PDF).
        """
        if self._is_mock(token):
            return b"%PDF-1.4 mock certificate content"

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
