"""
Unit tests for downloader.py.

Requirements: 12.4
"""
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from downloader import download_file, DownloadError


@patch("downloader.time.sleep")
def test_downloader_retries_and_succeeds(mock_sleep, tmp_path):
    mock_supabase = MagicMock()
    # Mock download method: fail twice, then succeed
    mock_supabase.storage.from_().download.side_effect = [
        Exception("Transient network error 1"),
        Exception("Transient network error 2"),
        b"%PDF-1.4 mock content"
    ]

    dest_file = download_file(mock_supabase, "jobs/123/doc.pdf", tmp_path)
    assert dest_file.exists()
    assert dest_file.read_bytes() == b"%PDF-1.4 mock content"
    assert mock_sleep.call_count == 2
    mock_sleep.assert_any_call(5)
    mock_sleep.assert_any_call(10)


@patch("downloader.time.sleep")
def test_downloader_exhausts_retries_raises_download_error(mock_sleep, tmp_path):
    mock_supabase = MagicMock()
    mock_supabase.storage.from_().download.side_effect = Exception("Persistent error")

    with pytest.raises(DownloadError):
        download_file(mock_supabase, "jobs/123/doc.pdf", tmp_path)

    # Sleeps after 1st and 2nd failed attempt; raises on 3rd attempt
    assert mock_sleep.call_count == 2
