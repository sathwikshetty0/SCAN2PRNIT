"""
printer_monitor.py — Windows WMI-based printer health checker.

Polls Windows printer status every N seconds and updates the
printer_status row in Supabase. This lets the admin dashboard
show real-time printer health (paper empty, jam, offline, etc.).

Requirements: PR1-PR6, ML2-ML13
"""

import platform
import time
import subprocess
from datetime import datetime, timezone

STATUS_ROW_ID = "00000000-0000-0000-0000-000000000001"


def _get_printer_status_windows(printer_name: str) -> dict:
    """
    Uses PowerShell / WMI to query printer status.
    Returns dict: {is_online, error_type, error_message}
    """
    try:
        result = subprocess.run(
            [
                "powershell", "-NoProfile", "-NonInteractive", "-Command",
                f'Get-WmiObject Win32_Printer | Where-Object {{$_.Name -eq "{printer_name}"}} | '
                'Select-Object -ExpandProperty PrinterStatus, DetectedErrorState, ExtendedDetectedErrorState'
            ],
            capture_output=True, text=True, timeout=10
        )
        output = result.stdout.strip()

        if not output or result.returncode != 0:
            return {"is_online": False, "error_type": "offline", "error_message": "Printer not found in Windows"}

        # Get more detailed status
        result2 = subprocess.run(
            [
                "powershell", "-NoProfile", "-NonInteractive", "-Command",
                f'$p = Get-WmiObject Win32_Printer | Where-Object {{$_.Name -eq "{printer_name}"}}; '
                'if ($p) {{ '
                '  $status = $p.PrinterStatus; '
                '  $err = $p.DetectedErrorState; '
                '  Write-Output "$status|$err" '
                '}} else {{ Write-Output "NOT_FOUND" }}'
            ],
            capture_output=True, text=True, timeout=10
        )
        out = result2.stdout.strip()

        if out == "NOT_FOUND" or not out:
            return {"is_online": False, "error_type": "offline", "error_message": "Printer not found"}

        parts = out.split("|")
        printer_status = int(parts[0]) if parts[0].isdigit() else 0
        error_state    = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0

        # Win32_Printer PrinterStatus codes:
        # 1=Other, 2=Unknown, 3=Idle, 4=Printing, 5=Warmup,
        # 6=Stopped Printing, 7=Offline
        if printer_status == 7:
            return {"is_online": False, "error_type": "offline", "error_message": "Printer is offline"}

        # Win32_Printer DetectedErrorState bitmask:
        # 0=Unknown, 2=No Error, 4=Low Paper, 8=No Paper
        # 16=Low Toner, 32=No Toner, 64=Door Open, 128=Jammed
        if error_state & 8:
            return {"is_online": True, "error_type": "paper_empty", "error_message": "Printer is out of paper"}
        if error_state & 4:
            return {"is_online": True, "error_type": "paper_empty", "error_message": "Printer paper is low"}
        if error_state & 128:
            return {"is_online": True, "error_type": "paper_jam", "error_message": "Paper jam detected"}
        if error_state & 32:
            return {"is_online": True, "error_type": "ink_low", "error_message": "Printer toner is empty"}
        if error_state & 16:
            return {"is_online": True, "error_type": "ink_low", "error_message": "Printer toner is low"}

        return {"is_online": True, "error_type": None, "error_message": None}

    except Exception as e:
        return {"is_online": False, "error_type": "offline", "error_message": f"WMI error: {e}"}


def _get_printer_status_unix(printer_name: str) -> dict:
    """CUPS-based printer status check for Linux/macOS."""
    try:
        result = subprocess.run(
            ["lpstat", "-p", printer_name],
            capture_output=True, text=True, timeout=10
        )
        output = result.stdout.lower()
        if "disabled" in output or "not accepting" in output:
            return {"is_online": False, "error_type": "offline", "error_message": "Printer disabled"}
        if result.returncode != 0:
            return {"is_online": False, "error_type": "offline", "error_message": "Printer not found"}
        return {"is_online": True, "error_type": None, "error_message": None}
    except Exception as e:
        return {"is_online": False, "error_type": "offline", "error_message": str(e)}


def get_printer_health(printer_name: str) -> dict:
    """Returns printer health for any OS."""
    if platform.system() == "Windows":
        return _get_printer_status_windows(printer_name)
    return _get_printer_status_unix(printer_name)


def update_printer_status(supabase, printer_name: str) -> dict:
    """
    Queries printer health and upserts into Supabase printer_status table.
    Returns the health dict.
    """
    health = get_printer_health(printer_name)
    try:
        supabase.table("printer_status").upsert({
            "id":            STATUS_ROW_ID,
            "updated_at":    datetime.now(timezone.utc).isoformat(),
            "is_online":     health["is_online"],
            "error_type":    health["error_type"],
            "error_message": health["error_message"],
            "printer_name":  printer_name,
        }).execute()
    except Exception as e:
        pass  # Non-critical — don't crash the main loop
    return health
