# backend/services/xsd_validator.py

from typing import Optional
import logging
from lxml import etree

logger = logging.getLogger(__name__)


class XSDValidator:
    """
    Валідатор XML схем для перевірки відповідності вимогам ДПС.
    """
    
    def __init__(self):
        self.schemas = {}
    
    def load_schema(self, schema_path: str, form_code: str) -> bool:
        """
        Завантажити XSD схему для конкретної форми
        
        Args:
            schema_path: Шлях до файлу XSD
            form_code: Код форми (наприклад, F0103306)
            
        Returns:
            True якщо успішно, False інакше
        """
        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema_doc = etree.parse(f)
                self.schemas[form_code] = etree.XMLSchema(schema_doc)
            logger.info(f"XSD schema loaded for {form_code}")
            return True
        except Exception as e:
            logger.error(f"Failed to load XSD schema for {form_code}: {e}")
            return False
    
    def validate_xml(self, xml_content: str, form_code: str) -> tuple[bool, Optional[str]]:
        """
        Валідація XML проти XSD схеми
        
        Args:
            xml_content: XML контент для валідації
            form_code: Код форми
            
        Returns:
            (is_valid, error_message)
        """
        if form_code not in self.schemas:
            return False, f"XSD schema not loaded for form {form_code}"
        
        try:
            xml_doc = etree.fromstring(xml_content.encode('utf-8'))
            schema = self.schemas[form_code]
            
            if schema.validate(xml_doc):
                return True, None
            else:
                error_log = schema.error_log
                error_msg = str(error_log) if error_log else "Validation failed"
                return False, error_msg
                
        except etree.XMLSyntaxError as e:
            return False, f"XML syntax error: {str(e)}"
        except Exception as e:
            return False, f"Validation error: {str(e)}"
    
    def validate_xml_structure(self, xml_content: str) -> tuple[bool, Optional[str]]:
        """
        Базова валідація структури XML без XSD
        
        Args:
            xml_content: XML контент
            
        Returns:
            (is_valid, error_message)
        """
        try:
            etree.fromstring(xml_content.encode('utf-8'))
            return True, None
        except etree.XMLSyntaxError as e:
            return False, f"Invalid XML structure: {str(e)}"
        except Exception as e:
            return False, f"XML parsing error: {str(e)}"


# Глобальний екземпляр валідатора
xsd_validator = XSDValidator()
