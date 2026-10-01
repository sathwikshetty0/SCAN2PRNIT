from pathlib import Path

PDF_MAGIC = b'%PDF'


def is_valid_pdf(path: Path) -> bool:
    """Returns True iff the first 4 bytes of the file are b'%PDF'."""
    try:
        with open(path, 'rb') as f:
            header = f.read(4)
        return header == PDF_MAGIC
    except (IOError, OSError):
        return False
