"""Download official manufacturer (OEM) car images and store them locally.

OEM image CDNs are copyrighted and usually block hotlinking (referer checks,
expired certs, JS-rendered URLs). So instead of hotlinking at runtime we fetch
each model's official image ONCE, server-side (no Referer header), validate it
is a real image, and save it under frontend/public/car-images/<slug>.<ext>.
The app then serves it from its own origin as /car-images/<slug>.<ext>.

For each model we open its official model page (PAGE_SOURCES), collect candidate
image URLs from that manufacturer's own site/CDN, score them to prefer a front
3/4 exterior "hires" studio shot (and reject rear/interior/detail/logo crops),
and download the best valid one. A per-slug DIRECT_SOURCES override can pin an
exact image URL. Successful slugs are written back into catalogue_data.py as
OEM_LOCAL_IMAGES, which the seed prefers over the Wikimedia fallback.

Network note: some OEM domains block or JS-render from certain networks. Any
model that cannot be fetched is simply skipped and keeps its existing image;
re-run this script from a network that can reach those domains to fill them in.

Usage (from backend/, needs network):
    python -m scripts.fetch_oem_images                 # all curated models
    python -m scripts.fetch_oem_images mahindra-thar   # just one/some slugs
"""
from __future__ import annotations

import re
import ssl
import sys
import time
import urllib.request
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

PUBLIC_DIR = BACKEND.parent / "frontend" / "public" / "car-images"
CATALOGUE = BACKEND / "app" / "seed" / "catalogue_data.py"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120 Safari/537.36"
)
_CTX = ssl._create_unverified_context()  # some OEM certs are mis-configured

# Official model pages to scrape an exterior image from (manufacturer sites).
PAGE_SOURCES: dict[str, str] = {
    # ---- Mahindra (auto.mahindra.com - product-catalogue hires studio shots) ----
    "mahindra-thar": "https://auto.mahindra.com/suv/thar",
    "mahindra-scorpio-n": "https://auto.mahindra.com/suv/scorpio-n",
    "mahindra-xuv700": "https://auto.mahindra.com/suv/xuv700",
    "mahindra-xuv-3xo": "https://auto.mahindra.com/suv/xuv-3xo",
    "mahindra-bolero": "https://auto.mahindra.com/suv/bolero",
    "mahindra-thar-roxx": "https://auto.mahindra.com/suv/thar-roxx/TH5D.html",
    "mahindra-scorpio-classic": "https://auto.mahindra.com/suv/scorpio-classic/SCRC.html",
    "mahindra-bolero-neo": "https://auto.mahindra.com/suv/bolero-neo/NEO.html",
    # ---- Tata (cars.tatamotors.com) ----
    "tata-nexon": "https://cars.tatamotors.com/cars/nexon",
    "tata-punch": "https://cars.tatamotors.com/cars/punch",
    "tata-tiago": "https://cars.tatamotors.com/cars/tiago",
    "tata-altroz": "https://cars.tatamotors.com/cars/altroz",
    "tata-harrier": "https://cars.tatamotors.com/cars/harrier",
    "tata-safari": "https://cars.tatamotors.com/cars/safari",
    # ---- Hyundai India (www.hyundai.com/in/en) ----
    "hyundai-creta": "https://www.hyundai.com/in/en/find-a-car/creta/highlights",
    "hyundai-venue": "https://www.hyundai.com/in/en/find-a-car/venue/highlights",
    "hyundai-i20": "https://www.hyundai.com/in/en/find-a-car/i20/highlights",
    "hyundai-verna": "https://www.hyundai.com/in/en/find-a-car/verna/highlights",
    "hyundai-exter": "https://www.hyundai.com/in/en/find-a-car/exter/highlights",
    "hyundai-alcazar": "https://www.hyundai.com/in/en/find-a-car/alcazar/highlights",
    # ---- Kia India (www.kia.com/in) ----
    "kia-seltos": "https://www.kia.com/in/our-vehicles/seltos/showroom.html",
    "kia-sonet": "https://www.kia.com/in/our-vehicles/sonet/showroom.html",
    "kia-carens": "https://www.kia.com/in/our-vehicles/carens/showroom.html",
    "kia-ev6": "https://www.kia.com/in/our-vehicles/ev6/showroom.html",
    # ---- Maruti Suzuki (Arena / Nexa) ----
    "maruti-swift": "https://www.marutisuzuki.com/channels/arena/swift",
    "maruti-dzire": "https://www.marutisuzuki.com/channels/arena/dzire",
    "maruti-brezza": "https://www.marutisuzuki.com/channels/arena/brezza",
    "maruti-ertiga": "https://www.marutisuzuki.com/channels/arena/ertiga",
    "maruti-baleno": "https://www.nexaexperience.com/nexa-cars/baleno/",
    "maruti-fronx": "https://www.nexaexperience.com/nexa-cars/fronx/",
    "maruti-grand-vitara": "https://www.nexaexperience.com/nexa-cars/grand-vitara/",
}

