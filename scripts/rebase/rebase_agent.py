#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Automated Git Conflict Resolution Agent powered by Gemini 2.5 Flash.
Inspects Git merge conflict markers during an active rebase, provides hyperspecific
context to Gemini, applies the resolution, and continues the rebase.
"""

import os
import re
import subprocess
import sys

try:
    from google import genai
except ImportError:
    print("Error: 'google-genai' SDK is not installed. Run: pip install google-genai", file=sys.stderr)
    sys.exit(1)


def run_cmd(cmd: list[str], check: bool = True) -> str:
    """Execute a shell command and return trimmed stdout."""
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=check)
    return res.stdout.strip()


def get_conflicted_files() -> list[str]:
    """Get list of unmerged files with active conflict markers."""
    output = run_cmd(["git", "diff", "--name-only", "--diff-filter=U"], check=False)
    if not output:
        return []
    return [line.strip() for line in output.splitlines() if line.strip()]


def is_rebase_in_progress() -> bool:
    """Check whether git rebase is currently active."""
    git_dir = run_cmd(["git", "rev-parse", "--git-dir"], check=False)
    if not git_dir:
        return False
    return os.path.exists(os.path.join(git_dir, "rebase-merge")) or os.path.exists(
        os.path.join(git_dir, "rebase-apply")
    )


def strip_markdown_fences(content: str) -> str:
    """Strip triple-backtick markdown fences if returned by the LLM."""
    trimmed = content.strip()
    # Match ```optional_lang\n ... \n```
    match = re.match(r"^```[a-zA-Z0-9_-]*\n(.*)\n```$", trimmed, re.DOTALL)
    if match:
        return match.group(1).rstrip() + "\n"
    return trimmed + "\n" if not trimmed.endswith("\n") else trimmed


def resolve_file_conflict(client: genai.Client, filepath: str, model_id: str = "gemini-2.5-flash") -> None:
    """Read a conflicted file, send hyperspecific context to Gemini, and overwrite with resolution."""
    print(f"\n[AI Agent] Resolving conflict in: {filepath}")

    if not os.path.exists(filepath):
        print(f"[AI Agent] Warning: File {filepath} does not exist on disk. Skipping.")
        return

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        conflicted_content = f.read()

    if "<<<<<<<" not in conflicted_content:
        print(f"[AI Agent] No conflict markers found in {filepath}. Staging file.")
        run_cmd(["git", "add", filepath])
        return

    # Gather commit context for better semantic resolution
    upstream_commit = run_cmd(["git", "log", "-1", "--format=%h: %s", "HEAD"], check=False)
    feature_commit = run_cmd(["git", "log", "-1", "--format=%h: %s", "REBASE_HEAD"], check=False)

    prompt = f"""You are an expert full-stack TypeScript/Rust software engineer resolving Git merge conflicts for the Fluxer repository.

We are rebasing our feature branch (`features/subprofiles`, implementing subprofiles/personas) onto `upstream/main`.

FILE TO RESOLVE: {filepath}

UPSTREAM COMMIT CONTEXT:
{upstream_commit or 'Latest upstream changes'}

OUR FEATURE COMMIT CONTEXT:
{feature_commit or 'Subprofiles / Personas implementation'}

RULES FOR CONFLICT RESOLUTION:
1. PRESERVE all subprofile/persona functionality, models, endpoints, store methods, and unit tests introduced on our branch.
2. ADOPT upstream architectural changes, refactors, dependencies, and upstream bug fixes cleanly without deleting our subprofile code.
3. CAREFULLY MERGE imports: combine imported symbols from both upstream and feature branch; do not remove symbols needed by either side.
4. REMOVE all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
5. OUTPUT REQUIREMENT: Return ONLY the complete, resolved file content. Do NOT wrap in markdown fences (no ``` or ```typescript). Do NOT include conversational explanations. Return raw valid code only.

CONFLICTED FILE CONTENT:
{conflicted_content}
"""

    response = client.models.generate_content(
        model=model_id,
        contents=prompt,
    )

    resolved_text = response.text
    if not resolved_text:
        raise RuntimeError(f"Gemini returned empty response for {filepath}")

    clean_content = strip_markdown_fences(resolved_text)

    # Sanity check: Ensure conflict markers were eliminated
    if "<<<<<<<" in clean_content or ">>>>>>>" in clean_content:
        raise ValueError(f"Gemini response for {filepath} still contains unresolved conflict markers!")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(clean_content)

    # Stage the resolved file
    run_cmd(["git", "add", filepath])
    print(f"[AI Agent] Successfully resolved and staged: {filepath}")


def run_self_test(client: genai.Client, model_id: str = "gemini-2.5-flash") -> None:
    """Verify Gemini API connectivity with a mock conflict snippet."""
    print("[AI Agent] Running API connectivity self-test...")
    test_conflict = """import { A } from './a';
<<<<<<< HEAD
import { B } from './b';
=======
import { C } from './c';
>>>>>>> subprofiles
export const test = 1;"""

    prompt = f"""Resolve this merge conflict cleanly by combining imports. Return only raw code without markdown backticks:
{test_conflict}"""

    response = client.models.generate_content(
        model=model_id,
        contents=prompt,
    )
    result = strip_markdown_fences(response.text or "")
    if "import { B }" in result and "import { C }" in result and "<<<<<<<" not in result:
        print("[AI Agent] Self-test PASSED! Gemini 2.5 Flash resolved test conflict successfully.")
    else:
        print(f"[AI Agent] Self-test warning: unexpected output:\n{result}")


def main() -> None:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    if "--self-test" in sys.argv:
        run_self_test(client)
        sys.exit(0)

    if not is_rebase_in_progress() and not get_conflicted_files():
        print("[AI Agent] No active rebase or conflicts detected. Nothing to do.")
        sys.exit(0)

    max_steps = 20
    step = 0

    while is_rebase_in_progress() or get_conflicted_files():
        step += 1
        if step > max_steps:
            raise RuntimeError(f"Rebase agent exceeded maximum iterations ({max_steps}). Aborting.")

        conflicts = get_conflicted_files()
        print(f"[AI Agent] Rebase step {step}: found {len(conflicts)} conflicted files.")

        for filepath in conflicts:
            resolve_file_conflict(client, filepath)

        # Attempt to continue rebase
        print("[AI Agent] Running: git -c core.editor=true rebase --continue")
        res = subprocess.run(
            ["git", "-c", "core.editor=true", "rebase", "--continue"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        if res.returncode == 0:
            print("[AI Agent] Rebase step completed successfully.")
            if not is_rebase_in_progress():
                print("[AI Agent] Entire rebase has finished cleanly!")
                break
        else:
            remaining = get_conflicted_files()
            if remaining:
                print(f"[AI Agent] Next commit has conflicts in {len(remaining)} files. Continuing loop...")
            else:
                print(f"[AI Agent] Git rebase --continue error:\n{res.stderr}")
                if "No changes" in res.stderr or "apply empty" in res.stderr:
                    print("[AI Agent] Skipping empty commit: git rebase --skip")
                    run_cmd(["git", "rebase", "--skip"])
                else:
                    raise RuntimeError(f"Git rebase --continue failed: {res.stderr}")


if __name__ == "__main__":
    main()
