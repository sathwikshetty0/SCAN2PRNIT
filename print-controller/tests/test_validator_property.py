# Feature: a4-print-kiosk, Property 9: PDF magic byte validation is correct for all byte sequences
#
# Validates: Requirements 12.5, 12.6

import tempfile
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from validator import is_valid_pdf


PDF_MAGIC = b'%PDF'


@given(st.binary())
@settings(max_examples=100)
def test_is_valid_pdf_iff_starts_with_magic(data: bytes) -> None:
    """
    Property 9: For any byte sequence, is_valid_pdf returns True if and only if
    the first four bytes are b'%PDF' (0x25 0x50 0x44 0x46).
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as f:
        f.write(data)
        tmp_path = Path(f.name)

    try:
        result = is_valid_pdf(tmp_path)
        expected = data[:4] == PDF_MAGIC
        assert result == expected, (
            f"is_valid_pdf returned {result} for data starting with {data[:4]!r}, "
            f"expected {expected}"
        )
    finally:
        tmp_path.unlink(missing_ok=True)


def test_is_valid_pdf_empty_bytes() -> None:
    """Empty file must return False (no magic bytes present)."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as f:
        tmp_path = Path(f.name)

    try:
        assert is_valid_pdf(tmp_path) is False
    finally:
        tmp_path.unlink(missing_ok=True)


def test_is_valid_pdf_partial_magic() -> None:
    """Partial magic b'%PD' (only 3 bytes) must return False."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as f:
        f.write(b'%PD')
        tmp_path = Path(f.name)

    try:
        assert is_valid_pdf(tmp_path) is False
    finally:
        tmp_path.unlink(missing_ok=True)


def test_is_valid_pdf_valid_header() -> None:
    """Bytes starting with b'%PDF' must return True."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as f:
        f.write(b'%PDF-1.4 some content')
        tmp_path = Path(f.name)

    try:
        assert is_valid_pdf(tmp_path) is True
    finally:
        tmp_path.unlink(missing_ok=True)
