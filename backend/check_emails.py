import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from api.main import EmailLog, EmailAuth, User

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/unitas")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

try:
    print("Checking SMTP configuration environment variables:")
    print(f"  SMTP_SERVER: {os.getenv('SMTP_SERVER')}")
    print(f"  SMTP_PORT: {os.getenv('SMTP_PORT')}")
    print(f"  SMTP_USER: {os.getenv('SMTP_USER')}")
    print(f"  SMTP_PASSWORD_SET: {'Yes' if os.getenv('SMTP_PASSWORD') else 'No'}")
    
    print("\nChecking EmailAuth system-wide fallback:")
    auth = db.query(EmailAuth).filter(EmailAuth.profile_id == None).first()
    if auth:
        print(f"  System Email Auth email: {auth.email}")
        print(f"  Has access token: {'Yes' if auth.access_token else 'No'}")
        print(f"  Expires at: {auth.expires_at}")
    else:
        print("  No system-wide EmailAuth fallback configured!")
        
    print("\nLast 5 email log entries:")
    logs = db.query(EmailLog).order_by(EmailLog.id.desc()).limit(5).all()
    for l in logs:
        print(f"  ID: {l.id}, Recipient: {l.recipient}, Subject: {l.subject}, Status: {l.status}")
        print(f"    Error: {l.error_message}")
        print("-" * 40)
finally:
    db.close()
