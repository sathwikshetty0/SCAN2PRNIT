"""
downloader.py — File downloader with exponential backoff retry.

Requirements: 11.1, 12.4
"""
import time
from pathlib import Path
from supabase import Client


class DownloadError(Exception):
    """Raised when file download fails after max retries."""
    pass


def download_file(supabase: Client, file_path: str, dest_dir: Path) -> Path:
    """
    Downloads file_path from Supabase Storage 'print-files' bucket to dest_dir.
    Retries up to 3 times with exponential backoff: 5 s -> 10 s -> 20 s.
    Raises DownloadError after exhausting retries.
    """
    backoff = [5, 10, 20]
    dest_path = dest_dir / Path(file_path).name

    for attempt, sleep_time in enumerate(backoff, start=1):
        try:
            file_bytes = supabase.storage.from_("print-files").download(file_path)
            dest_dir.mkdir(parents=True, exist_ok=True)
            with open(dest_path, "wb") as f:
                f.write(file_bytes)
            return dest_path
        except Exception as e:
            if attempt == len(backoff):
                raise DownloadError(
                    f"Failed to download file '{file_path}' after {attempt} attempts: {e}"
                ) from e
            time.sleep(sleep_time)

    raise DownloadError(f"Failed to download file '{file_path}'")
