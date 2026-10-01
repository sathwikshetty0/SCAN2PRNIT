"""
Unit tests for printer.py — print_file function and PrintError.

Mocks subprocess.run to verify correct commands are built per OS and that
PrintError is raised on non-zero exit codes.
Requirements: 11.2
"""
import platform
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from printer import PrintError, print_file


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_completed_process(returncode: int, stderr: bytes = b''):
    mock = MagicMock()
    mock.returncode = returncode
    mock.stderr = stderr
    return mock


# ---------------------------------------------------------------------------
# Linux / macOS tests
# ---------------------------------------------------------------------------

@patch('printer.platform.system', return_value='Linux')
@patch('printer.subprocess.run')
def test_linux_command_is_correct(mock_run, _mock_platform):
    """On Linux, lp is called with the correct arguments."""
    mock_run.return_value = _make_completed_process(0)
    file_path = Path('/tmp/test.pdf')

    print_file(file_path, 'HP_LaserJet', copies=2)

    mock_run.assert_called_once()
    cmd = mock_run.call_args[0][0]
    assert cmd[0] == 'lp'
    assert '-d' in cmd
    assert 'HP_LaserJet' in cmd
    assert '-n' in cmd
    assert '2' in cmd
    assert str(file_path) in cmd


@patch('printer.platform.system', return_value='Darwin')
@patch('printer.subprocess.run')
def test_macos_command_is_correct(mock_run, _mock_platform):
    """On macOS, lp is called with the correct arguments (same as Linux)."""
    mock_run.return_value = _make_completed_process(0)
    file_path = Path('/tmp/test.pdf')

    print_file(file_path, 'Canon_Printer', copies=1)

    mock_run.assert_called_once()
    cmd = mock_run.call_args[0][0]
    assert cmd[0] == 'lp'
    assert '-d' in cmd
    assert 'Canon_Printer' in cmd


@patch('printer.platform.system', return_value='Windows')
@patch('printer.subprocess.run')
def test_windows_command_is_correct(mock_run, _mock_platform):
    """On Windows, SumatraPDF.exe is called with the correct arguments."""
    mock_run.return_value = _make_completed_process(0)
    file_path = Path('C:/tmp/test.pdf')

    print_file(file_path, 'Microsoft Print to PDF', copies=3)

    mock_run.assert_called_once()
    cmd = mock_run.call_args[0][0]
    assert Path(cmd[0]).name.lower() == 'sumatrapdf.exe'
    assert '-print-to' in cmd
    assert 'Microsoft Print to PDF' in cmd
    assert '-print-settings' in cmd
    assert '3x' in cmd
    assert str(file_path) in cmd


# ---------------------------------------------------------------------------
# Error handling tests
# ---------------------------------------------------------------------------

@patch('printer.platform.system', return_value='Linux')
@patch('printer.subprocess.run')
def test_print_error_raised_on_nonzero_exit(mock_run, _mock_platform):
    """PrintError must be raised when subprocess exits with non-zero code."""
    mock_run.return_value = _make_completed_process(1, stderr=b'lp: no printer found')

    with pytest.raises(PrintError):
        print_file(Path('/tmp/test.pdf'), 'Missing_Printer', copies=1)


@patch('printer.platform.system', return_value='Linux')
@patch('printer.subprocess.run', side_effect=FileNotFoundError('lp not found'))
def test_print_error_raised_on_subprocess_exception(mock_run, _mock_platform):
    """PrintError must be raised when subprocess.run itself raises an exception."""
    with pytest.raises(PrintError):
        print_file(Path('/tmp/test.pdf'), 'Any_Printer', copies=1)


@patch('printer.platform.system', return_value='Linux')
@patch('printer.subprocess.run')
def test_progress_callback_reports_expected_sheet_count_on_success(mock_run, _mock_platform):
    mock_run.return_value = _make_completed_process(0)
    progress = MagicMock()

    print_file(Path('/tmp/test.pdf'), 'HP_LaserJet', copies=2,
               expected_sheets=12, progress_callback=progress)

    progress.assert_called_once_with(12)


@patch('printer.platform.system', return_value='Linux')
@patch('printer.subprocess.run')
def test_progress_callback_does_not_report_completion_on_print_error(mock_run, _mock_platform):
    mock_run.return_value = _make_completed_process(1, stderr=b'paper jam')
    progress = MagicMock()

    with pytest.raises(PrintError):
        print_file(Path('/tmp/test.pdf'), 'HP_LaserJet', copies=1,
                   expected_sheets=6, progress_callback=progress)

    progress.assert_not_called()


@patch('printer.time.sleep')
@patch('printer._windows_printed_pages', side_effect=[0, None])
@patch('printer.subprocess.Popen')
@patch('printer.platform.system', return_value='Windows')
def test_windows_reports_completion_only_after_spooler_job_disappears(
    _mock_platform, mock_popen, _mock_pages, _mock_sleep
):
    process = MagicMock()
    process.communicate.return_value = (b'', b'')
    process.returncode = 0
    mock_popen.return_value = process
    progress = MagicMock()

    print_file(Path('C:/tmp/job-123.pdf'), 'HP_LaserJet', copies=1,
               expected_sheets=3, progress_callback=progress)

    progress.assert_called_once_with(3)


@patch('printer._windows_printed_pages', return_value=None)
@patch('printer.subprocess.Popen')
@patch('printer.platform.system', return_value='Windows')
def test_windows_does_not_mark_printed_without_spooler_confirmation(
    _mock_platform, mock_popen, _mock_pages, monkeypatch
):
    from printer import PrintError

    process = MagicMock()
    process.communicate.return_value = (b'', b'')
    process.returncode = 0
    mock_popen.return_value = process
    monkeypatch.setattr('printer.WINDOWS_JOB_DISCOVERY_SECONDS', 0)
    progress = MagicMock()

    with pytest.raises(PrintError, match='completion could not be confirmed'):
        print_file(Path('C:/tmp/job-123.pdf'), 'HP_LaserJet', copies=1,
                   expected_sheets=3, progress_callback=progress)

    progress.assert_not_called()
