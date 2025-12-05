import argparse
import csv
import json
import os
import re
from typing import Any, Dict, List, Optional

DEFAULT_OUTPUT = os.path.join("docs", "generated", "jijiao_grade5_unit_sentences.json")
RE_NUMBER = re.compile(r"\d+")


class ImportError(Exception):
    """Raised when the CSV input cannot be converted into sentence payloads."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Import curated Jijiao Grade 5 sentences from a CSV/TSV file "
            "and generate the JSON payload used by the platform."
        )
    )
    parser.add_argument(
        "--input",
        "-i",
        required=True,
        help="Path to the UTF-8 CSV/TSV file that contains the unit sentences.",
    )
    parser.add_argument(
        "--output",
        "-o",
        default=DEFAULT_OUTPUT,
        help=f"Where to write the JSON payload (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--package-summary",
        default="Grade 5 (Jijiao) key sentences",
        help="Summary stored in the final JSON payload.",
    )
    return parser.parse_args()


def read_rows(path: str) -> List[Dict[str, str]]:
    with open(path, "r", encoding="utf-8", newline="") as handle:
        sample = handle.read(2048)
        handle.seek(0)
        dialect = csv.excel
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",	;|")
        except csv.Error:
            pass
        reader = csv.DictReader(handle, dialect=dialect)
        if not reader.fieldnames:
            raise ImportError("The input file must include a header row with column names.")
        rows: List[Dict[str, str]] = []
        for raw_row in reader:
            row = {}
            for key, value in raw_row.items():
                key = key.strip().lstrip("\ufeff") if key else ""
                row[key] = (value or "").strip()
            if any(value for value in row.values()):
                rows.append(row)
        if not rows:
            raise ImportError("The input file does not contain any data rows.")
        return rows


def parse_numeric(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    match = RE_NUMBER.search(value)
    if match:
        return int(match.group())
    try:
        return int(value)
    except ValueError:
        return None


def collect_units(rows: List[Dict[str, str]]) -> Dict[int, Dict[str, Any]]:
    units: Dict[int, Dict[str, Any]] = {}
    for idx, row in enumerate(rows, start=2):
        seq = parse_numeric(row.get("unit_sequence"))
        if seq is None:
            raise ImportError(
                f"Row {idx}: 'unit_sequence' is required and must contain a number."
            )
        unit_title = row.get("unit_title") or None
        unit = units.setdefault(
            seq,
            {"title": unit_title or f"Unit {seq}", "rounds": {}, "raw_order": idx},
        )
        if unit_title:
            unit["title"] = unit_title

        round_number = parse_numeric(row.get("group_number"))
        if round_number is None:
            raise ImportError(
                f"Row {idx}: 'group_number' is required and must contain a number."
            )
        round_title = row.get("group_title") or None
        rounds = unit["rounds"]
        group = rounds.setdefault(
            round_number,
            {
                "title": round_title or f"Group {round_number}",
                "sentences": [],
                "raw_order": idx,
            },
        )
        if round_title:
            group["title"] = round_title

        sentence_text = row.get("sentence_en")
        if not sentence_text:
            raise ImportError(
                f"Row {idx}: 'sentence_en' is required for the English sentence text."
            )
        sentence_number = parse_numeric(row.get("sentence_number"))
        page_number = parse_numeric(row.get("page_number"))
        group["sentences"].append(
            {
                "number": sentence_number,
                "title": row.get("sentence_title") or None,
                "en": sentence_text,
                "cn": row.get("sentence_cn") or "",
                "summary": row.get("summary") or None,
                "page": page_number,
                "order": idx,
            }
        )
    return units


def build_payload(units: Dict[int, Dict[str, Any]], package_summary: str) -> Dict[str, Any]:
    sorted_units = sorted(units.items(), key=lambda item: (item[0], item[1]["raw_order"]))
    payload_units: List[Dict[str, Any]] = []
    max_rounds = 0
    max_sentences = 0

    for sequence, unit in sorted_units:
        rounds_payload: List[Dict[str, Any]] = []
        sorted_rounds = sorted(
            unit["rounds"].items(), key=lambda item: (item[0], item[1]["raw_order"])
        )
        for round_number, round_data in sorted_rounds:
            sentences_sorted = sorted(
                round_data["sentences"],
                key=lambda sentence: (
                    sentence["number"] if sentence["number"] is not None else 10 ** 9,
                    sentence["order"],
                ),
            )
            sentences_payload = []
            for idx, sentence in enumerate(sentences_sorted, start=1):
                sentence_title = sentence["title"] or f"Sentence {idx}"
                page_number = sentence["page"] if sentence["page"] is not None else 0
                summary = sentence["summary"] or sentence["en"]
                sentences_payload.append(
                    {
                        "title": sentence_title,
                        "en": sentence["en"],
                        "cn": sentence["cn"],
                        "pageNumber": page_number,
                        "summary": summary,
                    }
                )
            rounds_payload.append(
                {
                    "title": round_data["title"] or f"Group {round_number}",
                    "roundNumber": round_number,
                    "sentences": sentences_payload,
                }
            )
            max_sentences = max(max_sentences, len(sentences_payload))
        max_rounds = max(max_rounds, len(rounds_payload))
        payload_units.append({"sequence": sequence, "title": unit["title"], "rounds": rounds_payload})

    if not payload_units:
        raise ImportError("No unit data found in the input file.")

    payload = {
        "packageSummary": package_summary,
        "rounds": max_rounds,
        "sentencesPerRound": max_sentences,
        "units": payload_units,
    }
    return payload



def main() -> None:
    args = parse_args()
    rows = read_rows(args.input)
    units = collect_units(rows)
    payload = build_payload(units, args.package_summary)
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    print(
        f"Imported {len(payload['units'])} units into {args.output}."
        f" Max rounds/unit: {payload['rounds']} | sentences/round: {payload['sentencesPerRound']}"
    )


if __name__ == "__main__":
    main()
