#!/usr/bin/env python3
"""
build_packs.py — Who Wants to Be Smart? DLC pack builder
─────────────────────────────────────────────────────────
Usage:
    cd dlc_website
    python3 scripts/build_packs.py [--pack <pack_id>] [--dry-run]

What it does:
    For each subdirectory under packs/ that contains a questions.json:
      1. Validates the questions.json schema.
      2. Reads the version from questions.json.
      3. Zips the directory as  packs/<pack_id>_v<version>.zip
      4. Prints the output path and byte size.

Flags:
    --pack <id>   Build only the named pack (default: all).
    --dry-run     Validate + report without writing any ZIP files.
    --help        Show this message.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import zipfile
from pathlib import Path
from typing import Any


# ── Colours for terminal output ───────────────────────────────────────────────
GREEN  = '\033[92m'
YELLOW = '\033[93m'
RED    = '\033[91m'
CYAN   = '\033[96m'
RESET  = '\033[0m'
BOLD   = '\033[1m'

def ok(msg: str)   -> None: print(f'{GREEN}  ✔  {msg}{RESET}')
def warn(msg: str) -> None: print(f'{YELLOW}  ⚠  {msg}{RESET}')
def err(msg: str)  -> None: print(f'{RED}  ✖  {msg}{RESET}')
def info(msg: str) -> None: print(f'{CYAN}  ℹ  {msg}{RESET}')
def head(msg: str) -> None: print(f'\n{BOLD}{msg}{RESET}')


# ── Schema validation ─────────────────────────────────────────────────────────

REQUIRED_PACK_KEYS    = {'pack_id', 'pack_name', 'version', 'questions'}
REQUIRED_QUESTION_KEYS = {'id', 'text', 'difficulty', 'category', 'choices'}
REQUIRED_CHOICE_KEYS  = {'id', 'text', 'is_correct'}


def validate_questions(data: Any, pack_dir: Path) -> list[str]:
    """Return a list of validation error strings (empty = valid)."""
    errors: list[str] = []

    # top-level keys
    missing = REQUIRED_PACK_KEYS - set(data.keys()) if isinstance(data, dict) else REQUIRED_PACK_KEYS
    if missing:
        errors.append(f'Missing top-level keys: {missing}')
        return errors  # can't proceed without structure

    questions = data.get('questions', [])
    if not isinstance(questions, list) or len(questions) == 0:
        errors.append('"questions" must be a non-empty list')
        return errors

    ids_seen: set[str] = set()

    for idx, q in enumerate(questions, 1):
        prefix = f'Q{idx} (id={q.get("id", "?")})'

        # required keys
        qmissing = REQUIRED_QUESTION_KEYS - set(q.keys())
        if qmissing:
            errors.append(f'{prefix}: missing keys {qmissing}')
            continue

        # duplicate id
        qid = q['id']
        if qid in ids_seen:
            errors.append(f'{prefix}: duplicate id "{qid}"')
        ids_seen.add(qid)

        choices = q.get('choices', [])

        # must have exactly 4 choices
        if not isinstance(choices, list) or len(choices) != 4:
            errors.append(f'{prefix}: must have exactly 4 choices (got {len(choices)})')
            continue

        # choice keys + exactly 1 correct
        correct_count = 0
        choice_ids: set[str] = set()
        for c in choices:
            cmissing = REQUIRED_CHOICE_KEYS - set(c.keys())
            if cmissing:
                errors.append(f'{prefix} choice {c.get("id","?")}: missing keys {cmissing}')
            if c.get('id') in choice_ids:
                errors.append(f'{prefix}: duplicate choice id "{c.get("id")}"')
            choice_ids.add(c.get('id'))
            if c.get('is_correct') is True:
                correct_count += 1

        if correct_count != 1:
            errors.append(f'{prefix}: must have exactly 1 correct choice (found {correct_count})')

    return errors


# ── Pack builder ──────────────────────────────────────────────────────────────

def build_pack(pack_dir: Path, out_dir: Path, dry_run: bool) -> bool:
    """
    Validate and zip a single pack directory.
    Returns True on success, False on validation failure.
    """
    questions_file = pack_dir / 'questions.json'
    if not questions_file.exists():
        err(f'{pack_dir.name}: no questions.json found — skipping')
        return False

    head(f'Pack: {pack_dir.name}')

    # load JSON
    try:
        data = json.loads(questions_file.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        err(f'Invalid JSON: {e}')
        return False

    # validate
    validation_errors = validate_questions(data, pack_dir)
    if validation_errors:
        err(f'Validation failed ({len(validation_errors)} error(s)):')
        for ve in validation_errors:
            print(f'     • {ve}')
        return False

    q_count = len(data['questions'])
    version  = data.get('version', 1)
    ok(f'Validated {q_count} questions (version {version})')

    # zip name
    zip_name = f'{pack_dir.name}_v{version}.zip'
    zip_path = out_dir / zip_name

    if dry_run:
        info(f'Dry run — would write: {zip_path}')
        return True

    # write zip
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            for file_path in sorted(pack_dir.rglob('*')):
                if file_path.is_file():
                    arcname = file_path.relative_to(pack_dir)
                    zf.write(file_path, arcname)
                    info(f'  + {arcname}')
    except OSError as e:
        err(f'Failed to write ZIP: {e}')
        return False

    size_kb = zip_path.stat().st_size / 1024
    ok(f'Written: {zip_path}  ({size_kb:.1f} KB)')
    return True


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description='Build DLC pack ZIP files for Who Wants to Be Smart?',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--pack',    metavar='PACK_ID', help='Build only this pack')
    parser.add_argument('--dry-run', action='store_true', help='Validate only, no ZIP written')
    args = parser.parse_args()

    # locate dlc_website root (script is in scripts/)
    script_dir = Path(__file__).resolve().parent
    root_dir   = script_dir.parent
    packs_dir  = root_dir / 'packs'

    if not packs_dir.is_dir():
        err(f'packs/ directory not found at {packs_dir}')
        sys.exit(1)

    # gather pack directories
    if args.pack:
        pack_dirs = [packs_dir / args.pack]
        if not pack_dirs[0].is_dir():
            err(f'Pack directory not found: {pack_dirs[0]}')
            sys.exit(1)
    else:
        pack_dirs = sorted(
            p for p in packs_dir.iterdir()
            if p.is_dir() and (p / 'questions.json').exists()
        )

    if not pack_dirs:
        warn('No pack directories with questions.json found.')
        sys.exit(0)

    print(f'\n{BOLD}Who Wants to Be Smart? — DLC Pack Builder{RESET}')
    print(f'Root : {root_dir}')
    print(f'Packs: {len(pack_dirs)} found')
    if args.dry_run:
        print(f'{YELLOW}Dry-run mode — no files will be written{RESET}')

    success = 0
    failure = 0
    for pd in pack_dirs:
        if build_pack(pd, packs_dir, dry_run=args.dry_run):
            success += 1
        else:
            failure += 1

    print()
    print('─' * 48)
    ok(f'{success} pack(s) built successfully') if success else None
    err(f'{failure} pack(s) failed')            if failure else None
    print()

    sys.exit(1 if failure else 0)


if __name__ == '__main__':
    main()
