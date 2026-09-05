"""Mail sender protocol."""

from typing import Protocol


class MailSender(Protocol):
    """Abstract interface for transactional email delivery."""

    async def send_mail(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str | None = None,
    ) -> None:
        """Send a transactional email."""
        ...
