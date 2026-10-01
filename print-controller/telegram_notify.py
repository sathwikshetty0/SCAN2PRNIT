"""
telegram_notify.py — Send Telegram messages for critical printer events.

Only sends alerts for: printer errors (offline, paper_empty, paper_jam),
job failures, and the tracked 15-sheet paper inventory threshold.

Does NOT send for ink_low (admin console only — N4 requirement).
"""

import urllib.request
import urllib.parse
from html import escape
from datetime import datetime

from logger import logger


def _send(token: str, chat_id: str, text: str) -> bool:
    """Send a Telegram message. Returns True on success."""
    if not token or not chat_id:
        logger.error("Telegram notification was not sent: bot token or chat ID is missing")
        return False

    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data = urllib.parse.urlencode({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
        }).encode()
        req = urllib.request.Request(url, data=data, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return True
            logger.error("Telegram notification failed with HTTP status %s", resp.status)
    except Exception as exc:
        logger.error("Telegram notification failed: %s", exc)
        return False
    return False


def notify_printer_error(token: str, chat_id: str, error_type: str, error_message: str, printer_name: str) -> None:
    """Send alert for printer hardware errors. Skips ink_low (admin console only)."""
    if error_type == "ink_low":
        return  # N4: ink_low = admin console only, no Telegram

    emoji = {
        "paper_empty": "🗒️",
        "paper_jam":   "⚠️",
        "offline":     "🔴",
    }.get(error_type, "⚠️")

    text = (
        f"{emoji} <b>Scan2Print — Printer Alert</b>\n\n"
        f"<b>Printer:</b> {escape(printer_name)}\n"
        f"<b>Error:</b> {escape(error_message)}\n"
        f"<b>Type:</b> {escape(error_type)}\n"
        f"<b>Time:</b> {datetime.now().strftime('%H:%M:%S')}"
    )
    _send(token, chat_id, text)


def notify_paper_low(token: str, chat_id: str, printer_name: str, remaining_sheets: int = 15) -> None:
    """Send an alert when the tracked sheet estimate reaches the 15-sheet threshold."""
    text = (
        f"🗒️ <b>Scan2Print — Low Paper Warning</b>\n\n"
        f"<b>Printer:</b> {escape(printer_name)}\n"
        f"Approximately {remaining_sheets} sheets remain in the tray.\n"
        f"Please refill the paper tray soon.\n"
        f"<b>Time:</b> {datetime.now().strftime('%H:%M:%S')}"
    )
    _send(token, chat_id, text)


def notify_job_failed(token: str, chat_id: str, job_id: str, error_message: str) -> None:
    """Send alert when a print job fails."""
    text = (
        f"❌ <b>Scan2Print — Print Job Failed</b>\n\n"
        f"<b>Job ID:</b> <code>{escape(job_id[:8])}…</code>\n"
        f"<b>Error:</b> {escape(error_message[:200])}\n"
        f"<b>Time:</b> {datetime.now().strftime('%H:%M:%S')}"
    )
    _send(token, chat_id, text)
