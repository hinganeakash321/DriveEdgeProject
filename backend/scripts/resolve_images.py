"""Resolve openly-licensed model images from Wikipedia pageimages.

For each model in catalogue_data.MODELS, query the Wikipedia API for the
article's lead image (pageimages -> thumbnail). These are openly licensed
(CC/public domain) and stable on upload.wikimedia.org. Writes the resulting
{slug: url} map back into catalogue_data.py (MODEL_IMAGE_URLS).

Usage: python -m scripts.resolve_images   (run from backend/, needs network)
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.seed.catalogue_data import MODELS  # noqa: E402

API = "https://en.wikipedia.org/w/api.php"
UA = "DriveEdge-ImageResolver/1.0 (educational sample project)"


def _get(params: dict) -> dict:
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def resolve() -> dict[str, str]:
    # wiki title -> list of slugs (a title like "Tata Punch" maps to 2 slugs)
    title_to_slugs: dict[str, list[str]] = {}
    for m in MODELS:
        title_to_slugs.setdefault(m["wiki"], []).append(m["slug"])

    titles = list(title_to_slugs.keys())
    result: dict[str, str] = {}
    # Batch in groups of 20 (pageimages supports multiple titles).
    for i in range(0, len(titles), 20):
        batch = titles[i : i + 20]
        data = _get(
            {
                "action": "query",
                "format": "json",
                "prop": "pageimages",
                "piprop": "thumbnail",
                "pithumbsize": "800",
                "titles": "|".join(batch),
                "redirects": "1",
            }
        )
        query = data.get("query", {})
        # Map any normalized/redirected titles back to the requested title.
        alias = {}
        for norm in query.get("normalized", []):
            alias[norm["to"]] = norm["from"]
        for red in query.get("redirects", []):
            alias[red["to"]] = alias.get(red["from"], red["from"])
        for page in query.get("pages", {}).values():
            thumb = page.get("thumbnail", {}).get("source")
            if not thumb:
                continue
            requested = alias.get(page["title"], page["title"])
            for slug in title_to_slugs.get(requested, []):
                result[slug] = thumb
    return result


def write_back(mapping: dict[str, str]) -> None:
    path = Path(__file__).resolve().parents[1] / "app" / "seed" / "catalogue_data.py"
    text = path.read_text()
    lines = [f'    "{slug}": "{url}",' for slug, url in sorted(mapping.items())]
    block = "MODEL_IMAGE_URLS: dict[str, str] = {\n" + "\n".join(lines) + "\n}\n"
    text = re.sub(r"MODEL_IMAGE_URLS: dict\[str, str\] = \{[^}]*\}\n", block, text, flags=re.DOTALL)
    path.write_text(text)


if __name__ == "__main__":
    mapping = resolve()
    print(f"Resolved {len(mapping)}/{len({m['slug'] for m in MODELS})} model images")
    for slug, url in sorted(mapping.items()):
        print(f"  {slug}: {url[:80]}...")
    write_back(mapping)
    print("Wrote MODEL_IMAGE_URLS into catalogue_data.py")
