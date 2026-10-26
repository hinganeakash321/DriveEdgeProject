"""Reusable notification service (Mailpit SMTP).

Sends plain-text emails for business events. Fails soft: if SMTP is
unreachable, the event is logged and the caller is not blocked.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("driveedge.notifications")


def _send(to: str, subject: str, body: str) -> bool:
    msg = EmailMessage()
    msg["From"] = settings.mail_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.mail_host, settings.mail_port, timeout=5) as smtp:
            smtp.send_message(msg)
        logger.info("Notification sent to %s: %s", to, subject)
        return True
    except OSError as exc:  # connection refused, timeout, etc.
        logger.warning("Email delivery unavailable (%s). Would have sent '%s' to %s", exc, subject, to)
        return False


def enquiry_confirmation(to: str, enquiry_id: int, vehicle_label: Optional[str]) -> bool:
    return _send(
        to,
        f"DriveEdge enquiry #{enquiry_id} received",
        f"We've received your enquiry (#{enquiry_id}) for {vehicle_label or 'a vehicle'}. "
        "Participating dealers will respond with quotations soon.",
    )


def dealer_enquiry_notification(to: str, enquiry_id: int, vehicle_label: Optional[str]) -> bool:
    return _send(
        to,
        f"New DriveEdge enquiry #{enquiry_id}",
        f"You have a new customer enquiry (#{enquiry_id}) for {vehicle_label or 'a vehicle'}. "
        "Log in to your dealer portal to prepare a quotation.",
    )


def quotation_received(to: str, enquiry_id: int, dealer_name: str) -> bool:
    return _send(
        to,
        f"New quotation on enquiry #{enquiry_id}",
        f"{dealer_name} has submitted a quotation for your enquiry #{enquiry_id}. "
        "Log in to compare offers.",
    )


def dealer_approval(to: str, approved: bool) -> bool:
    status = "approved" if approved else "not approved"
    return _send(
        to,
        f"DriveEdge dealer application {status}",
        f"Your dealership application has been {status}. "
        + ("You can now receive enquiries and submit quotations." if approved else ""),
    )
