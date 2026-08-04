#!/usr/bin/env python3

import argparse
import os
import re
import subprocess
from pathlib import Path

import yaml


def git_output(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        check=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.stdout.strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生成分类发布日志")
    parser.add_argument("--mode", choices=("dev", "release"), required=True)
    parser.add_argument("--current-ref", required=True)
    parser.add_argument("--current-tag", default="")
    parser.add_argument("--intro", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def load_categories() -> list[dict[str, object]]:
    config_path = Path(".github/changelog.yml")
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    categories = config.get("categories", [])
    if not categories or not any("*" in item.get("prefixes", []) for item in categories):
        raise SystemExit(".github/changelog.yml 必须包含其他更新分类")
    return categories


def find_previous_tag(mode: str, current_tag: str) -> str:
    tags = git_output("tag", "--list", "v*", "--sort=-v:refname").splitlines()
    if mode == "dev":
        return tags[0] if tags else ""
    return next((tag for tag in tags if tag != current_tag), "")


def get_commit_subjects(mode: str, previous_tag: str, current_ref: str) -> list[str]:
    if previous_tag:
        revision_range = f"{previous_tag}..{current_ref}"
    elif mode == "release":
        revision_range = current_ref
    else:
        return []

    output = git_output("log", revision_range, "--pretty=format:%s")
    return output.splitlines() if output else []


def commit_type(subject: str) -> str | None:
    match = re.match(r"^\s*([A-Za-z]+)(?:\([^)]*\))?!?:\s*(.*)$", subject)
    return match.group(1).lower() if match else None


def sanitize(subject: str) -> str:
    # 避免提交信息中的 @xxx 在 Release 页面触发无关用户提及。
    return re.sub(r"@(?=[\w-])", "@\u200b", subject)


def build_notes(
    categories: list[dict[str, object]],
    subjects: list[str],
    intro: str,
    previous_tag: str,
    current_tag: str,
) -> str:
    catch_all = next(item for item in categories if "*" in item.get("prefixes", []))
    buckets = {str(item["title"]): [] for item in categories}

    for subject in subjects:
        subject = subject.strip()
        if not subject:
            continue
        kind = commit_type(subject)
        target = catch_all
        for category in categories:
            if kind and kind in category.get("prefixes", []):
                target = category
                break
        buckets[str(target["title"])].append(sanitize(subject))

    lines = [intro, ""]
    for category in categories:
        title = str(category["title"])
        items = buckets[title]
        if not items:
            continue
        lines.append(f"### {title}")
        lines.extend(f"- {item}" for item in items)
        lines.append("")

    if previous_tag and current_tag:
        server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
        repository = os.environ.get("GITHUB_REPOSITORY", "")
        compare_url = f"{server}/{repository}/compare/{previous_tag}...{current_tag}"
        lines.extend(["---", f"**完整变更**：[{previous_tag}...{current_tag}]({compare_url})", ""])

    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    args = parse_args()
    if args.mode == "release" and not args.current_tag:
        raise SystemExit("release 模式必须提供 --current-tag")

    categories = load_categories()
    previous_tag = find_previous_tag(args.mode, args.current_tag)
    subjects = get_commit_subjects(args.mode, previous_tag, args.current_ref)
    notes = build_notes(
        categories,
        subjects,
        args.intro,
        previous_tag,
        args.current_tag,
    )
    Path(args.output).write_text(notes, encoding="utf-8", newline="\n")
    print(f"已生成 {args.output}，提交数：{len(subjects)}，上一版本：{previous_tag or '无'}")


if __name__ == "__main__":
    main()