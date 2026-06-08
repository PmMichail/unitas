import httpx
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, Optional, List
import logging

logger = logging.getLogger(__name__)

class TaxAPIClient:
    """
    Клієнт для роботи з API Електронного кабінету ДПС
    Документація: https://cabinet.tax.gov.ua/help/api-registers-int.html
    """
    
    def __init__(self):
        self.base_url = "https://cabinet.tax.gov.ua/api"
        self.report_url = "https://cabinet.tax.gov.ua/api/reporting"
        
    def _is_mock(self, token: str) -> bool:
        return not token or token.strip().lower().startswith("mock")
    
    async def submit_report(self, report_xml: str, tax_id: str, token: str) -> Dict:
        """
        Подати звіт до ДПС
        
        Args:
            report_xml: XML звіту (підписаний КЕП)
            tax_id: ЄДРПОУ або РНОКПП платника
            token: Токен доступу до API
        """
        if self._is_mock(token):
            logger.info(f"[TaxAPIClient] Simulated submission for tax_id={tax_id}")
            import random
            sub_id = f"sub-{random.randint(100000, 999999)}"
            conf_num = f"KEP-REC-{random.randint(100000, 999999)}"
            return {
                "success": True,
                "submission_id": sub_id,
                "confirmation_number": conf_num,
                "message": "Звіт успішно подано до ДПС (симуляція)"
            }
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.report_url}/submit",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/xml"
                    },
                    params={"tax_id": tax_id},
                    content=report_xml.encode('utf-8'),
                    timeout=15
                )
                
                return self._parse_response(response)
        except Exception as e:
            logger.error(f"[TaxAPIClient] Error submitting report: {e}")
            return {
                "success": False,
                "message": f"Помилка зв'язку з сервером ДПС: {str(e)}"
            }
    
    async def check_submission_status(self, submission_id: str, token: str) -> Dict:
        """Перевірити статус поданої декларації"""
        if self._is_mock(token):
            logger.info(f"[TaxAPIClient] Simulated status check for submission_id={submission_id}")
            return {
                "status": "accepted",
                "accepted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "rejection_reason": None,
                "message": "Декларація прийнята, пакет підписано без зауважень."
            }
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.report_url}/status/{submission_id}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    return {
                        "status": "pending",
                        "message": f"Сервер повернув код {response.status_code}"
                    }
        except Exception as e:
            logger.error(f"[TaxAPIClient] Error checking status: {e}")
            return {
                "status": "pending",
                "message": f"Помилка зв'язку з ДПС: {str(e)}"
            }
    
    async def get_available_reports(self, tax_id: str, token: str) -> list:
        """Отримати список доступних для подання звітів"""
        if self._is_mock(token):
            return [
                {"form_code": "F0103306", "name": "Декларація платника єдиного податку ФОП 3-ї групи"},
                {"form_code": "F0110210", "name": "Податкова декларація з податку на додану вартість (ТОВ)"}
            ]
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.report_url}/available",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"tax_id": tax_id},
                    timeout=10
                )
                if response.status_code == 200:
                    return response.json().get('reports', [])
        except Exception as e:
            logger.error(f"[TaxAPIClient] Error getting available reports: {e}")
        return []
    
    def _parse_response(self, response: httpx.Response) -> Dict:
        """Розбір відповіді від ДПС"""
        try:
            root = ET.fromstring(response.text)
            return {
                "success": root.find('success').text == 'true' if root.find('success') is not None else False,
                "submission_id": root.find('submission_id').text if root.find('submission_id') is not None else None,
                "message": root.find('message').text if root.find('message') is not None else None,
                "confirmation_number": root.find('confirmation_number').text if root.find('confirmation_number') is not None else None
            }
        except ET.ParseError:
            return {
                "success": response.status_code == 200,
                "message": response.text
            }
