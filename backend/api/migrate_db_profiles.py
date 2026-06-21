import sqlalchemy
from sqlalchemy import create_engine, text

def migrate():
    DATABASE_URL = "postgresql://unitas_backend:6VMY9QUVKZWJgRL@213.188.223.177:5432/unitas_backend?sslmode=disable"
    engine = create_engine(DATABASE_URL)
    
    with engine.begin() as conn:
        # 1. Find all child profiles (profiles with a parent_profile_id)
        child_profiles = conn.execute(
            text("SELECT id, parent_profile_id, name, slug FROM profiles WHERE parent_profile_id IS NOT NULL")
        ).all()
        
        print(f"Found {len(child_profiles)} child profiles to migrate.")
        
        for cp in child_profiles:
            child_id = cp.id
            parent_id = cp.parent_profile_id
            name = cp.name
            slug = cp.slug
            
            print(f"Migrating child profile {child_id} ('{name}', slug: '{slug}') to parent {parent_id}...")
            
            # Update parent profile module status to true
            conn.execute(
                text("""
                    UPDATE profiles 
                    SET is_member_module_active = TRUE, 
                        has_resident_cabinet = TRUE, 
                        slug = COALESCE(slug, :slug) 
                    WHERE id = :parent_id
                """),
                {"parent_id": parent_id, "slug": slug}
            )
            
            # 2. Find all tables that contain 'profile_id'
            tables_query = conn.execute(
                text("""
                    SELECT table_name 
                    FROM information_schema.columns 
                    WHERE column_name = 'profile_id' 
                      AND table_schema = 'public'
                """)
            ).all()
            
            unique_tables = ['subscriptions', 'tax_api_settings', 'push_subscriptions', 'dps_settlements']
            
            for t_row in tables_query:
                table_name = t_row.table_name
                if table_name == 'profiles':
                    continue
                
                # Check how many rows match child_id in this table
                count = conn.execute(
                    text(f'SELECT count(*) FROM "{table_name}" WHERE profile_id = :child_id'),
                    {"child_id": child_id}
                ).scalar()
                
                if count > 0:
                    if table_name in unique_tables:
                        # Handle unique constraint tables: check if parent already has a record
                        parent_count = conn.execute(
                            text(f'SELECT count(*) FROM "{table_name}" WHERE profile_id = :parent_id'),
                            {"parent_id": parent_id}
                        ).scalar()
                        
                        if parent_count > 0:
                            print(f"  Parent already has a record in unique table '{table_name}'.")
                            if table_name == 'subscriptions':
                                # Merge subscriptions: make sure parent has active module
                                conn.execute(
                                    text('UPDATE subscriptions SET is_member_module_active = TRUE WHERE profile_id = :parent_id'),
                                    {"parent_id": parent_id}
                                )
                            # Delete the child record since parent already has one
                            conn.execute(
                                text(f'DELETE FROM "{table_name}" WHERE profile_id = :child_id'),
                                {"child_id": child_id}
                            )
                            print(f"  Deleted child record in unique table '{table_name}'.")
                        else:
                            # Parent does not have a record, safe to update
                            conn.execute(
                                text(f'UPDATE "{table_name}" SET profile_id = :parent_id WHERE profile_id = :child_id'),
                                {"parent_id": parent_id, "child_id": child_id}
                            )
                            print(f"  Moved 1 record in unique table '{table_name}' to parent.")
                    else:
                        # Non-unique table, safe to update directly
                        print(f"  Moving {count} records in table '{table_name}' from profile {child_id} to {parent_id}...")
                        conn.execute(
                            text(f'UPDATE "{table_name}" SET profile_id = :parent_id WHERE profile_id = :child_id'),
                            {"parent_id": parent_id, "child_id": child_id}
                        )
            
            # 3. Delete the child profile
            print(f"  Deleting child profile {child_id}...")
            conn.execute(
                text("DELETE FROM profiles WHERE id = :child_id"),
                {"child_id": child_id}
            )
            
        print("Migration complete!")

if __name__ == "__main__":
    migrate()
