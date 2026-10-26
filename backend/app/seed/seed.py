"""Idempotent database seeding for DriveEdge.

Creates sample users (customer/dealer/admin), the sample catalogue, and dealers.
Run: python -m app.seed.seed
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from app.core.db import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    CustomerEnquiry,
    Dealer,
    DealerManufacturer,
    Manufacturer,
    Quotation,
    User,
    VehicleModel,
    VehicleVariant,
)
from app.models.enums import (
    AccountStatus,
    FuelType,
    Transmission,
    UserRole,
    VerificationStatus,
)
from app.seed.catalogue_data import (
    DEALERS,
    MANUFACTURERS,
    MODELS,
    MODEL_IMAGE_URLS,
    OEM_LOCAL_IMAGES,
)
from app.seed.demo_data import (
    seed_bulk_customers,
    seed_extra_dealers,
    seed_marketplace,
)


def _resolve_image(md: dict) -> str | None:
    """Prefer a locally-downloaded official manufacturer image, then any explicit
    image_url, then the Wikimedia fallback."""
    return (
        OEM_LOCAL_IMAGES.get(md["slug"])
        or md.get("image_url")
        or MODEL_IMAGE_URLS.get(md["slug"])
    )

SOURCE = "Sample data (public manufacturer info) - verify before purchase"


def seed_users(db):
    # 3 demo customers, 3 demo dealer owners, 1 admin (password: Password123).
    users = [
        ("Aarav Sharma", "customer@driveedge.in", UserRole.CUSTOMER, AccountStatus.ACTIVE),
        ("Priya Nair", "priya@driveedge.in", UserRole.CUSTOMER, AccountStatus.ACTIVE),
        ("Rohan Mehta", "rohan@driveedge.in", UserRole.CUSTOMER, AccountStatus.ACTIVE),
        ("Dealer Admin", "dealer@driveedge.in", UserRole.DEALER, AccountStatus.ACTIVE),
        ("Vikram Singh", "dealer2@driveedge.in", UserRole.DEALER, AccountStatus.ACTIVE),
        ("Neha Kapoor", "dealer3@driveedge.in", UserRole.DEALER, AccountStatus.ACTIVE),
        ("Platform Admin", "admin@driveedge.in", UserRole.ADMIN, AccountStatus.ACTIVE),
    ]
    customers: list[User] = []
    dealers: list[User] = []
    admin: User | None = None
    for name, email, role, status in users:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                name=name,
                email=email,
                phone="+91 90000 00000",
                password_hash=hash_password("Password123"),
                role=role,
                status=status,
            )
            db.add(u)
            db.flush()
        if role == UserRole.CUSTOMER:
            customers.append(u)
        elif role == UserRole.DEALER:
            dealers.append(u)
        else:
            admin = u
    return {"customers": customers, "dealers": dealers, "admin": admin}


def seed_manufacturers(db):
    by_slug = {}
    for name, slug, country, logo in MANUFACTURERS:
        m = db.query(Manufacturer).filter(Manufacturer.slug == slug).first()
        if not m:
            m = Manufacturer(name=name, slug=slug, country=country, logo_url=logo, active=True)
            db.add(m)
            db.flush()
        by_slug[slug] = m
    return by_slug


def seed_models(db, mfr_by_slug):
    now = datetime.now(timezone.utc)
    for md in MODELS:
        image_url = _resolve_image(md)
        existing = db.query(VehicleModel).filter(VehicleModel.slug == md["slug"]).first()
        if existing:
            # Refresh the image on re-seed so newly-downloaded OEM images apply
            # without recreating the database.
            if image_url and existing.image_url != image_url:
                existing.image_url = image_url
            continue
        gallery = md.get("gallery")
        model = VehicleModel(
            manufacturer_id=mfr_by_slug[md["mfr"]].id,
            model_name=md["model_name"],
            slug=md["slug"],
            body_type=md["body_type"],
            model_year=md.get("model_year"),
            description=md.get("description"),
            image_url=image_url,
            gallery_urls=json.dumps(gallery) if gallery else None,
            status=md.get("status", "available"),
            active=True,
        )
        db.add(model)
        db.flush()
        for v in md["variants"]:
            db.add(
                VehicleVariant(
                    vehicle_model_id=model.id,
                    variant_name=v["variant_name"],
                    fuel_type=FuelType(v["fuel_type"]),
                    transmission=Transmission(v["transmission"]),
                    ex_showroom_price=v.get("ex_showroom_price"),
                    engine_displacement=v.get("engine_displacement"),
                    power=v.get("power"),
                    torque=v.get("torque"),
                    mileage=v.get("mileage"),
                    electric_range=v.get("electric_range"),
                    battery_capacity=v.get("battery_capacity"),
                    seating_capacity=v.get("seating_capacity"),
                    boot_space=v.get("boot_space"),
                    ground_clearance=v.get("ground_clearance"),
                    safety_features=json.dumps(v.get("safety", [])),
                    comfort_features=json.dumps(v.get("comfort", [])),
                    infotainment_features=json.dumps(v.get("info", [])),
                    specification_source=SOURCE,
                    last_verified_at=now,
                    active=True,
                )
            )


def seed_dealers(db, mfr_by_slug, users):
    # Link the first N dealerships (in order) to the N demo dealer-owner accounts,
    # so each dealer login has a real, verified dealership workspace.
    dealer_owners = users.get("dealers", [])
    for idx, (name, city, state, lat, lng, mfr_slugs, verified) in enumerate(DEALERS):
        existing = db.query(Dealer).filter(Dealer.dealer_name == name).first()
        owner = dealer_owners[idx] if idx < len(dealer_owners) else None
        if existing:
            # Backfill ownership on re-seed if it is missing.
            if owner and existing.owner_user_id is None:
                existing.owner_user_id = owner.id
            continue
        dealer = Dealer(
            owner_user_id=owner.id if owner else None,
            dealer_name=name,
            address=f"{name}, {city}",
            city=city,
            state=state,
            latitude=lat,
            longitude=lng,
            # Owned demo dealerships are always verified so the dealer workspace works.
            verification_status=VerificationStatus.VERIFIED
            if (verified or owner)
            else VerificationStatus.PENDING,
            contact_email=f"{city.lower().replace(' ', '')}@driveedge.in",
            contact_phone="+91 20 0000 0000",
        )
        db.add(dealer)
        db.flush()
        for slug in mfr_slugs:
            if slug in mfr_by_slug:
                db.add(DealerManufacturer(dealer_id=dealer.id, manufacturer_id=mfr_by_slug[slug].id))


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        users = seed_users(db)
        mfr_by_slug = seed_manufacturers(db)
        seed_models(db, mfr_by_slug)
        seed_dealers(db, mfr_by_slug, users)
        db.commit()

        # Bulk demo marketplace (many customers/dealers + enquiries/quotations)
        # so both customer and dealer dashboards have real content.
        bulk_customers = seed_bulk_customers(db, n=40)
        seed_extra_dealers(db, mfr_by_slug, target_total=31)
        db.commit()
        seed_marketplace(db, users["customers"] + bulk_customers, mfr_by_slug)
        db.commit()

        print("Seed complete.")
        print("  Manufacturers:", db.query(Manufacturer).count())
        print("  Models:", db.query(VehicleModel).count())
        print("  Variants:", db.query(VehicleVariant).count())
        print("  Dealers:", db.query(Dealer).count())
        print("  Users:", db.query(User).count())
        print("  Enquiries:", db.query(CustomerEnquiry).count())
        print("  Quotations:", db.query(Quotation).count())
        print("\nLogins (password: Password123):")
        print("  Customers: customer@driveedge.in, priya@driveedge.in, rohan@driveedge.in")
        print("  Dealers:   dealer@driveedge.in, dealer2@driveedge.in, dealer3@driveedge.in")
        print("  Admin:     admin@driveedge.in")
    finally:
        db.close()


if __name__ == "__main__":
    main()
