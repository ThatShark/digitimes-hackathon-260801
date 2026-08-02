"""補充問卷題庫：投資習慣 / 投資經驗 / 投資預算。

這三份問卷與主要的 EFS 32 題人格量表互為補充：
- EFS 人格問卷 → 判定 4 字母代碼（R/E/F/S 四軸），寫入 trade_metrics.json
- 補充問卷 → 提供 AI 額外的使用者背景資料，存入 S3 供 ai_chat 讀取並作為
  個人化建議的依據（例如：使用者月投資金額很少 → AI 不會建議大額操作）

所有補充問卷同樣使用 7 點李克特量表（1=非常不同意 ~ 7=非常同意），
每份問卷含多個維度 (dimensions)，每個維度包含若干題目。

AI 分析方式：
  submit_quiz handler 會將原始作答 + 各維度平均分數整理成 JSON，存入
  users/{userId}/quiz_results/{quiz_id}.json，ai_chat handler 在組裝
  system prompt 時可讀取這些 JSON，讓模型理解使用者的投資背景。
"""

from src.data.questionnaire_bank import LIKERT_OPTIONS  # noqa: F401 — 複用同一組選項

# ============================================================
# 問卷一：投資習慣問卷 (Investment Habits)
# 12 題，3 個維度
# ============================================================
INVESTMENT_HABITS_QUIZ = {
    "id": "investment-habits",
    "title": "投資習慣問卷",
    "description": "了解你日常的投資決策流程與資訊來源，幫助 AI 更精準地配合你的操作節奏。",
    "icon": "📋",
    "duration": "4 分鐘",
    "dimensions": [
        {
            "id": "info_source",
            "name": "資訊來源偏好",
            "description": "使用者主要依賴哪些管道做決策",
        },
        {
            "id": "decision_process",
            "name": "決策流程",
            "description": "使用者從獲取資訊到下單的流程特徵",
        },
        {
            "id": "portfolio_mgmt",
            "name": "投資組合管理",
            "description": "使用者如何管理與調整持倉",
        },
    ],
    "questions": [
        # --- 資訊來源偏好 (info_source) ---
        {"id": "h1", "dimension": "info_source",
         "text": "我做投資決策前，會花大量時間閱讀專業分析報告或研究文章。"},
        {"id": "h2", "dimension": "info_source",
         "text": "我主要依靠社群媒體（Twitter/X、Threads、Discord）獲取投資資訊。"},
        {"id": "h3", "dimension": "info_source",
         "text": "我會定期追蹤鏈上數據（如活躍地址數、TVL、Gas 費用）來輔助判斷。"},
        {"id": "h4", "dimension": "info_source",
         "text": "朋友或投資社群的推薦，對我的買賣決定有很大的影響力。"},

        # --- 決策流程 (decision_process) ---
        {"id": "h5", "dimension": "decision_process",
         "text": "我通常在看到機會後會立即行動，不太會等待或猶豫。"},
        {"id": "h6", "dimension": "decision_process",
         "text": "在下單之前，我習慣設定好明確的停利與停損價位。"},
        {"id": "h7", "dimension": "decision_process",
         "text": "我有一套固定的投資檢核流程（例如確認多個指標才進場）。"},
        {"id": "h8", "dimension": "decision_process",
         "text": "我經常在深夜或情緒激動的時候做出買賣決定。"},

        # --- 投資組合管理 (portfolio_mgmt) ---
        {"id": "h9", "dimension": "portfolio_mgmt",
         "text": "我會定期（每週或每月）重新檢視並調整我的投資組合配置。"},
        {"id": "h10", "dimension": "portfolio_mgmt",
         "text": "我傾向將資金分散在 5 種以上不同的幣種或資產類型。"},
        {"id": "h11", "dimension": "portfolio_mgmt",
         "text": "當某個持倉超過總資產的 30%，我會主動減倉以降低集中風險。"},
        {"id": "h12", "dimension": "portfolio_mgmt",
         "text": "我很少主動調整投資組合，買入後通常就放著不管。"},
    ],
}


