"""End-to-end multi-customer / multi-dealer scenario against the real API.

Runs entirely in-process via FastAPI TestClient on the seeded dev database.
Exercises: logins, enquiry fan-out, per-dealer isolation, quotation submission,
customer quote comparison, and the role-aware AI chat endpoints (authz + scope).

Run: python -m scripts.scenario_multi_user
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

PWD = "Password123"
PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"

results: list[bool] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    results.append(ok)
    print(f"  [{PASS if ok else FAIL}] {label}" + (f" -> {detail}" if detail else ""))


def login(c: TestClient, email: str) -> dict:
    r = c.post("/api/auth/login", json={"email": email, "password": PWD})
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def find_variant(c: TestClient, mfr_slug: str) -> int:
    """Return a variant id of the first model for a manufacturer (via public catalogue)."""
    r = c.get("/api/cars", params={"manufacturer_slug": mfr_slug, "page_size": 5})
    items = r.json()["items"]
    detail = c.get(f"/api/cars/{items[0]['id']}").json()
    return detail["variants"][0]["id"]


def main() -> None:
    with TestClient(app) as c:
        print("\n== 1. Logins (3 customers, 3 dealers, 1 admin) ==")
        cust = {e: login(c, e) for e in ["customer@driveedge.in", "priya@driveedge.in", "rohan@driveedge.in"]}
        deal = {e: login(c, e) for e in ["dealer@driveedge.in", "dealer2@driveedge.in", "dealer3@driveedge.in"]}
        admin_h = login(c, "admin@driveedge.in")
        check("all 7 demo accounts log in", True)

        # Each dealer resolves to their own dealership.
        print("\n== 2. Dealer identity isolation ==")
        dmap = {}
        for e, h in deal.items():
            prof = c.get("/api/dealer/profile", headers=h)
            check(f"{e} has a dealership", prof.status_code == 200, prof.json().get("dealer_name"))
            dmap[e] = prof.json()

        print("\n== 3. Customer enquiries (fan-out to specific dealers) ==")
        # Priya enquires about a Hyundai to the two Mumbai/Delhi dealers.
        hyundai_variant = find_variant(c, "hyundai")
        d2_id = dmap["dealer2@driveedge.in"]["id"]
        d3_id = dmap["dealer3@driveedge.in"]["id"]
        d1_id = dmap["dealer@driveedge.in"]["id"]
        r = c.post(
            "/api/enquiries",
            headers=cust["priya@driveedge.in"],
            json={"vehicle_variant_id": hyundai_variant, "location": "Mumbai",
                  "message": "Best on-road price please", "dealer_ids": [d2_id, d3_id]},
        )
        check("Priya creates enquiry to dealer2 + dealer3", r.status_code in (200, 201), str(r.status_code))
        priya_enq = r.json()["id"]

        # Rohan enquires about a Tata to the Pune dealer only.
        tata_variant = find_variant(c, "tata")
        r = c.post(
            "/api/enquiries",
            headers=cust["rohan@driveedge.in"],
            json={"vehicle_variant_id": tata_variant, "location": "Pune",
                  "message": "Exchange offer?", "dealer_ids": [d1_id]},
        )
        check("Rohan creates enquiry to dealer1 only", r.status_code in (200, 201), str(r.status_code))

        print("\n== 4. Dealers see ONLY their own assigned enquiries ==")
        e2 = c.get("/api/dealer/enquiries", headers=deal["dealer2@driveedge.in"]).json()
        e3 = c.get("/api/dealer/enquiries", headers=deal["dealer3@driveedge.in"]).json()
        e1 = c.get("/api/dealer/enquiries", headers=deal["dealer@driveedge.in"]).json()
        e2_ids = {x["enquiry_id"] if "enquiry_id" in x else x.get("id") for x in e2}
        e1_ids = {x["enquiry_id"] if "enquiry_id" in x else x.get("id") for x in e1}
        check("dealer2 sees Priya's enquiry", priya_enq in e2_ids)
        check("dealer3 sees Priya's enquiry", priya_enq in {x.get("enquiry_id", x.get("id")) for x in e3})
        check("dealer1 (Pune) does NOT see Priya's enquiry", priya_enq not in e1_ids)

        print("\n== 5. Quotation submission + customer comparison ==")
        # dealer2 and dealer3 each quote Priya's enquiry.
        def dealer_link_for(dealer_h, enquiry_id):
            rows = c.get("/api/dealer/enquiries", headers=dealer_h).json()
            for x in rows:
                if x.get("enquiry_id", x.get("id")) == enquiry_id:
                    return x.get("enquiry_dealer_id") or x.get("id")
            return None

        # dealer2 discount 10k (final 1,130,000); dealer3 discount 40k (final 1,100,000 = lowest).
        for e, disc in [("dealer2@driveedge.in", 10000), ("dealer3@driveedge.in", 40000)]:
            link_id = dealer_link_for(deal[e], priya_enq)
            r = c.post(
                "/api/dealer/quotations",
                headers=deal[e],
                json={"enquiry_dealer_id": link_id, "vehicle_variant_id": hyundai_variant,
                      "ex_showroom_price": 1000000, "registration_charges": 80000,
                      "insurance_amount": 40000, "accessories_amount": 20000,
                      "discount_amount": disc, "other_charges": 0, "submit": True},
            )
            ok = r.status_code in (200, 201)
            check(f"{e} submits quotation (discount {disc})", ok,
                  f"final={r.json().get('final_price') if ok else r.text}")

        comp = c.post("/api/quotations/compare", headers=cust["priya@driveedge.in"],
                      params={"enquiry_id": priya_enq})
        if comp.status_code == 200:
            quotes = comp.json()
            lowest = next((q for q in quotes if q.get("is_lowest")), None)
            check("Priya sees 2 quotes with a lowest flagged", len(quotes) >= 2 and lowest is not None,
                  f"lowest final={lowest['final_price'] if lowest else None}")
        else:
            check("Priya can compare her quotes", False, str(comp.status_code))

        # Rohan must NOT be able to read Priya's quotes (gets nothing / rejected).
        intruder = c.post("/api/quotations/compare", headers=cust["rohan@driveedge.in"],
                          params={"enquiry_id": priya_enq})
        check("Rohan CANNOT read Priya's enquiry quotes", intruder.status_code in (400, 403, 404),
              str(intruder.status_code))

        print("\n== 6. Role-aware AI chat: authz + scope ==")
        # Customer cannot hit dealer/admin chat; dealer cannot hit admin chat.
        r = c.post("/api/ai/dealer-chat", headers=cust["priya@driveedge.in"], json={"message": "hi"})
        check("customer -> /dealer-chat is 403", r.status_code == 403, str(r.status_code))
        r = c.post("/api/ai/admin-chat", headers=deal["dealer2@driveedge.in"], json={"message": "hi"})
        check("dealer -> /admin-chat is 403", r.status_code == 403, str(r.status_code))

        # dealer2 asks about pending enquiries -> sees its own only.
        r = c.post("/api/ai/dealer-chat", headers=deal["dealer2@driveedge.in"],
                   json={"message": "show my pending enquiries"})
        ok = r.status_code == 200 and r.json()["intent"] == "enquiries"
        check("dealer2 dealer-chat enquiries intent", ok, r.json().get("intent"))

        # dealer2 pricing help for Hyundai: sees its own quote stats, never competitors'.
        r = c.post("/api/ai/dealer-chat", headers=deal["dealer2@driveedge.in"],
                   json={"message": "what price should I offer on the hyundai creta?"})
        check("dealer2 dealer-chat pricing intent", r.status_code == 200 and r.json()["intent"] == "pricing_help",
              r.json().get("intent"))

        # admin chat aggregate lookup.
        r = c.post("/api/ai/admin-chat", headers=admin_h, json={"message": "how many dealers are there?"})
        check("admin admin-chat returns aggregate answer", r.status_code == 200 and "dealer" in r.json()["message"].lower(),
              r.json().get("intent"))

    total, passed = len(results), sum(results)
    print(f"\n==== SCENARIO RESULT: {passed}/{total} checks passed ====")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
