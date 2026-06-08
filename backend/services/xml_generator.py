# backend/services/xml_generator.py

from typing import Dict, Optional
from datetime import datetime, date
import xml.etree.ElementTree as ET
from xml.dom import minidom
import logging

logger = logging.getLogger(__name__)


class XMLGenerator:
    """
    Генератор XML звітів для подання до ДПС.
    Відповідає вимогам Державної фіскальної служби.
    """
    
    def __init__(self):
        self.namespace = {
            "xsi": "http://www.w3.org/2001/XMLSchema-instance"
        }
    
    def generate_unified_tax_declaration(
        self,
        profile: Dict,
        tax_data: Dict,
        period: str,
        year: int
    ) -> str:
        """
        Генерація XML для декларації єдиного податку (F0103306)
        
        Args:
            profile: Дані профілю (tax_id, name, address, etc.)
            tax_data: Податкові дані (income, tax_due, paid, etc.)
            period: Період (Q1, Q2, Q3, Q4)
            year: Рік
            
        Returns:
            XML рядок
        """
        # Створення кореневого елемента
        root = ET.Element("DECLAR")
        root.set("xmlns", "http://tax.gov.ua")
        root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        root.set("xsi:schemaLocation", "http://tax.gov.ua F0103306.xsd")
        
        # Заголовок декларації
        decl_head = ET.SubElement(root, "DECLARHEAD")
        
        # Код документу
        ET.SubElement(decl_head, "C_DOC").text = "F0103306"
        ET.SubElement(decl_head, "C_DOC_SUB").text = "010"
        ET.SubElement(decl_head, "C_DOC_VER").text = "12"
        ET.SubElement(decl_head, "C_DOC_TYPE").text = "0"
        ET.SubElement(decl_head, "C_DOC_CNT").text = "1"
        
        # Платник податків
        ET.SubElement(decl_head, "C_REG").text = str(profile.get("tax_id", ""))[:2]
        ET.SubElement(decl_head, "C_RAJ").text = str(profile.get("tax_id", ""))[2:4]
        ET.SubElement(decl_head, "TIN").text = str(profile.get("tax_id", ""))
        ET.SubElement(decl_head, "C_STI_ORIG").text = str(profile.get("tax_id", ""))[:4]
        ET.SubElement(decl_head, "C_STI").text = str(profile.get("tax_id", ""))[:4]
        ET.SubElement(decl_head, "NAME").text = profile.get("name", "")
        ET.SubElement(decl_head, "C_DOC_STAN").text = "1"
        
        # Період
        period_map = {"Q1": "1", "Q2": "2", "Q3": "3", "Q4": "4"}
        ET.SubElement(decl_head, "PERIOD_MONTH").text = period_map.get(period, "1")
        ET.SubElement(decl_head, "PERIOD_YEAR").text = str(year)
        ET.SubElement(decl_head, "PERIOD_TYPE").text = "1"
        ET.SubElement(decl_head, "D_FILL").text = datetime.now().strftime("%d%m%Y")
        
        # Тіло декларації
        decl_body = ET.SubElement(root, "DECLARBODY")
        
        # Розділ 1 - Загальні показники
        ET.SubElement(decl_body, "R01G1").text = "1"  # Ознака подання
        
        # Кумулятивні доходи за періоди
        income_q1 = tax_data.get("income_q1", 0)
        income_q2 = tax_data.get("income_q2", 0)
        income_q3 = tax_data.get("income_q3", 0)
        income_q4 = tax_data.get("income_q4", 0)
        
        period_lower = period.lower()
        end_m = 12
        if "q1" in period_lower or "1 квартал" in period_lower or "січень" in period_lower or "лютий" in period_lower or "березень" in period_lower:
            end_m = 3
        elif "q2" in period_lower or "півріччя" in period_lower or "2 квартал" in period_lower or "квітень" in period_lower or "травень" in period_lower or "червень" in period_lower:
            end_m = 6
        elif "q3" in period_lower or "три квартали" in period_lower or "3 квартал" in period_lower or "липень" in period_lower or "серпень" in period_lower or "вересень" in period_lower:
            end_m = 9
            
        # ROW01 - Обсяг доходу за 1 квартал
        ET.SubElement(decl_body, "ROW01").text = str(round(income_q1, 2)) if end_m >= 1 else "0.0"
        
        # ROW02 - Обсяг доходу за півріччя (Q1 + Q2)
        ET.SubElement(decl_body, "ROW02").text = str(round(income_q1 + income_q2, 2)) if end_m >= 4 else "0.0"
        
        # ROW03 - Обсяг доходу за 9 місяців (Q1 + Q2 + Q3)
        ET.SubElement(decl_body, "ROW03").text = str(round(income_q1 + income_q2 + income_q3, 2)) if end_m >= 7 else "0.0"
        
        # ROW04 - Обсяг доходу за рік (Q1 + Q2 + Q3 + Q4)
        ET.SubElement(decl_body, "ROW04").text = str(round(income_q1 + income_q2 + income_q3 + income_q4, 2)) if end_m >= 10 else "0.0"
        
        # Ставка податку
        ET.SubElement(decl_body, "TAX_RATE").text = str(profile.get("tax_rate", 5))
        
        # Нараховано податку до сплати
        ET.SubElement(decl_body, "TAX_DUE").text = str(round(tax_data.get("tax_due", 0), 2))
        
        # Сума сплаченого податку
        ET.SubElement(decl_body, "TAX_PAID").text = str(round(tax_data.get("tax_paid", 0), 2))
        
        # Розділ 5 - Сума до сплати
        tax_diff = max(0, tax_data.get("tax_due", 0) - tax_data.get("tax_paid", 0))
        ET.SubElement(decl_body, "TAX_DIFF").text = str(round(tax_diff, 2))
        
        # Форматування XML
        xml_str = self._prettify_xml(root)
        return xml_str
    
    def generate_esv_declaration(
        self,
        profile: Dict,
        tax_data: Dict,
        period: str,
        year: int
    ) -> str:
        """
        Генерація XML для звіту про ЄСВ (F3007012)
        
        Args:
            profile: Дані профілю
            tax_data: Податкові дані
            period: Період
            year: Рік
            
        Returns:
            XML рядок
        """
        root = ET.Element("DECLAR")
        root.set("xmlns", "http://tax.gov.ua")
        root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        
        decl_head = ET.SubElement(root, "DECLARHEAD")
        ET.SubElement(decl_head, "C_DOC").text = "F3007012"
        ET.SubElement(decl_head, "C_DOC_SUB").text = "010"
        ET.SubElement(decl_head, "C_DOC_VER").text = "12"
        ET.SubElement(decl_head, "TIN").text = str(profile.get("tax_id", ""))
        ET.SubElement(decl_head, "NAME").text = profile.get("name", "")
        
        period_map = {"Q1": "1", "Q2": "2", "Q3": "3", "Q4": "4"}
        ET.SubElement(decl_head, "PERIOD_MONTH").text = period_map.get(period, "1")
        ET.SubElement(decl_head, "PERIOD_YEAR").text = str(year)
        ET.SubElement(decl_head, "D_FILL").text = datetime.now().strftime("%d%m%Y")
        
        decl_body = ET.SubElement(root, "DECLARBODY")
        
        # Сума ЄСВ за себе
        ET.SubElement(decl_body, "R01G1").text = str(round(tax_data.get("esv_due", 0), 2))
        ET.SubElement(decl_body, "R02G1").text = str(round(tax_data.get("esv_paid", 0), 2))
        
        esv_diff = max(0, tax_data.get("esv_due", 0) - tax_data.get("esv_paid", 0))
        ET.SubElement(decl_body, "R03G1").text = str(round(esv_diff, 2))
        
        return self._prettify_xml(root)
    
    def generate_military_tax_declaration(
        self,
        profile: Dict,
        tax_data: Dict,
        period: str,
        year: int
    ) -> str:
        """
        Генерація XML для декларації військового збору (F0120109)
        
        Args:
            profile: Дані профілю
            tax_data: Податкові дані
            period: Період
            year: Рік
            
        Returns:
            XML рядок
        """
        root = ET.Element("DECLAR")
        root.set("xmlns", "http://tax.gov.ua")
        root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        
        decl_head = ET.SubElement(root, "DECLARHEAD")
        ET.SubElement(decl_head, "C_DOC").text = "F0120109"
        ET.SubElement(decl_head, "C_DOC_SUB").text = "010"
        ET.SubElement(decl_head, "C_DOC_VER").text = "12"
        ET.SubElement(decl_head, "TIN").text = str(profile.get("tax_id", ""))
        ET.SubElement(decl_head, "NAME").text = profile.get("name", "")
        
        period_map = {"Q1": "1", "Q2": "2", "Q3": "3", "Q4": "4"}
        ET.SubElement(decl_head, "PERIOD_MONTH").text = period_map.get(period, "1")
        ET.SubElement(decl_head, "PERIOD_YEAR").text = str(year)
        ET.SubElement(decl_head, "D_FILL").text = datetime.now().strftime("%d%m%Y")
        
        decl_body = ET.SubElement(root, "DECLARBODY")
        
        # Сума військового збору
        ET.SubElement(decl_body, "R01G1").text = str(round(tax_data.get("military_tax_due", 0), 2))
        ET.SubElement(decl_body, "R02G1").text = str(round(tax_data.get("military_tax_paid", 0), 2))
        
        mil_diff = max(0, tax_data.get("military_tax_due", 0) - tax_data.get("military_tax_paid", 0))
        ET.SubElement(decl_body, "R03G1").text = str(round(mil_diff, 2))
        
        return self._prettify_xml(root)
    
    def generate_unified_report(
        self,
        profile: Dict,
        tax_data: Dict,
        period: str,
        year: int
    ) -> str:
        """
        Генерація XML для об'єднаного звіту (F0510101)
        
        Args:
            profile: Дані профілю
            tax_data: Податкові дані
            period: Період
            year: Рік
            
        Returns:
            XML рядок
        """
        root = ET.Element("DECLAR")
        root.set("xmlns", "http://tax.gov.ua")
        root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        
        decl_head = ET.SubElement(root, "DECLARHEAD")
        ET.SubElement(decl_head, "C_DOC").text = "F0510101"
        ET.SubElement(decl_head, "C_DOC_SUB").text = "010"
        ET.SubElement(decl_head, "C_DOC_VER").text = "12"
        ET.SubElement(decl_head, "TIN").text = str(profile.get("tax_id", ""))
        ET.SubElement(decl_head, "NAME").text = profile.get("name", "")
        
        period_map = {"Q1": "1", "Q2": "2", "Q3": "3", "Q4": "4"}
        ET.SubElement(decl_head, "PERIOD_MONTH").text = period_map.get(period, "1")
        ET.SubElement(decl_head, "PERIOD_YEAR").text = str(year)
        ET.SubElement(decl_head, "D_FILL").text = datetime.now().strftime("%d%m%Y")
        
        decl_body = ET.SubElement(root, "DECLARBODY")
        
        # Кумулятивні доходи
        income_q1 = tax_data.get("income_q1", 0)
        income_q2 = tax_data.get("income_q2", 0)
        income_q3 = tax_data.get("income_q3", 0)
        income_q4 = tax_data.get("income_q4", 0)
        
        period_lower = period.lower()
        end_m = 12
        if "q1" in period_lower or "1 квартал" in period_lower or "січень" in period_lower or "лютий" in period_lower or "березень" in period_lower:
            end_m = 3
        elif "q2" in period_lower or "півріччя" in period_lower or "2 квартал" in period_lower or "квітень" in period_lower or "травень" in period_lower or "червень" in period_lower:
            end_m = 6
        elif "q3" in period_lower or "три квартали" in period_lower or "3 квартал" in period_lower or "липень" in period_lower or "серпень" in period_lower or "вересень" in period_lower:
            end_m = 9
            
        ET.SubElement(decl_body, "ROW01").text = str(round(income_q1, 2)) if end_m >= 1 else "0.0"
        ET.SubElement(decl_body, "ROW02").text = str(round(income_q1 + income_q2, 2)) if end_m >= 4 else "0.0"
        ET.SubElement(decl_body, "ROW03").text = str(round(income_q1 + income_q2 + income_q3, 2)) if end_m >= 7 else "0.0"
        ET.SubElement(decl_body, "ROW04").text = str(round(income_q1 + income_q2 + income_q3 + income_q4, 2)) if end_m >= 10 else "0.0"
        
        # Єдиний податок
        ET.SubElement(decl_body, "TAX_DUE").text = str(round(tax_data.get("tax_due", 0), 2))
        ET.SubElement(decl_body, "TAX_PAID").text = str(round(tax_data.get("tax_paid", 0), 2))
        
        # ЄСВ
        ET.SubElement(decl_body, "ESV_DUE").text = str(round(tax_data.get("esv_due", 0), 2))
        ET.SubElement(decl_body, "ESV_PAID").text = str(round(tax_data.get("esv_paid", 0), 2))
        
        # Військовий збір
        ET.SubElement(decl_body, "MIL_DUE").text = str(round(tax_data.get("military_tax_due", 0), 2))
        ET.SubElement(decl_body, "MIL_PAID").text = str(round(tax_data.get("military_tax_paid", 0), 2))
        
        # ПДФО
        ET.SubElement(decl_body, "PIT_DUE").text = str(round(tax_data.get("pit_due", 0), 2))
        ET.SubElement(decl_body, "PIT_PAID").text = str(round(tax_data.get("pit_paid", 0), 2))
        
        return self._prettify_xml(root)
    
    def generate_pit_declaration(
        self,
        profile: Dict,
        tax_data: Dict,
        period: str,
        year: int
    ) -> str:
        """
        Генерація XML для декларації ПДФО (F0600101)
        
        Args:
            profile: Дані профілю
            tax_data: Податкові дані
            period: Період
            year: Рік
            
        Returns:
            XML рядок
        """
        root = ET.Element("DECLAR")
        root.set("xmlns", "http://tax.gov.ua")
        root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        
        decl_head = ET.SubElement(root, "DECLARHEAD")
        ET.SubElement(decl_head, "C_DOC").text = "F0600101"
        ET.SubElement(decl_head, "C_DOC_SUB").text = "010"
        ET.SubElement(decl_head, "C_DOC_VER").text = "12"
        ET.SubElement(decl_head, "TIN").text = str(profile.get("tax_id", ""))
        ET.SubElement(decl_head, "NAME").text = profile.get("name", "")
        
        period_map = {"Q1": "1", "Q2": "2", "Q3": "3", "Q4": "4"}
        ET.SubElement(decl_head, "PERIOD_MONTH").text = period_map.get(period, "1")
        ET.SubElement(decl_head, "PERIOD_YEAR").text = str(year)
        ET.SubElement(decl_head, "D_FILL").text = datetime.now().strftime("%d%m%Y")
        
        decl_body = ET.SubElement(root, "DECLARBODY")
        
        # Загальний дохід
        ET.SubElement(decl_body, "TOTAL_INCOME").text = str(round(tax_data.get("total_income", 0), 2))
        
        # Оподатковуваний дохід
        ET.SubElement(decl_body, "TAXABLE_INCOME").text = str(round(tax_data.get("taxable_income", 0), 2))
        
        # Нараховано ПДФО
        ET.SubElement(decl_head, "TAX_DUE").text = str(round(tax_data.get("pit_due", 0), 2))
        
        # Сплачено ПДФО
        ET.SubElement(decl_body, "TAX_PAID").text = str(round(tax_data.get("pit_paid", 0), 2))
        
        # Військовий збір
        ET.SubElement(decl_body, "MIL_DUE").text = str(round(tax_data.get("military_tax_due", 0), 2))
        ET.SubElement(decl_body, "MIL_PAID").text = str(round(tax_data.get("military_tax_paid", 0), 2))
        
        return self._prettify_xml(root)

    def generate_unified_report_llc(
        self,
        profile: Dict,
        tax_data: Dict,
        period: str,
        year: int
    ) -> str:
        """
        Генерація XML для об'єднаного звіту ТОВ (J0500109)
        """
        root = ET.Element("DECLAR")
        root.set("xmlns", "http://tax.gov.ua")
        root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        
        decl_head = ET.SubElement(root, "DECLARHEAD")
        ET.SubElement(decl_head, "C_DOC").text = "J0500109"
        ET.SubElement(decl_head, "C_DOC_SUB").text = "010"
        ET.SubElement(decl_head, "C_DOC_VER").text = "12"
        ET.SubElement(decl_head, "TIN").text = str(profile.get("tax_id", ""))
        ET.SubElement(decl_head, "NAME").text = profile.get("name", "")
        
        period_map = {
            "Q1": "1", "Q2": "2", "Q3": "3", "Q4": "4",
            "січень": "1", "лютий": "2", "березень": "3", "квітень": "4",
            "травень": "5", "червень": "6", "липень": "7", "серпень": "8",
            "вересень": "9", "жовтень": "10", "листопад": "11", "грудень": "12"
        }
        period_val = "1"
        period_lower = period.lower()
        for k, v in period_map.items():
            if k.lower() in period_lower:
                period_val = v
                break
                
        ET.SubElement(decl_head, "PERIOD_MONTH").text = period_val
        ET.SubElement(decl_head, "PERIOD_YEAR").text = str(year)
        ET.SubElement(decl_head, "D_FILL").text = datetime.now().strftime("%d%m%Y")
        
        decl_body = ET.SubElement(root, "DECLARBODY")
        
        # Доходи
        income_q1 = tax_data.get("income_q1", 0)
        income_q2 = tax_data.get("income_q2", 0)
        income_q3 = tax_data.get("income_q3", 0)
        income_q4 = tax_data.get("income_q4", 0)
        
        period_lower = period.lower()
        end_m = 12
        if "q1" in period_lower or "1 квартал" in period_lower or "січень" in period_lower or "лютий" in period_lower or "березень" in period_lower:
            end_m = 3
        elif "q2" in period_lower or "півріччя" in period_lower or "2 квартал" in period_lower or "квітень" in period_lower or "травень" in period_lower or "червень" in period_lower:
            end_m = 6
        elif "q3" in period_lower or "три квартали" in period_lower or "3 квартал" in period_lower or "липень" in period_lower or "серпень" in period_lower or "вересень" in period_lower:
            end_m = 9
            
        ET.SubElement(decl_body, "ROW01").text = str(round(income_q1, 2)) if end_m >= 1 else "0.0"
        ET.SubElement(decl_body, "ROW02").text = str(round(income_q1 + income_q2, 2)) if end_m >= 4 else "0.0"
        ET.SubElement(decl_body, "ROW03").text = str(round(income_q1 + income_q2 + income_q3, 2)) if end_m >= 7 else "0.0"
        ET.SubElement(decl_body, "ROW04").text = str(round(income_q1 + income_q2 + income_q3 + income_q4, 2)) if end_m >= 10 else "0.0"
        
        # Нараховані податки
        ET.SubElement(decl_body, "TAX_DUE").text = str(round(tax_data.get("tax_due", 0), 2))
        ET.SubElement(decl_body, "ESV_DUE").text = str(round(tax_data.get("esv_due", 0), 2))
        ET.SubElement(decl_body, "MIL_DUE").text = str(round(tax_data.get("military_tax_due", 0), 2))
        
        return self._prettify_xml(root)

    def generate_vat_declaration(
        self,
        profile: Dict,
        tax_data: Dict,
        period: str,
        year: int
    ) -> str:
        """
        Генерація XML для декларації з ПДВ ТОВ (F0110210)
        """
        root = ET.Element("DECLAR")
        root.set("xmlns", "http://tax.gov.ua")
        root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        
        decl_head = ET.SubElement(root, "DECLARHEAD")
        ET.SubElement(decl_head, "C_DOC").text = "F0110210"
        ET.SubElement(decl_head, "C_DOC_SUB").text = "102"
        ET.SubElement(decl_head, "C_DOC_VER").text = "10"
        ET.SubElement(decl_head, "TIN").text = str(profile.get("tax_id", ""))
        ET.SubElement(decl_head, "NAME").text = profile.get("name", "")
        
        period_map = {
            "Q1": "1", "Q2": "2", "Q3": "3", "Q4": "4",
            "січень": "1", "лютий": "2", "березень": "3", "квітень": "4",
            "травень": "5", "червень": "6", "липень": "7", "серпень": "8",
            "вересень": "9", "жовтень": "10", "листопад": "11", "грудень": "12"
        }
        period_val = "1"
        period_lower = period.lower()
        for k, v in period_map.items():
            if k.lower() in period_lower:
                period_val = v
                break
                
        ET.SubElement(decl_head, "PERIOD_MONTH").text = period_val
        ET.SubElement(decl_head, "PERIOD_YEAR").text = str(year)
        ET.SubElement(decl_head, "D_FILL").text = datetime.now().strftime("%d%m%Y")
        
        decl_body = ET.SubElement(root, "DECLARBODY")
        
        ET.SubElement(decl_body, "R01G3").text = str(round(tax_data.get("vat_out", 0), 2))
        ET.SubElement(decl_body, "R02G3").text = str(round(tax_data.get("vat_in", 0), 2))
        ET.SubElement(decl_body, "R03G3").text = str(round(tax_data.get("vat_due", 0), 2))
        
        return self._prettify_xml(root)

    
    def _prettify_xml(self, elem: ET.Element) -> str:
        """Форматування XML для читабельності"""
        rough_string = ET.tostring(elem, encoding='unicode')
        reparsed = minidom.parseString(rough_string)
        return reparsed.toprettyxml(indent="  ", encoding="UTF-8").decode('utf-8')


# Глобальний екземпляр генератора
xml_generator = XMLGenerator()