# ============================================================
# 問卷二：投資經驗問卷 (Investment Experience)
# 15 題，4 個維度
# ============================================================
INVESTMENT_EXPERIENCE_QUIZ = {
    "id": "investment-experience",
    "title": "投資經驗問卷",
    "description": "評估你的投資年資、市場歷練與知識深度，AI 會據此調整解說的專業程度與建議複雜度。",
    "icon": "🎓",
    "duration": "5 分鐘",
    "dimensions": [
        {
            "id": "market_years",
            "name": "市場年資與歷練",
            "description": "使用者的投資時間長度與經歷過的市場週期",
        },
        {
            "id": "knowledge_depth",
            "name": "金融知識深度",
            "description": "使用者對投資工具、技術分析、基本面的理解程度",
        },
        {
            "id": "crypto_specific",
            "name": "加密貨幣專業度",
            "description": "使用者對區塊鏈/DeFi/鏈上分析的熟悉程度",
        },
        {
            "id": "loss_experience",
            "name": "虧損經驗與教訓",
            "description": "使用者過去的虧損經歷以及從中學到的東西",
        },
    ],
    "questions": [
        # --- 市場年資與歷練 (market_years) ---
        {"id": "e1", "dimension": "market_years",
         "text": "我有超過 3 年的投資經驗（包含股票、基金、加密貨幣等任何形式）。"},
        {"id": "e2", "dimension": "market_years",
         "text": "我曾經歷過至少一次完整的牛熊市場週期。"},
        {"id": "e3", "dimension": "market_years",
         "text": "我在加密貨幣領域的交易經驗超過 1 年。"},
        {"id": "e4", "dimension": "market_years",
         "text": "我使用過 3 個以上不同的交易所或投資平台。"},

        # --- 金融知識深度 (knowledge_depth) ---
        {"id": "e5", "dimension": "knowledge_depth",
         "text": "我能清楚解釋什麼是移動平均線、RSI、MACD 等技術指標。"},
        {"id": "e6", "dimension": "knowledge_depth",
         "text": "我了解止盈止損單、限價單、OCO 單等進階下單類型的運作方式。"},
        {"id": "e7", "dimension": "knowledge_depth",
         "text": "我能看懂並分析一家公司或項目的財務報表/代幣經濟模型。"},
        {"id": "e8", "dimension": "knowledge_depth",
         "text": "我了解資產配置、夏普比率、最大回撤等投資組合管理概念。"},

        # --- 加密貨幣專業度 (crypto_specific) ---
        {"id": "e9", "dimension": "crypto_specific",
         "text": "我了解 DeFi 協議（如 AMM、借貸平台、流動性挖礦）的運作原理。"},
        {"id": "e10", "dimension": "crypto_specific",
         "text": "我曾使用過去中心化錢包（如 MetaMask）進行鏈上操作。"},
        {"id": "e11", "dimension": "crypto_specific",
         "text": "我會查看鏈上數據（如 Glassnode、Dune Analytics）來輔助投資決策。"},
        {"id": "e12", "dimension": "crypto_specific",
         "text": "我了解不同共識機制（PoW、PoS）和 Layer 1/Layer 2 的技術差異。"},

        # --- 虧損經驗與教訓 (loss_experience) ---
        {"id": "e13", "dimension": "loss_experience",
         "text": "我曾經歷過單筆投資虧損超過 50% 的經驗。"},
        {"id": "e14", "dimension": "loss_experience",
         "text": "過去的虧損經歷讓我建立了更嚴格的風控紀律。"},
        {"id": "e15", "dimension": "loss_experience",
         "text": "我曾因為 FOMO（害怕錯過）而追高買入，事後感到後悔。"},
    ],
}


# ============================================================
# 問卷三：投資預算問卷 (Investment Budget & Goals)
# 13 題，3 個維度
# ============================================================
INVESTMENT_BUDGET_QUIZ = {
    "id": "investment-budget",
    "title": "投資預算與目標問卷",
    "description": "了解你的可投資金額、收入來源與投資目標，AI 會據此建議合理的單筆交易金額。",
    "icon": "💰",
    "duration": "4 分鐘",
    "dimensions": [
        {
            "id": "budget_scale",
            "name": "投資規模與資金量",
            "description": "使用者可動用的投資金額大小",
        },
        {
            "id": "income_stability",
            "name": "收入穩定度與資金來源",
            "description": "使用者的收入型態與投資資金的來源",
        },
        {
            "id": "investment_goal",
            "name": "投資目標與期望",
            "description": "使用者希望透過投資達成的目標",
        },
    ],
    "questions": [
        # --- 投資規模與資金量 (budget_scale) ---
        {"id": "b1", "dimension": "budget_scale",
         "text": "我每月可以固定撥出一筆金額投入加密貨幣市場。"},
        {"id": "b2", "dimension": "budget_scale",
         "text": "我目前投入加密貨幣的總金額，佔我個人總資產的比例很高。"},
        {"id": "b3", "dimension": "budget_scale",
         "text": "即使投入加密貨幣的資金全部歸零，也不會影響我的日常生活。"},
        {"id": "b4", "dimension": "budget_scale",
         "text": "我單次下單的金額通常超過新台幣 10,000 元。"},
        {"id": "b5", "dimension": "budget_scale",
         "text": "我有足夠的緊急預備金（至少 3-6 個月生活費），才會將閒錢投入市場。"},

        # --- 收入穩定度與資金來源 (income_stability) ---
        {"id": "b6", "dimension": "income_stability",
         "text": "我有穩定的月薪或固定收入來源。"},
        {"id": "b7", "dimension": "income_stability",
         "text": "我的投資本金來自長期儲蓄，不是借貸或短期周轉金。"},
        {"id": "b8", "dimension": "income_stability",
         "text": "如果一筆投資被套牢，我不需要急著用這筆錢，可以耐心等待。"},
        {"id": "b9", "dimension": "income_stability",
         "text": "我有其他被動收入來源（如房租、股息、利息），不完全依賴薪水。"},

        # --- 投資目標與期望 (investment_goal) ---
        {"id": "b10", "dimension": "investment_goal",
         "text": "我投資加密貨幣的主要目的是長期財富累積，而非短期獲利。"},
        {"id": "b11", "dimension": "investment_goal",
         "text": "我希望透過投資在 3-5 年內達成一個具體的財務目標（如買房、退休）。"},
        {"id": "b12", "dimension": "investment_goal",
         "text": "我期望的年化報酬率超過 30%。"},
        {"id": "b13", "dimension": "investment_goal",
         "text": "比起追求高報酬，我更在意資產穩定增長、打敗通膨。"},
    ],
}


