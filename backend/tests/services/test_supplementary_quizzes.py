"""Unit tests for supplementary quiz sampling — pure functions, no
external services involved."""

from src.data.supplementary_quizzes import SUPPLEMENTARY_QUIZZES, sample_quiz


def test_sample_returns_none_for_unknown_quiz():
    assert sample_quiz("does-not-exist") is None


def test_all_quizzes_have_32_question_banks():
    for quiz_id, quiz in SUPPLEMENTARY_QUIZZES.items():
        assert len(quiz["questions"]) == 32, quiz_id


def test_all_quizzes_sample_sizes_sum_to_20():
    for quiz_id, quiz in SUPPLEMENTARY_QUIZZES.items():
        total = sum(d["sample_size"] for d in quiz["dimensions"])
        assert total == 20, quiz_id


def test_sample_returns_20_questions_for_each_quiz():
    for quiz_id in SUPPLEMENTARY_QUIZZES:
        questions = sample_quiz(quiz_id)
        assert len(questions) == 20, quiz_id


def test_sample_questions_have_no_dimension_leaked():
    for quiz_id in SUPPLEMENTARY_QUIZZES:
        for q in sample_quiz(quiz_id):
            assert set(q.keys()) == {"id", "text", "options"}, quiz_id


def test_sample_options_are_seven_point_likert():
    for quiz_id in SUPPLEMENTARY_QUIZZES:
        for q in sample_quiz(quiz_id):
            assert [o["id"] for o in q["options"]] == ["1", "2", "3", "4", "5", "6", "7"]


def test_sample_ids_are_unique_and_valid():
    for quiz_id, quiz in SUPPLEMENTARY_QUIZZES.items():
        valid_ids = {q["id"] for q in quiz["questions"]}
        sampled_ids = [q["id"] for q in sample_quiz(quiz_id)]
        assert len(sampled_ids) == len(set(sampled_ids)), quiz_id
        assert all(qid in valid_ids for qid in sampled_ids), quiz_id


def test_sample_is_balanced_per_dimension():
    for quiz_id, quiz in SUPPLEMENTARY_QUIZZES.items():
        q_to_dim = {q["id"]: q["dimension"] for q in quiz["questions"]}
        expected = {d["id"]: d["sample_size"] for d in quiz["dimensions"]}
        actual = {d["id"]: 0 for d in quiz["dimensions"]}
        for q in sample_quiz(quiz_id):
            actual[q_to_dim[q["id"]]] += 1
        assert actual == expected, quiz_id


def test_repeated_sampling_can_return_different_order():
    orders = set()
    for _ in range(10):
        questions = sample_quiz("investment-habits")
        orders.add(tuple(q["id"] for q in questions))
    assert len(orders) > 1
