import os
import sys
import subprocess

# Auto-install reportlab if missing
try:
    import reportlab
except ImportError:
    print("reportlab не знайдено. Встановлення...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_monobank_csv(filepath):
    content = """Дата і час;Опис;Сума (грн);Комісія (грн);Валюта;Баланс (грн)
15.03.2025 14:30;Зарахування від ТОВ "АйТі Сервіс" за розробку ПЗ;45000.00;0.00;UAH;45000.00
18.03.2025 09:15;Сплата Єдиного податку за 1 квартал 2025 р. ФОП Петренко;-4200.00;0.00;UAH;40800.00
18.03.2025 09:20;Сплата ЄСВ за 1 квартал 2025 р. ФОП Петренко;-5280.00;0.00;UAH;35520.00
22.03.2025 17:45;Зарахування від ФОП Іванов О.П. за консалтинг;12000.00;0.00;UAH;47520.00
"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Згенеровано: {filepath}")

def generate_oschad_html(filepath):
    content = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Виписка по рахунку - Ощадбанк</title>
    <style>
        body { font-family: Arial, sans-serif; background: #fafafa; color: #333; margin: 20px; }
        h2 { color: #1e3a8a; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f3f4f6; }
        .credit { color: green; font-weight: bold; }
        .debit { color: red; }
    </style>
</head>
<body>
    <h2>АТ "Ощадбанк" - Виписка по рахунку 2600123456789</h2>
    <p>Період: з 01.03.2025 по 31.03.2025</p>
    <p>Клієнт: ФОП Петренко Іван Васильович</p>
    <table>
        <thead>
            <tr>
                <th>Дата операції</th>
                <th>Призначення платежу</th>
                <th>Дебет (Витрати)</th>
                <th>Кредит (Надходження)</th>
                <th>Контрагент</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>10.03.2025</td>
                <td>Оплата послуг хостингу згідно рах. 102</td>
                <td class="debit">-450.00</td>
                <td>0.00</td>
                <td>ТОВ ХОСТІНГ-УКРАЇНА</td>
            </tr>
            <tr>
                <td>20.03.2025</td>
                <td>Оплата за послуги дизайну згідно договору №12</td>
                <td>0.00</td>
                <td class="credit">25000.00</td>
                <td>ТОВ Креатив Дизайн</td>
            </tr>
            <tr>
                <td>25.03.2025</td>
                <td>Сплата єдиного податку за 1 кв 2025 року</td>
                <td class="debit">-1250.00</td>
                <td>0.00</td>
                <td>ДПС України</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Згенеровано: {filepath}")

def generate_privat_pdf(filepath):
    doc = SimpleDocTemplate(filepath, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#1b5e20'),
        spaceAfter=12
    )
    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        spaceAfter=6
    )
    
    story = []
    story.append(Paragraph("AT KB 'PRIVATBANK'", title_style))
    story.append(Paragraph("Ofitsiina vypyska za rakhunkom 2600876543210 (FOP Petrenko)", normal_style))
    story.append(Paragraph("Period: 01.03.2025 - 31.03.2025", normal_style))
    story.append(Spacer(1, 10))
    
    data = [
        ["Data", "Pryznachennia platezhu", "Suma (UAH)", "Balans (UAH)"],
        ["05.03.2025", "Nadkhodzhennia za posluhy prohramuvannia zhidno dohovoru N45", "35000.00", "35000.00"],
        ["19.03.2025", "Splata edynogo sotsialnoho vnesku (ESV) za 1 kv. 2025 r.", "-5280.00", "29720.00"],
        ["20.03.2025", "Splata edynogo podatku FOP 3 hrupa 5% za 1 kv. 2025", "-1750.00", "27970.00"]
    ]
    
    table = Table(data, colWidths=[80, 260, 90, 90])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e8f5e9')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1b5e20')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#c8e6c9')),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
    ]))
    
    story.append(table)
    doc.build(story)
    print(f"Згенеровано: {filepath}")

def generate_abank_pdf(filepath):
    doc = SimpleDocTemplate(filepath, pagesize=letter)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#3f51b5'),
        spaceAfter=12
    )
    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        spaceAfter=6
    )
    
    story = []
    story.append(Paragraph("AT 'A-BANK'", title_style))
    story.append(Paragraph("Vypyska po karttsi/rakhunku 26009988776655", normal_style))
    story.append(Paragraph("Period: 01.03.2025 - 31.03.2025", normal_style))
    story.append(Spacer(1, 10))
    
    data = [
        ["Data", "Opys operatsii", "Suma (grn)", "Balans (grn)"],
        ["12.03.2025", "Oplata za rozrobku mobilnoho dodatku", "15000.00", "15000.00"],
        ["14.03.2025", "Posluhy zviazku Kyivstar", "-150.00", "14850.00"],
        ["28.03.2025", "Zarakhuvannia koshtiv (roialti) vid TOV Books", "8500.00", "23350.00"]
    ]
    
    table = Table(data, colWidths=[80, 260, 90, 90])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e8eaf6')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#3f51b5')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#c5cae9')),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
    ]))
    
    story.append(table)
    doc.build(story)
    print(f"Згенеровано: {filepath}")

def generate_pumb_csv(filepath):
    content = """Дата;Операція;Сума;Валюта;Контрагент;Призначення
05.03.2025;Надходження;25000.00;UAH;ТОВ ТехноСервіс;Оплата за послуги згідно договору №45
12.03.2025;Списання;-850.00;UAH;Київстар;Оплата послуг мобільного зв'язку
18.03.2025;Надходження;15000.00;UAH;ФОП Коваленко О.М.;Консалтингові послуги
25.03.2025;Списання;-3200.00;UAH;ДПС України;Сплата єдиного податку за 1 квартал 2025
"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Згенеровано: {filepath}")

