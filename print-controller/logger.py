"""
Print Controller structured logging setup.

Configures a logger that writes to both stdout and a rotating log file
(print_controller.log, 5 MB × 3 backups).  Every log record includes
a timestamp, the job_id (if provided), and an event description.

Requirements: 12.2
"""
import logging
import logging.handlers
import sys
from typing import Optional

# Log file settings
LOG_FILE = "print_controller.log"
LOG_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
LOG_BACKUP_COUNT = 3

# Log format: timestamp  level  job_id  message
LOG_FORMAT = "%(asctime)s  %(levelname)-8s  [job:%(job_id)s]  %(message)s"
DATE_FORMAT = "%Y-%m-%dT%H:%M:%S%z"


class _JobIdFilter(logging.Filter):
    """
    Injects a ``job_id`` field into every LogRecord so the formatter can
    always reference %(job_id)s — even for records that were not created via
    ``get_logger``.
    """

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        if not hasattr(record, "job_id"):
            record.job_id = "-"  # type: ignore[attr-defined]
        return True


def _build_logger() -> logging.Logger:
    """Create and configure the root print-controller logger."""
    logger = logging.getLogger("print_controller")
    logger.setLevel(logging.DEBUG)

    # Avoid adding duplicate handlers when the module is re-imported
    if logger.handlers:
        return logger

    formatter = logging.Formatter(fmt=LOG_FORMAT, datefmt=DATE_FORMAT)
    job_filter = _JobIdFilter()

    # --- stdout handler ---
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(logging.DEBUG)
    stdout_handler.setFormatter(formatter)
    stdout_handler.addFilter(job_filter)

    # --- rotating file handler ---
    file_handler = logging.handlers.RotatingFileHandler(
        filename=LOG_FILE,
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    file_handler.addFilter(job_filter)

    logger.addHandler(stdout_handler)
    logger.addHandler(file_handler)
    return logger


_root_logger = _build_logger()


def get_logger(job_id: Optional[str] = None) -> logging.LoggerAdapter:
    return logging.LoggerAdapter(
        _root_logger,
        extra={"job_id": job_id if job_id is not None else "-"},
    )


logger = get_logger()
