"""Vercel serverless entry point for the Debrief QA FastAPI app.

Imports and re-exports the FastAPI `app` object from `app.main`.
Vercel's @vercel/python runtime auto-detects the `app` symbol as the ASGI app.
"""
from app.main import app  # noqa: F401
