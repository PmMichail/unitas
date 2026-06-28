import os
import httpx
from typing import Dict, List, Optional
from datetime import datetime, timedelta

# Global variable to store last PrivatBank API debug log
privatbank_debug_log = ""

# Global variable to store last Monobank API debug log
_monobank_debug_log = ""

# Global variable to store last A-Bank API debug log
_abank_debug_log = ""

BANKS = {
    "privat": {
        "name": "ПриватБанк",
        "auth_url": "https://auth.privatbank.ua/oauth2/authorize",
        "token_url": "https://auth.privatbank.ua/oauth2/token",
        "scope": "statements payments",
        "client_id": os.getenv("PRIVAT_CLIENT_ID"),
        "client_secret": os.getenv("PRIVAT_CLIENT_SECRET")
    },
    "monobank": {
        "name": "Monobank",
        "auth_url": "https://api.monobank.ua/oauth/authorize",
        "token_url": "https://api.monobank.ua/oauth/token",
        "scope": "personal",
        "client_id": os.getenv("MONOBANK_CLIENT_ID"),
        "client_secret": os.getenv("MONOBANK_CLIENT_SECRET")
    },
    "abank": {
        "name": "А-Банк",
        "auth_url": "https://api.abank.ua/oauth/authorize",
        "token_url": "https://api.abank.ua/oauth/token",
        "scope": "accounts statements",
        "client_id": os.getenv("ABANK_CLIENT_ID"),
        "client_secret": os.getenv("ABANK_CLIENT_SECRET")
    },
    "oschadbank": {
        "name": "Ощадбанк",
        "auth_url": "https://api.oschadbank.ua/oauth/authorize",
        "token_url": "https://api.oschadbank.ua/oauth/token",
        "scope": "accounts statements",
        "client_id": os.getenv("OSCHAD_CLIENT_ID"),
        "client_secret": os.getenv("OSCHAD_CLIENT_SECRET")
    }
}

