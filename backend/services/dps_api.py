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
            raise Exception("Активний КЕП не знайдено для цього профілю. Завантажте КЕП у налаштуваннях або перевірте, що відкрито правильний профіль платника.")
        try:
            from api.main import Certificate, Profile
            cert_record = self.db.query(Certificate).filter(
                Certificate.profile_id == self.profile_id,
                Certificate.is_active == True,
                Certificate.private_key_encrypted != None
            ).order_by(Certificate.created_at.desc()).first()
            if not cert_record and self.tax_id:
                cert_record = self.db.query(Certificate).join(
                    Profile, Profile.id == Certificate.profile_id
                ).filter(
                    Profile.tax_id == self.tax_id,
                    Certificate.is_active == True,
                    Certificate.private_key_encrypted != None
                ).order_by(Certificate.created_at.desc()).first()
            if not cert_record:
                raise Exception("Активний КЕП не знайдено для цього профілю. Завантажте КЕП у налаштуваннях або перевірте, що відкрито правильний профіль платника.")
            return cert_record
        except Exception as e:
            if "Активний КЕП" in str(e):
                raise e
            logger.error(f"Failed to query Certificate from DB: {e}")
            raise Exception(f"Помилка перевірки КЕП у базі даних: {str(e)}")

    def _build_authorization_signature(self, cert_record) -> str:
        try:
            import base64
            from services.report_signer import decrypt_private_key
            from cryptography import x509
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.serialization import pkcs7, load_pem_private_key, Encoding

            private_key_bytes = decrypt_private_key(cert_record.private_key_encrypted)
            cert = x509.load_pem_x509_certificate(cert_record.cert_data.encode("utf-8"))
            private_key = load_pem_private_key(private_key_bytes, password=None)

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
            id_to_sign = edrpou or drfo or self.tax_id
            if not id_to_sign:
                raise Exception("Не вдалося визначити ЄДРПОУ/РНОКПП для підпису КЕП.")

            builder = pkcs7.PKCS7SignatureBuilder()
            builder = builder.set_data(id_to_sign.encode("utf-8"))
            builder = builder.add_signer(cert, private_key, hashes.SHA256())
            der_signature = builder.sign(Encoding.DER, [])
            return base64.b64encode(der_signature).decode("utf-8")
        except Exception as e:
            logger.error(f"[KEP SIGNATURE] Помилка формування Authorization підпису: {e}")
            raise Exception(f"Помилка формування підпису КЕП: {str(e)}")

    async def _get_private_api_json(self, path: str, params: dict = None) -> Any:
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

        if self.db and self.profile_id and not use_kep:
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
                "tax_id": self.tax_id,
                "period": period,
                "type": "detailed"
            }
            url = "https://cabinet.tax.gov.ua/api/statement-of-settlements"

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
        """Прямий запит до API ДПС"""
        if not period:
            period = str(datetime.datetime.now().year)
        data = await self._get_private_api_json("/ta/splatp", {"year": period})
        return self._map_settlement_rows(data)

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
