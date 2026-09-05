"""Minimal structured-ish logging setup.

Kept deliberately small for sprint 0. Swap the formatter for JSON when a log
aggregator is actually in front of this.
"""

import logging
import sys

from crm.core.config import settings

_FORMAT = "%(asctime)s %(levelname)-8s %(name)s [%(request_id)s] %(message)s"


class _RequestIdFilter(logging.Filter):
    """Guarantees the format string never blows up on records without a request id."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_FORMAT))
    handler.addFilter(_RequestIdFilter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.DEBUG if settings.debug else logging.INFO)

    # Uvicorn installs its own handlers; route them through ours instead.
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        logging.getLogger(name).handlers = [handler]
        logging.getLogger(name).propagate = False
