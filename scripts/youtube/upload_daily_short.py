#!/usr/bin/env python3
"""
Portable Headless YouTube Shorts Auto-Uploader (YouTube Data API v3)

Configuration via environment variables (see .env.example):
  YOUTUBE_CHANNEL_ID     Target channel ID (optional safety check when youtube.readonly scope is present)
  YOUTUBE_CHANNEL_TITLE  Display name for logs
  YOUTUBE_QUEUE_DIR      Folder containing queued episode folders or .mp4 files (default: ./queue)
  YOUTUBE_CLIENT_SECRET  Path to Google OAuth client_secret.json (default: ./secrets/client_secret.json)
  YOUTUBE_TOKEN_FILE     Path to saved OAuth token JSON (default: ./secrets/youtube_token.json)

Modes:
  --auth-only                  One-time interactive Google OAuth login
  --verify-token               Refresh OAuth token & confirm live connection without uploading
  --dry-run                    Inspect queued video(s) & parsed metadata without uploading
  (default)                    Upload the next queued video immediately
  --schedule-all --hour 19     Upload all queued videos now & schedule 1/day on YouTube servers (publishAt)
"""

import argparse
import datetime
import json
import os
import re
import shutil
import time

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

TARGET_CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID", "")
TARGET_CHANNEL_TITLE = os.environ.get("YOUTUBE_CHANNEL_TITLE", "YouTube Channel")
UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload"
READONLY_SCOPE = "https://www.googleapis.com/auth/youtube.readonly"
DEFAULT_AUTH_SCOPES = [UPLOAD_SCOPE, READONLY_SCOPE]

CLIENT_SECRET_FILE = os.environ.get(
    "YOUTUBE_CLIENT_SECRET", os.path.join(PROJECT_ROOT, "secrets", "client_secret.json")
)
TOKEN_FILE = os.environ.get(
    "YOUTUBE_TOKEN_FILE", os.path.join(PROJECT_ROOT, "secrets", "youtube_token.json")
)
QUEUE_ROOT = os.environ.get("YOUTUBE_QUEUE_DIR", os.path.join(PROJECT_ROOT, "queue"))
UPLOADED_DIR = os.path.join(QUEUE_ROOT, "Uploaded")
HISTORY_FILE = os.path.join(QUEUE_ROOT, "upload_history.json")
LOG_FILE = os.path.join(QUEUE_ROOT, "auto_upload.log")

WIB_TZ = datetime.timezone(datetime.timedelta(hours=7))


