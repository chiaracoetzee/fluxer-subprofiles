#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Autonomous Antigravity Rebase Agent powered by Gemini 3.8 Flash.
Operates across the full repository with complete toolset access
(run_command, view_file, edit_file, search_dir, find_file) to inspect
codebase context, resolve merge conflicts, and verify test suites.
Gracefully escalates with diagnostic explanations if human intervention is needed.
"""

import asyncio
import os
import re
import subprocess
import sys

from google.antigravity import (
    Agent,
    CapabilitiesConfig,
    GeminiAPIEndpoint,
    GeminiModelOptions,
    LocalAgentConfig,
    ModelAPIRetryConfig,
    ModelOutputRetryConfig,
    ModelTarget,
    ModelType,
    RetryConfig,
    SessionContinuationMode,
    ThinkingLevel,
)
from google.antigravity.hooks import policy

ESCALATION_FILE = "/tmp/rebase_escalation_reason.md"
LOG_SAVE_DIR = "/tmp/antigravity_logs"
CONVERSATION_ID = "fluxer-rebase-session"
TIMEOUT_SECONDS = 600  # 10 minute internal timeout


def run_cmd(cmd: list[str], check: bool = False) -> str:
    """Run a shell command and return trimmed output."""
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=check)
    return res.stdout.strip()


def extract_retry_delay(error_msg: str, default: float = 22.0, buffer: float = 3.0) -> float:
    """Extracts the exact retry cooldown requested by Google's API, with a safety buffer."""
    # 1. Match 'Please retry in 18.799194076s'
    m1 = re.search(r"retry in ([0-9]+(?:\.[0-9]+)?)\s*s", error_msg, re.IGNORECASE)
    if m1:
        return float(m1.group(1)) + buffer

    # 2. Match 'retryDelay:16s'
    m2 = re.search(r"retryDelay:([0-9]+(?:\.[0-9]+)?)\s*s", error_msg, re.IGNORECASE)
    if m2:
        return float(m2.group(1)) + buffer

    return default


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

    # Configure Gemini 3.8 Flash model target with low thinking level to prevent empty candidate responses
    model_endpoint = GeminiAPIEndpoint(
        api_key=api_key,
        options=GeminiModelOptions(thinking_level=ThinkingLevel.LOW),
    )
    model_target = ModelTarget(
        name="gemini-3.8-flash",
        types=[ModelType.TEXT],
        endpoint=model_endpoint,
    )

    # If --self-test flag is passed, verify connectivity with Gemini 3.8 Flash
    if "--self-test" in sys.argv:
        print("[Antigravity Agent] Running API connectivity self-test with Gemini 3.8 Flash...")
        test_config = LocalAgentConfig(
            system_instructions="You are an autonomous AI test assistant. Reply concisely.",
            capabilities=CapabilitiesConfig(),
            policies=[policy.allow_all()],
            api_key=api_key,
            model=model_target,
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
        "- edit_file: Modify files to resolve conflict markers cleanly\n"
        "- search_dir: Search across the entire codebase for symbols, imports, or definitions\n"
        "- find_file: Locate files across packages\n\n"
        "CRITICAL TOOL-USE DIRECTIVE:\n"
        "- You MUST begin your very first response by calling a tool (e.g. `run_command` to inspect git status or diff, or `view_file` to view the conflicted files). Never return an empty message or empty candidate without tool calls.\n\n"
        "OBJECTIVES & RULES:\n"
        "1. PRESERVE ALL SUBPROFILE FEATURES: Keep all persona models, schemas, store methods, UI components, and unit tests.\n"
        "2. CLEANLY ADOPT UPSTREAM: Incorporate upstream refactors, new utilities, dependency updates, and bug fixes.\n"
        "3. RESOLVE CONFLICTS: Read conflicted files, inspect surrounding context, remove conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), "
        "and stage resolved files with `git add`.\n"
        "4. CONTINUE REBASE: Use `git -c core.editor=true rebase --continue` to advance through commits until the rebase is finished.\n"
        "5. RUN TESTS & FIX REGRESSIONS: Run test suites (`pnpm vitest run packages/schema/src/domains/persona/`, `pnpm --filter @fluxer/app test src/features/persona/`, `pnpm --filter @fluxer/api test src/api/persona/tests/`). "
        "If tests fail, inspect the failures, view related files across the repo, fix the code, and re-run tests until green.\n\n"
        "6. HUMAN INTERVENTION ESCALATION CRITERIA:\n"
        "If you determine that a conflict or regression CANNOT be safely resolved autonomously—for example:\n"
        "   - Upstream has fundamentally rewritten or removed a core architectural subsystem that subprofiles depend on,\n"
        "   - Conflicting changes require a product design or business decision that cannot be inferred from code,\n"
        "   - Resolving the conflict would require guessing intent or dropping valid subprofile logic,\n"
        "   - Repeated test failures persist after targeted debugging attempts,\n"
        "DO NOT GUESS OR FORCE UNVERIFIED CODE. You are explicitly authorized and expected to escalate:\n"
        "   a) Write a clear diagnostic markdown explanation to `/tmp/rebase_escalation_reason.md` specifying:\n"
        "      - What files or architectural components are blocked,\n"
        "      - The exact nature of the conflict or breaking change,\n"
        "      - The specific decision or action recommended for the human developer.\n"
        "   b) State clearly in your response: '[ESCALATION REQUIRED: <brief summary>]'.\n"
        "   c) Exit without completing the rebase so the automated system safely aborts and alerts the developer."
    )

    prompt = (
        f"Please resolve the current Git rebase conflicts and ensure the test suite passes.\n\n"
        f"Initial Repository Context:\n"
        f"{conflict_summary}\n\n"
        f"Begin immediately by using your tools: inspect the conflicted files, check their context, "
        f"resolve the conflicts, stage them with git add, continue the rebase, and run the vitest suites.\n"
        f"If human intervention is required, write your diagnostic report to `/tmp/rebase_escalation_reason.md` and exit."
    )

    os.makedirs(LOG_SAVE_DIR, exist_ok=True)
    retry_config = RetryConfig(
        api_retry=ModelAPIRetryConfig(
            max_retries=2,
            initial_sleep_duration_ms=5000,
            exponential_multiplier=1.5,
        ),
        model_output_retry=ModelOutputRetryConfig(
            max_retries=3,
        ),
    )

    print("[Antigravity Agent] Initializing full autonomous Antigravity agent with Gemini 3.8 Flash...")
    config = LocalAgentConfig(
        system_instructions=system_instructions,
        capabilities=CapabilitiesConfig(),
        policies=[policy.allow_all()],
        workspaces=[repo_dir],
        api_key=api_key,
        model=model_target,
        save_dir=LOG_SAVE_DIR,
        conversation_id=CONVERSATION_ID,
        session_continuation_mode=SessionContinuationMode.CREATE_OR_RESUME,
        retry_config=retry_config,
    )

    async def run_resolution():
        max_turns = 10
        turn = 0
        while turn < max_turns:
            turn += 1
            try:
                print(f"[Antigravity Agent] Active resolution turn {turn}/{max_turns}...")
                full_output = []
                async with Agent(config) as agent:
                    curr_prompt = prompt if turn == 1 else "Please continue advancing the rebase and verifying tests until completely finished."
                    response = await agent.chat(curr_prompt)

                    async for token in response:
                        full_output.append(token)
                        sys.stdout.write(token)
                        sys.stdout.flush()
                    print("\n[Antigravity Agent] Turn finished.")

                all_text = "".join(full_output)

                # Check for human escalation
                if os.path.exists(ESCALATION_FILE):
                    with open(ESCALATION_FILE, "r", encoding="utf-8") as f:
                        reason = f.read().strip()
                    print(f"\n[Antigravity Agent] Human intervention requested:\n{reason}\n", file=sys.stderr)
                    sys.exit(1)

                if "[ESCALATION REQUIRED" in all_text:
                    reason = all_text.split("[ESCALATION REQUIRED", 1)[1].split("]", 1)[0].strip(": ")
                    with open(ESCALATION_FILE, "w", encoding="utf-8") as f:
                        f.write(f"**Reason for Escalation:**\n{reason}\n")
                    print(f"\n[Antigravity Agent] Escalation flagged: {reason}\n", file=sys.stderr)
                    sys.exit(1)

                # Post-check: Verify if rebase has completed
                git_dir = run_cmd(["git", "rev-parse", "--git-dir"])
                rebase_merge = os.path.join(git_dir, "rebase-merge")
                rebase_apply = os.path.join(git_dir, "rebase-apply")
                if not os.path.exists(rebase_merge) and not os.path.exists(rebase_apply):
                    unmerged = run_cmd(["git", "diff", "--name-only", "--diff-filter=U"])
                    if not unmerged:
                        print("[Antigravity Agent] All rebase steps completed cleanly!")
                        return
                    else:
                        print(f"[Antigravity Agent] Unmerged files remain: {unmerged}. Continuing...")
                else:
                    print("[Antigravity Agent] Rebase still in progress. Continuing session...")

            except Exception as e:
                err_str = str(e)
                print(f"\n[Antigravity Agent] Execution error encountered: {err_str}", file=sys.stderr)

                # Dynamic Google API 429 cooldown handling
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "Quota exceeded" in err_str:
                    delay = extract_retry_delay(err_str, default=22.0, buffer=3.0)
                    print(
                        f"[Antigravity Agent] Google rate limit 429 encountered: requested wait detected. "
                        f"Sleeping {delay:.1f}s before resuming session...",
                        file=sys.stderr,
                    )
                    await asyncio.sleep(delay)
                    continue

                if turn < max_turns:
                    print("[Antigravity Agent] Transient error encountered. Retrying turn in 5s...", file=sys.stderr)
                    await asyncio.sleep(5)
                    continue
                else:
                    raise

        raise RuntimeError("Agent exceeded maximum allowed turns without finishing the rebase.")

    try:
        async with asyncio.timeout(TIMEOUT_SECONDS):
            await run_resolution()
    except TimeoutError:
        timeout_msg = (
            "**Reason for Escalation:**\n"
            f"The autonomous rebase agent exceeded the runtime limit of {TIMEOUT_SECONDS // 60} minutes "
            "without completing all rebase commits or tests. Escalating to human developer."
        )
        print(f"\n[Antigravity Agent] {timeout_msg}\n", file=sys.stderr)
        with open(ESCALATION_FILE, "w", encoding="utf-8") as f:
            f.write(timeout_msg)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
