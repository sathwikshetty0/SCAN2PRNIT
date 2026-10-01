"""
printer.py — Cross-platform print dispatch for the A4 Print Kiosk.

Dispatches a PDF file to a named printer using the OS-appropriate command:
  - Linux/macOS: lp (CUPS-based)
  - Windows:     SumatraPDF.exe (requires SumatraPDF in PATH or configured path)

No fallback to the system default printer is ever attempted; if the named
printer is unavailable the subprocess exits non-zero and PrintError is raised.
"""

import platform
import subprocess
import time
from pathlib import Path
from typing import Callable, Optional


class PrintError(Exception):
    """Raised when the print command fails or cannot be invoked."""

WINDOWS_JOB_DISCOVERY_SECONDS = 30
PRINT_COMPLETION_SECONDS = 15 * 60


def _windows_printed_pages(printer_name: str, job_marker: str) -> Optional[int]:
    escaped_marker = job_marker.replace("'", "''")
    command = (
        "Get-CimInstance Win32_PrintJob | "
        f"Where-Object {{$_.PrinterName -like '*{printer_name.replace(chr(39), chr(39) * 2)}*' "
        f"-and $_.Document -like '*{escaped_marker}*'}} | "
        "Select-Object -First 1 -ExpandProperty PagesPrinted"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5,
        )
        output = result.stdout.decode(errors="replace").strip()
        return int(output) if result.returncode == 0 and output.isdigit() else None
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def print_file(
    file_path: Path,
    printer_name: str,
    copies: int,
    expected_sheets: Optional[int] = None,
    progress_callback: Optional[Callable[[int], None]] = None,
    health_callback: Optional[Callable[[], None]] = None,
) -> None:
    """
    Send *file_path* to *printer_name* with *copies* copies.

    Dispatches the OS-appropriate print command:
      - Linux/macOS: lp -d <printer_name> -n <copies> <file_path>
      - Windows:     SumatraPDF.exe -print-to "<printer_name>"
                                    -print-settings "<copies>x" "<file_path>"

    Raises:
        PrintError: if the subprocess exits with a non-zero return code,
                    the Windows spooler cannot confirm completion, or the
                    subprocess cannot be started.
                    Never falls back to the system default printer.

    On Windows, the optional progress callback is driven by the matching
    Win32_PrintJob record. A successful command submission alone is not treated
    as a completed print.
    """
    system = platform.system()

    if system == "Windows":
        import os
        import shutil
        possible_paths = [
            shutil.which("SumatraPDF.exe"),
            shutil.which("SumatraPDF"),
            os.path.expandvars(r"%LOCALAPPDATA%\SumatraPDF\SumatraPDF.exe"),
            r"C:\Program Files\SumatraPDF\SumatraPDF.exe",
        ]
        sumatra = next((p for p in possible_paths if p and os.path.exists(p)), None)
        if not sumatra:
            raise PrintError(
                "SumatraPDF.exe not found. Please install SumatraPDF from "
                "https://www.sumatrapdfreader.org and ensure it is in PATH "
                "or at %LOCALAPPDATA%\\SumatraPDF\\SumatraPDF.exe"
            )
        cmd = [
            sumatra,
            "-print-to", printer_name,
            "-print-settings", f"{copies}x",
            str(file_path),
        ]
    else:
        # Linux and macOS both use CUPS via the `lp` command.
        cmd = [
            "lp",
            "-d", printer_name,
            "-n", str(copies),
            str(file_path),
        ]

    try:
        if system == "Windows" and progress_callback:
            last_reported = 0
            started_at = time.monotonic()
            job_observed = False
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            result = None
            while True:
                try:
                    stdout, stderr = process.communicate(timeout=0.5)
                    result = subprocess.CompletedProcess(cmd, process.returncode, stdout, stderr)
                except subprocess.TimeoutExpired:
                    pass

                if health_callback:
                    health_callback()

                if result is not None and result.returncode != 0:
                    break

                pages_printed = _windows_printed_pages(printer_name, file_path.stem)
                if pages_printed is not None:
                    job_observed = True
                    if pages_printed > last_reported:
                        last_reported = pages_printed
                        progress_callback(last_reported)
                elif result is not None and job_observed:
                    break

                elapsed = time.monotonic() - started_at
                if result is not None and not job_observed and elapsed >= WINDOWS_JOB_DISCOVERY_SECONDS:
                    raise PrintError(
                        "Windows did not expose this print job in its spooler; completion could not be confirmed"
                    )
                if elapsed >= PRINT_COMPLETION_SECONDS:
                    process.kill()
                    process.communicate()
                    raise PrintError("Timed out waiting for the Windows print spooler to finish this job")
                time.sleep(0.25)

        else:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
    except PrintError:
        raise
    except Exception as exc:
        raise PrintError(
            f"Failed to invoke print command {cmd[0]!r}: {exc}"
        ) from exc

    if result.returncode != 0:
        stderr_text = result.stderr.decode(errors="replace").strip()
        raise PrintError(
            f"Print command exited with code {result.returncode}"
            + (f": {stderr_text}" if stderr_text else "")
        )

    if progress_callback and expected_sheets is not None:
        progress_callback(expected_sheets)
