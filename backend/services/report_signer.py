from OpenSSL import crypto
import base64
import hashlib
from datetime import datetime
import os
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

def _fernet_key_from_secret(secret: str) -> bytes:
    return base64.urlsafe_b64encode(secret.encode()[:32].ljust(32, b'0'))

def _candidate_secrets() -> list[str]:
    secrets = []
    for name in ("SECRET_KEY", "JWT_SECRET_KEY"):
        value = os.getenv(name)
        if value and value not in secrets:
            secrets.append(value)
    legacy = "dGhpcy1pcy1hLXNlY3JldC1rZXktZm9yLXVuaXRheC0="
    if legacy not in secrets:
        secrets.append(legacy)
    return secrets

def encrypt_private_key(private_key_bytes: bytes) -> str:
    secret = _candidate_secrets()[0]
    f = Fernet(_fernet_key_from_secret(secret))
    return f.encrypt(private_key_bytes).decode('utf-8')

def decrypt_private_key(encrypted_key: str) -> bytes:
    last_error = None
    for secret in _candidate_secrets():
        try:
            f = Fernet(_fernet_key_from_secret(secret))
            return f.decrypt(encrypted_key.encode('utf-8'))
        except Exception as e:
            last_error = e
    raise last_error


class ReportSigner:
    """Підписання XML звітів КЕП перед відправкою до ДПС"""
    
    async def sign_report(self, report_xml: str, certificate_id: int, db) -> str:
        """
        Підписати звіт КЕП
        Формат: XML-DSig (XAdES) відповідно до вимог ДПС
        """
        from api.main import Certificate
        
        cert_record = db.query(Certificate).filter(Certificate.id == certificate_id).first()
        if not cert_record:
            raise Exception("Сертифікат не знайдено в базі даних")
        
        # Розшифрувати приватний ключ
        private_key_bytes = decrypt_private_key(cert_record.private_key_encrypted)
        
        # Створити підпис
        signature = self._create_xml_signature(report_xml, private_key_bytes, cert_record.cert_data)
        
        # Вбудувати підпис у XML
        signed_xml = self._embed_signature(report_xml, signature)
        
        return signed_xml
    
    def _create_xml_signature(self, xml_content: str, private_key: bytes, certificate: str) -> str:
        """Створити XML-DSig підпис"""
        # Обчислити хеш XML
        xml_hash = hashlib.sha256(xml_content.encode('utf-8')).digest()
        
        # Підписати хеш
        key = crypto.load_privatekey(crypto.FILETYPE_PEM, private_key)
        signature = crypto.sign(key, xml_hash, 'sha256')
        
        return base64.b64encode(signature).decode('utf-8')
    
    def _embed_signature(self, xml_content: str, signature: str) -> str:
        """Вбудувати підпис у XML згідно з форматом ДПС"""
        digest_val = base64.b64encode(hashlib.sha256(xml_content.encode('utf-8')).digest()).decode('utf-8')
        
        signature_block = f"""
        <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
            <ds:SignedInfo>
                <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
                <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
                <ds:Reference URI="">
                    <ds:Transforms>
                        <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                    </ds:Transforms>
                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                    <ds:DigestValue>{digest_val}</ds:DigestValue>
                </ds:Reference>
            </ds:SignedInfo>
            <ds:SignatureValue>{signature}</ds:SignatureValue>
        </ds:Signature>
        """
        
        if '</DECLAR>' in xml_content:
            return xml_content.replace('</DECLAR>', signature_block.strip() + '\n</DECLAR>')
        elif '</declaration>' in xml_content:
            return xml_content.replace('</declaration>', signature_block.strip() + '\n</declaration>')
        elif '</DECLARBODY>' in xml_content:
            return xml_content.replace('</DECLARBODY>', signature_block.strip() + '\n</DECLARBODY>')
        else:
            return xml_content + "\n" + signature_block.strip()
