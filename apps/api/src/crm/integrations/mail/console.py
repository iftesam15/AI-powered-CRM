"""Console and in-memory email sender for local development and tests."""

import logging
from dataclasses import dataclass

from crm.integrations.mail.protocol import MailSender

logger = logging.getLogger(__name__)


@dataclass
class OutboxMessage:
    to_email: str
    subject: str
    text_body: str
    html_body: str | None


class ConsoleMailSender(MailSender):
    """Logs sent emails to logger/stdout and keeps an in-memory outbox."""

    def __init__(self) -> None:
        self.outbox: list[OutboxMessage] = []

    async def send_mail(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str | None = None,
    ) -> None:
        msg = OutboxMessage(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        self.outbox.append(msg)
        logger.info(
            "[MAIL SENDER] To: %s | Subject: %s\nBody: %s",
            to_email,
            subject,
            text_body,
        )

    def clear(self) -> None:
        self.outbox.clear()
