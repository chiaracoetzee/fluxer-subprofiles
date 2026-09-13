#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Autonomous Antigravity Rebase Agent powered by Gemini 3.8 Flash.
Operates across the full repository with complete toolset access
(run_command, view_file, edit_file, search_dir, find_file) to inspect
codebase context, resolve merge conflicts, and verify test suites.
"""

import asyncio
import os
import subprocess
import sys

from google.antigravity import Agent, CapabilitiesConfig, LocalAgentConfig
from google.antigravity.hooks import policy


def run_cmd(cmd: list[str], check: bool = False) -> str:
    """Run a shell command and return trimmed output."""
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=check)
    return res.stdout.strip()


def get_conflict_summary() -> str:
    """Extract active rebase and git status conflict details."""
    unmerged = run_cmd(["git", "diff", "--name-only", "--diff-filter=U"])
    git_status = run_cmd(["git", "status", "--short"])
    upstream_head = run_cmd(["git", "log", "-1", "--format=%h: %s", "HEAD"])
    feature_head = run_cmd(["git", "log", "-1", "--format=%h: %s", "REBASE_HEAD"])

    return (
        f"Unmerged/Conflicted Files:\n{unmerged or 'None detected'}\n\n"
        f"Git Status:\n{git_status}\n\n"
        f"Upstream Commit (HEAD): {upstream_head or 'Unknown'}\n"
        f"Our Feature Commit (REBASE_HEAD): {feature_head or 'Unknown'}\n"
    )


async def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # If --self-test flag is passed, verify connectivity with Gemini 3.8 Flash
    if "--self-test" in sys.argv:
        print("[Antigravity Agent] Running API connectivity self-test with Gemini 3.8 Flash...")
        test_config = LocalAgentConfig(
            system_instructions="You are an autonomous AI test assistant.",
            capabilities=CapabilitiesConfig(),
            policies=[policy.allow_all()],
            api_key=api_key,
        )
        async with Agent(test_config) as test_agent:
            resp = await test_agent.chat("Respond with 'Antigravity Gemini 3.8 Flash is online and ready.'")
            tokens = []
            async for token in resp:
                tokens.append(token)
                sys.stdout.write(token)
                sys.stdout.flush()
            print()
        print("[Antigravity Agent] Self-test succeeded!")
        return

    repo_dir = os.getcwd()
    conflict_summary = get_conflict_summary()

    system_instructions = (
        "You are an expert autonomous software engineer and Git conflict resolution agent for the Fluxer codebase, "
        "powered by Gemini 3.8 Flash.\n\n"
        "A git rebase of `features/subprofiles` (our branch implementing persona subprofiles) against `upstream/main` "
        "is currently in progress and encountered conflicts or requires test verification.\n\n"
        "YOU HAVE ACCESS TO THE ENTIRE REPOSITORY AND FULL SYSTEM TOOLS:\n"
        "- run_command: Run shell commands (e.g. `git status`, `git diff`, `git log`, `pnpm vitest run ...`, `git add <file>`, `git rebase --continue`)\n"
        "- view_file: Read any file in the workspace to understand context, surrounding types, or upstream changes\n"
        "- edit_file / replace_file_content: Modify files to resolve conflict markers cleanly\n"
        "- search_dir / grep_search: Search across the entire codebase for symbols, imports, or definitions\n"
        "- find_file: Locate files across packages\n\n"
        "OBJECTIVES & RULES:\n"
        "1. PRESERVE ALL SUBPROFILE FEATURES: Keep all persona models, schemas, store methods, UI components, and unit tests.\n"
        "2. CLEANLY ADOPT UPSTREAM: Incorporate upstream refactors, new utilities, dependency updates, and bug fixes.\n"
        "3. RESOLVE CONFLICTS: Read conflicted files, inspect surrounding context, remove conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), "
        "and stage resolved files with `git add`.\n"
        "4. CONTINUE REBASE: Use `git -c core.editor=true rebase --continue` to advance through commits until the rebase is finished.\n"
        "5. RUN TESTS & FIX REGRESSIONS: Run test suites (`pnpm vitest run packages/schema/src/domains/persona/`, `pnpm --filter @fluxer/app test src/features/persona/`, `pnpm --filter @fluxer/api test src/api/persona/tests/`). "
        "If tests fail, inspect the failures, view related files across the repo, fix the code, and re-run tests until green.\n"
        "6. Finish your task when the rebase is complete and all test suites pass."
    )

    prompt = (
        f"Please resolve the current Git rebase conflicts and ensure the test suite passes.\n\n"
        f"Initial Repository Context:\n"
        f"{conflict_summary}\n\n"
        f"Begin by inspecting the conflicted files with your tools, checking their surrounding context and imports, "
        f"resolving the conflicts, continuing the rebase, and running the tests to verify everything passes."
    )

    print("[Antigravity Agent] Initializing full autonomous Antigravity agent with Gemini 3.8 Flash...")
    config = LocalAgentConfig(
        system_instructions=system_instructions,
        capabilities=CapabilitiesConfig(),
        policies=[policy.allow_all()],
        workspaces=[repo_dir],
        api_key=api_key,
    )

    async with Agent(config) as agent:
        print("[Antigravity Agent] Agent active. Sending rebase resolution task...")
        response = await agent.chat(prompt)

        async for token in response:
            sys.stdout.write(token)
            sys.stdout.flush()
        print("\n[Antigravity Agent] Agent session finished.")

    # Post-check: Verify rebase finished cleanly
    git_dir = run_cmd(["git", "rev-parse", "--git-dir"])
    rebase_merge = os.path.join(git_dir, "rebase-merge")
    rebase_apply = os.path.join(git_dir, "rebase-apply")
    if os.path.exists(rebase_merge) or os.path.exists(rebase_apply):
        raise RuntimeError("Rebase is still in progress after agent execution!")

    unmerged = run_cmd(["git", "diff", "--name-only", "--diff-filter=U"])
    if unmerged:
        raise RuntimeError(f"Unmerged files still remain: {unmerged}")

    print("[Antigravity Agent] All rebase steps completed cleanly!")


if __name__ == "__main__":
    asyncio.run(main())
