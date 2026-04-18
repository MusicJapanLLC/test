import base64
from email.mime.text import MIMEText
from abc import ABC, abstractmethod

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


class MailClient(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, body: str) -> str:
        """Send mail and return a provider-specific message id."""


class GmailClient(MailClient):
    def __init__(self, token_path: str, sender_email: str, sender_name: str = ""):
        creds = Credentials.from_authorized_user_file(token_path, GMAIL_SCOPES)
        self.service = build("gmail", "v1", credentials=creds)
        self.sender_email = sender_email
        self.sender_name = sender_name

    def send(self, to: str, subject: str, body: str) -> str:
        message = MIMEText(body, "plain", "utf-8")
        message["to"] = to
        message["from"] = (
            f"{self.sender_name} <{self.sender_email}>"
            if self.sender_name
            else self.sender_email
        )
        message["subject"] = subject
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        sent = (
            self.service.users()
            .messages()
            .send(userId="me", body={"raw": raw})
            .execute()
        )
        return sent["id"]


class SendGridClient(MailClient):
    def __init__(self, api_key: str, sender_email: str, sender_name: str = ""):
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        self._Mail = Mail
        self.client = SendGridAPIClient(api_key)
        self.sender_email = sender_email
        self.sender_name = sender_name

    def send(self, to: str, subject: str, body: str) -> str:
        from_value = (self.sender_email, self.sender_name) if self.sender_name else self.sender_email
        message = self._Mail(
            from_email=from_value,
            to_emails=to,
            subject=subject,
            plain_text_content=body,
        )
        response = self.client.send(message)
        return response.headers.get("X-Message-Id", "")


def build_mail_client(settings) -> MailClient:
    if settings.mail_provider == "gmail":
        return GmailClient(settings.gmail_token_path, settings.sender_email, settings.sender_name)
    if settings.mail_provider == "sendgrid":
        return SendGridClient(settings.sendgrid_api_key, settings.sender_email, settings.sender_name)
    raise ValueError(f"unknown MAIL_PROVIDER: {settings.mail_provider}")