def log(msg: str):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        os.makedirs(QUEUE_ROOT, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def _load_credentials_from_file(path: str) -> tuple[Credentials, list[str]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    raw_scopes = data.get("scopes")
    if isinstance(raw_scopes, list) and raw_scopes:
        scopes = raw_scopes
    elif isinstance(data.get("scope"), str) and data["scope"].strip():
        scopes = data["scope"].strip().split()
    else:
        scopes = [UPLOAD_SCOPE]

    token = data.get("token") or data.get("access_token")
    refresh_token = data.get("refresh_token")
    client_id = data.get("client_id")
    client_secret = data.get("client_secret")
    token_uri = data.get("token_uri") or "https://oauth2.googleapis.com/token"

    if not refresh_token or not client_id or not client_secret:
        raise RuntimeError(f"Incomplete OAuth token file at {path}.")

    creds = Credentials(
        token=token,
        refresh_token=refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=scopes,
    )
    return creds, scopes


def _save_token(path: str, creds: Credentials, scopes: list[str]):
    payload = {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri or "https://oauth2.googleapis.com/token",
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scope": " ".join(scopes),
        "scopes": scopes,
        "token_type": "Bearer",
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass


def get_credentials(allow_interactive: bool = False) -> tuple[Credentials, list[str]]:
    if os.path.exists(TOKEN_FILE) and not allow_interactive:
        creds, scopes = _load_credentials_from_file(TOKEN_FILE)
        if not creds.valid or creds.expired or not creds.token:
            log("Refreshing YouTube OAuth access token...")
            creds.refresh(Request())
            _save_token(TOKEN_FILE, creds, scopes)
        return creds, scopes

    if not allow_interactive:
        raise RuntimeError(
            f"OAuth token not found at {TOKEN_FILE}. Run with --auth-only once first."
        )

    if not os.path.exists(CLIENT_SECRET_FILE):
        raise FileNotFoundError(
            f"Google OAuth client secret not found at {CLIENT_SECRET_FILE}."
        )

    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, DEFAULT_AUTH_SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent")
    _save_token(TOKEN_FILE, creds, DEFAULT_AUTH_SCOPES)
    log(f"OAuth login succeeded. Saved token to {TOKEN_FILE}")
    return creds, DEFAULT_AUTH_SCOPES


def verify_target_channel(youtube, scopes: list[str]) -> dict:
    if READONLY_SCOPE not in scopes:
        return {"id": TARGET_CHANNEL_ID or "unknown", "title": TARGET_CHANNEL_TITLE}

    resp = youtube.channels().list(part="snippet", mine=True).execute()
    items = resp.get("items", [])
    if not items:
        raise RuntimeError("Signed-in Google account has no active YouTube channel.")
    ch = items[0]
    ch_id = ch["id"]
    ch_title = ch["snippet"]["title"]
    if TARGET_CHANNEL_ID and ch_id != TARGET_CHANNEL_ID:
        raise RuntimeError(
            f"Channel mismatch: signed in as '{ch_title}' ({ch_id}), expected {TARGET_CHANNEL_ID}."
        )
    log(f"Verified target channel: '{ch_title}' ({ch_id})")
    return {"id": ch_id, "title": ch_title}


def parse_caption_file(caption_path: str | None, fallback_name: str) -> tuple[str, str, list[str]]:
    default_title = re.sub(r"^\d+[_-]*", "", fallback_name)
    default_title = re.sub(r"^\d{4}-\d{2}-\d{2}[_-]*", "", default_title)
    default_title = default_title.replace("-", " ").replace("_", " ").strip()[:95]
    default_desc = f"{default_title}\n\n#shorts #edukasi"

    if not caption_path or not os.path.exists(caption_path):
        return default_title, default_desc, ["shorts", "edukasi"]

    raw = open(caption_path, "r", encoding="utf-8").read()
    m_sec = re.search(r"YOUTUBE SHORTS\s*=+\s*(.*?)(?:\n=+\s*\n|$)", raw, flags=re.S | re.I)
    sec = m_sec.group(1).strip() if m_sec else raw.strip()

    title = default_title
    m_title = re.search(r"Judul[^\n]*:\s*\n([^\n]+)", sec, flags=re.I)
    if m_title:
        title = m_title.group(1).strip().strip('"').strip("'")
    else:
        m_title2 = re.search(r"Judul\s*:\s*([^\n]+)", sec, flags=re.I)
        if m_title2:
            title = m_title2.group(1).strip().strip('"').strip("'")

    desc = default_desc
    m_desc = re.search(r"Deskripsi\s*:\s*\n(.*)", sec, flags=re.S | re.I)
    if m_desc:
        desc = m_desc.group(1).strip()

    title = title.replace("<", "").replace(">", "").strip()[:100]
    desc = desc.replace("<", "").replace(">", "").strip()

    tags = [t.lower() for t in re.findall(r"#([A-Za-z0-9_]+)", desc)]
    if "shorts" not in tags:
        tags.insert(0, "shorts")
    return title, desc, tags[:25]


def list_queue_items() -> list[dict]:
    os.makedirs(QUEUE_ROOT, exist_ok=True)
    os.makedirs(UPLOADED_DIR, exist_ok=True)

    skip = {"Uploaded", "upload_history.json", "auto_upload.log", "CARA_PAKAI.txt", "client_secret.json", ".DS_Store"}
    entries = sorted(e for e in os.listdir(QUEUE_ROOT) if e not in skip and not e.startswith("."))
    items = []
    for name in entries:
        full = os.path.join(QUEUE_ROOT, name)
        if os.path.isdir(full):
            mp4s = sorted(f for f in os.listdir(full) if f.lower().endswith(".mp4") and not f.startswith("."))
            if mp4s:
                cap = os.path.join(full, "caption.txt")
                items.append({
                    "item_name": name,
                    "item_path": full,
                    "mp4_path": os.path.join(full, mp4s[0]),
                    "caption_path": cap if os.path.exists(cap) else None,
                })
        elif os.path.isfile(full) and name.lower().endswith(".mp4"):
            cap = os.path.join(QUEUE_ROOT, f"{os.path.splitext(name)[0]}.txt")
            items.append({
                "item_name": name,
                "item_path": full,
                "mp4_path": full,
                "caption_path": cap if os.path.exists(cap) else None,
            })
    return items


def load_history() -> list[dict]:
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        return json.load(open(HISTORY_FILE, "r", encoding="utf-8"))
    except Exception:
        return []


def record_history(entry: dict):
    hist = load_history()
    hist.append(entry)
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(hist, f, indent=2, ensure_ascii=False)


def compute_next_schedule_slot(hour: int, minute: int) -> datetime.datetime:
    now = datetime.datetime.now(WIB_TZ)
    next_slot = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if next_slot <= now + datetime.timedelta(minutes=15):
        next_slot += datetime.timedelta(days=1)

    for entry in load_history():
        pub_str = entry.get("publish_at")
        if pub_str:
            try:
                pub_dt = datetime.datetime.fromisoformat(pub_str).astimezone(WIB_TZ)
                candidate = pub_dt.replace(hour=hour, minute=minute, second=0, microsecond=0) + datetime.timedelta(days=1)
                if candidate > next_slot:
                    next_slot = candidate
            except Exception:
                pass
    return next_slot


def upload_video(youtube, mp4_path: str, title: str, description: str, tags: list[str], privacy: str, publish_at_iso: str | None) -> str:
    status_block: dict = {"selfDeclaredMadeForKids": False}
    if publish_at_iso:
        status_block["privacyStatus"] = "private"
        status_block["publishAt"] = publish_at_iso
    else:
        status_block["privacyStatus"] = privacy

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": "27",
            "defaultLanguage": "id",
            "defaultAudioLanguage": "id",
        },
        "status": status_block,
    }
    media = MediaFileUpload(mp4_path, mimetype="video/mp4", chunksize=8 * 1024 * 1024, resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    retries = 0
    while response is None:
        try:
            status, response = request.next_chunk()
            if status:
                log(f"  Upload progress: {int(status.progress() * 100)}%")
        except HttpError as e:
            if e.resp.status in (500, 502, 503, 504) and retries < 4:
                retries += 1
                time.sleep(2 ** retries)
            else:
                raise
    return response["id"]


def upload_and_archive(youtube, ch: dict, item: dict, privacy: str, publish_at_iso: str | None = None):
    title, desc, tags = parse_caption_file(item["caption_path"], item["item_name"])
    vid = upload_video(youtube, item["mp4_path"], title, desc, tags, privacy, publish_at_iso)
    url = f"https://www.youtube.com/shorts/{vid}"
    log(f"SUCCESS -> {url} ({publish_at_iso or privacy})")

    dest = os.path.join(UPLOADED_DIR, f"{datetime.datetime.now().strftime('%Y-%m-%d_%H%M')}_{item['item_name']}")
    shutil.move(item["item_path"], dest)
    record_history({
        "uploaded_at": datetime.datetime.now(WIB_TZ).isoformat(),
        "publish_at": publish_at_iso,
        "channel_id": ch["id"],
        "video_id": vid,
        "url": url,
        "title": title,
        "source_item": item["item_name"],
    })


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verify-token", action="store_true")
    ap.add_argument("--auth-only", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--schedule-all", action="store_true")
    ap.add_argument("--hour", type=int, default=19)
    ap.add_argument("--minute", type=int, default=0)
    ap.add_argument("--privacy", default="public", choices=["public", "unlisted", "private"])
    args = ap.parse_args()

    if args.auth_only:
        creds, scopes = get_credentials(allow_interactive=True)
        yt = build("youtube", "v3", credentials=creds)
        verify_target_channel(yt, scopes)
        return

    if args.verify_token:
        creds, scopes = get_credentials(allow_interactive=False)
        creds.refresh(Request())
        _save_token(TOKEN_FILE, creds, scopes)
        print("TOKEN_OK!")
        return

    items = list_queue_items()
    if not items:
        log(f"Queue empty in {QUEUE_ROOT}")
        return

    if args.schedule_all:
        first_slot = compute_next_schedule_slot(args.hour, args.minute)
        for idx, item in enumerate(items):
            slot = first_slot + datetime.timedelta(days=idx)
            title, _, _ = parse_caption_file(item["caption_path"], item["item_name"])
            log(f"  [{idx+1}] {slot.strftime('%Y-%m-%d %H:%M WIB')} | {item['item_name']} -> {title}")
        if args.dry_run:
            return
        creds, scopes = get_credentials(allow_interactive=False)
        yt = build("youtube", "v3", credentials=creds)
        ch = verify_target_channel(yt, scopes)
        for idx, item in enumerate(items):
            slot = first_slot + datetime.timedelta(days=idx)
            upload_and_archive(yt, ch, item, "private", slot.isoformat())
        return

    item = items[0]
    title, _, tags = parse_caption_file(item["caption_path"], item["item_name"])
    log(f"Next: {item['item_name']} -> {title} ({', '.join(tags[:6])})")
    if args.dry_run:
        return
    creds, scopes = get_credentials(allow_interactive=False)
    yt = build("youtube", "v3", credentials=creds)
    ch = verify_target_channel(yt, scopes)
    upload_and_archive(yt, ch, item, args.privacy, None)


if __name__ == "__main__":
    main()
