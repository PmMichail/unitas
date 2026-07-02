import httpx
import logging
import datetime
import xml.etree.ElementTree as ET
from typing import Any

logger = logging.getLogger(__name__)

class DPSAPI:
    def __init__(self, token: str, tax_id: str, profile_id: int = None, db = None):
        self.token = token
        self.tax_id = tax_id
        self.profile_id = profile_id
        self.db = db
        self.base_url = "https://cabinet.tax.gov.ua/ws/public_api"

    def _format_error(self, error: Exception) -> str:
        return str(error) or repr(error) or error.__class__.__name__

    def _get_active_certificate(self):
        if not self.db or not self.profile_id:
            logger.error(f"[KEP DIAGNOSTIC] No db or profile_id. db={self.db is not None}, profile_id={self.profile_id}")
            raise Exception("Активний КЕП не знайдено для цього профілю. Завантажте КЕП у налаштуваннях або перевірте, що відкрито правильний профіль платника.")
        try:
            from api.main import Certificate, Profile
            
            # Log all certificates for this profile
            all_certs = self.db.query(Certificate).filter(
                Certificate.profile_id == self.profile_id
            ).all()
            logger.info(f"[KEP DIAGNOSTIC] Found {len(all_certs)} certificates for profile_id={self.profile_id}")
            for cert in all_certs:
                logger.info(f"[KEP DIAGNOSTIC] Cert id={cert.id}, is_active={cert.is_active}, has_key={cert.private_key_encrypted is not None}")
            
            cert_record = self.db.query(Certificate).filter(
                Certificate.profile_id == self.profile_id,
                Certificate.is_active == True,
                Certificate.private_key_encrypted != None
            ).order_by(Certificate.created_at.desc()).first()
            
            logger.info(f"[KEP DIAGNOSTIC] Primary lookup result: {cert_record is not None}")
            
            if not cert_record and self.tax_id:
                logger.info(f"[KEP DIAGNOSTIC] Trying fallback lookup by tax_id={self.tax_id}")
                cert_record = self.db.query(Certificate).join(
                    Profile, Profile.id == Certificate.profile_id
                ).filter(
                    Profile.tax_id == self.tax_id,
                    Certificate.is_active == True,
                    Certificate.private_key_encrypted != None
                ).order_by(Certificate.created_at.desc()).first()
                logger.info(f"[KEP DIAGNOSTIC] Fallback lookup result: {cert_record is not None}")
            
            if not cert_record:
                logger.error(f"[KEP DIAGNOSTIC] No active certificate found after all lookups")
                raise Exception("Активний КЕП не знайдено для цього профілю. Завантажте КЕП у налаштуваннях або перевірте, що відкрито правильний профіль платника.")
            
            logger.info(f"[KEP DIAGNOSTIC] Found active certificate: id={cert_record.id}, profile_id={cert_record.profile_id}")
            return cert_record
        except Exception as e:
            if "Активний КЕП" in str(e):
                raise e
            logger.error(f"[KEP DIAGNOSTIC] Failed to query Certificate from DB: {e}")
            raise Exception(f"Помилка перевірки КЕП у базі даних: {str(e)}")

    def _build_authorization_signature(self, cert_record) -> str:
        """
        Build authorization signature using UAPKI or fallback to cryptography
        """
        # Try UAPKI first if available
        try:
            return self._build_authorization_signature_uapki(cert_record)
        except Exception as e:
            logger.warning(f"[KEP SIGNATURE] UAPKI signature failed, falling back to cryptography: {e}")
            return self._build_authorization_signature_cryptography(cert_record)
    
    def _build_authorization_signature_uapki(self, cert_record) -> str:
        """Build authorization signature using UAPKI library"""
        try:
            from services.uapki_client import UAPKIClient
            from services.report_signer import decrypt_private_key
            import tempfile
            import os
            
            logger.info(f"[UAPKI SIGNATURE] Starting signature build for cert_id={cert_record.id}")
            
            # Decrypt private key
            private_key_bytes = decrypt_private_key(cert_record.private_key_encrypted)
            logger.info(f"[UAPKI SIGNATURE] Private key decrypted successfully, length={len(private_key_bytes)}")
            
            # Create temporary files for UAPKI
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.pem', delete=False) as key_file:
                key_file.write(private_key_bytes)
                key_file_path = key_file.name
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as cert_file:
                cert_file.write(cert_record.cert_data)
                cert_file_path = cert_file.name
            
            try:
                # Initialize UAPKI client
                uapki = UAPKIClient()
                
                # Extract EDRPOU/DRFO from certificate
                from cryptography import x509
                cert = x509.load_pem_x509_certificate(cert_record.cert_data.encode("utf-8"))
                
                edrpou = ""
                drfo = ""
                for attr in cert.subject:
                    oid_str = attr.oid.dotted_string
                    val = str(attr.value)
                    if oid_str == "1.2.804.2.1.1.1.11.1.1.3":
                        edrpou = val
                    elif oid_str == "1.2.804.2.1.1.1.11.1.4":
                        drfo = val
                
                logger.info(f"[UAPKI SIGNATURE] Extracted from cert: edrpou={edrpou}, drfo={drfo}, tax_id={self.tax_id}")
                
                if not edrpou and len(self.tax_id) == 8:
                    edrpou = self.tax_id
                if not drfo and len(self.tax_id) == 10:
                    drfo = self.tax_id
                id_to_sign = edrpou or drfo or self.tax_id
                if not id_to_sign:
                    logger.error(f"[UAPKI SIGNATURE] Cannot determine EDRPOU/DRFO for signing")
                    raise Exception("Не вдалося визначити ЄДРПОУ/РНОКПП для підпису КЕП.")
                
                logger.info(f"[UAPKI SIGNATURE] Signing ID: {id_to_sign}")
                
                # Sign using UAPKI
                signature = uapki.sign_data(
                    data=id_to_sign,
                    key_file=key_file_path,
                    key_password=""  # Private key already decrypted
                )
                
                logger.info(f"[UAPKI SIGNATURE] Signature created successfully, length={len(signature)}")
                return signature
                
            finally:
                # Clean up temporary files
                if os.path.exists(key_file_path):
                    os.unlink(key_file_path)
                if os.path.exists(cert_file_path):
                    os.unlink(cert_file_path)
                    
        except Exception as e:
            import traceback
            logger.error(f"[UAPKI SIGNATURE] Помилка формування Authorization підпису: {e}")
            logger.error(f"[UAPKI SIGNATURE] Traceback: {traceback.format_exc()}")
            raise Exception(f"Помилка формування підпису UAPKI: {str(e)}")
    
    def _build_authorization_signature_cryptography(self, cert_record) -> str:
        """Build authorization signature using cryptography library (fallback)"""
        try:
            import base64
            from services.report_signer import decrypt_private_key
            from cryptography import x509
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.serialization import pkcs7, load_pem_private_key, Encoding

            logger.info(f"[KEP SIGNATURE] Starting signature build for cert_id={cert_record.id}")
            
            private_key_bytes = decrypt_private_key(cert_record.private_key_encrypted)
            logger.info(f"[KEP SIGNATURE] Private key decrypted successfully, length={len(private_key_bytes)}")
            
            cert = x509.load_pem_x509_certificate(cert_record.cert_data.encode("utf-8"))
            private_key = load_pem_private_key(private_key_bytes, password=None)
            logger.info(f"[KEP SIGNATURE] Certificate and private key loaded")

            edrpou = ""
            drfo = ""
            for attr in cert.subject:
                oid_str = attr.oid.dotted_string
                val = str(attr.value)
                if oid_str == "1.2.804.2.1.1.1.11.1.1.3":
                    edrpou = val
                elif oid_str == "1.2.804.2.1.1.1.11.1.4":
                    drfo = val

            logger.info(f"[KEP SIGNATURE] Extracted from cert: edrpou={edrpou}, drfo={drfo}, tax_id={self.tax_id}")

            if not edrpou and len(self.tax_id) == 8:
                edrpou = self.tax_id
            if not drfo and len(self.tax_id) == 10:
                drfo = self.tax_id
            id_to_sign = edrpou or drfo or self.tax_id
            if not id_to_sign:
                logger.error(f"[KEP SIGNATURE] Cannot determine EDRPOU/DRFO for signing")
                raise Exception("Не вдалося визначити ЄДРПОУ/РНОКПП для підпису КЕП.")

            logger.info(f"[KEP SIGNATURE] Signing ID: {id_to_sign}")

            builder = pkcs7.PKCS7SignatureBuilder()
            builder = builder.set_data(id_to_sign.encode("utf-8"))
            builder = builder.add_signer(cert, private_key, hashes.SHA256())
            # Add certificate to signature according to DPS documentation
            der_signature = builder.sign(Encoding.DER, [cert])
            auth_sig_b64 = base64.b64encode(der_signature).decode("utf-8")
            
            logger.info(f"[KEP SIGNATURE] Signature created successfully, length={len(auth_sig_b64)}")
            return auth_sig_b64
        except Exception as e:
            import traceback
            logger.error(f"[KEP SIGNATURE] Помилка формування Authorization підпису: {e}")
            logger.error(f"[KEP SIGNATURE] Traceback: {traceback.format_exc()}")
            raise Exception(f"Помилка формування підпису КЕП: {str(e)}")

    async def get_oauth_token(self, signature: str) -> str:
        """
        Шаг 2: Exchange signature for DPS OAuth token
        
        Args:
            signature: Base64 encoded CAdES-BES signature
            
        Returns:
            OAuth access token
        """
        try:
            logger.info(f"[DPS OAUTH] Exchanging signature for token")
            
            # DPS OAuth token endpoint
            oauth_url = "https://cabinet.tax.gov.ua/ws/auth/oauth/token"
            
            # Prepare request according to DPS documentation
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            }
            
            # Form data with signature
            data = {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": signature,
                "scope": "tax_api"
            }
            
            logger.info(f"[DPS OAUTH] Requesting token from {oauth_url}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    oauth_url,
                    headers=headers,
                    data=data,
                    timeout=20
                )
            
            logger.info(f"[DPS OAUTH] Response status: {response.status_code}")
            response.raise_for_status()
            
            result = response.json()
            
            if "error" in result:
                error_msg = result.get("error_description", result.get("error", "Unknown error"))
                raise Exception(f"DPS OAuth error: {error_msg}")
            
            access_token = result.get("access_token")
            if not access_token:
                raise Exception("No access token in DPS OAuth response")
            
            logger.info(f"[DPS OAUTH] Token received successfully, length: {len(access_token)}")
            return access_token
            
        except Exception as e:
            logger.error(f"[DPS OAUTH] Failed to get token: {e}")
            raise Exception(f"Помилка отримання токена ДПС: {str(e)}")
    
    async def fetch_dps_data_with_token(self, token: str, year: int = None) -> Any:
        """
        Шаг 3: Use token to query DPS API
        
        Args:
            token: OAuth access token
            year: Year for data (optional)
            
        Returns:
            DPS API response data
        """
        try:
            logger.info(f"[DPS API] Fetching data with token, year={year}")
            
            # DPS public API endpoint
            api_url = f"{self.base_url}/ta/splatp"
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/json"
            }
            
            params = {}
            if year:
                params["year"] = year
            
            logger.info(f"[DPS API] Requesting from {api_url} with params={params}")
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    api_url,
                    headers=headers,
                    params=params,
                    timeout=20
                )
            
            logger.info(f"[DPS API] Response status: {response.status_code}")
            response.raise_for_status()
            
            content_type = response.headers.get("content-type", "")
            if "text/html" in content_type or "<html" in response.text.lower():
                raise Exception("Сервер ДПС повернув HTML сторінку замість даних. Токен недійсний.")
            
            result = response.json()
            logger.info(f"[DPS API] Data fetched successfully")
            return result
            
        except Exception as e:
            logger.error(f"[DPS API] Failed to fetch data: {e}")
            raise Exception(f"Помилка отримання даних ДПС: {str(e)}")
    
    async def get_dps_data_with_uapki(self, year: int = None) -> Any:
        """
        Complete flow: Sign with UAPKI -> Get token -> Fetch data
        
        Args:
            year: Year for data (optional)
            
        Returns:
            DPS API response data
        """
        try:
            # Step 1: Generate signature with UAPKI
            cert_record = self._get_active_certificate()
            signature = self._build_authorization_signature(cert_record)
            
            # Step 2: Exchange signature for token
            token = await self.get_oauth_token(signature)
            
            # Step 3: Fetch data with token
            data = await self.fetch_dps_data_with_token(token, year)
            
            return data
            
        except Exception as e:
            logger.error(f"[DPS FLOW] Complete flow failed: {e}")
            raise Exception(f"Помилка отримання даних ДПС: {str(e)}")

    def _build_jkurwa_signature(self) -> str | None:
        """Try to build signature using jkurwa (JKS-based). Returns None if no JKS stored."""
        if not self.db or not self.profile_id:
            return None
        try:
            from api.main import DPSJKSCredential, decrypt_token
            jks_cred = self.db.query(DPSJKSCredential).filter(
                DPSJKSCredential.profile_id == self.profile_id
            ).first()
            if not jks_cred:
                return None
            from services.jkurwa_signer import sign_with_jkurwa
            password = decrypt_token(jks_cred.password_encrypted)
            signature = sign_with_jkurwa(bytes(jks_cred.jks_data), password)
            logger.info(f"[JKURWA] Signature built for profile_id={self.profile_id}, length={len(signature)}")
            return signature
        except Exception as e:
            logger.warning(f"[JKURWA] Signature build failed: {e}")
            return None

    async def _get_private_api_json(self, path: str, params: dict = None) -> Any:
        auth_signature = self._build_jkurwa_signature()
        if not auth_signature:
            cert_record = self._get_active_certificate()
            auth_signature = self._build_authorization_signature(cert_record)
        headers = {
            "Authorization": auth_signature,
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        url = f"{self.base_url}{path}"
        logger.info(f"DPS private API request: GET {url} params={params or {}}")
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params or {}, timeout=20)
        logger.info(f"DPS private API response: status={response.status_code}, content-type={response.headers.get('content-type')}")
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if "text/html" in content_type or "<html" in response.text.lower():
            raise Exception("Сервер ДПС повернув HTML сторінку замість даних. Авторизація КЕП не прийнята.")
        try:
            return response.json()
        except Exception:
            if response.text.strip().startswith("<"):
                return self._parse_xml_response(response.text)
            raise Exception("Сервер ДПС повернув некоректний формат відповіді.")

    def _map_settlement_rows(self, data: Any) -> list:
        items = data
        if isinstance(data, dict):
            items = data.get("content") or data.get("settlements") or data.get("details") or []
        if isinstance(items, dict):
            items = list(items.values())
        if not isinstance(items, list):
            items = [items] if isinstance(items, dict) else []
        mapped_data = []
        for item in items:
            if not isinstance(item, dict):
                continue
            mapped_data.append({
                "tax_name": item.get("namePlt") or item.get("shotName") or item.get("tax_name") or "Невідомий платіж",
                "tax_code": item.get("plat1") or item.get("shot") or item.get("tax_code") or "",
                "overpaid": float(item.get("perepl0") or item.get("overpaid") or 0.0),
                "debt": float(item.get("nedoim0") or item.get("debtAll") or item.get("zaborg0") or item.get("debt") or 0.0),
                "penalty": float(item.get("penia0") or item.get("penalty") or 0.0),
                "accrued": float(item.get("narah0") or item.get("accrued") or 0.0),
                "paid": float(item.get("splbd0") or item.get("splpov0") or item.get("paid") or 0.0)
            })
        return mapped_data
    
    def _parse_xml_response(self, text: str) -> Any:
        try:
            root = ET.fromstring(text)
            
            # Check for error tags
            if root.tag == "error" or root.find("error") is not None:
                err_desc = root.find("error_description").text if root.find("error_description") is not None else "Невідома помилка"
                raise Exception(f"Помилка ДПС: {err_desc}")
            
            results = []
            for child in root:
                item = {}
                for subchild in child:
                    tag = subchild.tag
                    # Strip namespace if present
                    if "}" in tag:
                        tag = tag.split("}", 1)[1]
                    val = subchild.text
                    if val is not None:
                        try:
                            if "." in val:
                                val = float(val)
                        except ValueError:
                            pass
                    item[tag] = val
                if item:
                    results.append(item)
            return results
        except Exception as e:
            logger.error(f"XML parsing failed: {e}")
            if "Помилка ДПС" in str(e):
                raise e
            raise Exception("Сервер ДПС повернув некоректний формат відповіді (не вдалося розпарсити XML).")

    async def _make_request(self, period: str = None) -> Any:
        if not period:
            import datetime
            period = str(datetime.datetime.now().year)

        # 1. Check for active KEP key in database
        use_kep = False
        cert_record = None
        if self.db and self.profile_id:
            try:
                from api.main import Certificate, Profile
                cert_record = self.db.query(Certificate).filter(
                    Certificate.profile_id == self.profile_id,
                    Certificate.is_active == True
                ).order_by(Certificate.created_at.desc()).first()
                if (not cert_record or not cert_record.private_key_encrypted) and self.tax_id:
                    cert_record = self.db.query(Certificate).join(
                        Profile, Profile.id == Certificate.profile_id
                    ).filter(
                        Profile.tax_id == self.tax_id,
                        Certificate.is_active == True,
                        Certificate.private_key_encrypted != None
                    ).order_by(Certificate.created_at.desc()).first()
                if cert_record and cert_record.private_key_encrypted:
                    use_kep = True
                    logger.info(f"[KEP HANDSHAKE] Активний КЕП знайдено: certificate_id={cert_record.id}, certificate_profile_id={cert_record.profile_id}, requested_profile_id={self.profile_id}")
                else:
                    logger.warning(f"[KEP HANDSHAKE] Активний КЕП не знайдено для profile_id={self.profile_id}, tax_id={self.tax_id}")
            except Exception as e:
                logger.error(f"Failed to query Certificate from DB: {e}")
                raise Exception(f"Помилка перевірки КЕП у базі даних: {str(e)}")

        # Try KEP-based request if certificate found
        if use_kep and cert_record:
            try:
                return await self._get_private_api_json(f"/ws/public_api/ta/splatp", {"year": period})
            except Exception as e:
                logger.warning(f"[KEP HANDSHAKE] KEP-based request failed: {e}")
                logger.info(f"[TOKEN FALLBACK] KEP failed, trying token-based API")
                use_kep = False

        # If KEP not found or failed, try token-based fallback
        if not use_kep:
            logger.warning(f"[TOKEN FALLBACK] Using token-based API")
            if self.token and not self.token.strip().lower().startswith("mock"):
                try:
                    return await self._make_token_request(period)
                except Exception as e:
                    logger.error(f"[TOKEN FALLBACK] Token-based request failed: {e}")
                    raise Exception("Активний КЕП не знайдено для цього профілю. Завантажте КЕП у налаштуваннях або перевірте, що відкрито правильний профіль платника.")
            else:
                raise Exception("Активний КЕП не знайдено для цього профілю. Завантажте КЕП у налаштуваннях або перевірте, що відкрито правильний профіль платника.")

    async def _make_token_request(self, period: str = None) -> Any:
        """Fallback method using token-based API instead of KEP"""
        logger.info(f"[TOKEN API] Making token-based request to DPS API")
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json, application/xml;q=0.9, */*;q=0.8",
            "Content-Type": "application/json"
        }
        params = {
            "tax_id": self.tax_id
        }
        url = "https://cabinet.tax.gov.ua/api/settlement-status"

        logger.info(f"[TOKEN API] Request: GET {url} params={params}")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=headers, params=params, timeout=10)
            except Exception as e:
                logger.error(f"[TOKEN API] Connection error: {e}")
                raise Exception(f"Помилка з'єднання з сервером ДПС: {str(e)}")
        
        logger.info(f"[TOKEN API] Response: Status {response.status_code}, Content-Type: {response.headers.get('content-type')}")
        logger.debug(f"[TOKEN API] Response snippet: {response.text[:500]}")

        if response.status_code == 401:
            raise Exception("Токен ДПС недійсний або закінчився. Будь ласка, оновіть токен або КЕП-ключ.")
        
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            try:
                err_json = response.json()
                if isinstance(err_json, dict):
                    err_desc = err_json.get("error_description") or err_json.get("error") or err_json.get("message")
                    if err_desc:
                        raise Exception(f"Помилка ДПС: {err_desc}")
            except Exception as parse_err:
                if "Помилка ДПС" in str(parse_err):
                    raise parse_err
            raise Exception(f"Сервер ДПС повернув статус {e.response.status_code}. Перевірте токен або спробуйте пізніше.")

        # Check if response is HTML
        content_type = response.headers.get("content-type", "")
        if "text/html" in content_type or "<html" in response.text.lower():
            logger.warning("[TOKEN API] DPS API returned HTML page instead of JSON/XML data.")
            raise Exception("Помилка авторизації токена: Сервер ДПС перенаправив на сторінку входу.")

        # Parse JSON/XML
        try:
            res_data = response.json()
        except Exception as e:
            if "application/xml" in content_type or "text/xml" in content_type or response.text.strip().startswith("<"):
                return self._parse_xml_response(response.text)
            logger.error(f"[TOKEN API] Failed to parse JSON response: {e}")
            raise Exception("Сервер ДПС повернув некоректний формат відповіді.")

        return res_data

    async def _make_request(self, period: str = None) -> Any:
        if not period:
            import datetime
            period = str(datetime.datetime.now().year)

        # 1. Check for active KEP key in database
        use_kep = False
        cert_record = None
        if self.db and self.profile_id:
            try:
                from api.main import Certificate, Profile
                cert_record = self.db.query(Certificate).filter(
                    Certificate.profile_id == self.profile_id,
                    Certificate.is_active == True
                ).order_by(Certificate.created_at.desc()).first()
                if (not cert_record or not cert_record.private_key_encrypted) and self.tax_id:
                    cert_record = self.db.query(Certificate).join(
                        Profile, Profile.id == Certificate.profile_id
                    ).filter(
                        Profile.tax_id == self.tax_id,
                        Certificate.is_active == True,
                        Certificate.private_key_encrypted != None
                    ).order_by(Certificate.created_at.desc()).first()
                if cert_record and cert_record.private_key_encrypted:
                    use_kep = True
                    logger.info(f"[KEP HANDSHAKE] Активний КЕП знайдено: certificate_id={cert_record.id}, certificate_profile_id={cert_record.profile_id}, requested_profile_id={self.profile_id}")
                else:
                    logger.warning(f"[KEP HANDSHAKE] Активний КЕП не знайдено для profile_id={self.profile_id}, tax_id={self.tax_id}")
            except Exception as e:
                logger.error(f"Failed to query Certificate from DB: {e}")
                raise Exception(f"Помилка перевірки КЕП у базі даних: {str(e)}")

        # Try KEP-based request if certificate found
        if use_kep and cert_record:
            try:
                return await self._get_private_api_json(f"/ws/public_api/ta/splatp", {"year": period})
            except Exception as e:
                logger.warning(f"[KEP HANDSHAKE] KEP-based request failed: {e}")
                logger.info(f"[TOKEN FALLBACK] KEP failed, trying token-based API")
                use_kep = False

        # If KEP not found or failed, try token-based fallback
        if not use_kep:
            logger.warning(f"[TOKEN FALLBACK] Using token-based API")
            if self.token and not self.token.strip().lower().startswith("mock"):
                try:
                    return await self._make_token_request(period)
                except Exception as e:
                    logger.error(f"[TOKEN FALLBACK] Token-based request failed: {e}")
                    raise Exception("Активний КЕП не знайдено для цього профілю. Завантажте КЕП у налаштуваннях або перевірте, що відкрито правильний профіль платника.")
            else:
                raise Exception("Активний КЕП не знайдено для цього профілю. Завантажте КЕП у налаштуваннях або перевірте, що відкрито правильний профіль платника.")

        if use_kep:
            logger.info(f"[KEP HANDSHAKE] Ключ знайдено для профілю {self.profile_id}")
            async with httpx.AsyncClient() as client:
                # Step 1: Session initialization
                stage = "ініціалізація сесії"
                try:
                    init_resp = await client.get("https://cabinet.tax.gov.ua/", timeout=15)
                    init_resp.raise_for_status()
                    logger.info("[KEP HANDSHAKE] Отримано початковий виклик від ДПС")
                except Exception as e:
                    error_detail = self._format_error(e)
                    logger.error(f"[KEP HANDSHAKE] Помилка на етапі: {stage}: {error_detail}")
                    raise Exception(f"Помилка КЕП авторизації: {stage}: {error_detail}")

                # Step 2: Extract attributes and sign
                stage = "підписання виклику"
                try:
                    from services.report_signer import decrypt_private_key
                    private_key_bytes = decrypt_private_key(cert_record.private_key_encrypted)
                    
                    import base64
                    import time
                    from cryptography.hazmat.primitives.serialization import pkcs7, load_pem_private_key, Encoding
                    from cryptography import x509
                    from cryptography.hazmat.primitives import hashes
                    
                    cert = x509.load_pem_x509_certificate(cert_record.cert_data.encode('utf-8'))
                    private_key = load_pem_private_key(private_key_bytes, password=None)
                    
                    # Extract EDRPOU/DRFO from cert OIDs
                    edrpou = ""
                    drfo = ""
                    for attr in cert.subject:
                        oid_str = attr.oid.dotted_string
                        val = str(attr.value)
                        if oid_str == "1.2.804.2.1.1.1.11.1.1.3":
                            edrpou = val
                        elif oid_str == "1.2.804.2.1.1.1.11.1.4":
                            drfo = val
                            
                    if not edrpou and len(self.tax_id) == 8:
                        edrpou = self.tax_id
                    if not drfo and len(self.tax_id) == 10:
                        drfo = self.tax_id
                        
                    if not edrpou:
                        edrpou = drfo
                    if not drfo:
                        drfo = edrpou
                        
                    id_to_sign = edrpou if edrpou else drfo
                    
                    builder = pkcs7.PKCS7SignatureBuilder()
                    builder = builder.set_data(id_to_sign.encode('utf-8'))
                    builder = builder.add_signer(cert, private_key, hashes.SHA256())
                    
                    der_signature = builder.sign(Encoding.DER, [])
                    auth_sig_b64 = base64.b64encode(der_signature).decode('utf-8')
                except Exception as e:
                    error_detail = self._format_error(e)
                    logger.error(f"[KEP HANDSHAKE] Помилка на етапі: {stage}: {error_detail}")
                    raise Exception(f"Помилка КЕП авторизації: {stage}: {error_detail}")

                # Step 3: Login handshake
                stage = "автентифікація"
                try:
                    id_cabinet = str(int(time.time() * 1000))
                    username = f"{edrpou}-{drfo}-{id_cabinet}"
                    
                    login_data = {
                        "grant_type": "password",
                        "username": username,
                        "password": auth_sig_b64
                    }
                    login_headers = {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Authorization": "Basic QUU2ODY3NjY0QzA5NkM4M0UwNTMwMTAxMDA3RjQ1RjQ6QUU2ODY3NjY0QzA5NkM4M0UwNTMwMTAxMDA3RjQ1RjQ="
                    }
                    
                    logger.info("[KEP HANDSHAKE] Відправлено підписаний КЕП пакет логіну")
                    token_resp = await client.post(
                        "https://cabinet.tax.gov.ua/ws/auth/oauth/token",
                        data=login_data,
                        headers=login_headers,
                        timeout=15
                    )
                    token_resp.raise_for_status()
                    
                    token_data = token_resp.json()
                    access_token = token_data.get("access_token")
                    
                    cookie_names = list(client.cookies.keys())
                    logger.info(f"[KEP HANDSHAKE] Авторизація успішна. Отримано Cookies: {cookie_names}")
                except Exception as e:
                    error_detail = self._format_error(e)
                    logger.error(f"[KEP HANDSHAKE] Помилка на етапі: {stage}: {error_detail}")
                    raise Exception(f"Помилка КЕП авторизації: {stage}: {error_detail}")

                # Step 4: Make requests with established session cookies
                stage = "запит даних із сесією"
                try:
                    headers = {
                        "Authorization": f"Bearer {access_token}" if access_token else "",
                        "Accept": "application/json, text/plain, */*",
                        "Content-Type": "application/json"
                    }
                    params = {
                        "year": period
                    }
                    url = f"{self.base_url}/ta/splatp"
                    
                    logger.info(f"DPS API Request with KEP: GET {url} params={params}")
                    response = await client.get(url, headers=headers, params=params, timeout=15)
                except Exception as e:
                    error_detail = self._format_error(e)
                    logger.error(f"[KEP HANDSHAKE] Помилка на етапі: {stage}: {error_detail}")
                    raise Exception(f"Помилка КЕП авторизації: {stage}: {error_detail}")

                # Step 5: Process and map response
                stage = "обробка відповіді"
                try:
                    response.raise_for_status()
                    
                    # Check if response is HTML
                    content_type = response.headers.get("content-type", "")
                    if "text/html" in content_type or "<html" in response.text.lower():
                        logger.warning("DPS API returned HTML page (redirection/login screen) instead of JSON/XML data.")
                        raise Exception("Сервер ДПС перенаправив на сторінку входу.")
                    
                    # Parse JSON/XML
                    try:
                        res_data = response.json()
                    except Exception as e:
                        if "application/xml" in content_type or "text/xml" in content_type or response.text.strip().startswith("<"):
                            res_data = self._parse_xml_response(response.text)
                        else:
                            logger.error(f"Failed to parse JSON response: {e}")
                            raise Exception("Сервер ДПС повернув некоректний формат відповіді.")
                    
                    # Map keys
                    mapped_data = []
                    items = res_data
                    if isinstance(res_data, dict):
                        items = res_data.get("settlements") or res_data.get("details") or []
                        if isinstance(items, dict):
                            items = list(items.values())
                    
                    if not isinstance(items, list):
                        items = [items] if isinstance(items, dict) else []
                    
                    for item in items:
                        if not isinstance(item, dict):
                            continue
                        mapped_data.append({
                            "tax_name": item.get("namePlt") or item.get("tax_name") or "Невідомий платіж",
                            "tax_code": item.get("plat1") or item.get("tax_code") or "",
                            "overpaid": float(item.get("perepl0") or item.get("overpaid") or 0.0),
                            "debt": float(item.get("nedoim0") or item.get("debtAll") or item.get("debt") or 0.0),
                            "penalty": float(item.get("penia0") or item.get("penalty") or 0.0),
                            "accrued": float(item.get("narah0") or item.get("accrued") or 0.0),
                            "paid": float(item.get("splbd0") or item.get("paid") or 0.0)
                        })
                    return mapped_data
                except Exception as e:
                    error_detail = self._format_error(e)
                    logger.error(f"[KEP HANDSHAKE] Помилка на етапі: {stage}: {error_detail}")
                    raise Exception(f"Помилка КЕП авторизації: {stage}: {error_detail}")
        else:
            # Fallback to old token-based request or mock/demo data
            if not self.token or self.token.strip().lower().startswith("mock") or self.token.strip().lower().startswith("demo"):
                logger.info("Using mock/demo data for settlements")
                return [
                    {
                        "tax_name": "Єдиний податок з фізичних осіб",
                        "tax_code": "18050400",
                        "overpaid": 0.0,
                        "debt": 1729.40,
                        "penalty": 0.0,
                        "accrued": 1729.40,
                        "paid": 0.0
                    },
                    {
                        "tax_name": "Військовий збір",
                        "tax_code": "11011700",
                        "overpaid": 0.0,
                        "debt": 864.70,
                        "penalty": 0.0,
                        "accrued": 864.70,
                        "paid": 0.0
                    }
                ]

            headers = {
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/json, application/xml;q=0.9, */*;q=0.8",
                "Content-Type": "application/json"
            }
            params = {
                "tax_id": self.tax_id
            }
            url = "https://cabinet.tax.gov.ua/api/settlement-status"

            logger.info(f"DPS API Request: GET {url} params={params}")

            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(url, headers=headers, params=params, timeout=10)
                except Exception as e:
                    logger.error(f"DPS API connection error: {e}")
                    raise Exception(f"Помилка з'єднання з сервером ДПС: {str(e)}")
            
            logger.info(f"DPS API Response: Status {response.status_code}, Content-Type: {response.headers.get('content-type')}")
            logger.debug(f"DPS API Response snippet: {response.text[:500]}")

            if response.status_code == 401:
                raise Exception("Токен ДПС недійсний або закінчився. Будь ласка, оновіть токен або КЕП-ключ.")
            
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                try:
                    err_json = response.json()
                    if isinstance(err_json, dict):
                        err_desc = err_json.get("error_description") or err_json.get("error") or err_json.get("message")
                        if err_desc:
                            raise Exception(f"Помилка ДПС: {err_desc}")
                except Exception as parse_err:
                    if "Помилка ДПС" in str(parse_err):
                        raise parse_err
                raise Exception(f"Сервер ДПС повернув статус {e.response.status_code}. Перевірте КЕП або спробуйте пізніше.")

            # Check if response is HTML
            content_type = response.headers.get("content-type", "")
            if "text/html" in content_type or "<html" in response.text.lower():
                logger.warning("DPS API returned HTML page (redirection/login screen) instead of JSON/XML data.")
                raise Exception("Помилка авторизації ключа: Сервер ДПС перенаправив на сторінку входу.")

            # Parse JSON/XML
            try:
                res_data = response.json()
            except Exception as e:
                if "application/xml" in content_type or "text/xml" in content_type or response.text.strip().startswith("<"):
                    return self._parse_xml_response(response.text)
                logger.error(f"Failed to parse JSON response: {e}")
                raise Exception("Сервер ДПС повернув некоректний формат відповіді.")

            # Map keys if KEP signature authorization was used
            if use_kep:
                mapped_data = []
                items = res_data
                if isinstance(res_data, dict):
                    items = res_data.get("settlements") or res_data.get("details") or []
                    if isinstance(items, dict):
                        items = list(items.values())
                
                if not isinstance(items, list):
                    items = [items] if isinstance(items, dict) else []
                
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    mapped_data.append({
                        "tax_name": item.get("namePlt") or item.get("tax_name") or "Невідомий платіж",
                        "tax_code": item.get("plat1") or item.get("tax_code") or "",
                        "overpaid": float(item.get("perepl0") or item.get("overpaid") or 0.0),
                        "debt": float(item.get("nedoim0") or item.get("debtAll") or item.get("debt") or 0.0),
                        "penalty": float(item.get("penia0") or item.get("penalty") or 0.0),
                        "accrued": float(item.get("narah0") or item.get("accrued") or 0.0),
                        "paid": float(item.get("splbd0") or item.get("paid") or 0.0)
                    })
                return mapped_data

            return res_data

    async def get_settlement_status(self, period: str = None) -> Any:
        """Прямий запит до API ДПС з fallback на токен при помилці КЕП"""
        if not period:
            period = str(datetime.datetime.now().year)
        
        # Try KEP-based request first
        try:
            data = await self._get_private_api_json("/ta/splatp", {"year": period})
            return self._map_settlement_rows(data)
        except Exception as e:
            logger.warning(f"[DPS API] KEP-based request failed: {e}")
            logger.info(f"[DPS API] Falling back to token-based API")
            
            # Fallback to token-based request
            if self.token and not self.token.strip().lower().startswith("mock"):
                try:
                    return await self._make_token_request(period)
                except Exception as token_error:
                    logger.error(f"[DPS API] Token-based request also failed: {token_error}")
                    raise Exception(f"Помилка запиту до ДПС: КЕП помилка: {e}, Токен помилка: {token_error}")
            else:
                raise Exception(f"Помилка запиту до ДПС: {e}")

    async def get_detailed_settlements(self, period: str = None) -> Any:
        """Отримує ДЕТАЛЬНУ таблицю розрахунків з бюджетом"""
        return await self.get_settlement_status(period=period)

    async def get_report_documents(self, year: int = None, month: int = None) -> Any:
        if not year:
            year = datetime.datetime.now().year
        if not month:
            month = datetime.datetime.now().month
        data = await self._get_private_api_json("/reg_doc/list", {"periodYear": year, "periodMonth": month})
        if isinstance(data, dict):
            return data.get("content") or []
        return data if isinstance(data, list) else []

    async def get_report_status(self, report_type: str = None, year: int = None, month: int = None) -> dict:
        docs = await self.get_report_documents(year=year, month=month)
        matching_docs = []
        for doc in docs:
            if not isinstance(doc, dict):
                continue
            doc_code = doc.get("doc") or doc.get("cDoc") or doc.get("cdoc")
            if not report_type or doc_code == report_type:
                matching_docs.append(doc)
        if not matching_docs:
            return {"submitted": False, "submission_date": None}
        accepted_doc = next((d for d in matching_docs if "Прийнято" in str(d.get("flagName", ""))), matching_docs[0])
        return {
            "submitted": True,
            "submission_date": accepted_doc.get("dget") or accepted_doc.get("dterm"),
            "status": accepted_doc.get("flagName"),
            "document_name": accepted_doc.get("docName"),
            "registration_number": accepted_doc.get("nreg")
        }
    
    def get_current_tax_rates(self) -> dict:
        """Отримати актуальні податкові ставки для ФОП"""
        return {
            "single_tax": {
                "group_1": {"rate": 10, "limit": 294000, "description": "до 294,000 грн/рік"},
                "group_2": {"rate": 20, "limit": 2208000, "description": "до 2,208,000 грн/рік"},
                "group_3": {"rate": 5, "limit": None, "description": "без обмежень"}
            },
            "military_tax": {
                "rate": 1.5,
                "description": "1.5% від доходу"
            },
            "esv": {
                "rate": 22,
                "min_wage_base": 9288,  # UAH per month (2024)
                "description": "22% від мінімальної зарплати"
            },
            "pdfo": {
                "rate": 18,
                "description": "18% від доходу (загальна система)"
            },
            "vat": {
                "rate": 20,
                "description": "20% ПДВ"
            },
            "updated_at": datetime.datetime.now().isoformat()
        }
    
    def get_recent_changes(self) -> list:
        """Отримати останні зміни в податковому законодавстві"""
        return [
            {
                "id": 1,
                "date": "2024-01-01",
                "title": "Збільшення військового збору",
                "description": "Ставка військового збору збільшена з 1% до 1.5%",
                "affected_groups": [1, 2, 3],
                "type": "rate_change"
            },
            {
                "id": 2,
                "date": "2024-01-01",
                "title": "Оновлення лімітів доходу для ФОП",
                "description": "Нові ліміти: Група 1 - 294,000 грн, Група 2 - 2,208,000 грн",
                "affected_groups": [1, 2],
                "type": "limit_change"
            },
            {
                "id": 3,
                "date": "2024-01-01",
                "title": "Обов'язкове використання ПРРО",
                "description": "Групи 2 та 3 зобов'язані використовувати ПРРО",
                "affected_groups": [2, 3],
                "type": "requirement"
            }
        ]
