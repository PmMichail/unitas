import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://unitas_backend:6VMY9QUVKZWJgRL@213.188.223.177:5432/unitas_backend?sslmode=disable"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Running database migrations...")
    
    # 1. Add card details to consulting_companies
    card_cols = [
        ("card_last_four", "VARCHAR"),
        ("card_type", "VARCHAR"),
        ("card_masked", "VARCHAR"),
        ("card_token", "VARCHAR")
    ]
    for col_name, col_type in card_cols:
        try:
            # Check if column exists by attempting to ALTER TABLE
            conn.execute(text(f"ALTER TABLE consulting_companies ADD COLUMN {col_name} {col_type}"))
            conn.commit()
            print(f"Added column {col_name} to consulting_companies")
        except Exception as e:
            print(f"Column {col_name} in consulting_companies already exists or failed: {e}")
            
    # 2. Add is_suspended to consulting_client_assignments
    try:
        conn.execute(text("ALTER TABLE consulting_client_assignments ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE"))
        conn.commit()
        print("Added column is_suspended to consulting_client_assignments")
    except Exception as e:
        print(f"Column is_suspended in consulting_client_assignments already exists or failed: {e}")

print("Migration completed.")
