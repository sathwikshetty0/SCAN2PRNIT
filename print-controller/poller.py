"""
poller.py — Atomic job claiming for the A4 Print Kiosk.

Requirements: 10.2, 10.3, 10.4, 10.5
"""
from typing import Optional, Dict, Any
from supabase import Client


def claim_next_job(supabase: Client) -> Optional[Dict[str, Any]]:
    """
    Atomically UPDATE job_status='PRINTING' WHERE payment_status='PAID'
    AND job_status='QUEUED' RETURNING *.

    Returns the claimed job dict, or None if no qualifying job exists.
    Raises network exceptions to caller (caller logs and skips cycle).
    """
    # Fetch candidate job
    res = (
        supabase.table("print_jobs")
        .select("*")
        .eq("payment_status", "PAID")
        .eq("job_status", "QUEUED")
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )

    if not res.data or len(res.data) == 0:
        return None

    candidate_id = res.data[0]["id"]

    # Atomically attempt to update status to PRINTING
    update_res = (
        supabase.table("print_jobs")
        .update({"job_status": "PRINTING"})
        .eq("id", candidate_id)
        .eq("job_status", "QUEUED")
        .eq("payment_status", "PAID")
        .execute()
    )

    if not update_res.data or len(update_res.data) == 0:
        # Race condition: another controller claimed it first
        return None

    return update_res.data[0]
