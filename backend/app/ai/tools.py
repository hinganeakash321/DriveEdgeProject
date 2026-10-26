"""Allowlisted, authorization-enforcing backend tools for AI agents.

These are plain Python functions (not raw SQL). Agents may only call these;
each validates inputs and scopes data to what the caller is authorized to see.
Treat all model/user input as untrusted.
"""
from __future__ import annotations

from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    CustomerActivity,
    CustomerEnquiry,
    Dealer,
    EnquiryDealer,
    Manufacturer,
    Quotation,
    User,
    VehicleModel,
    VehicleVariant,
)
from app.models.enums import EnquiryStatus, QuotationStatus, UserRole
from app.services import catalogue_service as cat
from app.services import notification_service as notify
from app.services import quotation_service as qsvc
from app.services.catalogue_service import CarFilters
from app.services.dealer_service import DealerFilters, list_dealers


def search_vehicles(
    db: Session,
    *,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    body_type: Optional[str] = None,
    fuel_type: Optional[str] = None,
    transmission: Optional[str] = None,
    seating_capacity: Optional[int] = None,
    limit: int = 10,
) -> List[dict]:
    filters = CarFilters(
        min_price=Decimal(str(min_price)) if min_price is not None else None,
        max_price=Decimal(str(max_price)) if max_price is not None else None,
        body_type=body_type,
        fuel_type=fuel_type,
        transmission=transmission,
        seating_capacity=seating_capacity,
        sort="price_asc",
        page=1,
        page_size=min(max(limit, 1), 20),
    )
    rows, _total, _p, _ps = cat.list_vehicles(db, filters)
    return [
        {
            "vehicle_id": m.id,
            "manufacturer": m.manufacturer.name if m.manufacturer else None,
            "model": m.model_name,
            "body_type": m.body_type,
            "min_price": float(m.min_price) if m.min_price is not None else None,
            "max_price": float(m.max_price) if m.max_price is not None else None,
            "fuel_types": sorted({v.fuel_type.value for v in m.active_variants}),
            "transmissions": sorted({v.transmission.value for v in m.active_variants}),
            "seating": sorted({v.seating_capacity for v in m.active_variants if v.seating_capacity}),
        }
        for m in rows
    ]


def get_vehicle_details(db: Session, vehicle_id: int) -> Optional[dict]:
    m = cat.get_vehicle(db, vehicle_id)
    if not m:
        return None
    return {
        "vehicle_id": m.id,
        "manufacturer": m.manufacturer.name if m.manufacturer else None,
        "model": m.model_name,
        "body_type": m.body_type,
        "min_price": float(m.min_price) if m.min_price is not None else None,
        "max_price": float(m.max_price) if m.max_price is not None else None,
        "variants": [
            {
                "variant_id": v.id,
                "name": v.variant_name,
                "fuel_type": v.fuel_type.value,
                "transmission": v.transmission.value,
                "price": float(v.ex_showroom_price) if v.ex_showroom_price is not None else None,
                "mileage": v.mileage,
                "electric_range": v.electric_range,
                "seating": v.seating_capacity,
            }
            for v in m.active_variants
        ],
    }


def find_dealers(db: Session, *, city: Optional[str] = None, manufacturer_id: Optional[int] = None, limit: int = 10) -> List[dict]:
    results, _total = list_dealers(db, DealerFilters(city=city, manufacturer_id=manufacturer_id, page=1, page_size=limit))
    return [
        {
            "dealer_id": d.id,
            "name": d.dealer_name,
            "city": d.city,
            "verified": d.verification_status.value == "verified",
        }
        for d, _dist in results
    ]


def get_authorized_quotations(db: Session, user: User, enquiry_id: int) -> List[dict]:
    """Only returns quotations on an enquiry owned by this customer."""
    if user.role != UserRole.CUSTOMER:
        return []
    enquiry = db.get(CustomerEnquiry, enquiry_id)
    if not enquiry or enquiry.customer_id != user.id:
        return []
    quotations = (
        db.query(Quotation)
        .join(EnquiryDealer, Quotation.enquiry_dealer_id == EnquiryDealer.id)
        .filter(EnquiryDealer.enquiry_id == enquiry_id)
        .filter(Quotation.status != QuotationStatus.DRAFT)
        .all()
    )
    return [
        {
            "quotation_id": q.id,
            "dealer": q.dealer.dealer_name if q.dealer else None,
            "final_price": float(q.final_price),
            "ex_showroom_price": float(q.ex_showroom_price),
            "discount": float(q.discount_amount),
            "validity_date": q.validity_date.isoformat() if q.validity_date else None,
            "status": q.status.value,
        }
        for q in quotations
    ]