# ============================================================
# 問卷註冊表（所有補充問卷的索引）
# ============================================================
SUPPLEMENTARY_QUIZZES = {
    "investment-habits": INVESTMENT_HABITS_QUIZ,
    "investment-experience": INVESTMENT_EXPERIENCE_QUIZ,
    "investment-budget": INVESTMENT_BUDGET_QUIZ,
}

# 為了向後相容：保留舊版 resolve_label 介面（新問卷不再使用閾值式標籤，
# 改由 AI 直接根據各維度平均分數做解讀，但此函式仍可被舊的 submit_quiz
# handler 呼叫而不會報錯）。
_LEGACY_LABEL_THRESHOLDS = {
    "risk-tolerance": [
        (75, "積極型", "你能承受較大幅度的虧損與波動，AI 之後會在建議中納入較積極的操作選項。"),
        (40, "均衡型", "你的風險承受度適中，AI 會在穩健與積極之間維持平衡的建議。"),
        (0, "保守型", "你偏好穩健保本，AI 之後會優先提供風險較低的操作建議。"),
    ],
    "market-sentiment": [
        (65, "情緒敏感型", "你容易受市場氣氛與名人效應影響，AI 會在市場劇烈波動時特別提醒你保持冷靜。"),
        (30, "觀察型", "你會先觀察再行動，這是不錯的習慣，AI 會持續提供即時市場資訊供你參考。"),
        (0, "冷靜自律型", "你不容易被市場情緒左右，甚至傾向逆勢操作，AI 會在分析中納入你的逆勢傾向。"),
    ],
}


def resolve_label(quiz_id: str, score: int):
    """向後相容：回傳 (label, message)。新問卷會回傳通用訊息。"""
    thresholds = _LEGACY_LABEL_THRESHOLDS.get(quiz_id)
    if thresholds:
        for threshold, label, message in thresholds:
            if score >= threshold:
                return label, message
        return thresholds[-1][1], thresholds[-1][2]
    # 新問卷：不使用閾值式標籤，由 AI 解讀
    return "已完成", "感謝你的作答！AI 將根據這些資料提供更精準的個人化建議。"


def score_supplementary_quiz(quiz_id: str, answers: list) -> dict:
    """計算補充問卷的各維度平均分數。

    Parameters:
        quiz_id: 問卷 ID（investment-habits / investment-experience / investment-budget）
        answers: list of {"question_id": str, "option_id": str}，option_id 為 "1"~"7"

    Returns:
        {
            "quiz_id": str,
            "dimensions": {
                "<dimension_id>": {"name": str, "avg_score": float, "answers_count": int},
                ...
            },
            "overall_avg": float,
            "total_answers": int,
            "raw_answers": list  # 原始作答（供 AI 讀取）
        }

    若 quiz_id 不存在於 SUPPLEMENTARY_QUIZZES 中，回傳空結構。
    """
    quiz = SUPPLEMENTARY_QUIZZES.get(quiz_id)
    if not quiz:
        return {"quiz_id": quiz_id, "dimensions": {}, "overall_avg": 0, "total_answers": 0, "raw_answers": []}

    # 建立 question_id → dimension 的映射
    q_to_dim = {q["id"]: q["dimension"] for q in quiz["questions"]}

    # 按維度收集分數
    dim_scores = {d["id"]: [] for d in quiz["dimensions"]}
    for answer in answers:
        qid = answer.get("question_id")
        dim_id = q_to_dim.get(qid)
        if not dim_id:
            continue
        try:
            value = int(answer.get("option_id"))
        except (TypeError, ValueError):
            continue
        if 1 <= value <= 7:
            dim_scores[dim_id].append(value)

    # 計算各維度平均
    dim_name_map = {d["id"]: d["name"] for d in quiz["dimensions"]}
    dimensions = {}
    all_values = []
    for dim_id, values in dim_scores.items():
        avg = round(sum(values) / len(values), 2) if values else 0
        dimensions[dim_id] = {
            "name": dim_name_map[dim_id],
            "avg_score": avg,
            "answers_count": len(values),
        }
        all_values.extend(values)

    overall_avg = round(sum(all_values) / len(all_values), 2) if all_values else 0

    return {
        "quiz_id": quiz_id,
        "dimensions": dimensions,
        "overall_avg": overall_avg,
        "total_answers": len(all_values),
        "raw_answers": answers,
    }
