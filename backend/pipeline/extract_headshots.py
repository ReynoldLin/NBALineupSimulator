"""
Pipeline utility: extract player headshot URLs from cached HTML files
and update the players table.

Run manually (from backend/):
    python -m pipeline.extract_headshots

Reads from pipeline/cache/*.html — no network calls needed.
Only processes players whose headshot_url is currently NULL.
"""

import json
import logging
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import Player

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent / "cache"


def extract_headshot_url(html: str) -> Optional[str]:
    """Extract the headshot URL from the JSON-LD script tag."""
    soup = BeautifulSoup(html, "lxml")
    script = soup.find("script", {"type": "application/ld+json"})
    if not script:
        return None
    try:
        data = json.loads(script.string)
        image = data.get("image")
        if isinstance(image, dict):
            return image.get("contentUrl")
    except (json.JSONDecodeError, AttributeError):
        pass
    return None


def main() -> None:
    init_db()
    db = SessionLocal()

    try:
        # Only process players with no headshot yet
        players = (
            db.query(Player)
            .filter(Player.headshot_url.is_(None))
            .all()
        )
        logger.info("%d players with no headshot URL", len(players))

        updated, missing_cache, no_image = 0, 0, 0

        for i, player in enumerate(players):
            cache_file = CACHE_DIR / f"{player.slug}.html"

            if not cache_file.exists():
                missing_cache += 1
                continue

            html = cache_file.read_text(encoding="utf-8", errors="replace")
            url = extract_headshot_url(html)

            if url:
                player.headshot_url = url
                updated += 1
            else:
                no_image += 1

            if (i + 1) % 100 == 0:
                db.commit()
                logger.info(
                    "Progress: %d/%d — updated=%d no_image=%d missing_cache=%d",
                    i + 1, len(players), updated, no_image, missing_cache,
                )

        db.commit()
        logger.info(
            "Done. updated=%d no_image=%d missing_cache=%d",
            updated, no_image, missing_cache,
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()