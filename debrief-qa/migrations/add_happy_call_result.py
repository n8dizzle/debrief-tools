"""
Migration: Add happy_call_result column to debrief_sessions.

Stores the specific outcome of a happy call:
- spoke_to_homeowner (maps to happy_call = pass)
- voicemail_left (maps to happy_call = na)
- no_answer (maps to happy_call = na)

Usage:
    python migrations/add_happy_call_result.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text, inspect


def get_db_url():
    return os.getenv("DATABASE_URL", "sqlite:///./debrief.db")


def column_exists(inspector, table_name, column_name):
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def add_column(conn, inspector, table_name, column_name, column_type, is_postgres):
    if column_exists(inspector, table_name, column_name):
        print(f"  {table_name}.{column_name} already exists, skipping")
        return
    print(f"  Adding {table_name}.{column_name} ({column_type})...")
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
    conn.commit()


def run_migration():
    db_url = get_db_url()
    is_postgres = db_url.startswith("postgresql")
    print(f"Database: {'PostgreSQL' if is_postgres else 'SQLite'}")

    engine = create_engine(db_url)
    inspector = inspect(engine)

    tables = inspector.get_table_names()

    with engine.connect() as conn:
        try:
            if 'debrief_sessions' in tables:
                print("\n=== debrief_sessions ===")
                add_column(conn, inspector, "debrief_sessions", "happy_call_result", "VARCHAR(30)", is_postgres)
            else:
                print("debrief_sessions table not found, skipping")

            print("\nMigration completed successfully!")

        except Exception as e:
            print(f"Error during migration: {e}")
            raise


if __name__ == "__main__":
    run_migration()
