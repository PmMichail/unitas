import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from api.main import Profile, Subscription, Payment, User

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/unitas")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

try:
    print("Checking database for profile ID 33...")
    profile = db.query(Profile).filter(Profile.id == 33).first()
    if profile:
        print(f"Profile 33 found:")
        print(f"  Name: {profile.name}")
        print(f"  Type: {profile.type}")
        print(f"  Tax system: {profile.tax_system}")
        print(f"  User ID: {profile.user_id}")
        
        user = db.query(User).filter(User.id == profile.user_id).first()
        if user:
            print(f"  Owner User Email: {user.email}")
            print(f"  Owner User Telegram ID: {user.telegram_id}")
        else:
            print("  Owner User not found!")
    else:
        print("Profile 33 not found!")
        
    print("\nListing all subscriptions for profile 33:")
    subs = db.query(Subscription).filter(Subscription.profile_id == 33).all()
    for s in subs:
        print(f"  Subscription ID: {s.id}, Plan: {s.plan}, Status: {s.status}, Expires: {s.expires_at}")
        
    print("\nListing recent payments for profile 33:")
    payments = db.query(Payment).filter(Payment.profile_id == 33).order_by(Payment.id.desc()).limit(5).all()
    for p in payments:
        print(f"  Payment ID: {p.id}, Type: {p.payment_type}, Amount: {p.amount}, Status: {p.status}, Order ID: {p.liqpay_order_id}")
finally:
    db.close()
