"""Unit tests for persisted printer progress and sheet inventory updates."""
from pathlib import Path
from unittest.mock import MagicMock
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from updater import record_print_progress


def test_record_print_progress_uses_atomic_progress_rpc():
    supabase = MagicMock()
    supabase.rpc.return_value.execute.return_value.data = [
        {
            "estimated_sheets_printed": 4,
            "remaining_sheets": 96,
            "low_alert": False,
        }
    ]

    result = record_print_progress(supabase, "job-1", 4)

    supabase.rpc.assert_called_once_with(
        "record_print_progress",
        {"p_job_id": "job-1", "p_cumulative_sheets": 4},
    )
    assert result == (4, 96, False)


def test_record_print_progress_returns_low_paper_threshold_crossing():
    supabase = MagicMock()
    supabase.rpc.return_value.execute.return_value.data = [
        {
            "estimated_sheets_printed": 5,
            "remaining_sheets": 15,
            "low_alert": True,
        }
    ]

    _, remaining, alert = record_print_progress(supabase, "job-1", 5)

    assert (remaining, alert) == (15, True)
