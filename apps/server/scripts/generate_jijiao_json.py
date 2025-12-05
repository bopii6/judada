import json
import math
import os
import re
from collections import Counter
from dataclasses import dataclass
from typing import List, Dict, Any

import easyocr
import numpy as np
import pypdfium2 as pdfium

PDF_PATH = r"E:\英语教材\冀教版五年级下册.pdf"
OUTPUT_PATH = os.path.join("docs", "generated", "jijiao_grade5_unit_sentences.json")
ROUND_COUNT = 4
SENTENCES_PER_ROUND = 16

UNITS = [
    {"sequence": 1, "title": "Unit 1 Going to Beijing", "start": 5, "end": 18},
    {"sequence": 2, "title": "Unit 2 In Beijing", "start": 19, "end": 36},
    {"sequence": 3, "title": "Unit 3 Writing Home", "start": 37, "end": 54},
    {"sequence": 4, "title": "Unit 4 Did You Have a Nice Trip?", "start": 55, "end": 72}
]

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "if", "in", "on", "for", "to",
    "of", "is", "am", "are", "was", "were", "be", "been", "being", "with",
    "as", "by", "at", "from", "this", "that", "these", "those", "it", "its",
    "i", "you", "he", "she", "we", "they", "them", "him", "her", "my",
    "your", "our", "their", "me", "us"
}

QUESTION_STARTERS = re.compile(r"^(when|what|why|how|who|where|can|do|does|did|will|would|could)\b", re.I)
ADVERB_TOKENS = re.compile(r"\b(always|usually|often|sometimes|never|every)\b", re.I)
SKIP_PREFIXES = ("look", "listen", "write", "read", "circle", "copy", "trace", "spell", "draw", "say")

reader = easyocr.Reader(['en'], gpu=False)
document = pdfium.PdfDocument(PDF_PATH)
PAGE_LIMIT = max(unit["end"] for unit in UNITS)

@dataclass
class SentenceCandidate:
    text: str
    page: int
    order: int
    tokens: List[str]
    score: float = 0.0


