"""Post Comments Lambda handlers.

Implements GET/POST /community/post/{postId}/comments. Comments are a flat,
floor-numbered thread (no nested replies) stored as a single JSON array at
community/posts/{postId}/comments.json. There is no backend-side concept of
"posts" yet (the community feed is still frontend mock data) — postId is
just an opaque string key, so this works the same whether the post itself
is a real or a mock one.

Since this app has no login system (single demo user, per
frontend/src/utils/currentUser.js), the comment author's name/personality
are supplied by the client in the POST body rather than resolved from a
user profile store.

GET response 200:
{"items": [{"id","floor","author","personality","content","images","time","likes","tips"}, ...]}

POST request body:
{"content": str, "images": [str], "author": str, "personality": {...} | null}
POST response 201: the newly created comment object (same shape as GET items).
"""

import json
import time
from datetime import datetime, timezone

from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def get_comments_handler(event, context):
    """GET /community/post/{postId}/comments"""
    post_id = _extract_post_id(event)
    if not post_id:
        return _error(400, "缺少貼文 ID")

    storage = _storage()
    if not storage:
        return _error(502, "後端儲存服務未設定")

    comments = _load_comments(storage, post_id)
    return json_response(200, {"items": comments})


def add_comment_handler(event, context):
    """POST /community/post/{postId}/comments"""
    post_id = _extract_post_id(event)
    if not post_id:
        return _error(400, "缺少貼文 ID")

    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _error(400, "無法解析請求內容")

    content = (body.get("content") or "").strip()
    if not content:
        return _error(400, "留言內容不可為空")

    images = body.get("images") or []
    if not isinstance(images, list):
        images = []
    author = (body.get("author") or "匿名投資人").strip()
    personality = body.get("personality") or None

    storage = _storage()
    if not storage:
        return _error(502, "後端儲存服務未設定")

    comments = _load_comments(storage, post_id)

    new_comment = {
        "id": f"c-{int(time.time() * 1000)}",
        "floor": len(comments) + 1,
        "author": author,
        "personality": personality,
        "content": content,
        "images": images,
        "time": "剛剛",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "likes": 0,
        "tips": 0,
    }
    comments.append(new_comment)

    try:
        storage.put_post_comments(post_id, json.dumps(comments, ensure_ascii=False))
    except S3StorageError:
        return _error(502, "留言儲存失敗，請稍後再試")

    return json_response(201, new_comment)


def _load_comments(storage: S3StorageService, post_id: str) -> list:
    """Returns the comment list for a post, or [] if none exist yet."""
    try:
        raw = storage.get_post_comments(post_id)
        return json.loads(raw.decode("utf-8"))
    except (S3StorageError, json.JSONDecodeError, UnicodeDecodeError):
        return []


def _extract_post_id(event) -> "str | None":
    path_params = event.get("pathParameters") or {}
    return path_params.get("postId") or None


def _storage() -> "S3StorageService | None":
    import os

    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    if not bucket:
        return None
    return S3StorageService(bucket_name=bucket)


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
