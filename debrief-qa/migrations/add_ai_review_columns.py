"""
Migration: Add AI Invoice Review columns to TicketRaw table

Run this script to add the ai_invoice_score, ai_invoice_notes, and ai_reviewed_at
columns to an existing database.

Usage:
    python migrations/add_ai_review_columns.py
"""

import os
import sys
import sqlite3

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


def get_db_path():
    """Get the database path from environment or default."""
    db_url = os.getenv("DATABASE_URL", "sqlite:///./debrief.db")
    # Extract path from sqlite:///path format
    if db_url.startswith("sqlite:///"):
        return db_url.replace("sqlite:///", "")
    return "debrief.db"


def column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


def run_migration():
    db_path = get_db_path()
    print(f"Database path: {db_path}")

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}. Migration not needed - columns will be created automatically.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check and add ai_invoice_score column
        if not column_exists(cursor, "ticket_raw", "ai_invoice_score"):
            print("Adding ai_invoice_score column...")
            cursor.execute("ALTER TABLE ticket_raw ADD COLUMN ai_invoice_score INTEGER")
            print("  Done")
        else:
            print("ai_invoice_score column already exists")

        # Check and add ai_invoice_notes column
        if not column_exists(cursor, "ticket_raw", "ai_invoice_notes"):
            print("Adding ai_invoice_notes column...")
            cursor.execute("ALTER TABLE ticket_raw ADD COLUMN ai_invoice_notes TEXT")
            print("  Done")
        else:
            print("ai_invoice_notes column already exists")

        # Check and add ai_reviewed_at column
        if not column_exists(cursor, "ticket_raw", "ai_reviewed_at"):
            print("Adding ai_reviewed_at column...")
            cursor.execute("ALTER TABLE ticket_raw ADD COLUMN ai_reviewed_at DATETIME")
            print("  Done")
        else:
            print("ai_reviewed_at column already exists")

        conn.commit()
        print("\nMigration completed successfully!")

    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
