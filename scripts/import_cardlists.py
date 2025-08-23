# scripts/import_cardlists.py
import json, os, re, sys, uuid, glob
from typing import Iterator, Dict, Any, Optional, List, Tuple, Set
from datetime import datetime, timezone

# Make "server.*" imports work when running this script directly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from server.db import SessionLocal
from server.models import Card

SPORT_DIRS = {
    "baseball":   "Baseball",
    "basketball": "Basketball",
    "football":   "Football",
    "hockey":     "Hockey",
}

def now_utc() -> str:
    # ISO-8601 Z time, second precision
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def parse_brand(release_name: str) -> str:
    """
    Try to extract the brand from titles like:
      '1981 Donruss Baseball' -> 'Donruss'
      '1990-91 Upper Deck Hockey' -> 'Upper Deck'
      'Topps Chrome Baseball' -> 'Topps Chrome'
    Fallback: remove leading years, return first non-numeric token(s).
    """
    s = (release_name or "").strip()

    # Remove leading year patterns (e.g., "1981 ", "1990-91 ")
    s = re.sub(r"^\s*\d{4}(?:-\d{2})?\s+", "", s)

    # Remove trailing explicit sport words to isolate brand
    s = re.sub(r"\s+(Baseball|Basketball|Football|Hockey)\s*$", "", s, flags=re.I)

    # Compact remaining whitespace
    s = re.sub(r"\s+", " ", s).strip()

    # If nothing left, fallback
    return s or (release_name or "").strip()

def ensure_str(x: Optional[str]) -> Optional[str]:
    if x is None:
        return None
    s = str(x).strip()
    return s or None

def find_year_from_path(path: str) -> Optional[int]:
    m = re.search(r"(19|20)\d{2}", path.replace("\\", "/"))
    return int(m.group()) if m else None

def build_canonical(d: Dict[str, Any]) -> str:
    parts = [
        str(d.get("year") or "").strip().lower(),
        (d.get("brand") or "").strip().lower(),
        (d.get("set_name") or "").strip().lower(),
        (d.get("card_no") or "").strip().lower(),
        (d.get("player") or "").strip().lower(),
    ]
    return "|".join(parts)

def import_release(path: str, sport: str) -> Iterator[Dict[str, Any]]:
    """Yield card rows parsed from a single release JSON file, de-duplicated."""
    with open(path, "r", encoding="utf-8") as f:
        rel = json.load(f)

    release_name = rel.get("name") or ""
    brand = parse_brand(release_name)
    year = find_year_from_path(path)

    seen_in_release: Set[str] = set()

    for s in rel.get("sets", []) or []:
        subset = s.get("name")
        numbered = s.get("numberedTo")
        for c in s.get("cards", []) or []:
            attrs = c.get("attributes") or []
            d = {
                "external_source": "junkwaxdata",
                "external_id": ensure_str(c.get("uniqueId")),

                "sport": sport,
                "year": year,
                "brand": brand,
                "set_name": release_name,
                "subset": ensure_str(subset),

                "card_no": ensure_str(c.get("number")),
                "player": ensure_str(c.get("name")),
                "print_run": numbered if isinstance(numbered, int) else None,

                "attributes_json": json.dumps(attrs) if attrs else None,
                "variations_json": json.dumps(c.get("variations") or None),
                "parallels_json": json.dumps(c.get("parallels") or None),
            }

            key = build_canonical(d)
            if key in seen_in_release:
                # same card repeated within the JSON (e.g., parallel/attribute duplicate) → skip
                continue
            seen_in_release.add(key)
            yield d

def safe_set(obj, name: str, value):
    if hasattr(obj, name):
        setattr(obj, name, value)