# Pin an exact image URL for a slug (bypasses scraping). These are official
# front 3/4 studio shots (frame-0 of the 360 exterior) from each OEM's own
# reachable asset CDN, latest model-year available.
_TATA = "https://tata.cars/content/dam/tml/pv/products"
_MS = "https://www.marutisuzuki.com/adobe/assets/urn:aaid:aem"
_NEXA = "https://www.nexaexperience.com/adobe/assets/urn:aaid:aem"
DIRECT_SOURCES: dict[str, str] = {
    # Tata - frame-0 of the official 360 exterior (front 3/4, white, latest year).
    "tata-nexon": f"{_TATA}/nexon/year-2025/ice/promoting-vc/360-exterior/new/calgury-white/CalguryWhite-0.png",
    "tata-punch": f"{_TATA}/punch/year-2026/ice/promoting-vc/360-exterior/pristine-white/PrestineWhite-0.png",
    "tata-tiago": f"{_TATA}/tiago/year-2026/ice/promoting-vc/360-exterior/prestine-white/PrestineWhite-0.png",
    "tata-altroz": f"{_TATA}/altroz/year-2025/ice/promoting-vc/360-exterior/prestine-white/PrestineWhite-0.png",
    "tata-harrier": f"{_TATA}/harrier/year-2025/ice/promoting-vc/360-exterior/new/prestine-white/PrestineWhite-0.png",
    "tata-safari": f"{_TATA}/safari/year-2025/ice/promoting-vc/home-page/frost-white/exterior-360/FrostWhite-0.png",
    "tata-curvv": f"{_TATA}/curvv/year-2026/ice/promoting-vc/exterior-360/pristine-white/PristineWhite-0.png",
    "tata-sierra": f"{_TATA}/sierra/year-2025/ice/promoting-vc/360-exterior/prestine-white/PrestineWhite-0.png",
    # Maruti Suzuki - official Adobe AEM studio assets (front 3/4 / clean front).
    "maruti-baleno": f"{_MS}:1769a006-c56e-44a3-8611-5de540b23f58/as/Stunning_New_Baleno_Front-Three_Quarter.jpg?width=2000",
    "maruti-dzire": f"{_MS}:528c5c2b-4d2b-440c-b287-720983416144/as/Dzire_Desktop_Image_Front_02.png?width=2000",
    "maruti-brezza": f"{_MS}:3ac853d2-ce97-45dd-9d8b-49427f42c5ca/as/MS_Brezza_Ang02_final.png?width=2000",
    # Grand Vitara: official NEXA front 3/4 press image (no clean studio shot is
    # exposed statically; this fills an otherwise-empty card with the real car).
    "maruti-grand-vitara": f"{_MS}:d80b712c-e5c1-42c1-948f-b6d0a2be9a9c/as/E178F646F5A24421837A1AFBE3AE368B.jpg",
    "maruti-invicto": f"{_NEXA}:4be11301-09e7-4df0-8f6d-1e43f729e629/as/InvictoFrontTilted-335x185.png",
    "maruti-xl6": f"{_NEXA}:918d528f-4d3f-4612-a6f5-ab893889d689/as/XL6-FrontTilted-335x185.png",
}