def get_customer_enquiry_status(db: Session, user: User, enquiry_id: int) -> Optional[dict]:
    if user.role != UserRole.CUSTOMER:
        return None
    enquiry = db.get(CustomerEnquiry, enquiry_id)
    if not enquiry or enquiry.customer_id != user.id:
        return None
    return {
        "enquiry_id": enquiry.id,
        "status": enquiry.status.value,
        "dealers_contacted": len(enquiry.dealer_links),
        "quotations_received": sum(1 for link in enquiry.dealer_links if link.quotation),
    }


def get_vehicle_variants(db: Session, vehicle_id: int) -> List[dict]:
    """All active variants of a model (empty list for unknown/invalid id)."""
    details = get_vehicle_details(db, vehicle_id)
    return details["variants"] if details else []


def compare_vehicles(db: Session, vehicle_ids: List[int]) -> List[dict]:
    """Side-by-side details for up to 4 vehicles. Skips unknown ids."""
    out = []
    for vid in list(dict.fromkeys(vehicle_ids))[:4]:
        details = get_vehicle_details(db, vid)
        if details:
            out.append(details)
    return out


def search_dealers(
    db: Session,
    *,
    city: Optional[str] = None,
    manufacturer_name: Optional[str] = None,
    limit: int = 10,
) -> List[dict]:
    """Dealer search by city and/or manufacturer name (resolved to id)."""
    from app.models import Manufacturer

    manufacturer_id = None
    if manufacturer_name:
        m = (
            db.query(Manufacturer)
            .filter(Manufacturer.name.ilike(f"%{manufacturer_name.strip()}%"))
            .first()
        )
        manufacturer_id = m.id if m else -1  # -1 guarantees empty result if unmatched
    results, _total = list_dealers(
        db,
        DealerFilters(city=city, manufacturer_id=manufacturer_id, page=1, page_size=min(max(limit, 1), 20)),
    )
    return [
        {
            "dealer_id": d.id,
            "name": d.dealer_name,
            "city": d.city,
            "state": d.state,
            "verified": d.verification_status.value == "verified",
            "manufacturers": [dm.manufacturer.name for dm in d.manufacturers if dm.manufacturer],
        }
        for d, _dist in results
    ]


def get_dealer_details(db: Session, dealer_id: int) -> Optional[dict]:
    d = db.get(Dealer, dealer_id)
    if not d:
        return None
    return {
        "dealer_id": d.id,
        "name": d.dealer_name,
        "address": d.address,
        "city": d.city,
        "state": d.state,
        "verified": d.verification_status.value == "verified",
        "contact_email": d.contact_email,
        "contact_phone": d.contact_phone,
        "manufacturers": [dm.manufacturer.name for dm in d.manufacturers if dm.manufacturer],
    }


def compare_quotations(db: Session, user: User, enquiry_id: int) -> List[dict]:
    """Authorized quotation comparison with lowest-price annotation.

    Ownership enforced: only the customer who owns the enquiry sees quotations.
    """
    if user.role != UserRole.CUSTOMER:
        return []
    enquiry = db.get(CustomerEnquiry, enquiry_id)
    if not enquiry or enquiry.customer_id != user.id:
        return []
    quotations = (
        db.query(Quotation)
        .join(EnquiryDealer, Quotation.enquiry_dealer_id == EnquiryDealer.id)
        .filter(EnquiryDealer.enquiry_id == enquiry_id)
        .filter(Quotation.status != QuotationStatus.DRAFT)
        .all()
    )
    annotated = qsvc.annotate_comparison(quotations)
    return [
        {
            "quotation_id": q.id,
            "dealer": q.dealer.dealer_name if q.dealer else None,
            "ex_showroom_price": float(q.ex_showroom_price),
            "registration_charges": float(q.registration_charges),
            "insurance_amount": float(q.insurance_amount),
            "accessories_amount": float(q.accessories_amount),
            "discount_amount": float(q.discount_amount),
            "other_charges": float(q.other_charges),
            "final_price": float(q.final_price),
            "validity_date": q.validity_date.isoformat() if q.validity_date else None,
            "status": q.status.value,
            "is_lowest": low,
            "value_score": score,
        }
        for q, low, score in annotated
    ]


