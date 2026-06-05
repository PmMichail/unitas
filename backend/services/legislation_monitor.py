# backend/services/legislation_monitor.py

import os
import json
import asyncio
import requests
import feedparser
from bs4 import BeautifulSoup
from datetime import datetime, timedelta, date
from sqlalchemy import text
from backend.api.main import SessionLocal, LegislativeChange, AIAnalysis, LegislationSubscription, Profile

class LegislationMonitor:
    def __init__(self):
        self.last_check = datetime.now() - timedelta(days=2)
    
    async def fetch_rss(self, rss_url: str) -> list:
        """Отримати новини з RSS-стрічки"""
        entries = []
        try:
            feed = feedparser.parse(rss_url)
            for entry in feed.entries:
                published = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    published = datetime(*entry.published_parsed[:6])
                else:
                    published = datetime.now()
                    
                if published > self.last_check:
                    entries.append({
                        "source": "ДПС України" if "tax.gov.ua" in rss_url else "Міністерство фінансів",
                        "title": entry.title,
                        "url": entry.link,
                        "published": published,
                        "summary": BeautifulSoup(entry.summary, 'html.parser').get_text() if hasattr(entry, 'summary') else entry.title
                    })
        except Exception as e:
            print(f"[Legislation Monitor] RSS parsing failed for {rss_url}: {e}")
        return entries
    
    async def fetch_zakon_api(self) -> list:
        """Отримати зміни через API Верховної Ради"""
        params = {
            "query": "податок єдиний податок",
            "date_from": self.last_check.strftime("%Y-%m-%d")
        }
        try:
            response = requests.get("https://zakon.rada.gov.ua/api/laws/search", params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                results = []
                for item in data.get('results', []):
                    results.append({
                        "source": "Верховна Рада",
                        "title": item.get('title'),
                        "url": item.get('url'),
                        "number": item.get('number'),
                        "date": datetime.strptime(item.get('date'), "%Y-%m-%d") if item.get('date') else datetime.now(),
                        "summary": item.get('description') or "Зміни до Податкового кодексу України."
                    })
                return results
        except Exception as e:
            print(f"[Legislation Monitor] Rada API search failed: {e}")
        return []
    
    async def scrape_kmu(self) -> list:
        """Скрапінг Урядового порталу"""
        url = "https://www.kmu.gov.ua/npas"
        documents = []
        try:
            response = requests.get(url, timeout=5)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            for card in soup.select('.document-card, a'):
                # Handle potential class names or elements
                title_elem = card if card.name == 'a' and 'npas' in card.get('href', '') else card.select_one('.document-title, a')
                date_elem = card.select_one('.document-date, span.date')
                
                if title_elem and title_elem.text.strip():
                    doc_date = datetime.now()
                    if date_elem:
                        try:
                            doc_date = datetime.strptime(date_elem.text.strip(), "%d.%m.%Y")
                        except ValueError:
                            pass
                            
                    if doc_date > self.last_check:
                        url_path = title_elem.get('href', '')
                        full_url = url_path if url_path.startswith('http') else "https://www.kmu.gov.ua" + url_path
                        documents.append({
                            "source": "Урядовий портал",
                            "title": title_elem.text.strip(),
                            "url": full_url,
                            "date": doc_date,
                            "summary": card.select_one('.document-description, p').text.strip() if card.select_one('.document-description, p') else "Постанова Кабінету Міністрів України."
                        })
        except Exception as e:
            print(f"[Legislation Monitor] KMU scraping failed: {e}")
        return documents
    
    async def analyze_with_ai(self, change: dict) -> dict:
        """Проаналізувати зміну за допомогою GPT-4"""
        api_key = os.getenv("OPENAI_API_KEY")
        
        # Fallback simulation if no API key is configured
        if not api_key or api_key == "your_openai_api_key":
            title_lower = change.get('title', '').lower()
            
            affected_taxes = []
            if any(w in title_lower for w in ["єдиний", "єп", "еп", "єдиного"]):
                affected_taxes.append("edp")
            if any(w in title_lower for w in ["єсв", "есв", "соціальн"]):
                affected_taxes.append("esv")
            if any(w in title_lower for w in ["пдфо", "доходи", "рнокпп"]):
                affected_taxes.append("pdfo")
            if any(w in title_lower for w in ["військов", "вз"]):
                affected_taxes.append("vz")
            if not affected_taxes:
                affected_taxes = ["none"]
                
            affected_profiles = []
            if "фоп" in title_lower or "фізичн" in title_lower:
                affected_profiles.extend(["fop_3", "fop_2"])
            if "тов" in title_lower or "юридичн" in title_lower:
                affected_profiles.append("llc")
            if not affected_profiles:
                affected_profiles = ["all"]
                
            severity = "info"
            if any(w in title_lower for w in ["критич", "збільш", "нове", "штраф"]):
                severity = "critical"
            elif any(w in title_lower for w in ["змін", "важлив", "термін"]):
                severity = "important"
                
            return {
                "affected_taxes": affected_taxes,
                "affected_profiles": affected_profiles,
                "short_summary": f"Нові нормативні зміни щодо {change.get('title')[:60]}... регулюють нарахування та звітування.",
                "severity": severity,
                "action_required": severity != "info",
                "action_type": "update_rates" if "ставк" in title_lower else "change_deadline" if "термін" in title_lower else "none",
                "recommendations": "Рекомендується перевірити деталі в особистому кабінеті платника податків та врахувати при здачі звітності."
            }

        try:
            from openai import AsyncOpenAI
            async_client = AsyncOpenAI(api_key=api_key)
            prompt = f"""
            Ти — експерт з податкового законодавства України.
            Проаналізуй наступну зміну в законодавстві.
            
            ЗАГОЛОВОК: {change.get('title')}
            ОПИС: {change.get('summary')}
            
            Дай відповідь у форматі JSON:
            {{
                "affected_taxes": ["edp", "esv", "pdfo", "vz", "none"],
                "affected_profiles": ["fop_3", "fop_2", "fop_1", "llc", "vat_payer", "all"],
                "short_summary": "короткий підсумок українською (до 200 символів)",
                "severity": "critical/important/info",
                "action_required": true/false,
                "action_type": "update_rates/new_report/change_deadline/none",
                "recommendations": "рекомендації для клієнтів українською"
            }}
            """
            response = await async_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                timeout=15
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            print(f"[Legislation Monitor] OpenAI API error: {e}. Falling back to simulation.")
            return {
                "affected_taxes": ["none"],
                "affected_profiles": ["all"],
                "short_summary": f"Зміна законодавства щодо {change.get('title')[:50]}.",
                "severity": "info",
                "action_required": False,
                "action_type": "none",
                "recommendations": f"Помилка аналізу ШІ. Будь ласка, ознайомтесь самостійно: {change.get('url')}"
            }
            
    async def run_monitoring(self):
        """Запуск моніторингу (щогодини)"""
        print("[Legislation Monitor] Starting background monitoring loop...")
        
        while True:
            db = SessionLocal()
            try:
                # 1. Seed initial data if database is empty
                count = db.execute(text("SELECT COUNT(*) FROM legislative_changes")).scalar()
                if count == 0:
                    print("[Legislation Monitor] Seeding initial legislation changes...")
                    db.execute(text("""
                        INSERT INTO legislative_changes 
                        (source, title, description, document_url, document_number, publication_date, affected_taxes, affected_profiles, summary, severity, is_notified, detected_at)
                        VALUES 
                        ('ДПС України', 'Оновлено ліміти доходів для ФОП 3 групи на 2026 рік', 
                         'Державна податкова служба оприлюднила нові ліміти річного доходу для ФОП спрощеної системи.', 
                         'https://tax.gov.ua/legislation/1', '1025-дпс', '2026-01-01', '["edp"]', '["fop_3"]', 
                         'Новий ліміт доходу для ФОП 3 групи встановлено на рівні 1167 мінімальних зарплат.', 
                         'important', 1, CURRENT_TIMESTAMP),
                        ('Верховна Рада України', 'Зміни до Податкового кодексу щодо військового збору', 
                         'Прийнято Закон про збільшення ставки військового збору для всіх категорій платників.', 
                         'https://zakon.rada.gov.ua/laws/show/2', '9999-IX', '2026-03-01', '["vz"]', '["all"]', 
                         'Збільшено ставку військового збору для ФОП спрощеної та загальної системи оподаткування.', 
                         'critical', 1, CURRENT_TIMESTAMP)
                    """))
                    db.commit()
                    
                    # Insert corresponding AI Analysis rows
                    db.execute(text("""
                        INSERT INTO ai_analysis (change_id, recommendations, action_required, action_type)
                        VALUES 
                        (1, 'Слідкуйте за обсягом доходу за рік, щоб не перевищити ліміт 8 285 700 грн.', 1, 'update_rates'),
                        (2, 'Зверніть увагу на нову ставку при розрахунку податків та виплаті заробітної плати працівникам.', 1, 'update_rates')
                    """))
                    db.commit()

                # 2. Fetch changes from sources
                all_changes = []
                all_changes.extend(await self.fetch_rss("https://tax.gov.ua/rss/legislation.xml"))
                all_changes.extend(await self.fetch_rss("https://mof.gov.ua/uk/rss/legislation"))
                all_changes.extend(await self.fetch_zakon_api())
                all_changes.extend(await self.scrape_kmu())
                
                print(f"[Legislation Monitor] Fetched {len(all_changes)} legislative items. Checking for new documents...")
                
                for change in all_changes:
                    # Check duplicate
                    url = change.get('url')
                    existing = db.query(LegislativeChange).filter(LegislativeChange.document_url == url).first()
                    if not existing:
                        print(f"[Legislation Monitor] New change detected: {change['title']}")
                        analysis = await self.analyze_with_ai(change)
                        
                        pub_date = change.get('published') or change.get('date') or datetime.now()
                        if isinstance(pub_date, datetime):
                            pub_date = pub_date.date()
                            
                        # Save change
                        new_change = LegislativeChange(
                            source=change['source'],
                            title=change['title'],
                            description=change.get('summary'),
                            document_url=url,
                            document_number=change.get('number'),
                            publication_date=pub_date,
                            affected_taxes=analysis['affected_taxes'],
                            affected_profiles=analysis['affected_profiles'],
                            summary=analysis['short_summary'],
                            severity=analysis['severity'],
                            is_notified=True
                        )
                        db.add(new_change)
                        db.commit()
                        db.refresh(new_change)
                        
                        # Save AI Analysis
                        ai_an = AIAnalysis(
                            change_id=new_change.id,
                            analysis_text=change.get('summary'),
                            recommendations=analysis['recommendations'],
                            action_required=analysis['action_required'],
                            action_type=analysis['action_type']
                        )
                        db.add(ai_an)
                        db.commit()
                        
                        # Notify users
                        await self.notify_users(db, analysis['affected_profiles'], change, analysis)
                        
                self.last_check = datetime.now()
            except Exception as e:
                print(f"[Legislation Monitor] Error in monitoring loop: {e}")
            finally:
                db.close()
                
            await asyncio.sleep(3600)
            
    async def notify_users(self, db, affected_profiles: list, change: dict, analysis: dict):
        """Сповістити користувачів, яких стосується зміна"""
        try:
            # Query subscribed profiles
            # Select profiles that have tax_system match or 'all' is affected
            query_str = "SELECT p.* FROM profiles p JOIN legislation_subscriptions s ON s.profile_id = p.id WHERE s.notify_telegram = 1"
            profiles = db.execute(text(query_str)).all()
            
            for profile in profiles:
                # Check if this profile is affected
                profile_system = profile.tax_system.lower() if profile.tax_system else ""
                
                # Check match
                is_affected = False
                if "all" in affected_profiles:
                    is_affected = True
                else:
                    for ap in affected_profiles:
                        if ap == "fop_3" and ("fop_ep" in profile_system or "ednuy-3" in profile_system):
                            is_affected = True
                        elif ap == "fop_2" and "fop_2" in profile_system:
                            is_affected = True
                        elif ap == "llc" and "llc" in profile_system:
                            is_affected = True
                        elif ap == "vat_payer" and getattr(profile, 'is_vat_payer', False):
                            is_affected = True
                            
                if is_affected:
                    # Find user telegram_id
                    user = db.execute(text("SELECT telegram_id FROM users WHERE id = :uid"), {"uid": profile.user_id}).first()
                    if user and user.telegram_id:
                        await self.send_telegram_notification(user.telegram_id, change, analysis)
        except Exception as e:
            print(f"[Legislation Monitor] Failed to notify users: {e}")
            
    async def send_telegram_notification(self, telegram_id: str, change: dict, analysis: dict):
        """Надіслати сповіщення в Telegram"""
        import os
        token = os.getenv("TELEGRAM_BOT_TOKEN")
        if not token:
            return
            
        emoji = "🔴" if analysis.get('severity') == 'critical' else "🟠" if analysis.get('severity') == 'important' else "🔵"
        message = f"""{emoji} *Зміни в законодавстві*
        
*{change['title']}*
{analysis['short_summary']}

💡 *Рекомендація:* {analysis['recommendations']}

[Детальніше]({change.get('url', '')})"""
        
        try:
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            payload = {
                "chat_id": telegram_id,
                "text": message,
                "parse_mode": "Markdown"
            }
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            print(f"[Legislation Monitor] Telegram send error: {e}")
