"""
telegram_notify.py — Send Telegram messages for critical printer events.

Only sends alerts for: printer errors (offline, paper_empty, paper_jam),
job failures, and paper low warning (last ~15 pages = WMI reports paper_low/error_state & 4).

Does NOT send for ink_low (admin console only — N4 requirement).
"""

import os
import urllib.request
import urllib.parse
import json
from datetime import datetime


def _send(token: str, chat_id: str, text: str) -> bool:
    """Send a Telegram message. Returns True on success."""
    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data = urllib.parse.urlencode({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
        }).encode()
        req = urllib.request.Request(url, data=data, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
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
        f"<b>Printer:</b> {printer_name}\n"
        f"<b>Error:</b> {error_message}\n"
        f"<b>Type:</b> {error_type}\n"
        f"<b>Time:</b> {datetime.now().strftime('%H:%M:%S')}"
    )
    _send(token, chat_id, text)


def notify_paper_low(token: str, chat_id: str, printer_name: str) -> None:
    """Send alert when WMI reports paper_low (error_state & 4 — last ~15 sheets)."""
    text = (
        f"🗒️ <b>Scan2Print — Low Paper Warning</b>\n\n"
        f"<b>Printer:</b> {printer_name}\n"
        f"Paper is running low — approximately 15 or fewer sheets remaining.\n"
        f"Please refill the paper tray soon.\n"
        f"<b>Time:</b> {datetime.now().strftime('%H:%M:%S')}"
    )
    _send(token, chat_id, text)


def notify_job_failed(token: str, chat_id: str, job_id: str, error_message: str) -> None:
    """Send alert when a print job fails."""
    text = (
        f"❌ <b>Scan2Print — Print Job Failed</b>\n\n"
        f"<b>Job ID:</b> <code>{job_id[:8]}…</code>\n"
        f"<b>Error:</b> {error_message[:200]}\n"
        f"<b>Time:</b> {datetime.now().strftime('%H:%M:%S')}"
    )
    _send(token, chat_id, text)
