"""
Migration: Add Invoice Criteria columns for the 3-criteria pass/fail grading system.

Replaces the old single 1-10 invoice score with 3 independent criteria:
1. Situation - What was the job / what situation did the tech arrive to?
2. Work Done - What did the tech do / what state was the system left in?
3. Customer Discussion - What was discussed with the customer?

Adds columns to:
- tickets_raw: AI suggestion fields (ai_invoice_situation, etc.)
- debrief_sessions: Dispatcher grade fields (invoice_situation, etc.)
- spot_checks: Manager verification fields (invoice_situation_correct, etc.)

Usage:
    python migrations/add_invoice_criteria_columns.py
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
            # ---- tickets_raw: AI suggestion columns ----
            if 'tickets_raw' in tables:
                print("\n=== tickets_raw (AI suggestions) ===")
                add_column(conn, inspector, "tickets_raw", "ai_invoice_situation", "BOOLEAN", is_postgres)
                add_column(conn, inspector, "tickets_raw", "ai_invoice_work_done", "BOOLEAN", is_postgres)
                add_column(conn, inspector, "tickets_raw", "ai_invoice_customer_discussion", "BOOLEAN", is_postgres)
                add_column(conn, inspector, "tickets_raw", "ai_invoice_situation_notes", "TEXT", is_postgres)
                add_column(conn, inspector, "tickets_raw", "ai_invoice_work_done_notes", "TEXT", is_postgres)
                add_column(conn, inspector, "tickets_raw", "ai_invoice_customer_discussion_notes", "TEXT", is_postgres)
            else:
                print("tickets_raw table not found, skipping")

            # ---- debrief_sessions: Dispatcher grade columns ----
            if 'debrief_sessions' in tables:
                print("\n=== debrief_sessions (dispatcher grades) ===")
                add_column(conn, inspector, "debrief_sessions", "invoice_situation", "VARCHAR(10)", is_postgres)
                add_column(conn, inspector, "debrief_sessions", "invoice_work_done", "VARCHAR(10)", is_postgres)
                add_column(conn, inspector, "debrief_sessions", "invoice_customer_discussion", "VARCHAR(10)", is_postgres)
            else:
                print("debrief_sessions table not found, skipping")

            # ---- spot_checks: Manager verification columns ----
            if 'spot_checks' in tables:
                print("\n=== spot_checks (manager verification) ===")
                add_column(conn, inspector, "spot_checks", "invoice_situation_correct", "BOOLEAN", is_postgres)
                add_column(conn, inspector, "spot_checks", "invoice_work_done_correct", "BOOLEAN", is_postgres)
                add_column(conn, inspector, "spot_checks", "invoice_customer_discussion_correct", "BOOLEAN", is_postgres)
                add_column(conn, inspector, "spot_checks", "corrected_invoice_situation", "VARCHAR(10)", is_postgres)
                add_column(conn, inspector, "spot_checks", "corrected_invoice_work_done", "VARCHAR(10)", is_postgres)
                add_column(conn, inspector, "spot_checks", "corrected_invoice_customer_discussion", "VARCHAR(10)", is_postgres)
            else:
                print("spot_checks table not found, skipping")

            print("\nMigration completed successfully!")

        except Exception as e:
            print(f"Error during migration: {e}")
            raise


if __name__ == "__main__":
    run_migration()
