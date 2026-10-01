"""
Print Controller configuration loader.

Reads all required configuration from environment variables (or .env file).
Exits with a non-zero status code and a descriptive error message if any
required variable is missing — Requirement 13.6.

Requirements: 10.1, 13.4, 13.6, 15.4
"""
from dataclasses import dataclass
import os
import sys
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    supabase_url: str
    supabase_service_role_key: str
    printer_name: str
    poll_interval: int  # seconds, range 5–300
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""


def load_config() -> Config:
    """
    Load configuration from environment variables / .env file.

    Exits with sys.exit(1) and a descriptive message if any required variable
    is missing.  POLL_INTERVAL_SECONDS is optional; defaults to 10 s.
    """
    supabase_url = os.environ.get('SUPABASE_URL')
    if not supabase_url:
        sys.exit('FATAL: Missing required environment variable: SUPABASE_URL')

    supabase_service_role_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not supabase_service_role_key:
        sys.exit('FATAL: Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY')

    printer_name = os.environ.get('PRINTER_NAME')
    if not printer_name:
        sys.exit('FATAL: Missing required environment variable: PRINTER_NAME')

    poll_interval_raw = os.environ.get('POLL_INTERVAL_SECONDS', '10')
    try:
        poll_interval = int(poll_interval_raw)
    except ValueError:
        poll_interval = 10
    poll_interval = max(5, min(300, poll_interval))

    telegram_bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    telegram_chat_id   = os.environ.get('TELEGRAM_CHAT_ID', '')

    return Config(
        supabase_url=supabase_url,
        supabase_service_role_key=supabase_service_role_key,
        printer_name=printer_name,
        poll_interval=poll_interval,
        telegram_bot_token=telegram_bot_token,
        telegram_chat_id=telegram_chat_id,
    )
