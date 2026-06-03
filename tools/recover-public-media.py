#!/usr/bin/env python3
"""Recover public project media from project links into local repo files.

Reads Website/data/projects.json, fetches project pages (mainly Instructables),
tries to find candidate images, downloads them into Website/data/media/<slug>/,
and updates each project's image_urls with local paths.

Usage from repo root:
  python3 tools/recover-public-media.py --dry-run
  python3 tools/recover-public-media.py
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import mimetypes
import os
import re
import sys
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse, unquote

try:
    import requests
except ImportError:  # pragma: no cover
    print("This script needs requests: python3 -m pip install requests", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
PROJECTS_JSON = ROOT / "Website" / "data" / "projects.json"
MEDIA_ROOT = ROOT / "Website" / "data" / "media"
REPORT_CSV = ROOT / "Website" / "data" / "media-recovery-report.csv"
REPORT_MD = ROOT / "Website" / "data" / "media-recovery-report.md"

UA = "Mozilla/5.0 (compatible; DEF-projects-media-recovery/1.0)"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def legacy_names(project: dict) -> list[str]:
    names = []
    for url in project.get("legacy_media", {}).get("image_urls", []) or []:
        path = urlparse(url).path
        name = unquote(Path(path).name).lower()
        stem = Path(name).stem
        if name:
            names.append(name)
        if stem:
            names.append(stem)
    return names


def tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", text.lower()) if len(t) >= 3}


def extract_image_urls(page_url: str, html_text: str) -> list[str]:
    found: list[str] = []
    text = html.unescape(html_text)

    # Common meta tags and direct image references in HTML / JSON blobs.
    patterns = [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)["\']',
        r'<img[^>]+(?:src|data-src|data-original)=["\']([^"\']+)["\']',
        r'"(?:src|url|image|imageUrl)"\s*:\s*"(https?://[^"\\]+?)"',
        r'(https?://[^\s"\'<>\\]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s"\'<>\\]*)?)',
    ]
    for pat in patterns:
        for match in re.findall(pat, text, flags=re.I):
            found.append(urljoin(page_url, match.replace("\\/", "/")))

    # srcset entries: each item can be "url 800w".
    for srcset in re.findall(r'(?:srcset|data-srcset)=["\']([^"\']+)["\']', text, flags=re.I):
        for part in srcset.split(','):
            url = part.strip().split(' ')[0]
            if url:
                found.append(urljoin(page_url, url))

    # De-duplicate while preserving order.
    out = []
    seen = set()
    for u in found:
        u = u.strip()
        if not u or u in seen:
            continue
        ext = Path(urlparse(u).path.lower()).suffix
        if ext in IMAGE_EXTS or "instructables" in u.lower() or "autodesk" in u.lower():
            seen.add(u)
            out.append(u)
    return out


def score_candidate(project: dict, url: str) -> int:
    u = unquote(url.lower())
    score = 0
    legacy = legacy_names(project)
    for name in legacy:
        if name and name in u:
            score += 100
    project_tokens = tokens(project.get("title", "") + " " + project.get("slug", ""))
    url_tokens = tokens(u)
    score += 6 * len(project_tokens & url_tokens)
    if "cover" in u or "main" in u or "primary" in u:
        score += 5
    if any(bad in u for bad in ["avatar", "logo", "icon", "footer", "facebook", "twitter"]):
        score -= 20
    return score


def extension_from_response(resp, url: str) -> str:
    ext = Path(urlparse(url).path).suffix.lower()
    if ext in IMAGE_EXTS:
        return ext
    ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
    guessed = mimetypes.guess_extension(ctype)
    return guessed if guessed in IMAGE_EXTS else ".jpg"


def safe_name(project: dict, index: int, ext: str, source_url: str) -> str:
    h = hashlib.sha1(source_url.encode()).hexdigest()[:8]
    return f"{project['slug']}-{index:02d}-{h}{ext}"


def fetch(session, url: str, timeout: int = 20):
    return session.get(url, timeout=timeout, headers={"User-Agent": UA})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Find candidates but do not download or modify projects.json")
    parser.add_argument("--max-images-per-project", type=int, default=3)
    parser.add_argument("--min-score", type=int, default=6, help="Minimum match score to auto-download")
    args = parser.parse_args()

    projects = json.loads(PROJECTS_JSON.read_text(encoding="utf-8"))
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    rows = []

    session = requests.Session()
    changed = False

    for project in projects:
        page_url = project.get("project_link")
        if not page_url or "instructables.com" not in page_url:
            rows.append([project.get("id"), project.get("title"), "skipped", page_url or "", "", "", "no instructables project_link"])
            continue

        try:
            page = fetch(session, page_url)
            status = page.status_code
        except Exception as exc:
            rows.append([project.get("id"), project.get("title"), "error", page_url, "", "", f"page fetch failed: {exc}"])
            continue
        if status >= 400:
            rows.append([project.get("id"), project.get("title"), "error", page_url, "", "", f"page status {status}"])
            continue

        candidates = extract_image_urls(page_url, page.text)
        scored = sorted(((score_candidate(project, u), u) for u in candidates), reverse=True)
        selected = [(s, u) for s, u in scored if s >= args.min_score][: args.max_images_per_project]
        if not selected:
            rows.append([project.get("id"), project.get("title"), "no-match", page_url, "", "", f"{len(candidates)} candidates, none above threshold"])
            continue

        local_urls = list(project.get("image_urls") or [])
        project_dir = MEDIA_ROOT / project["slug"]
        if not args.dry_run:
            project_dir.mkdir(parents=True, exist_ok=True)

        for i, (score, image_url) in enumerate(selected, start=1):
            local_path = ""
            note = "candidate"
            if not args.dry_run:
                try:
                    img = fetch(session, image_url)
                    if img.status_code >= 400 or not img.content:
                        rows.append([project.get("id"), project.get("title"), "download-error", page_url, image_url, "", f"image status {img.status_code}"])
                        continue
                    ext = extension_from_response(img, image_url)
                    filename = safe_name(project, i, ext, image_url)
                    out = project_dir / filename
                    out.write_bytes(img.content)
                    local_path = f"data/media/{project['slug']}/{filename}"
                    if local_path not in local_urls:
                        local_urls.append(local_path)
                        changed = True
                    note = "downloaded"
                except Exception as exc:
                    rows.append([project.get("id"), project.get("title"), "download-error", page_url, image_url, "", str(exc)])
                    continue
            rows.append([project.get("id"), project.get("title"), note, page_url, image_url, local_path, f"score={score}"])
        if not args.dry_run:
            project["image_urls"] = local_urls

    with REPORT_CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["project_id", "title", "status", "project_link", "candidate_image_url", "local_path", "note"])
        writer.writerows(rows)

    downloaded = sum(1 for r in rows if r[2] == "downloaded")
    candidates = sum(1 for r in rows if r[2] == "candidate")
    REPORT_MD.write_text(
        "# Media recovery report\n\n"
        f"Mode: {'dry-run' if args.dry_run else 'download'}\n\n"
        f"Downloaded images: {downloaded}\n\n"
        f"Candidate images in dry-run: {candidates}\n\n"
        "See `media-recovery-report.csv` for details. Review matches manually before committing.\n",
        encoding="utf-8",
    )

    if changed and not args.dry_run:
        PROJECTS_JSON.write_text(json.dumps(projects, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {REPORT_CSV}")
    print(f"Wrote {REPORT_MD}")
    if args.dry_run:
        print("Dry run only; no images downloaded and projects.json unchanged.")
    else:
        print(f"Downloaded {downloaded} image(s); projects.json {'updated' if changed else 'unchanged'}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
