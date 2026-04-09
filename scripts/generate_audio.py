#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = PROJECT_ROOT / "assets" / "data" / "course-data.js"
AUDIO_DIR = PROJECT_ROOT / "assets" / "audio" / "terms"


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    stripped = "".join(char for char in normalized if not unicodedata.combining(char))
    slug = re.sub(r"[^a-z0-9]+", "-", stripped).strip("-")
    return slug


def load_course_data() -> dict:
    raw_text = DATA_FILE.read_text(encoding="utf-8")
    match = re.search(r"window\.COURSE_DATA\s*=\s*(\{.*\})\s*;\s*$", raw_text, re.S)

    if not match:
        raise ValueError(f"无法从 {DATA_FILE} 中解析 window.COURSE_DATA。")

    return json.loads(match.group(1))


def collect_audio_entries(course_data: dict) -> list[tuple[str, str]]:
    entries: dict[str, str] = {}

    for unit in course_data.get("units", []):
        for group_name in ("roots", "affixes"):
            for morpheme in unit.get(group_name, []):
                for example in morpheme.get("examples", []):
                    phrase = example.get("audioText") or example.get("term")
                    if not phrase:
                        continue

                    slug = slugify(phrase)
                    entries.setdefault(slug, phrase)

    return list(entries.items())


def ensure_tools_exist() -> None:
    for command in ("say", "afconvert"):
        result = subprocess.run(
            ["which", command],
            check=False,
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            raise RuntimeError(f"未找到命令：{command}")


def generate_audio_file(text: str, output_path: Path, voice: str, rate: int) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        aiff_path = temp_dir_path / "temp.aiff"

        subprocess.run(
            ["say", "-v", voice, "-r", str(rate), "-o", str(aiff_path), text],
            check=True
        )
        subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", "LEI16", str(aiff_path), str(output_path)],
            check=True
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="为医学英语术语批量生成 wav 音频。")
    parser.add_argument("--voice", default="Samantha", help="say 使用的发音人，默认 Samantha")
    parser.add_argument("--rate", type=int, default=150, help="朗读语速，默认 150")
    parser.add_argument("--force", action="store_true", help="即使音频已存在也重新生成")
    args = parser.parse_args()

    ensure_tools_exist()
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    course_data = load_course_data()
    entries = collect_audio_entries(course_data)

    created_count = 0
    skipped_count = 0

    for slug, phrase in entries:
        output_path = AUDIO_DIR / f"{slug}.wav"

        if output_path.exists() and not args.force:
            skipped_count += 1
            print(f"skip   {output_path.name}")
            continue

        generate_audio_file(phrase, output_path, args.voice, args.rate)
        created_count += 1
        print(f"create {output_path.name}")

    print()
    print(f"完成：新建 {created_count} 个，跳过 {skipped_count} 个。")


if __name__ == "__main__":
    main()
