"""
Unit tests for validator.py — is_valid_pdf function.

Tests: valid %PDF header, non-PDF bytes, empty file, partial '%PD'.
Requirements: 11.2, 12.5, 12.6
"""
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from validator import is_valid_pdf


def test_valid_pdf_header_returns_true():
    """A file whose first four bytes are b'%PDF' must return True."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as f:
        f.write(b'%PDF-1.4\n some content here')
        tmp = Path(f.name)
    try:
        assert is_valid_pdf(tmp) is True
    finally:
        tmp.unlink(missing_ok=True)


def test_non_pdf_bytes_returns_false():
    """A file whose first four bytes are not b'%PDF' must return False."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as f:
        f.write(b'\x89PNG\r\n\x1a\n')  # PNG magic bytes
        tmp = Path(f.name)
    try:
        assert is_valid_pdf(tmp) is False
    finally:
        tmp.unlink(missing_ok=True)


def test_empty_file_returns_false():
    """An empty file (0 bytes) must return False."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as f:
        tmp = Path(f.name)
    try:
        assert is_valid_pdf(tmp) is False
    finally:
        tmp.unlink(missing_ok=True)


def test_partial_magic_bytes_returns_false():
    """A file with only b'%PD' (3 bytes, incomplete magic) must return False."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as f:
        f.write(b'%PD')
        tmp = Path(f.name)
    try:
        assert is_valid_pdf(tmp) is False
    finally:
        tmp.unlink(missing_ok=True)


def test_nonexistent_file_returns_false():
    """A path that does not exist on disk must return False (IOError handled)."""
    non_existent = Path('/tmp/this_file_does_not_exist_12345.pdf')
    assert is_valid_pdf(non_existent) is False