def list_customer_quotations(
    db: Session, user: User, model_query: Optional[str] = None
) -> List[dict]:
    """List the authenticated customer's quotations, optionally filtered by car model.

    Ownership enforced: only quotations on enquiries owned by this customer are
    returned. Each row carries its car model so the caller can group results per
    car. The lowest valid final price within each model group is flagged. This
    lets the assistant answer "what quotations do I have" and "compare quotations
    for my <car>" using a car name instead of an opaque enquiry/quotation number.
    """
    if user.role != UserRole.CUSTOMER:
        return []
    q = (
        db.query(Quotation)
        .join(EnquiryDealer, Quotation.enquiry_dealer_id == EnquiryDealer.id)
        .join(CustomerEnquiry, EnquiryDealer.enquiry_id == CustomerEnquiry.id)
        .join(VehicleVariant, Quotation.vehicle_variant_id == VehicleVariant.id)
        .join(VehicleModel, VehicleVariant.vehicle_model_id == VehicleModel.id)
        .join(Manufacturer, VehicleModel.manufacturer_id == Manufacturer.id)
        .filter(CustomerEnquiry.customer_id == user.id)
        .filter(Quotation.status != QuotationStatus.DRAFT)
    )
    if model_query and model_query.strip():
        like = f"%{model_query.strip().lower()}%"
        q = q.filter(
            func.lower(Manufacturer.name + " " + VehicleModel.model_name).like(like)
            | func.lower(VehicleModel.model_name).like(like)
        )
    quotations = q.all()

    rows: List[dict] = []
    for qt in quotations:
        model = qt.variant.model if qt.variant else None
        mfr = model.manufacturer.name if model and model.manufacturer else ""
        model_label = f"{mfr} {model.model_name}".strip() if model else "Unknown model"
        rows.append(
            {
                "quotation_id": qt.id,
                "enquiry_id": qt.enquiry_dealer.enquiry_id if qt.enquiry_dealer else None,
                "model": model_label,
                "model_id": model.id if model else None,
                "dealer": qt.dealer.dealer_name if qt.dealer else None,
                "final_price": float(qt.final_price),
                "special_offer": qt.special_offer,
                "status": qt.status.value,
            }
        )

    # Flag the lowest final price within each car-model group.
    lowest_by_model: dict[int, float] = {}
    for r in rows:
        mid = r["model_id"]
        if mid is None:
            continue
        if mid not in lowest_by_model or r["final_price"] < lowest_by_model[mid]:
            lowest_by_model[mid] = r["final_price"]
    for r in rows:
        r["is_lowest"] = r["model_id"] is not None and r["final_price"] == lowest_by_model.get(r["model_id"])

    rows.sort(key=lambda r: (r["model"], r["final_price"]))
    return rows


# Indicative default energy prices (clearly-labelled assumptions, NOT live market
# data). Running cost is only computed when a distance is supplied; callers may
# override these with user-provided figures.
_DEFAULT_ASSUMPTIONS = {
    "petrol_price_per_litre": 105.0,
    "diesel_price_per_litre": 92.0,
    "cng_price_per_kg": 80.0,
    "electricity_price_per_kwh": 9.0,
}


