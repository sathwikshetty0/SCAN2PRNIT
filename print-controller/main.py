"""
main.py — Entry point for the Python Print Controller.

Requirements: 10.2, 10.3, 11.1, 11.4, 11.5, 11.6, 12.1, 12.3, 15.1, 15.2
"""
import os
import time
import tempfile
from pathlib import Path
from supabase import create_client, Client

from config import Config, load_config
from logger import logger
from poller import claim_next_job
from downloader import download_file, DownloadError
from validator import is_valid_pdf
from printer import print_file, PrintError
from updater import mark_printed, mark_failed
from printer_monitor import update_printer_status
from telegram_notify import notify_printer_error, notify_paper_low, notify_job_failed

# Cooldown tracker: error_type -> last notification timestamp
_last_notified: dict = {}


def recover_stale_jobs(supabase: Client) -> None:
    """
    On startup, marks any PRINTING jobs as FAILED with 'Controller restarted'.
    """
    try:
        res = (
            supabase.table("print_jobs")
            .update({
                "job_status": "FAILED",
                "error_message": "Controller restarted"
            })
            .eq("job_status", "PRINTING")
            .execute()
        )
        count = len(res.data) if res.data else 0
        if count > 0:
            logger.warning("Recovered %d stale PRINTING job(s) -> FAILED", count)
    except Exception as e:
        logger.error("Error recovering stale jobs: %s", e)


_TELEGRAM_COOLDOWN_SECONDS = 300  # 5 minutes between repeat alerts for same error


def run_one_cycle(supabase: Client, config: Config, telegram_token: str = "", telegram_chat_id: str = "") -> None:
    """
    Executes one polling cycle:
    1. Check printer health
    2. Claim next job (skip if printer has a blocking error)
    3. Download file
    4. Validate PDF header
    5. Print file
    6. Update status
    7. Delete temp file (in finally block)
    """
    # Always update printer health in Supabase
    health = update_printer_status(supabase, config.printer_name)

    # Send Telegram alerts for printer errors (with cooldown)
    now = time.time()
    error_type = health.get("error_type")
    if error_type in ("paper_empty", "paper_jam", "offline"):
        last = _last_notified.get(error_type, 0)
        if now - last >= _TELEGRAM_COOLDOWN_SECONDS:
            notify_printer_error(telegram_token, telegram_chat_id, error_type,
                                 health["error_message"], config.printer_name)
            _last_notified[error_type] = now
    elif error_type == "paper_low":
        last = _last_notified.get("paper_low", 0)
        if now - last >= _TELEGRAM_COOLDOWN_SECONDS:
            notify_paper_low(telegram_token, telegram_chat_id, config.printer_name)
            _last_notified["paper_low"] = now

    # Block printing if printer has a hard error
    if not health["is_online"] or health["error_type"] in ("paper_empty", "paper_jam", "offline"):
        logger.warning(
            "Printer not ready (error_type=%s): %s — skipping job dispatch",
            health["error_type"], health["error_message"]
        )
        return

    try:
        job = claim_next_job(supabase)
    except Exception as e:
        logger.warning("Network or database error during poll cycle: %s", e)
        return

    if job is None:
        logger.debug("Polling cycle complete: no qualifying jobs")
        return

    job_id = job["id"]
    file_path_str = job["file_path"]
    copies = job.get("copies", 1)
    logger.info("Claimed job %s (file: %s, copies: %d)", job_id, file_path_str, copies)

    temp_dir = Path(tempfile.gettempdir()) / "a4_kiosk_downloads"
    downloaded_file: Path | None = None

    try:
        # Download file
        downloaded_file = download_file(supabase, file_path_str, temp_dir)

        # Validate magic bytes
        if not is_valid_pdf(downloaded_file):
            logger.error("Job %s failed validation: not a valid PDF", job_id)
            mark_failed(supabase, job_id, "Downloaded file is not a valid PDF")
            return

        # Dispatch to printer
        logger.info("Printing job %s to printer '%s'...", job_id, config.printer_name)
        print_file(downloaded_file, config.printer_name, copies)

        # Mark printed
        mark_printed(supabase, job_id)
        logger.info("Job %s successfully printed and marked PRINTED", job_id)

    except DownloadError as e:
        logger.error("Job %s failed during download: %s", job_id, e)
        mark_failed(supabase, job_id, str(e))
    except PrintError as e:
        logger.error("Job %s failed during printing: %s", job_id, e)
        mark_failed(supabase, job_id, str(e))
        notify_job_failed(telegram_token, telegram_chat_id, job_id, str(e))
        # After a print failure, re-check printer health and update status
        update_printer_status(supabase, config.printer_name)
    except Exception as e:
        logger.exception("Job %s encountered unexpected error: %s", job_id, e)
        mark_failed(supabase, job_id, f"Unexpected error: {e}")
    finally:
        if downloaded_file and downloaded_file.exists():
            try:
                downloaded_file.unlink()
                logger.debug("Cleaned up temp file %s", downloaded_file)
            except Exception as e:
                logger.warning("Failed to delete temp file %s: %s", downloaded_file, e)


def run_forever(config: Config) -> None:
    """Main polling loop."""
    logger.info("Starting Print Controller with printer '%s', interval %ds",
                config.printer_name, config.poll_interval)
    supabase = create_client(config.supabase_url, config.supabase_service_role_key)
    recover_stale_jobs(supabase)

    telegram_token   = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    telegram_chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    # Immediately update printer status on startup
    update_printer_status(supabase, config.printer_name)

    while True:
        try:
            run_one_cycle(supabase, config, telegram_token, telegram_chat_id)
        except Exception as e:
            logger.exception("Unhandled exception in polling loop: %s", e)
        time.sleep(config.poll_interval)


if __name__ == "__main__":
    cfg = load_config()
    run_forever(cfg)