class BankOAuthService:
    def __init__(self):
        self.redirect_uri = os.getenv("BANK_REDIRECT_URI", "https://unitas-backend.fly.dev/api/banks/{bank_name}/callback")
    
    def get_auth_url(self, bank_name: str, state: str) -> str:
        """Generate OAuth authorization URL"""
        bank = BANKS.get(bank_name)
        if not bank:
            raise ValueError(f"Unknown bank: {bank_name}")
        
        return f"{bank['auth_url']}?client_id={bank['client_id']}&response_type=code&scope={bank['scope']}&state={state}&redirect_uri={self.redirect_uri.format(bank_name=bank_name)}"
    
    async def exchange_code_for_token(self, bank_name: str, code: str) -> Dict:
        """Exchange authorization code for access token"""
        bank = BANKS.get(bank_name)
        if not bank:
            raise ValueError(f"Unknown bank: {bank_name}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                bank['token_url'],
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": bank['client_id'],
                    "client_secret": bank['client_secret'],
                    "redirect_uri": self.redirect_uri.format(bank_name=bank_name)
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def refresh_token(self, bank_name: str, refresh_token: str) -> Dict:
        """Refresh access token using refresh token"""
        bank = BANKS.get(bank_name)
        if not bank:
            raise ValueError(f"Unknown bank: {bank_name}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                bank['token_url'],
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": bank['client_id'],
                    "client_secret": bank['client_secret']
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def get_bank_accounts(self, bank_name: str, access_token: str) -> List[Dict]:
        if bank_name == "monobank":
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    "https://api.monobank.ua/personal/client-info",
                    headers={"X-Token": access_token}
                )
                response.raise_for_status()
                data = response.json()
                accounts = []
                for account in data.get("accounts", []):
                    accounts.append({
                        "id": account.get("id"),
                        "number": account.get("maskedPan", [None])[0] or account.get("iban") or account.get("id"),
                        "currency": account.get("currencyCode"),
                        "balance": (account.get("balance") or 0) / 100,
                        "iban": account.get("iban")
                    })
                return accounts
        if bank_name == "privat":
            return [{"id": "default", "number": "", "currency": "UAH", "balance": 0.0}]
        return []
    
    async def get_bank_transactions(
        self, 
        bank_name: str, 
        access_token: str, 
        account_id: str, 
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> List[Dict]:
        if from_date is None:
            from_date = datetime.now() - timedelta(days=1)
        if to_date is None:
            to_date = datetime.now()
        
        if bank_name == "monobank":
            from_ts = int(from_date.timestamp())
            to_ts = int(to_date.timestamp())
            requested_account = (account_id or "").strip()
            statement_account = "0"
            debug_log = "[Monobank API] Mode: personal/fop account statement\n"
            async with httpx.AsyncClient(timeout=30) as client:
                if requested_account and requested_account != "manual":
                    info_response = await client.get(
                        "https://api.monobank.ua/personal/client-info",
                        headers={"X-Token": access_token}
                    )
                    try:
                        info_response.raise_for_status()
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code == 403:
                            raise ValueError("Monobank token does not have access to Personal/FOP API. Use token from https://api.monobank.ua/ for account statements, not merchant/acquiring token.")
                        raise
                    client_info = info_response.json()
                    accounts = client_info.get("accounts", []) if isinstance(client_info, dict) else []
                    for account in accounts:
                        if requested_account in {account.get("id"), account.get("iban")}:
                            statement_account = account.get("id") or statement_account
                            break
                    debug_log += f"[Monobank API] Requested account: {requested_account}\n"
                    debug_log += f"[Monobank API] Resolved statement account: {statement_account}\n"
                    debug_log += f"[Monobank API] Accounts preview: {[{'id': a.get('id'), 'iban': a.get('iban'), 'type': a.get('type'), 'currencyCode': a.get('currencyCode')} for a in accounts][:10]}\n"
                url = f"https://api.monobank.ua/personal/statement/{statement_account}/{from_ts}/{to_ts}"
                debug_log += f"[Monobank API] Request URL: {url}\n"
                response = await client.get(url, headers={"X-Token": access_token})
                response.raise_for_status()
                transactions = response.json()
                if not isinstance(transactions, list):
                    transactions = []
                debug_log += f"[Monobank API] Transactions count: {len(transactions)}\n"
                debug_log += f"[Monobank API] Response preview: {str(transactions[:5])[:1000]}\n"
                global _monobank_debug_log
                _monobank_debug_log = debug_log
                return [
                    {
                        "id": item.get("id") or item.get("invoiceId") or f"mono_{from_ts}_{index}",
                        "date": datetime.fromtimestamp(item.get("time") or from_ts).isoformat(),
                        "amount": (item.get("amount") or 0) / 100,
                        "purpose": item.get("comment") or item.get("description") or item.get("invoiceId") or "",
                        "counterparty": item.get("counterName") or item.get("counterIban") or item.get("counterEdrpou") or "",
                        "balance_after": (item.get("balance") / 100) if item.get("balance") is not None else None,
                        "raw": item
                    }
                    for index, item in enumerate(transactions)
                ]
        if bank_name == "abank":
            import uuid
            iban = (account_id or "").strip()
            if not access_token:
                raise ValueError("A-Bank token is not configured")
            if not iban or iban == "manual":
                raise ValueError("A-Bank IBAN is not configured")
            payload = {
                "request_ref": str(uuid.uuid4()).upper(),
                "token": access_token,
                "iban": iban,
                "date_from": from_date.strftime("%Y-%m-%d %H:%M:%S"),
                "date_to": to_date.strftime("%Y-%m-%d %H:%M:%S"),
            }
            debug_log = "[A-Bank API] Request URL: https://open-api.a-bank.com.ua/legal-entity/payments-list\n"
            debug_log += f"[A-Bank API] Request payload: {{'request_ref': '{payload['request_ref']}', 'iban': '{iban}', 'date_from': '{payload['date_from']}', 'date_to': '{payload['date_to']}'}}\n"
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://open-api.a-bank.com.ua/legal-entity/payments-list",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                data = response.json()
                debug_log += f"[A-Bank API] Response keys: {list(data.keys()) if isinstance(data, dict) else type(data)}\n"
                debug_log += f"[A-Bank API] Response preview: {str(data)[:1000]}\n"
                if not isinstance(data, dict):
                    raise ValueError("A-Bank API returned invalid response")
                if data.get("result") == "error":
                    error = data.get("error") or {}
                    raise ValueError(error.get("title") or error.get("status") or "A-Bank API error")
                payments = data.get("payments") or []
                debug_log += f"[A-Bank API] Payments count: {len(payments)}\n"
                global _abank_debug_log
                _abank_debug_log = debug_log
                normalized = []
                for index, item in enumerate(payments):
                    debit = item.get("debit") or {}
                    credit = item.get("credit") or {}
                    amount_raw = item.get("amount_eq") if item.get("amount_eq") is not None else item.get("amount")
                    try:
                        amount = float(str(amount_raw or 0).replace(" ", "").replace(",", "."))
                    except Exception:
                        amount = 0.0
                    if iban and debit.get("iban") == iban:
                        amount = -abs(amount)
                        counterparty = credit.get("name") or credit.get("iban") or credit.get("okpo") or ""
                    else:
                        amount = abs(amount)
                        counterparty = debit.get("name") or debit.get("iban") or debit.get("okpo") or ""
                    normalized.append({
                        "id": str(item.get("payment_ref") or item.get("payment_num") or f"abank_{payload['request_ref']}_{index}"),
                        "date": item.get("date_create") or item.get("date") or from_date.strftime("%Y-%m-%d"),
                        "amount": amount,
                        "purpose": item.get("title") or "",
                        "counterparty": counterparty,
                        "balance_after": None,
                        "raw": item
                    })
                return normalized
        if bank_name == "privat":
            auth_data = {}
            try:
                import json
                auth_data = json.loads(access_token) if access_token.strip().startswith("{") else {"token": access_token}
            except Exception:
                auth_data = {"token": access_token}
            token = auth_data.get("token") or auth_data.get("password") or access_token
            if not token:
                raise ValueError("PrivatBank token is not configured")
            acc = account_id if account_id and account_id != "manual" else auth_data.get("card", "")
            if not acc:
                raise ValueError("PrivatBank account number is not configured")
            params = {
                "acc": acc,
                "startDate": from_date.strftime("%d-%m-%Y"),
                "endDate": to_date.strftime("%d-%m-%Y"),
                "limit": 100
            }
            headers = {
                "User-Agent": "Unitas Accounting System",
                "token": token,
                "Content-Type": "application/json;charset=cp1251"
            }
            debug_log = f"[PrivatBank API] Request URL: https://acp.privatbank.ua/api/statements/transactions\n"
            debug_log += f"[PrivatBank API] Request params: {params}\n"
            debug_log += f"[PrivatBank API] Request headers: {headers}\n"
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get("https://acp.privatbank.ua/api/statements/transactions", params=params, headers=headers)
                response.raise_for_status()
                try:
                    # Try to parse JSON with explicit encoding handling
                    import json
                    # Try response.json() first
                    try:
                        # Attempt strict UTF-8 decoding
                        raw_text = response.content.decode('utf-8')
                        data = json.loads(raw_text)
                    except UnicodeDecodeError:
                        try:
                            # Fallback to CP1251 (Windows-1251) commonly used by PrivatBank ACP API
                            raw_text = response.content.decode('cp1251')
                            data = json.loads(raw_text)
                        except Exception:
                            # Final fallback with characters ignored
                            raw_text = response.content.decode('utf-8', errors='ignore')
                            data = json.loads(raw_text)
                    except Exception:
                        # Fallback for other JSON parse errors
                        raw_text = response.content.decode('utf-8', errors='ignore')
                        data = json.loads(raw_text)
                    debug_log += f"[PrivatBank API] Response data keys: {list(data.keys()) if isinstance(data, dict) else type(data)}\n"
                    debug_log += f"[PrivatBank API] Response preview: {str(data)[:1000]}\n"
                except Exception as e:
                    data = {}
                    debug_log += f"[PrivatBank API] Failed to parse JSON: {e}\n"
                    debug_log += f"[PrivatBank API] Raw response length: {len(response.content)}\n"
                    debug_log += f"[PrivatBank API] Raw response: {response.text[:1000]}\n"
                statements = data.get("transactions") or data.get("statements") or data.get("statement") or []
                if isinstance(statements, dict):
                    statements = statements.get("statement", [])
                if isinstance(statements, dict):
                    statements = [statements]
                debug_log += f"[PrivatBank API] Statements count: {len(statements)}\n"
                normalized = []
                for item in statements:
                    amount_raw = item.get("amount") or item.get("SUM") or item.get("sum") or 0
                    try:
                        amount = float(str(amount_raw).replace(" ", "").replace(",", "."))
                    except Exception:
                        amount = 0.0

                    # Detect transaction direction (Debit vs Credit)
                    # TRANTYPE: "D" for Debit (outflow/expense), "C" for Credit (inflow/income)
                    # dbcr: "db"/"debit" for Debit, "cr"/"credit" for Credit
                    trantype_val = item.get("TRANTYPE") or item.get("trantype") or item.get("dbcr") or item.get("DEBCR")
                    if trantype_val and isinstance(trantype_val, str):
                        trantype_upper = trantype_val.strip().upper()
                        if trantype_upper.startswith("D"): # matches "D", "DB", "DEBIT"
                            amount = -abs(amount)
                        elif trantype_upper.startswith("C"): # matches "C", "CR", "CREDIT"
                            amount = abs(amount)

                    tx_date = item.get("date") or item.get("DATE") or item.get("trandate") or item.get("DAT_OD") or item.get("DAT_KL") or from_date.strftime("%Y-%m-%d")
                    normalized.append({
                        "id": str(item.get("id") or item.get("REF") or item.get("reference") or f"privat_{tx_date}_{amount}_{len(normalized)}"),
                        "date": tx_date,
                        "amount": amount,
                        "purpose": item.get("description") or item.get("purpose") or item.get("OSND") or "",
                        "counterparty": item.get("counterpartyName") or item.get("name") or item.get("AUT_CNTR_NAM") or "",
                        "balance_after": None,
                        "raw": item
                    })
                debug_log += f"[PrivatBank API] Normalized transactions: {len(normalized)}\n"
                global privatbank_debug_log
                privatbank_debug_log = debug_log
                try:
                    with open("/tmp/privatbank_debug.log", "a") as f:
                        f.write(debug_log + "\n")
                except Exception:
                    pass
                print(debug_log)
                return normalized
        return []

bank_oauth_service = BankOAuthService()
