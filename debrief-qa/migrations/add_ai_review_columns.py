"""
Migration: Add AI Invoice Review columns to TicketRaw table

Run this script to add the ai_invoice_score, ai_invoice_notes, and ai_reviewed_at
columns to an existing database.

Supports both SQLite and PostgreSQL databases.

Usage:
    python migrations/add_ai_review_columns.py
"""

import os
import sys

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text, inspect


def get_db_url():
    """Get the database URL from environment."""
    return os.getenv("DATABASE_URL", "sqlite:///./debrief.db")


def column_exists(inspector, table_name, column_name):
    """Check if a column exists in a table."""
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def run_migration():
    db_url = get_db_url()
    is_postgres = db_url.startswith("postgresql")
    print(f"Database URL: {db_url[:50]}...")
    print(f"Database type: {'PostgreSQL' if is_postgres else 'SQLite'}")

    engine = create_engine(db_url)
    inspector = inspect(engine)

    # Check if table exists
    if 'tickets_raw' not in inspector.get_table_names():
        print("Table 'tickets_raw' does not exist. Migration not needed - columns will be created automatically when the app starts.")
        return

    with engine.connect() as conn:
        try:
            # Check and add ai_invoice_score column
            if not column_exists(inspector, "tickets_raw", "ai_invoice_score"):
                print("Adding ai_invoice_score column...")
                conn.execute(text("ALTER TABLE tickets_raw ADD COLUMN ai_invoice_score INTEGER"))
                conn.commit()
                print("  Done")
            else:
                print("ai_invoice_score column already exists")

            # Check and add ai_invoice_notes column
            if not column_exists(inspector, "tickets_raw", "ai_invoice_notes"):
                print("Adding ai_invoice_notes column...")
                conn.execute(text("ALTER TABLE tickets_raw ADD COLUMN ai_invoice_notes TEXT"))
                conn.commit()
                print("  Done")
            else:
                print("ai_invoice_notes column already exists")

            # Check and add ai_reviewed_at column
            if not column_exists(inspector, "tickets_raw", "ai_reviewed_at"):
                print("Adding ai_reviewed_at column...")
                if is_postgres:
                    conn.execute(text("ALTER TABLE tickets_raw ADD COLUMN ai_reviewed_at TIMESTAMP"))
                else:
                    conn.execute(text("ALTER TABLE tickets_raw ADD COLUMN ai_reviewed_at DATETIME"))
                conn.commit()
                print("  Done")
            else:
                print("ai_reviewed_at column already exists")

            print("\nMigration completed successfully!")

        except Exception as e:
            print(f"Error during migration: {e}")
            raise


if __name__ == "__main__":
    run_migration()
