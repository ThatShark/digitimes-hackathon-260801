"""問卷抽樣與計分：從 32 題題庫抽 20 題（每軸各 5 題）、打亂順序，
以及把使用者作答換算成 R/E/F/S 四軸分數與 4 字人格代碼。

計分公式：每軸把答到的低分極題目取平均、高分極題目取平均（皆為 1-5 分），
score = 50 + (mean_high - mean_low) / 4 * 50，clamp 到 [0, 100]。
分數 >= 50 落在該軸的高分極字母，否則落在低分極字母。
"""

import random
import uuid

from src.data.questionnaire_bank import (
    LIKERT_OPTIONS,
    PERSONALITY_NAMES,
    QUESTION_BANK,
    QUESTIONS_BY_ID,
)

AXES = ["R", "E", "F", "S"]
QUESTIONS_PER_AXIS = 5

# 每軸高分極對應的字母、低分極對應的字母（順序固定為 R,E,F,S 組代碼）。
_HIGH_LETTER = {"R": "A", "E": "E", "F": "S", "S": "I"}
_LOW_LETTER = {"R": "D", "E": "C", "F": "L", "S": "Q"}


def sample_questionnaire():
    """回傳 (questionnaire_id, questions)。questions 是 20 題（每軸 5 題）、
    整體順序已打亂，每題只暴露 id/text/options，不外露 axis/pole。"""
    selected = []
    for axis in AXES:
        axis_questions = [q for q in QUESTION_BANK if q["axis"] == axis]
        selected.extend(random.sample(axis_questions, QUESTIONS_PER_AXIS))
    random.shuffle(selected)

    questions = [
        {"id": q["id"], "text": q["text"], "options": LIKERT_OPTIONS}
        for q in selected
    ]
    return str(uuid.uuid4()), questions


def score_answers(answers):
    """answers: list of {"question_id": str, "option_id": str}.

    回傳 {"code": str, "name": str, "axes": {"R": int, "E": int, "F": int, "S": int}}。
    無法辨識的 question_id 會被忽略；某軸完全沒有作答時該軸分數維持 50（中性）。
    """
    pole_values = {axis: {"low": [], "high": []} for axis in AXES}

    for answer in answers:
        question = QUESTIONS_BY_ID.get(answer.get("question_id"))
        if not question:
            continue
        try:
            value = int(answer.get("option_id"))
        except (TypeError, ValueError):
            continue
        if not 1 <= value <= 5:
            continue
        pole_values[question["axis"]][question["pole"]].append(value)

    axes_scores = {}
    for axis in AXES:
        low_values = pole_values[axis]["low"]
        high_values = pole_values[axis]["high"]
        if low_values and high_values:
            mean_low = sum(low_values) / len(low_values)
            mean_high = sum(high_values) / len(high_values)
            score = 50 + (mean_high - mean_low) / 4 * 50
        else:
            score = 50
        axes_scores[axis] = round(max(0, min(100, score)))

    code = "".join(
        _HIGH_LETTER[axis] if axes_scores[axis] >= 50 else _LOW_LETTER[axis]
        for axis in AXES
    )
    name = PERSONALITY_NAMES.get(code, "未知")

    return {"code": code, "name": name, "axes": axes_scores}
