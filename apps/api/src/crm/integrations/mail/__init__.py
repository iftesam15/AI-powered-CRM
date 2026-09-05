"""Mail delivery integrations."""

from functools import lru_cache

from crm.core.config import settings
from crm.integrations.mail.console import ConsoleMailSender
from crm.integrations.mail.protocol import MailSender
from crm.integrations.mail.smtp import SmtpMailSender


@lru_cache
def get_mail_sender() -> MailSender:
    """Resolve mail sender based on environment."""
    if settings.environment in {"local", "test"} and not settings.smtp_user:
        # In local/test without credentials, SmtpMailSender connects to local mailcatcher (1025)
        return SmtpMailSender()
    return SmtpMailSender()


__all__ = ["ConsoleMailSender", "MailSender", "SmtpMailSender", "get_mail_sender"]
