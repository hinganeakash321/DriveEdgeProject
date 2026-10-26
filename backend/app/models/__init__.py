"""ORM models for DriveEdge.

Importing this package registers all models on the shared Base metadata.
"""
from app.models.enums import (
    AccountStatus,
    EnquiryStatus,
    FuelType,
    QuotationStatus,
    Transmission,
    UserRole,
    VerificationStatus,
)
from app.models.user import User
from app.models.catalogue import Manufacturer, VehicleModel, VehicleVariant
from app.models.dealer import Dealer, DealerManufacturer
from app.models.enquiry import CustomerEnquiry, EnquiryDealer
from app.models.quotation import Quotation
from app.models.misc import (
    AIConversation,
    AuditLog,
    CustomerActivity,
    Favourite,
    RecentlyViewed,
    SavedSearch,
)

__all__ = [
    "AccountStatus",
    "EnquiryStatus",
    "FuelType",
    "QuotationStatus",
    "Transmission",
    "UserRole",
    "VerificationStatus",
    "User",
    "Manufacturer",
    "VehicleModel",
    "VehicleVariant",
    "Dealer",
    "DealerManufacturer",
    "CustomerEnquiry",
    "EnquiryDealer",
    "Quotation",
    "AIConversation",
    "AuditLog",
    "CustomerActivity",
    "Favourite",
    "RecentlyViewed",
    "SavedSearch",
]
