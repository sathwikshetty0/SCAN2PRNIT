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
from pathlib import Path


class PrintError(Exception):
    """Raised when the print command fails or cannot be invoked."""


def print_file(file_path: Path, printer_name: str, copies: int) -> None:
    """
    Send *file_path* to *printer_name* with *copies* copies.

    Dispatches the OS-appropriate print command:
      - Linux/macOS: lp -d <printer_name> -n <copies> <file_path>
      - Windows:     SumatraPDF.exe -print-to "<printer_name>"
                                    -print-settings "<copies>x" "<file_path>"

    Raises:
        PrintError: if the subprocess exits with a non-zero return code,
                    or if the subprocess cannot be started at all.
                    Never falls back to the system default printer.
    """
    system = platform.system()

    if system == "Windows":
        cmd = [
            "SumatraPDF.exe",
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
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
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
