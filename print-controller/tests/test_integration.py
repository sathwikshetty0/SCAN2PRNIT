"""
Integration test for print controller.

Requirements: 10.3, 10.4, 12.1
"""
from unittest.mock import MagicMock
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import recover_stale_jobs


def test_recover_stale_jobs_marks_printing_jobs_failed():
    mock_supabase = MagicMock()
    mock_res = MagicMock()
    mock_res.data = [{"id": "job-1"}, {"id": "job-2"}]

    update_builder = MagicMock()
    update_builder.eq.return_value = update_builder
    update_builder.execute.return_value = mock_res
    mock_supabase.table.return_value.update.return_value = update_builder

    recover_stale_jobs(mock_supabase)

    mock_supabase.table.assert_called_with("print_jobs")
    update_builder.eq.assert_called_with("job_status", "PRINTING")
