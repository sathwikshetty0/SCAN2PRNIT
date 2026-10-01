"""
updater.py — Status updates for print jobs in Supabase.

Requirements: 10.3, 11.4, 11.5
"""
from datetime import datetime, timezone
from typing import Optional
from supabase import Client


def mark_printing(supabase: Client, job_id: str) -> None:
    """Mark a job as PRINTING."""
    supabase.table("print_jobs").update({
        "job_status": "PRINTING"
    }).eq("id", job_id).execute()


def mark_printed(supabase: Client, job_id: str) -> None:
    """Mark a job as PRINTED and record printed_at timestamp."""
    supabase.table("print_jobs").update({
        "job_status": "PRINTED",
        "printed_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", job_id).execute()


def mark_failed(supabase: Client, job_id: str, error_message: Optional[str] = None) -> None:
    """Mark a job as FAILED and record error_message."""
    supabase.table("print_jobs").update({
        "job_status": "FAILED",
        "error_message": error_message or "Unknown error"
    }).eq("id", job_id).execute()