def upsert_card(db, d: Dict[str, Any], cache: Dict[str, Card]) -> str:
    """Insert/update a Card row by canonical key with an in-memory cache to avoid duplicates before commit."""
    canonical = build_canonical(d)

    row = cache.get(canonical)
    if row is None:
        row = db.query(Card).filter_by(tenant_id="local", canonical_key=canonical).first()
    created = False

    if row is None:
        row = Card(
            card_uuid=f"c_{uuid.uuid4()}",
            tenant_id="local",
            schema_version="v1",
            created_at=now_utc(),
            updated_at=now_utc(),
            canonical_key=canonical,
        )
        db.add(row)
        # Keep it visible to subsequent queries and our cache even before commit
        db.flush()
        cache[canonical] = row
        created = True
    else:
        cache[canonical] = row  # ensure cache points to the found row

    row.sport     = d.get("sport")
    row.year      = d.get("year")
    row.brand     = d.get("brand")
    row.set_name  = d.get("set_name")
    row.subset    = d.get("subset")
    row.card_no   = d.get("card_no")
    row.player    = d.get("player")
    row.print_run = d.get("print_run")

    safe_set(row, "external_source", d.get("external_source"))
    safe_set(row, "external_id", d.get("external_id"))
    safe_set(row, "attributes_json", d.get("attributes_json"))
    safe_set(row, "variations_json", d.get("variations_json"))
    safe_set(row, "parallels_json", d.get("parallels_json"))

    row.updated_at = now_utc()
    return "created" if created else "updated"

def list_release_files_under_root(
    root: str,
    only_sport: Optional[str],
    include_categories: bool = False,
) -> List[Tuple[str, str]]:
    files: List[Tuple[str, str]] = []
    for sd, sport_name in SPORT_DIRS.items():
        if only_sport and sport_name.lower() != only_sport.lower():
            continue
        sport_dir = os.path.join(root, sd)
        if not os.path.isdir(sport_dir):
            continue
        for dirpath, _, filenames in os.walk(sport_dir):
            norm = dirpath.replace("\\", "/").lower()
            if ("/categories" in norm) and (not include_categories):
                continue
            for fn in filenames:
                if fn.lower().endswith(".json"):
                    files.append((os.path.join(dirpath, fn), sport_name))
    return files

def main():
    import argparse
    ap = argparse.ArgumentParser(description="Import CardLists JSONs into the local DB.")
    ap.add_argument("--root", help="Path to CardLists root (contains baseball/, basketball/, ... OR Categories/)")
    ap.add_argument("--include-categories", action="store_true",
                    help="Include 'Categories' paths while scanning --root")
    ap.add_argument("--sport", choices=list(SPORT_DIRS.values()) + ["All"],
                    help="Limit to one sport (default All with --root)")

    ap.add_argument("--release", help="Path to a single release JSON")
    ap.add_argument("--glob", help="Glob for many releases (e.g. C:\\data\\CardLists\\baseball\\1990\\*.json)")

    ap.add_argument("--commit-every", type=int, default=500)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    pairs: List[Tuple[str, str]] = []
    if args.root:
        only = None if (not args.sport or args.sport == "All") else args.sport
        pairs = list_release_files_under_root(args.root, only_sport=only, include_categories=args.include_categories)
    elif args.release:
        if not args.sport:
            ap.error("--sport is required when using --release")
        pairs = [(args.release, args.sport)]
    elif args.glob:
        if not args.sport:
            ap.error("--sport is required when using --glob")
        for p in glob.glob(args.glob):
            pairs.append((p, args.sport))
    else:
        ap.error("Provide --root OR (--release + --sport) OR (--glob + --sport)")

    if args.verbose:
        print(f"Found {len(pairs)} release file(s).")

    db = SessionLocal()
    created = updated = 0
    cache: Dict[str, Card] = {}
    global_seen: Set[str] = set()  # prevents duplicates across files within the same run

    try:
        batch = 0
        for i, (path, sport) in enumerate(pairs, 1):
            if args.verbose and i % 25 == 0:
                print(f"[{i}/{len(pairs)}] {sport} :: {path}")
            for d in import_release(path, sport):
                key = build_canonical(d)
                if key in global_seen:
                    continue
                global_seen.add(key)

                status = upsert_card(db, d, cache)
                if status == "created": created += 1
                else: updated += 1

                batch += 1
                if not args.dry_run and batch >= args.commit_every:
                    db.commit()
                    batch = 0
        if not args.dry_run:
            db.commit()
        print(f"Done. releases={len(pairs)}  created={created}  updated={updated}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
