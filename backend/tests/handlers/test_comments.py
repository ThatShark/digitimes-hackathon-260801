"""Unit tests for GET/POST /community/post/{postId}/comments."""

import json
from unittest.mock import patch

from src.handlers import comments
from src.services.s3_storage import S3StorageError, S3StorageService


def _event(post_id="1", body=None):
    e = {"pathParameters": {"postId": post_id}}
    if body is not None:
        e["body"] = json.dumps(body)
    return e


def test_get_missing_post_id_returns_400():
    resp = comments.get_comments_handler({"pathParameters": {}}, None)
    assert resp["statusCode"] == 400


def test_post_missing_post_id_returns_400():
    resp = comments.add_comment_handler({"pathParameters": {}, "body": "{}"}, None)
    assert resp["statusCode"] == 400


def test_post_missing_content_returns_400(monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    resp = comments.add_comment_handler(_event(body={"content": "  "}), None)
    assert resp["statusCode"] == 400


def test_post_unparseable_body_returns_400(monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    resp = comments.add_comment_handler({"pathParameters": {"postId": "1"}, "body": "not-json"}, None)
    assert resp["statusCode"] == 400


@patch.object(S3StorageService, "get_post_comments")
def test_get_returns_empty_list_when_no_comments_exist(mock_get, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    mock_get.side_effect = S3StorageError("not found")
    resp = comments.get_comments_handler(_event(), None)
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"])["items"] == []


@patch.object(S3StorageService, "get_post_comments")
def test_get_returns_existing_comments(mock_get, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    existing = [{"id": "c-1", "floor": 1, "author": "王大壯", "personality": None,
                 "content": "hi", "images": [], "time": "1 小時前", "likes": 0, "tips": 0}]
    mock_get.return_value = json.dumps(existing, ensure_ascii=False).encode("utf-8")
    resp = comments.get_comments_handler(_event(), None)
    body = json.loads(resp["body"])
    assert body["items"] == existing


@patch.object(S3StorageService, "put_post_comments")
@patch.object(S3StorageService, "get_post_comments")
def test_post_first_comment_gets_floor_1(mock_get, mock_put, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    mock_get.side_effect = S3StorageError("not found")

    resp = comments.add_comment_handler(
        _event(body={"content": "第一則留言", "author": "小明", "personality": {"code": "DCLQ"}}), None
    )
    assert resp["statusCode"] == 201
    body = json.loads(resp["body"])
    assert body["floor"] == 1
    assert body["author"] == "小明"
    assert body["content"] == "第一則留言"
    mock_put.assert_called_once()
    saved_arg = mock_put.call_args[0][1]
    assert json.loads(saved_arg)[0]["floor"] == 1


@patch.object(S3StorageService, "put_post_comments")
@patch.object(S3StorageService, "get_post_comments")
def test_post_second_comment_gets_floor_2(mock_get, mock_put, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    existing = [{"id": "c-1", "floor": 1, "author": "王大壯", "personality": None,
                 "content": "hi", "images": [], "time": "1 小時前", "likes": 0, "tips": 0}]
    mock_get.return_value = json.dumps(existing, ensure_ascii=False).encode("utf-8")

    resp = comments.add_comment_handler(_event(body={"content": "第二則留言"}), None)
    body = json.loads(resp["body"])
    assert body["floor"] == 2


@patch.object(S3StorageService, "put_post_comments")
@patch.object(S3StorageService, "get_post_comments")
def test_post_s3_write_failure_returns_502(mock_get, mock_put, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    mock_get.side_effect = S3StorageError("not found")
    mock_put.side_effect = S3StorageError("boom")

    resp = comments.add_comment_handler(_event(body={"content": "test"}), None)
    assert resp["statusCode"] == 502


def test_no_bucket_configured_returns_502(monkeypatch):
    monkeypatch.delenv("TRADES_BUCKET_NAME", raising=False)
    resp = comments.get_comments_handler(_event(), None)
    assert resp["statusCode"] == 502
