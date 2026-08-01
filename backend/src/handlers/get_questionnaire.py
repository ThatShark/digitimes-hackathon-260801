"""Get Questionnaire Lambda handler.

Implements GET /questionnaire per backend/api.yaml operationId getQuestionnaire.
Returns 20 questions randomly sampled from the 32-question EFS question bank
(5 per axis), order shuffled. No S3/Bedrock access needed — pure static data.

Success response 200:
{
  "id": "<uuid>",
  "questions": [
    {"id": "q7", "text": "...", "options": [{"id":"1","text":"非常不符合"}, ...]},
    ...
  ]
}
"""

from src.services.questionnaire_scoring import sample_questionnaire
from src.utils.http import json_response


def lambda_handler(event, context):
    """GET /questionnaire"""
    questionnaire_id, questions = sample_questionnaire()
    return json_response(200, {"id": questionnaire_id, "questions": questions})