def normalize_text(text: str) -> str:
    text = text.replace("’", "'").replace("`", "'").replace("“", '"').replace("”", '"')
    text = re.sub(r"[\u4e00-\u9fff]", " ", text)  # remove Chinese characters
    text = re.sub(r'[^A-Za-z0-9,\'"?!:;()\-\ ]+', " ", text)
    text = re.sub(r"\s+'", "'", text)
    text = re.sub(r"'\s+", "'", text)
    lower = text.lower()
    replacements = {
        "dont": "don't",
        "cant": "can't",
        "im ": "i'm ",
        " im": " i'm",
        "youre": "you're",
        "whats": "what's",
        "wheres": "where's",
        "thats": "that's",
        "lets": "let's"
    }
    for src, target in replacements.items():
        if src in lower:
            idx = lower.index(src)
            text = text[:idx] + target + text[idx + len(src):]
            lower = text.lower()
    text = re.sub(r"l\.", "!", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_into_sentences(text: str) -> List[str]:
    segments = []
    buffer = []
    for ch in text:
        buffer.append(ch)
        if ch in ".?!":
            sentence = "".join(buffer).strip()
            if sentence:
                segments.append(sentence)
            buffer = []
    remainder = "".join(buffer).strip()
    if remainder:
        segments.append(remainder)
    return segments


def is_valid_sentence(text: str) -> bool:
    if not text:
        return False
    if len(text) < 6 or len(text) > 140:
        return False
    if "__" in text or text.count("_") > 2:
        return False
    if text.endswith(":"):
        return False
    stripped = text.lstrip()
    lower = stripped.lower()
    if any(lower.startswith(f"{prefix} ") for prefix in SKIP_PREFIXES):
        return False
    if stripped[:2].isdigit():
        return False
    cleaned = re.sub(r"[^A-Za-z]", "", text)
    if not cleaned:
        return False
    letters = sum(c.isalpha() for c in text)
    non_space = len(text.replace(" ", ""))
    if non_space == 0:
        return False
    if letters / non_space < 0.6:
        return False
    word_count = len(re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", text))
    if word_count < 4:
        return False
    if re.match(r"^[A-Z]$", text):
        return False
    return True


def is_valid_sentence_relaxed(text: str) -> bool:
    if not text:
        return False
    if len(text) < 4 or len(text) > 160:
        return False
    cleaned = re.sub(r"[^A-Za-z]", "", text)
    if not cleaned:
        return False
    word_count = len(re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", text))
    return word_count >= 3


def tokenize(text: str) -> List[str]:
    words = re.split(r"[^A-Za-z0-9']+", text.lower())
    tokens = [w for w in words if len(w) > 1 and w not in STOP_WORDS]
    return tokens


def score_sentence(text: str, tokens: List[str], freq: Counter) -> float:
    if not tokens:
        return 0.0
    score = sum(freq.get(token, 0) for token in tokens)
    if text.strip().endswith("?"):
        score += 2.5
    if any(ch.isdigit() for ch in text):
        score += 1.0
    unique_tokens = len(set(tokens))
    if 3 <= unique_tokens <= 15:
        score += 1.5
    if "," in text or ";" in text:
        score += 0.5
    if ADVERB_TOKENS.search(text):
        score += 1.0
    if QUESTION_STARTERS.search(text.strip()):
        score += 1.5
    return score


def jaccard(tokens_a: List[str], tokens_b: List[str]) -> float:
    set_a, set_b = set(tokens_a), set(tokens_b)
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    if union == 0:
        return 0.0
    return intersection / union


all_pages: Dict[int, List[str]] = {}
print("Running OCR for pages 5-", PAGE_LIMIT)
for index in range(PAGE_LIMIT):
    page_number = index + 1
    page = document[index]
    pil_image = page.render(scale=2).to_pil()
    arr = np.array(pil_image)
    lines = []
    for raw in reader.readtext(arr, detail=0, paragraph=True):
        normalized = normalize_text(raw)
        if not normalized:
            continue
        for sentence in split_into_sentences(normalized):
            if sentence:
                lines.append(sentence)
    all_pages[page_number] = lines

units_output = []
package_sentences = 0

for unit in UNITS:
    start, end = unit["start"], unit["end"]
    raw_candidates: List[SentenceCandidate] = []
    order = 0
    total_needed = ROUND_COUNT * SENTENCES_PER_ROUND
    for page_number in range(start, end + 1):
        for line in all_pages.get(page_number, []):
            if not is_valid_sentence(line):
                continue
            cleaned = line
            if cleaned and cleaned[-1].isalpha():
                cleaned += "."
            tokens = tokenize(cleaned)
            if not tokens:
                continue
            raw_candidates.append(SentenceCandidate(text=cleaned, page=page_number, order=order, tokens=tokens))
            order += 1

    if len(raw_candidates) < total_needed:
        existing_keys = {candidate.text.lower() for candidate in raw_candidates}
        for page_number in range(start, end + 1):
            for line in all_pages.get(page_number, []):
                if len(raw_candidates) >= total_needed:
                    break
                normalized_key = line.lower()
                if normalized_key in existing_keys:
                    continue
                if not is_valid_sentence_relaxed(line):
                    continue
                candidate_text = line
                if candidate_text and candidate_text[-1].isalpha():
                    candidate_text += "."
                tokens = tokenize(candidate_text)
                if not tokens:
                    continue
                raw_candidates.append(SentenceCandidate(text=candidate_text, page=page_number, order=order, tokens=tokens))
                existing_keys.add(normalized_key)
                order += 1
            if len(raw_candidates) >= total_needed:
                break

    # Deduplicate by text (case-insensitive)
    unique_map = {}
    for candidate in raw_candidates:
        key = candidate.text.lower()
        if key not in unique_map:
            unique_map[key] = candidate
    candidates = list(unique_map.values())

    freq = Counter()
    for cand in candidates:
        freq.update(cand.tokens)

    for cand in candidates:
        cand.score = score_sentence(cand.text, cand.tokens, freq)

    total_needed = ROUND_COUNT * SENTENCES_PER_ROUND
    selected: List[SentenceCandidate] = []
    for cand in sorted(candidates, key=lambda c: (-c.score, c.page, c.order)):
        if len(selected) >= total_needed:
            break
        if any(jaccard(cand.tokens, existing.tokens) >= 0.85 for existing in selected):
            continue
        selected.append(cand)

    if len(selected) < total_needed:
        fallback = [cand for cand in sorted(candidates, key=lambda c: (c.page, c.order)) if cand not in selected]
        for cand in fallback:
            selected.append(cand)
            if len(selected) >= total_needed:
                break

    selected = selected[:total_needed]
    selected.sort(key=lambda c: (c.page, c.order))

    rounds = []
    for round_index in range(ROUND_COUNT):
        sentences = []
        for sentence_index in range(SENTENCES_PER_ROUND):
            idx = round_index * SENTENCES_PER_ROUND + sentence_index
            if idx >= len(selected):
                break
            cand = selected[idx]
            sentences.append({
                "title": f"Sentence {sentence_index + 1}",
                "en": cand.text,
                "cn": "",
                "pageNumber": cand.page,
                "summary": cand.text
            })
        rounds.append({
            "title": f"Round {round_index + 1}",
            "roundNumber": round_index + 1,
            "sentences": sentences
        })

    units_output.append({
        "sequence": unit["sequence"],
        "title": unit["title"],
        "rounds": rounds
    })
    package_sentences += sum(len(r["sentences"]) for r in rounds)
    print(f"Unit {unit['sequence']} collected {package_sentences} sentences so far")

output_payload = {
    "packageSummary": "Grade 5 (Jijiao) key sentences",
    "rounds": ROUND_COUNT,
    "sentencesPerRound": SENTENCES_PER_ROUND,
    "units": units_output
}

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    json.dump(output_payload, f, ensure_ascii=False, indent=2)

print(f"JSON saved to {OUTPUT_PATH}")
