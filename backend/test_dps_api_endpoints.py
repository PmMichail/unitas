#!/usr/bin/env python3
"""
Скрипт для перевірки актуальності API ендпоінтів ДПС
Використання: python test_dps_api_endpoints.py
"""

import httpx
import asyncio
import json
from datetime import datetime

DPS_ENDPOINTS = {
    "main_page": "https://cabinet.tax.gov.ua/",
    "oauth_token": "https://cabinet.tax.gov.ua/ws/auth/oauth/token",
    "public_api_splatp": "https://cabinet.tax.gov.ua/ws/public_api/ta/splatp",
    "api_statement": "https://cabinet.tax.gov.ua/api/statement-of-settlements",
    "api_settlement_status": "https://cabinet.tax.gov.ua/api/settlement-status",
    "api_tax_debt": "https://cabinet.tax.gov.ua/api/tax-debt",
}

async def test_endpoint(name: str, url: str, method: str = "GET", headers: dict = None, params: dict = None):
    """Перевіряє доступність ендпоінту"""
    print(f"\n🔍 Перевірка {name}: {url}")
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=params)
            
            print(f"   ✅ Status: {response.status_code}")
            print(f"   📄 Content-Type: {response.headers.get('content-type', 'N/A')}")
            
            # Check if response is HTML (might indicate login page)
            content_type = response.headers.get('content-type', '')
            if 'text/html' in content_type or '<html' in response.text.lower():
                print(f"   ⚠️  Warning: Response is HTML (might be login page)")
            
            # Show snippet of response
            snippet = response.text[:200] if response.text else "Empty response"
            print(f"   📝 Response snippet: {snippet}...")
            
            return {
                "name": name,
                "url": url,
                "status": response.status_code,
                "content_type": content_type,
                "success": response.status_code < 400
            }
    except httpx.TimeoutException:
        print(f"   ❌ Timeout: Request timed out")
        return {"name": name, "url": url, "status": "TIMEOUT", "success": False}
    except httpx.ConnectError:
        print(f"   ❌ Connection Error: Could not connect")
        return {"name": name, "url": url, "status": "CONNECT_ERROR", "success": False}
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return {"name": name, "url": url, "status": "ERROR", "error": str(e), "success": False}

async def main():
    print("=" * 60)
    print("Перевірка API ендпоінтів ДПС")
    print(f"Час: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    results = []
    
    # Test main page
    results.append(await test_endpoint("Main Page", DPS_ENDPOINTS["main_page"]))
    
    # Test OAuth token endpoint (without credentials)
    results.append(await test_endpoint(
        "OAuth Token", 
        DPS_ENDPOINTS["oauth_token"], 
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        params={"grant_type": "password", "username": "test", "password": "test"}
    ))
    
    # Test public API endpoint (without auth)
    results.append(await test_endpoint(
        "Public API (splatp)", 
        DPS_ENDPOINTS["public_api_splatp"],
        params={"year": "2024"}
    ))
    
    # Test API statement endpoint (without auth)
    results.append(await test_endpoint(
        "API Statement", 
        DPS_ENDPOINTS["api_statement"],
        params={"tax_id": "00000000", "period": "2024"}
    ))
    
    # Test API settlement status (without auth)
    results.append(await test_endpoint(
        "API Settlement Status", 
        DPS_ENDPOINTS["api_settlement_status"],
        params={"tax_id": "00000000"}
    ))
    
    # Test API tax debt (without auth)
    results.append(await test_endpoint(
        "API Tax Debt", 
        DPS_ENDPOINTS["api_tax_debt"],
        params={"tax_id": "00000000"}
    ))
    
    # Summary
    print("\n" + "=" * 60)
    print("Підсумок:")
    print("=" * 60)
    
    successful = sum(1 for r in results if r["success"])
    total = len(results)
    
    print(f"✅ Успішно: {successful}/{total}")
    print(f"❌ Помилок: {total - successful}/{total}")
    
    for result in results:
        status_icon = "✅" if result["success"] else "❌"
        print(f"{status_icon} {result['name']}: {result['status']}")
    
    print("\n💡 Рекомендації:")
    if successful == total:
        print("   Всі ендпоінти доступні. Проблема може бути в авторизації.")
    elif successful > 0:
        print("   Деякі ендпоінти доступні. Перевірте логи для детальної інформації.")
    else:
        print("   Жоден ендпоінт не доступний. Можливо, проблема з мережею або ДПС недоступний.")

if __name__ == "__main__":
    asyncio.run(main())
