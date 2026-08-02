"""Get Supplementary Quiz Lambda handler.

Implements GET /quiz/{quizId} — returns the full question list for a
supplementary quiz (investment-habits / investment-experience / investment-budget).

All supplementary quizzes use the same 7-point Likert scale as the main
EFS personality questionnaire. Unlike the personality bank (which randomly
samples 20 out of 32), supplementary quizzes return all their questions
in the defined order.

Success response 200:
{
  "id": "<quiz_id>",
  "title": "投資習慣問卷",
  "questions": [
    {"id": "h1", "text": "...", "options": [{"id":"1","text":"非常不同意"}, ...]},
    ...
  ]
}

Error response 404:
{
  "status": "error",
  "message": "未知的問卷 ID"
}
"""

from src.data.questionnaire_bank import LIKERT_OPTIONS
from src.data.supplementary_quizzes import SUPPLEMENTARY_QUIZZES
from src.utils.http import json_response


def lambda_handler(event, context):
    """GET /quiz?quiz_id=<id>"""
    # Primary: query string parameter
    query_params = event.get("queryStringParameters") or {}
    quiz_id = query_params.get("quiz_id", "")

    # Fallback: path parameter (if deployed with /quiz/{quizId} route)
    if not quiz_id:
        path_params = event.get("pathParameters") or {}
        quiz_id = path_params.get("quizId") or path_params.get("quiz_id", "")

    quiz = SUPPLEMENTARY_QUIZZES.get(quiz_id)
    if not quiz:
        return json_response(404, {"status": "error", "message": "未知的問卷 ID"})

    questions = [
        {"id": q["id"], "text": q["text"], "options": LIKERT_OPTIONS}
        for q in quiz["questions"]
    ]

    return json_response(200, {
        "id": quiz_id,
        "title": quiz["title"],
        "questions": questions,
    })
