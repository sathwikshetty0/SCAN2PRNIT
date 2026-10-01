"""
Unit tests for poller.py.

Requirements: 10.4
"""
from unittest.mock import MagicMock
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from poller import claim_next_job


def test_claim_next_job_returns_none_when_no_rows():
    mock_supabase = MagicMock()
    # Mock select response with empty data
    select_builder = MagicMock()
    select_builder.eq.return_value = select_builder
    select_builder.order.return_value = select_builder
    select_builder.limit.return_value = select_builder
    select_builder.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value.select.return_value = select_builder

    job = claim_next_job(mock_supabase)
    assert job is None


def test_claim_next_job_returns_claimed_job_dict():
    mock_supabase = MagicMock()
    fake_job = {"id": "uuid-123", "file_path": "jobs/uuid-123/file.pdf", "job_status": "QUEUED"}

    # Mock select response
    select_builder = MagicMock()
    select_builder.eq.return_value = select_builder
    select_builder.order.return_value = select_builder
    select_builder.limit.return_value = select_builder
    select_builder.execute.return_value = MagicMock(data=[fake_job])
    mock_supabase.table.return_value.select.return_value = select_builder

    # Mock update response
    claimed_job = dict(fake_job, job_status="PRINTING")
    update_builder = MagicMock()
    update_builder.eq.return_value = update_builder
    update_builder.execute.return_value = MagicMock(data=[claimed_job])
    mock_supabase.table.return_value.update.return_value = update_builder

    job = claim_next_job(mock_supabase)
    assert job is not None
    assert job["id"] == "uuid-123"
    assert job["job_status"] == "PRINTING"
