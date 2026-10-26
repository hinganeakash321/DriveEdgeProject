"""Bulk demo data: many customers, dealers, enquiries and quotations.

Generates a realistic marketplace so that BOTH the customer and dealer
dashboards have meaningful content out of the box:
  * 40 additional customers (+ the 3 named demo customers)
  * extra dealerships so there are 20+ in total
  * enquiries fanned out to the dealers that sell the relevant brand
  * quotations with varied statuses (submitted / preferred / accepted / draft)
  * customer activity rows for the customer dashboard timeline

The routine is deterministic (fixed RNG seed) and idempotent: it is a no-op once
the marketplace has already been populated, so re-seeding never duplicates data.

All amounts are indicative sample data. No real customer PII is used.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.core.security import hash_password
from app.models import (
    CustomerActivity,
    CustomerEnquiry,
    Dealer,
    DealerManufacturer,
    EnquiryDealer,
    Manufacturer,
    Quotation,
    User,
    VehicleVariant,
)
from app.models.enums import (
    AccountStatus,
    EnquiryStatus,
    QuotationStatus,
    UserRole,
    VerificationStatus,
)
from app.services import quotation_service as qsvc

RNG = random.Random(20261024)

_FIRST = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
    "Ishaan", "Rudra", "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Myra",
    "Anika", "Navya", "Kiara", "Riya", "Kabir", "Dhruv", "Kian", "Aryan",
    "Neha", "Pooja", "Sneha", "Megha", "Isha", "Tara", "Nisha", "Aisha",
    "Rohit", "Karan", "Varun", "Nikhil", "Rahul", "Sameer", "Yash", "Manish",
    "Deepak", "Suresh", "Ramesh", "Anil", "Sunil", "Vikas", "Ajay", "Gaurav",
]
_LAST = [
    "Sharma", "Verma", "Patel", "Reddy", "Nair", "Mehta", "Iyer", "Gupta",
    "Singh", "Rao", "Kapoor", "Joshi", "Kulkarni", "Desai", "Pillai", "Banerjee",
    "Chowdhury", "Malhotra", "Agarwal", "Bhat", "Menon", "Shetty", "Chauhan", "Das",
]
_CITIES = [
    ("Pune", "Maharashtra", 18.5204, 73.8567), ("Mumbai", "Maharashtra", 19.0760, 72.8777),
    ("New Delhi", "Delhi", 28.6139, 77.2090), ("Bengaluru", "Karnataka", 12.9716, 77.5946),
    ("Hyderabad", "Telangana", 17.3850, 78.4867), ("Chennai", "Tamil Nadu", 13.0827, 80.2707),
    ("Ahmedabad", "Gujarat", 23.0225, 72.5714), ("Jaipur", "Rajasthan", 26.9124, 75.7873),
    ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462), ("Kolkata", "West Bengal", 22.5726, 88.3639),
    ("Surat", "Gujarat", 21.1702, 72.8311), ("Nagpur", "Maharashtra", 21.1458, 79.0882),
    ("Indore", "Madhya Pradesh", 22.7196, 75.8577), ("Bhopal", "Madhya Pradesh", 23.2599, 77.4126),
    ("Coimbatore", "Tamil Nadu", 11.0168, 76.9558), ("Kochi", "Kerala", 9.9312, 76.2673),
    ("Chandigarh", "Chandigarh", 30.7333, 76.7794), ("Vadodara", "Gujarat", 22.3072, 73.1812),
]
# Brands used to generate extra single-brand dealerships (round-robin), so every
# brand ends up with multiple competing showrooms for the brand-scoped fan-out.
_EXTRA_DEALER_BRANDS = [
    "tata", "maruti-suzuki", "hyundai", "mahindra", "kia", "toyota", "honda",
    "mg-motor", "skoda", "volkswagen", "renault", "nissan", "byd",
    "bmw", "audi", "mercedes-benz",
]
# Showroom suffixes/localities used to build professional, human-readable
# dealership names (e.g. "Tata Motors Nexa Baner, Pune") instead of a bare index.
_DEALER_SUFFIXES = [
    "Motors", "Auto", "Wheels", "Cars", "Central", "Premier", "Galaxy", "Elite",
    "Hub", "Drive", "Crown", "Prime", "Imperial", "Pinnacle", "Signature", "Grand",
]

_MESSAGES = [
    "Please share your best on-road price.",
    "Looking for an exchange offer on my old car.",
    "What is the earliest delivery timeline?",
    "Any festive discount available this month?",
    "Need finance options and EMI details.",
    "Corporate discount applicable?",
    "Please include accessories in the quote.",
    "Interested in a test drive this weekend.",
]
_DELIVERY = ["2-3 weeks", "4-6 weeks", "Ready stock", "6-8 weeks", "Within a month"]
_OFFERS = [
    "Free 3-year service package",
    "Complimentary ceramic coating + floor mats",
    "₹20,000 corporate / exchange bonus",
    "Free extended warranty (2 years)",
    "Zero-cost first-year insurance",
    "Festive cashback + free accessories kit",
    "Loyalty bonus for existing customers",
    "Free fast-charger installation",
]


def _now_minus(days: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days, hours=RNG.uniform(0, 23))


def _unique_name() -> str:
    return f"{RNG.choice(_FIRST)} {RNG.choice(_LAST)}"


def seed_bulk_customers(db, n: int = 40) -> list[User]:
    """Create n demo customers (demo.custNN@driveedge.in). Idempotent by email."""
    out: list[User] = []
    for i in range(1, n + 1):
        email = f"demo.cust{i:02d}@driveedge.in"
        u = db.query(User).filter(User.email == email).first()
        if not u:
            city = RNG.choice(_CITIES)
            u = User(
                name=_unique_name(),
                email=email,
                phone=f"+91 9{RNG.randint(100000000, 999999999)}",
                password_hash=hash_password("Password123"),
                role=UserRole.CUSTOMER,
                status=AccountStatus.ACTIVE,
            )
            u._seed_city = city  # type: ignore[attr-defined]
            db.add(u)
            db.flush()
        out.append(u)
    return out


def seed_extra_dealers(db, mfr_by_slug, target_total: int = 31) -> None:
    """Top up dealerships to at least `target_total` so Find Dealers / fan-out
    have plenty to work with. Each generated dealership sells exactly ONE brand
    (assigned round-robin so every brand gets multiple competing showrooms) and
    is named after that brand. Generated dealerships are verified and ownerless."""
    existing = db.query(Dealer).count()
    idx = 0
    created = 0
    while db.query(Dealer).count() < target_total:
        slug = _EXTRA_DEALER_BRANDS[created % len(_EXTRA_DEALER_BRANDS)]
        mfr = mfr_by_slug.get(slug)
        if mfr is None:
            created += 1
            continue
        city, state, lat, lng = _CITIES[(existing + idx) % len(_CITIES)]
        suffix = _DEALER_SUFFIXES[(existing + idx) % len(_DEALER_SUFFIXES)]
        # Professional, readable name: "<Brand> <Suffix>, <City>". Fall back to an
        # appended index only if that exact combination is already taken, so names
        # stay unique without exposing a bare counter in the common case.
        name = f"{mfr.name} {suffix}, {city}"
        if db.query(Dealer).filter(Dealer.dealer_name == name).first():
            name = f"{mfr.name} {suffix} {existing + idx + 1}, {city}"
        if db.query(Dealer).filter(Dealer.dealer_name == name).first():
            idx += 1
            continue
        dealer = Dealer(
            owner_user_id=None,
            dealer_name=name,
            address=f"{mfr.name} {suffix}, {city}, {state}",
            city=city,
            state=state,
            latitude=lat + RNG.uniform(-0.05, 0.05),
            longitude=lng + RNG.uniform(-0.05, 0.05),
            verification_status=VerificationStatus.VERIFIED,
            contact_email=f"{city.lower().replace(' ', '')}{existing + idx}@driveedge.in",
            contact_phone="+91 20 0000 0000",
        )
        db.add(dealer)
        db.flush()
        db.add(DealerManufacturer(dealer_id=dealer.id, manufacturer_id=mfr.id))
        created += 1
        idx += 1


def _dealers_by_manufacturer(db) -> dict[int, list[int]]:
    mapping: dict[int, list[int]] = {}
    for link in db.query(DealerManufacturer).all():
        mapping.setdefault(link.manufacturer_id, []).append(link.dealer_id)
    return mapping


def _make_quotation(db, link: EnquiryDealer, variant: VehicleVariant, when: datetime,
                    status: QuotationStatus) -> Quotation:
    base = Decimal(str(variant.ex_showroom_price or 800000))
    reg = (base * Decimal("0.10")).quantize(Decimal("1"))
    ins = (base * Decimal("0.04")).quantize(Decimal("1"))
    acc = Decimal(RNG.choice([0, 10000, 15000, 20000, 25000, 30000]))
    disc = Decimal(RNG.choice([0, 10000, 20000, 25000, 35000, 50000]))
    q = Quotation(
        enquiry_dealer_id=link.id,
        dealer_id=link.dealer_id,
        vehicle_variant_id=variant.id,
        ex_showroom_price=base,
        registration_charges=reg,
        insurance_amount=ins,
        accessories_amount=acc,
        discount_amount=disc,
        other_charges=Decimal(0),
        estimated_delivery=RNG.choice(_DELIVERY),
        validity_date=(when + timedelta(days=14)).date(),
        status=status,
        notes=None,
        special_offer=RNG.choice(_OFFERS) if RNG.random() < 0.45 else None,
        created_at=when,
    )
    qsvc.recompute(q)
    db.add(q)
    db.flush()
    return q


def seed_marketplace(db, customers: list[User], mfr_by_slug) -> None:
    """Create enquiries + quotations across customers and dealers.

    No-op once the marketplace is already populated (idempotent)."""
    if db.query(CustomerEnquiry).count() >= 60:
        return

    variants = (
        db.query(VehicleVariant)
        .filter(VehicleVariant.active.is_(True))
        .all()
    )
    if not variants:
        return
    mfr_name_by_id = {m.id: m.slug for m in db.query(Manufacturer).all()}
    # variant_id -> manufacturer_id
    var_mfr: dict[int, int] = {}
    for v in variants:
        if v.model and v.model.manufacturer_id:
            var_mfr[v.id] = v.model.manufacturer_id
    sellable = [v for v in variants if v.id in var_mfr]
    dealers_by_mfr = _dealers_by_manufacturer(db)
    all_dealer_ids = [d.id for d in db.query(Dealer).all()]

    for cust in customers:
        n_enq = RNG.randint(1, 3)
        for _ in range(n_enq):
            variant = RNG.choice(sellable)
            mfr_id = var_mfr[variant.id]
            candidates = dealers_by_mfr.get(mfr_id) or all_dealer_ids
            k = min(len(candidates), RNG.randint(2, 4))
            dealer_ids = RNG.sample(candidates, k=k)
            city = getattr(cust, "_seed_city", None)
            location = city[0] if isinstance(city, tuple) else RNG.choice(_CITIES)[0]
            created = _now_minus(RNG.uniform(1, 40))
            enquiry = CustomerEnquiry(
                customer_id=cust.id,
                vehicle_variant_id=variant.id,
                location=location,
                message=RNG.choice(_MESSAGES),
                status=EnquiryStatus.SENT_TO_DEALER,
                created_at=created,
            )
            db.add(enquiry)
            db.flush()
            db.add(CustomerActivity(
                customer_id=cust.id, enquiry_id=enquiry.id,
                activity_type="enquiry_submitted",
                description=f"Enquiry #{enquiry.id} submitted",
            ))

            any_pref = False
            n_quoted = 0
            for did in dealer_ids:
                sent = created + timedelta(hours=RNG.uniform(1, 12))
                link = EnquiryDealer(
                    enquiry_id=enquiry.id, dealer_id=did,
                    response_status="sent", sent_at=sent,
                )
                db.add(link)
                db.flush()
                roll = RNG.random()
                if roll < 0.68:  # dealer responded with a quotation
                    when = sent + timedelta(hours=RNG.uniform(2, 48))
                    status = QuotationStatus.SUBMITTED
                    # Occasionally the customer has preferred / accepted one.
                    if not any_pref and RNG.random() < 0.22:
                        status = RNG.choice([QuotationStatus.PREFERRED, QuotationStatus.ACCEPTED])
                        any_pref = True
                    q = _make_quotation(db, link, variant, when, status)
                    link.response_status = "responded"
                    link.viewed_at = sent + timedelta(hours=1)
                    link.responded_at = when
                    n_quoted += 1
                    db.add(CustomerActivity(
                        customer_id=cust.id, enquiry_id=enquiry.id, quotation_id=q.id,
                        activity_type="quotation_received",
                        description="A dealer submitted a quotation",
                    ))
                elif roll < 0.85:  # viewed but not yet responded
                    link.response_status = "viewed"
                    link.viewed_at = sent + timedelta(hours=RNG.uniform(1, 10))

            if n_quoted:
                enquiry.status = (
                    EnquiryStatus.PREFERRED if any_pref else EnquiryStatus.QUOTATION_SUBMITTED
                )
