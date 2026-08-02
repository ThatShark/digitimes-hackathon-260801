"""Unit tests for questionnaire sampling and scoring — pure functions, no
external services involved.

Updated for the 7-point Likert scale (option_id "1"~"7").
"""

from src.data.questionnaire_bank import QUESTIONS_BY_ID
from src.services.questionnaire_scoring import AXES, sample_questionnaire, score_answers


# ── sample_questionnaire ─────────────────────────────────────────────────────

def test_sample_returns_20_questions():
    _, questions = sample_questionnaire()
    assert len(questions) == 20


def test_sample_is_balanced_5_per_axis():
    _, questions = sample_questionnaire()
    axis_counts = {axis: 0 for axis in AXES}
    for q in questions:
        axis_counts[QUESTIONS_BY_ID[q["id"]]["axis"]] += 1
    assert axis_counts == {"R": 5, "E": 5, "F": 5, "S": 5}


def test_sample_questions_have_no_axis_or_pole_leaked():
    _, questions = sample_questionnaire()
    for q in questions:
        assert set(q.keys()) == {"id", "text", "options"}


def test_sample_options_are_seven_point_likert():
    _, questions = sample_questionnaire()
    for q in questions:
        assert [o["id"] for o in q["options"]] == ["1", "2", "3", "4", "5", "6", "7"]


def test_sample_ids_are_unique_and_valid():
    _, questions = sample_questionnaire()
    ids = [q["id"] for q in questions]
    assert len(ids) == len(set(ids))
    assert all(qid in QUESTIONS_BY_ID for qid in ids)


def test_sample_id_is_a_uuid_like_string():
    questionnaire_id, _ = sample_questionnaire()
    assert isinstance(questionnaire_id, str)
    assert len(questionnaire_id) > 0


# ── score_answers ────────────────────────────────────────────────────────────

def test_all_neutral_answers_score_50_on_every_axis():
    # 4 is the midpoint of the 7-point scale
    answers = [{"question_id": qid, "option_id": "4"} for qid in QUESTIONS_BY_ID]
    result = score_answers(answers)
    assert result["axes"] == {"R": 50, "E": 50, "F": 50, "S": 50}


def test_extreme_low_pole_answers_score_0():
    # Low pole maxed at 7, high pole at 1 → maximum difference toward low
    answers = [
        {"question_id": qid, "option_id": ("7" if q["pole"] == "low" else "1")}
        for qid, q in QUESTIONS_BY_ID.items()
    ]
    result = score_answers(answers)
    assert result["axes"]["R"] == 0


def test_extreme_high_pole_answers_score_100():
    # High pole maxed at 7, low pole at 1 → maximum difference toward high
    answers = [
        {"question_id": qid, "option_id": ("1" if QUESTIONS_BY_ID[qid]["pole"] == "low" else "7")}
        for qid in QUESTIONS_BY_ID
    ]
    result = score_answers(answers)
    assert result["axes"] == {"R": 100, "E": 100, "F": 100, "S": 100}


def test_code_letters_follow_high_score_convention():
    # All axes maxed toward high pole -> code should be A E S I (in R,E,F,S order)
    answers = [
        {"question_id": qid, "option_id": ("1" if QUESTIONS_BY_ID[qid]["pole"] == "low" else "7")}
        for qid in QUESTIONS_BY_ID
    ]
    result = score_answers(answers)
    assert result["code"] == "AESI"
    assert result["name"] == "探險家"


def test_code_letters_low_pole_convention():
    answers = [
        {"question_id": qid, "option_id": ("7" if QUESTIONS_BY_ID[qid]["pole"] == "low" else "1")}
        for qid in QUESTIONS_BY_ID
    ]
    result = score_answers(answers)
    assert result["code"] == "DCLQ"
    assert result["name"] == "長青樹"


def test_missing_axis_answers_defaults_to_neutral_50():
    result = score_answers([])
    assert result["axes"] == {"R": 50, "E": 50, "F": 50, "S": 50}


def test_unknown_question_id_is_ignored():
    result = score_answers([{"question_id": "does-not-exist", "option_id": "7"}])
    assert result["axes"] == {"R": 50, "E": 50, "F": 50, "S": 50}


def test_invalid_option_value_is_ignored():
    result = score_answers([{"question_id": "q1", "option_id": "not-a-number"}])
    assert result["axes"]["R"] == 50


def test_out_of_range_option_is_ignored():
    # Option 0 and 8 are outside valid range (1-7)
    result = score_answers([
        {"question_id": "q1", "option_id": "0"},
        {"question_id": "q2", "option_id": "8"},
    ])
    assert result["axes"]["R"] == 50
