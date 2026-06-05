# backend/services/legislation_sources.py

LEGISLATION_SOURCES = [
    {
        "name": "ДПС України",
        "url": "https://tax.gov.ua/legislation",
        "type": "rss",
        "rss_url": "https://tax.gov.ua/rss/legislation.xml"
    },
    {
        "name": "Верховна Рада України",
        "url": "https://zakon.rada.gov.ua/laws",
        "type": "api",
        "api_url": "https://zakon.rada.gov.ua/api/laws/search"
    },
    {
        "name": "Урядовий портал",
        "url": "https://www.kmu.gov.ua/npas",
        "type": "scraping",
        "scraping_selector": ".document-card"
    },
    {
        "name": "Міністерство фінансів",
        "url": "https://mof.gov.ua/uk/legislation",
        "type": "rss",
        "rss_url": "https://mof.gov.ua/uk/rss/legislation"
    }
]
