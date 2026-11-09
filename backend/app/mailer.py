"""
Sends email over SMTP.

Works with any provider that offers SMTP — a Gmail account with an app
password, Resend, SendGrid, Brevo — configured through environment variables:

    SMTP_HOST       e.g. smtp.gmail.com
    SMTP_PORT       587 (STARTTLS, the default) or 465 (SSL)
    SMTP_USER       the login, often the sending address
    SMTP_PASSWORD   the password or app password
    MAIL_FROM       the From address; defaults to SMTP_USER

With no SMTP_HOST set, nothing is sent: the message is printed to the server
log instead, so password reset can be tested locally without an email
account. Don't rely on that in production — anyone with access to the logs
could read reset codes.
"""

import os
import smtplib
import ssl
from email.message import EmailMessage


def is_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))


def send_email(to: str, subject: str, body: str) -> None:
    """
    Sends a plain-text email. Errors are logged, not raised: this runs after
    the response has gone out, and a failed send must not reveal whether the
    address belongs to an account.
    """
    if not is_configured():
        print(f"[email not configured] To: {to} | {subject}\n{body}")
        return

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("MAIL_FROM") or user

    message = EmailMessage()
    message["From"] = sender
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    try:
        context = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as smtp:
                if user:
                    smtp.login(user, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=20) as smtp:
                smtp.starttls(context=context)
                if user:
                    smtp.login(user, password)
                smtp.send_message(message)
    except Exception as exc:  # noqa: BLE001
        print(f"[email failed] To: {to} | {subject} | {exc}")
