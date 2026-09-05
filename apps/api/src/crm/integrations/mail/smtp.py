"""SMTP email delivery implementation."""

import logging
from email.message import EmailMessage

import aiosmtplib

from crm.core.config import settings
from crm.integrations.mail.protocol import MailSender

logger = logging.getLogger(__name__)


class SmtpMailSender(MailSender):
    """Sends transactional email via standard SMTP (e.g. Mailhog or production SMTP)."""

    def __init__(
        self,
        hostname: str | None = None,
        port: int | None = None,
        username: str | None = None,
        password: str | None = None,
        use_tls: bool | None = None,
        from_email: str | None = None,
        from_name: str | None = None,
    ) -> None:
        self.hostname = hostname or settings.smtp_host
        self.port = port or settings.smtp_port
        self.username = username or settings.smtp_user
        self.password = password or settings.smtp_password
        self.use_tls = use_tls if use_tls is not None else settings.smtp_tls
        self.from_email = from_email or settings.smtp_from_email
        self.from_name = from_name or settings.smtp_from_name

    async def send_mail(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str | None = None,
    ) -> None:
        message = EmailMessage()
        sender = f"{self.from_name} <{self.from_email}>" if self.from_name else self.from_email
        message["From"] = sender
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(text_body)

        if html_body:
            message.add_alternative(html_body, subtype="html")

        try:
            await aiosmtplib.send(
                message,
                hostname=self.hostname,
                port=self.port,
                username=self.username or None,
                password=self.password or None,
                use_tls=self.use_tls,
                timeout=10,
            )
            logger.info(
                "Sent email '%s' to %s via SMTP (%s:%d)",
                subject,
                to_email,
                self.hostname,
                self.port,
            )
        except Exception as exc:
            logger.error(
                "Failed to deliver email to %s via SMTP (%s:%d): %s",
                to_email,
                self.hostname,
                self.port,
                exc,
            )
            raise