def calculate_running_cost(
    *,
    fuel_type: str,
    monthly_distance_km: Optional[float] = None,
    mileage_kmpl: Optional[float] = None,
    electric_wh_per_km: Optional[float] = None,
    energy_price: Optional[float] = None,
) -> dict:
    """Deterministic monthly running-cost estimate.

    Returns an explicit 'insufficient_inputs' result (asking for the missing
    figure) rather than inventing values. Never fabricates live fuel prices;
    uses clearly-labelled indicative assumptions unless the caller overrides.
    """
    if not monthly_distance_km or monthly_distance_km <= 0:
        return {
            "status": "insufficient_inputs",
            "needs": "monthly_distance_km",
            "message": "Tell me your approximate monthly driving distance (km) to estimate running cost.",
        }
    ft = (fuel_type or "").lower()
    assumptions = {"monthly_distance_km": monthly_distance_km}
    if ft == "electric":
        wh = electric_wh_per_km or 150.0
        price = energy_price or _DEFAULT_ASSUMPTIONS["electricity_price_per_kwh"]
        kwh = monthly_distance_km * wh / 1000.0
        cost = kwh * price
        assumptions.update({"wh_per_km": wh, "electricity_price_per_kwh": price})
    else:
        if not mileage_kmpl or mileage_kmpl <= 0:
            return {
                "status": "insufficient_inputs",
                "needs": "mileage_kmpl",
                "message": "I need the vehicle's mileage (km per litre/kg) to estimate fuel cost.",
            }
        key = {
            "diesel": "diesel_price_per_litre",
            "cng": "cng_price_per_kg",
        }.get(ft, "petrol_price_per_litre")
        price = energy_price or _DEFAULT_ASSUMPTIONS[key]
        cost = monthly_distance_km / mileage_kmpl * price
        assumptions.update({"mileage": mileage_kmpl, "energy_price": price})
    return {
        "status": "ok",
        "estimated_monthly_cost": round(cost, 2),
        "currency": "INR",
        "is_estimate": True,
        "assumptions": assumptions,
        "disclaimer": "Indicative estimate using sample energy prices; actual costs vary by city, driving style and current rates.",
    }


def create_vehicle_enquiry(
    db: Session,
    user: User,
    *,
    vehicle_variant_id: int,
    dealer_ids: List[int],
    location: Optional[str] = None,
    message: Optional[str] = None,
    confirm: bool = False,
) -> dict:
    """Side-effecting: creates an enquiry and fans it out to dealers.

    Requires an authenticated customer and explicit confirm=True. Returns the
    real backend result; never claims success without committing.
    """
    if user.role != UserRole.CUSTOMER:
        return {"status": "forbidden", "message": "Only customers can create enquiries."}
    variant = db.get(VehicleVariant, vehicle_variant_id)
    if not variant:
        return {"status": "invalid", "message": "Vehicle variant not found."}
    valid_dealer_ids = [d.id for d in db.query(Dealer).filter(Dealer.id.in_(dealer_ids or [])).all()]
    # Enforce single-brand showrooms: only dealers that sell this car's brand.
    mfr_id = variant.model.manufacturer_id if variant.model else None
    if mfr_id is not None and valid_dealer_ids:
        from app.models import DealerManufacturer

        brand_dealer_ids = {
            link.dealer_id
            for link in db.query(DealerManufacturer)
            .filter(
                DealerManufacturer.manufacturer_id == mfr_id,
                DealerManufacturer.dealer_id.in_(valid_dealer_ids),
            )
            .all()
        }
        valid_dealer_ids = [d for d in valid_dealer_ids if d in brand_dealer_ids]
    if not valid_dealer_ids:
        return {"status": "invalid", "message": "No valid dealers selected for this car's brand."}
    if not confirm:
        return {
            "status": "confirmation_required",
            "message": "Please confirm you want to send this enquiry.",
            "preview": {
                "vehicle_variant_id": vehicle_variant_id,
                "dealer_ids": valid_dealer_ids,
                "location": location,
            },
        }
    enquiry = CustomerEnquiry(
        customer_id=user.id,
        vehicle_variant_id=vehicle_variant_id,
        location=location,
        message=message,
        status=EnquiryStatus.REQUESTED,
    )
    db.add(enquiry)
    db.flush()
    created = 0
    for did in valid_dealer_ids:
        db.add(EnquiryDealer(enquiry_id=enquiry.id, dealer_id=did, response_status="sent"))
        created += 1
    if created:
        enquiry.status = EnquiryStatus.SENT_TO_DEALER
    db.add(
        CustomerActivity(
            customer_id=user.id,
            enquiry_id=enquiry.id,
            activity_type="enquiry_submitted",
            description=f"Enquiry #{enquiry.id} submitted via AI assistant",
        )
    )
    db.commit()
    db.refresh(enquiry)
    notify.enquiry_confirmation(user.email, enquiry.id, None)
    return {
        "status": "created",
        "enquiry_id": enquiry.id,
        "dealers_contacted": created,
        "message": f"Enquiry #{enquiry.id} sent to {created} dealer(s).",
    }
