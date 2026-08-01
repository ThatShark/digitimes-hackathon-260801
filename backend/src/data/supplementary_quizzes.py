"""Scoring rules for the two smaller supplementary quizzes shown in the
questionnaire list (風險承受度評估 / 市場情緒敏感度).

Unlike the 32-question EFS bank (single source of truth for both the
question text AND the R/E/F/S personality), these two quizzes are small,
fixed-order, single-dimension questionnaires whose question text still
lives in the frontend (frontend/src/pages/QuestionnairePage.jsx). This
module only holds the scoring side: each question's A/B/C/D option maps
to a 0-100 weight, and the mean of answered weights becomes the quiz's
score, resolved into a label + feedback message. Scores are intentionally
kept separate from trade_metrics.json (the R/E/F/S personality) — nothing
currently consumes them, they exist so the questionnaire has real
feedback instead of a static "已完成" placeholder.
"""

SUPPLEMENTARY_QUIZZES = {
    "risk-tolerance": {
        # All 3 questions share the same option ordering: A = most risk
        # tolerant, D = least — see QuestionnairePage.jsx's QUESTIONNAIRES.
        "questions": {
            1: {"A": 100, "B": 65, "C": 30, "D": 0},
            2: {"A": 100, "B": 65, "C": 30, "D": 0},
            3: {"A": 100, "B": 65, "C": 30, "D": 0},
        },
        "label_thresholds": [
            (75, "積極型", "你能承受較大幅度的虧損與波動，AI 之後會在建議中納入較積極的操作選項。"),
            (40, "均衡型", "你的風險承受度適中，AI 會在穩健與積極之間維持平衡的建議。"),
            (0, "保守型", "你偏好穩健保本，AI 之後會優先提供風險較低的操作建議。"),
        ],
    },
    "market-sentiment": {
        "questions": {
            1: {"A": 100, "B": 60, "C": 20, "D": 0},
            2: {"A": 50, "B": 30, "C": 10, "D": 100},
        },
        "label_thresholds": [
            (65, "情緒敏感型", "你容易受市場氣氛與名人效應影響，AI 會在市場劇烈波動時特別提醒你保持冷靜。"),
            (30, "觀察型", "你會先觀察再行動，這是不錯的習慣，AI 會持續提供即時市場資訊供你參考。"),
            (0, "冷靜自律型", "你不容易被市場情緒左右，甚至傾向逆勢操作，AI 會在分析中納入你的逆勢傾向。"),
        ],
    },
}


def resolve_label(quiz_id: str, score: int):
    """Returns (label, message) for a score, walking thresholds highest-first."""
    thresholds = SUPPLEMENTARY_QUIZZES[quiz_id]["label_thresholds"]
    for threshold, label, message in thresholds:
        if score >= threshold:
            return label, message
    return thresholds[-1][1], thresholds[-1][2]