def generate_raiffeisen_pdf(filepath):
    doc = SimpleDocTemplate(filepath, pagesize=letter)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#ff6f00'),
        spaceAfter=12
    )
    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        spaceAfter=6
    )
    
    story = []
    story.append(Paragraph("Raiffeisen Bank Aval", title_style))
    story.append(Paragraph("Виписка по рахунку 2600555444333221", normal_style))
    story.append(Paragraph("Період: 01.03.2025 - 31.03.2025", normal_style))
    story.append(Paragraph("Клієнт: ФОП Петренко І.В. (РНОКПП: 1234567890)", normal_style))
    story.append(Spacer(1, 10))
    
    data = [
        ["Дата", "Опис операції", "Сума (грн)", "Баланс (грн)"],
        ["08.03.2025", "Зарахування від ТОВ ІнфоТех за розробку ПЗ", "38000.00", "38000.00"],
        ["15.03.2025", "Оплата комунальних послуг", "-1200.00", "36800.00"],
        ["22.03.2025", "Надходження від ФОП Сидоренко за консалтинг", "9500.00", "46300.00"],
        ["28.03.2025", "Сплата ЄСВ за 1 квартал 2025", "-5280.00", "41020.00"]
    ]
    
    table = Table(data, colWidths=[80, 260, 90, 90])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#fff3e0')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#ff6f00')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#ffe0b2')),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
    ]))
    
    story.append(table)
    doc.build(story)
    print(f"Згенеровано: {filepath}")

def generate_sense_pdf(filepath):
    doc = SimpleDocTemplate(filepath, pagesize=letter)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#0097a7'),
        spaceAfter=12
    )
    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        spaceAfter=6
    )
    
    story = []
    story.append(Paragraph("Sense Bank (Альфа-Банк)", title_style))
    story.append(Paragraph("Виписка по картці 537541XXXXXX1234", normal_style))
    story.append(Paragraph("Період: 01.03.2025 - 31.03.2025", normal_style))
    story.append(Paragraph("Клієнт: ФОП Петренко Іван Васильович", normal_style))
    story.append(Spacer(1, 10))
    
    data = [
        ["Дата", "Операція", "Сума (грн)", "Баланс (грн)"],
        ["10.03.2025", "Оплата за хостинг-послуги", "-650.00", "27350.00"],
        ["16.03.2025", "Зарахування від ТОВ Діджитал Солюшнс", "42000.00", "69350.00"],
        ["23.03.2025", "Оплата за ліцензії ПЗ", "-2800.00", "66550.00"],
        ["30.03.2025", "Зарахування від ФОП Мельник за дизайн", "18000.00", "84550.00"]
    ]
    
    table = Table(data, colWidths=[80, 260, 90, 90])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e0f7fa')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#0097a7')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#b2ebf2')),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
    ]))
    
    story.append(table)
    doc.build(story)
    print(f"Згенеровано: {filepath}")

def main():
    samples_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(samples_dir, exist_ok=True)
    
    generate_monobank_csv(os.path.join(samples_dir, "monobank.csv"))
    generate_oschad_html(os.path.join(samples_dir, "oschad.html"))
    generate_privat_pdf(os.path.join(samples_dir, "pryvat24.pdf"))
    generate_abank_pdf(os.path.join(samples_dir, "abank.pdf"))
    generate_pumb_csv(os.path.join(samples_dir, "pumb.csv"))
    generate_raiffeisen_pdf(os.path.join(samples_dir, "raiffeisen.pdf"))
    generate_sense_pdf(os.path.join(samples_dir, "sense.pdf"))
    print("\nВсі тестові файли успішно створені!")

if __name__ == "__main__":
    main()