_NEG = (
    "rear", "tail", "interior", "wheel", "detail", "seat", "dash", "logo",
    "icon", "thumb", "spin", "360", "library", "banner", "disclaimer", "nav",
)


def _score(url: str) -> int:
    lu = url.lower()
    s = 0
    if "product-catalog" in lu:
        s += 5
    if "hires" in lu:
        s += 4
    if "exterior" in lu or "front" in lu:
        s += 3
    if "1366" in lu or "1920" in lu or "large" in lu:
        s += 1
    for n in _NEG:
        if n in lu:
            s -= 6
    return s


def _get(url: str, tries: int = 3) -> bytes | None:
    last: Exception | None = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,image/*"})
            with urllib.request.urlopen(req, timeout=30, context=_CTX) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.2)
    print(f"      request failed: {repr(last)[:110]}")
    return None


def _ext_for(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _candidates(html: str) -> list[str]:
    urls = re.findall(r'https?://[^\s"\'<>()\\]+?\.(?:jpg|jpeg|png|webp)', html)
    return sorted(dict.fromkeys(urls), key=_score, reverse=True)


def _save(slug: str, data: bytes) -> str | None:
    ext = _ext_for(data)
    if not ext or len(data) < 15000:
        return None
    out = PUBLIC_DIR / f"{slug}.{ext}"
    out.write_bytes(data)
    return f"/car-images/{slug}.{ext}"


def fetch(slugs: list[str]) -> dict[str, str]:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    saved: dict[str, str] = {}
    for slug in slugs:
        print(f"  {slug}")
        # 1) direct override
        if slug in DIRECT_SOURCES:
            data = _get(DIRECT_SOURCES[slug])
            path = _save(slug, data) if data else None
            if path:
                saved[slug] = path
                print(f"      saved (direct) {Path(path).name}")
                continue
        # 2) scrape the model page
        page = PAGE_SOURCES.get(slug)
        if not page:
            print("      no source configured")
            continue
        html_bytes = _get(page)
        if not html_bytes:
            continue
        cands = _candidates(html_bytes.decode("utf-8", "ignore"))
        for url in cands[:12]:
            if _score(url) < 0:
                break
            data = _get(url, tries=1)
            if not data:
                continue
            path = _save(slug, data)
            if path:
                saved[slug] = path
                print(f"      saved {Path(path).name} ({len(data)//1024} KB)")
                break
        else:
            print(f"      no usable image among {len(cands)} candidates")
    return saved


def write_back(mapping: dict[str, str]) -> None:
    """Merge saved slugs into OEM_LOCAL_IMAGES in catalogue_data.py."""
    text = CATALOGUE.read_text()
    existing: dict[str, str] = {}
    m = re.search(r"OEM_LOCAL_IMAGES: dict\[str, str\] = \{(.*?)\}\n", text, flags=re.DOTALL)
    if m:
        for k, v in re.findall(r'"([^"]+)":\s*"([^"]+)"', m.group(1)):
            existing[k] = v
    existing.update(mapping)
    lines = [f'    "{k}": "{v}",' for k, v in sorted(existing.items())]
    block = "OEM_LOCAL_IMAGES: dict[str, str] = {\n" + "\n".join(lines) + "\n}\n"
    if m:
        text = text[: m.start()] + block + text[m.end():]
    else:
        text = (
            text.rstrip()
            + "\n\n# Official manufacturer images downloaded locally (see scripts/fetch_oem_images.py).\n"
            + block
        )
    CATALOGUE.write_text(text)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    slugs = args or list(PAGE_SOURCES.keys())
    print(f"Fetching {len(slugs)} OEM image(s) -> {PUBLIC_DIR}")
    saved = fetch(slugs)
    if saved:
        write_back(saved)
    print(f"\nDownloaded {len(saved)}/{len(slugs)}. OEM_LOCAL_IMAGES updated for: {', '.join(sorted(saved)) or '(none)'}")
