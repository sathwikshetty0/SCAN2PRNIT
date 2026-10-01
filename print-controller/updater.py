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


def record_print_progress(
    supabase: Client, job_id: str, cumulative_sheets: int
) -> tuple[int, int | None, bool]:
    """Atomically save progress, decrement inventory, and report threshold crossings."""
    result = supabase.rpc(
        "record_print_progress",
        {"p_job_id": job_id, "p_cumulative_sheets": cumulative_sheets},
    ).execute()
    if not result.data:
        raise RuntimeError("Print progress update returned no result")

    progress = result.data[0]
    return (
        progress["estimated_sheets_printed"],
        progress["remaining_sheets"],
        progress["low_alert"],
    )


def mark_failed(supabase: Client, job_id: str, error_message: Optional[str] = None) -> None:
    """Mark a job as FAILED and record error_message."""
    supabase.table("print_jobs").update({
        "job_status": "FAILED",
        "error_message": error_message or "Unknown error"
    }).eq("id", job_id).execute()
