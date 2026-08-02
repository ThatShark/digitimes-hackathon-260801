"""Get Supplementary Quiz Lambda handler.

Implements GET /quiz/{quizId} — returns 20 randomly-sampled questions
(dimension-balanced) for a supplementary quiz (investment-habits /
investment-experience / investment-budget), mirroring how the main EFS
personality questionnaire samples 20 of 32 questions per axis.

Each quiz's question bank is 32 questions split across its dimensions;
each dimension's sample_size (see src/data/supplementary_quizzes.py) sums
to 20. Order is shuffled per request.

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

from src.data.supplementary_quizzes import SUPPLEMENTARY_QUIZZES, sample_quiz
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
    questions = sample_quiz(quiz_id)
    if not quiz or questions is None:
        return json_response(404, {"status": "error", "message": "未知的問卷 ID"})

    return json_response(200, {
        "id": quiz_id,
        "title": quiz["title"],
        "questions": questions,
    })
