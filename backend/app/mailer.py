"""
Sends email — through Brevo's web API, or over SMTP.

Why two ways
------------
Render's free tier has blocked outgoing SMTP (ports 25, 465 and 587) since
September 2025, so a Gmail SMTP login doesn't work there. Brevo's API sends
over ordinary HTTPS, which isn't blocked, and it can send from a plain Gmail
address without owning a domain. SMTP still works on a paid Render instance
or locally.

Configuration (Render → Environment, or backend/.env locally)
-------------------------------------------------------------
Brevo (works on the free tier — recommended):
    BREVO_API_KEY   from Brevo → SMTP & API → API keys
    MAIL_FROM       the verified sender address, e.g. knowtrients.app@gmail.com

SMTP (paid Render instance, or locally):
    SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD, MAIL_FROM

Optional:
    MAIL_FROM_NAME  shown as the sender's name; defaults to "Knowtrients"

Brevo is used if BREVO_API_KEY is set, otherwise SMTP if SMTP_HOST is set.
With neither, nothing is sent — the message is printed to the server log so
the flow can be tested locally. Don't rely on that in production: anyone
with access to the logs could read the codes.
"""

import json
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def is_configured() -> bool:
    return bool(os.getenv("BREVO_API_KEY") or os.getenv("SMTP_HOST"))


def _sender() -> tuple[str, str]:
    name = os.getenv("MAIL_FROM_NAME", "Knowtrients")
    address = os.getenv("MAIL_FROM") or os.getenv("SMTP_USER") or ""
    return name, address


def _send_brevo(to: str, subject: str, body: str) -> None:
    name, address = _sender()
    payload = json.dumps({
        "sender": {"name": name, "email": address},
        "to": [{"email": to}],
        "subject": subject,
        "textContent": body,
    }).encode()
    request = urllib.request.Request(
        BREVO_URL,
        data=payload,
        method="POST",
        headers={
            "api-key": os.getenv("BREVO_API_KEY", ""),
            "accept": "application/json",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status >= 300:
            raise RuntimeError(f"Brevo answered {response.status}")


def _send_smtp(to: str, subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")

    message = EmailMessage()
    message["From"] = formataddr(_sender())
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

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


def send_email(to: str, subject: str, body: str) -> None:
    """
    Sends a plain-text email. Errors are logged, not raised: this runs after
    the response has gone out, so there's no one to report them to.
    """
    try:
        if os.getenv("BREVO_API_KEY"):
            _send_brevo(to, subject, body)
        elif os.getenv("SMTP_HOST"):
            _send_smtp(to, subject, body)
        else:
            print(f"[email not configured] To: {to} | {subject}\n{body}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        print(f"[email failed] To: {to} | {subject} | Brevo {exc.code}: {detail}")
    except Exception as exc:  # noqa: BLE001
        print(f"[email failed] To: {to} | {subject} | {exc}")
