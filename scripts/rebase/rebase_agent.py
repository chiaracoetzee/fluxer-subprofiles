#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Autonomous Antigravity Rebase Agent powered by Gemini 3.8 Flash.
Operates across the repository with essential git conflict tools
(run_command, view_file, edit_file, search_dir, find_file) to inspect
codebase context, resolve merge conflicts, and verify test suites.
Generates human-readable Markdown transcripts and logs all actions.
"""

import asyncio
from datetime import datetime, timezone
import json
import os
import re
import subprocess
import sys

from google.antigravity import (
    Agent,
    BuiltinTools,
    CapabilitiesConfig,
    GeminiAPIEndpoint,
    GeminiModelOptions,
    LocalAgentConfig,
    ModelAPIRetryConfig,
    ModelOutputRetryConfig,
    ModelTarget,
    ModelType,
    RetryConfig,
    ThinkingLevel,
    types,
)
from google.antigravity.hooks import policy

ESCALATION_FILE = "/tmp/rebase_escalation_reason.md"
MD_TRANSCRIPT_FILE = "/tmp/rebase_transcript.md"
APP_DATA_DIR = "/tmp/antigravity_data"
LOG_SAVE_DIR = "/tmp/antigravity_data/sessions"
CONVERSATION_ID = "fluxer-rebase-automation-session"
TIMEOUT_SECONDS = 600  # 10 minute internal timeout


class MarkdownLogger:
    """Logs the agent session to a human-readable Markdown document."""

    def __init__(self, filepath: str = MD_TRANSCRIPT_FILE):
        self.filepath = filepath
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        self.write_raw(
            f"# 🤖 Antigravity Rebase Agent Session Transcript\n\n"
            f"- **Timestamp**: {now_str}\n"
            f"- **Model**: Gemini 3.8 Flash (`gemini-3.8-flash`)\n"
            f"- **Conversation ID**: `{CONVERSATION_ID}`\n\n"
            f"---\n\n"
        )

    def write_raw(self, content: str):
        with open(self.filepath, "a", encoding="utf-8") as f:
            f.write(content)

    def log_section(self, title: str, body: str):
        self.write_raw(f"### {title}\n\n{body}\n\n")

    def log_turn(self, turn_num: int, prompt: str, output: str):
        self.write_raw(
            f"## 🔄 Turn {turn_num}\n\n"
            f"#### User Prompt\n```text\n{prompt}\n```\n\n"
            f"#### Agent Response\n{output or '*(No text emitted)*'}\n\n"
            f"---\n\n"
        )


logger = MarkdownLogger()


def run_cmd(cmd: list[str], check: bool = False) -> str:
    """Run a shell command and return trimmed output."""
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=check)
    return res.stdout.strip()


def extract_retry_delay(error_msg: str, default: float = 22.0, buffer: float = 3.0) -> float:
    """Extracts the exact retry cooldown requested by Google's API, with a safety buffer."""
    m1 = re.search(r"retry in ([0-9]+(?:\.[0-9]+)?)\s*s", error_msg, re.IGNORECASE)
    if m1:
        return float(m1.group(1)) + buffer

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


def export_jsonl_transcripts():
    """Converts any raw JSONL transcripts produced by the Go harness into clean Markdown."""
    try:
        brain_dir = os.path.join(APP_DATA_DIR, "brain", CONVERSATION_ID, ".system_generated", "logs")
        jsonl_path = os.path.join(brain_dir, "transcript.jsonl")
        if not os.path.exists(jsonl_path):
            return

        out_path = os.path.join(APP_DATA_DIR, "detailed_jsonl_transcript.md")
        with open(jsonl_path, "r", encoding="utf-8") as f, open(out_path, "w", encoding="utf-8") as out:
            out.write("# 📋 Detailed Step-by-Step Trajectory Transcript\n\n")
            for line in f:
                if not line.strip():
                    continue
                try:
                    step = json.loads(line)
                    step_type = step.get("type", "UNKNOWN")
                    source = step.get("source", "")
                    content = step.get("content", "")
                    tool_calls = step.get("tool_calls", [])

                    out.write(f"### Step {step.get('step_index', '?')} [{source} - {step_type}]\n")
                    if content:
                        out.write(f"{content}\n\n")
                    if tool_calls:
                        out.write("**Tool Calls:**\n```json\n" + json.dumps(tool_calls, indent=2) + "\n```\n\n")
                except Exception:
                    continue
        print(f"[Antigravity Agent] Detailed trajectory exported to {out_path}")
    except Exception as e:
        print(f"[Antigravity Agent] Note: could not export jsonl transcript: {e}", file=sys.stderr)


async def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(APP_DATA_DIR, exist_ok=True)
    os.makedirs(LOG_SAVE_DIR, exist_ok=True)

    # Configure Gemini 3.8 Flash model target with low thinking level to eliminate empty candidate errors
    model_endpoint = GeminiAPIEndpoint(
        api_key=api_key,
        options=GeminiModelOptions(thinking_level=ThinkingLevel.LOW),
    )
    model_target = ModelTarget(
        name="gemini-3.8-flash",
        types=[ModelType.TEXT],
        endpoint=model_endpoint,
    )

    # Prune capabilities to ONLY essential git & code tools to drastically reduce token payload and prevent 429s
    capabilities = CapabilitiesConfig(
        enabled_tools=[
            BuiltinTools.RUN_COMMAND,
            BuiltinTools.VIEW_FILE,
            BuiltinTools.EDIT_FILE,
            BuiltinTools.SEARCH_DIR,
            BuiltinTools.FIND_FILE,
        ],
        enable_subagents=False,
    )

    # If --self-test flag is passed, verify connectivity with Gemini 3.8 Flash
    if "--self-test" in sys.argv:
        print("[Antigravity Agent] Running API connectivity self-test with Gemini 3.8 Flash...")
        test_config = LocalAgentConfig(
            system_instructions="You are an autonomous AI test assistant. Reply concisely.",
            capabilities=CapabilitiesConfig(enabled_tools=[BuiltinTools.RUN_COMMAND], enable_subagents=False),
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
    logger.log_section("Initial Conflict & Repository State", f"```text\n{conflict_summary}\n```")

    system_instructions = (
        "You are an expert autonomous software engineer and Git conflict resolution agent for the Fluxer codebase, "
        "powered by Gemini 3.8 Flash.\n\n"
        "A git rebase of `features/subprofiles` (our branch implementing persona subprofiles) against `upstream/main` "
        "is currently in progress and encountered conflicts or requires test verification.\n\n"
        "YOU HAVE ACCESS TO ESSENTIAL CODEBASE TOOLS:\n"
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

    print("[Antigravity Agent] Initializing streamlined autonomous Antigravity agent with Gemini 3.8 Flash...")
    config = LocalAgentConfig(
        system_instructions=system_instructions,
        capabilities=capabilities,
        policies=[policy.allow_all()],
        workspaces=[repo_dir],
        api_key=api_key,
        model=model_target,
        app_data_dir=APP_DATA_DIR,
        save_dir=LOG_SAVE_DIR,
        conversation_id=CONVERSATION_ID,
        session_continuation_mode=types.SessionContinuationMode.CREATE_OR_RESUME,
        retry_config=retry_config,
    )

    async def run_resolution():
        max_turns = 10
        turn = 0
        while turn < max_turns:
            turn += 1
            if turn > 1:
                print("[Antigravity Agent] Pausing 5s between turns for rate-limit safety...", file=sys.stderr)
                await asyncio.sleep(5)
            curr_prompt = prompt if turn == 1 else "Please continue advancing the rebase and verifying tests until completely finished."
            try:
                print(f"[Antigravity Agent] Active resolution turn {turn}/{max_turns}...")
                full_output = []
                async with Agent(config) as agent:
                    response = await agent.chat(curr_prompt)

                    async for token in response:
                        full_output.append(token)
                        sys.stdout.write(token)
                        sys.stdout.flush()
                    print("\n[Antigravity Agent] Turn finished.")

                turn_text = "".join(full_output)
                logger.log_turn(turn, curr_prompt, turn_text)

                # Check for human escalation
                if os.path.exists(ESCALATION_FILE):
                    with open(ESCALATION_FILE, "r", encoding="utf-8") as f:
                        reason = f.read().strip()
                    logger.log_section("⚠️ Human Escalation Triggered", reason)
                    print(f"\n[Antigravity Agent] Human intervention requested:\n{reason}\n", file=sys.stderr)
                    sys.exit(1)

                if "[ESCALATION REQUIRED" in turn_text:
                    reason = turn_text.split("[ESCALATION REQUIRED", 1)[1].split("]", 1)[0].strip(": ")
                    with open(ESCALATION_FILE, "w", encoding="utf-8") as f:
                        f.write(f"**Reason for Escalation:**\n{reason}\n")
                    logger.log_section("⚠️ Human Escalation Triggered", reason)
                    print(f"\n[Antigravity Agent] Escalation flagged: {reason}\n", file=sys.stderr)
                    sys.exit(1)

                # Post-check: Verify if rebase has completed
                git_dir = run_cmd(["git", "rev-parse", "--git-dir"])
                rebase_merge = os.path.join(git_dir, "rebase-merge")
                rebase_apply = os.path.join(git_dir, "rebase-apply")
                if not os.path.exists(rebase_merge) and not os.path.exists(rebase_apply):
                    unmerged = run_cmd(["git", "diff", "--name-only", "--diff-filter=U"])
                    if not unmerged:
                        logger.log_section("✅ Success", "All rebase commits and tests completed cleanly!")
                        print("[Antigravity Agent] All rebase steps completed cleanly!")
                        return
                    else:
                        print(f"[Antigravity Agent] Unmerged files remain: {unmerged}. Continuing...")
                else:
                    print("[Antigravity Agent] Rebase still in progress. Continuing session...")

            except Exception as e:
                err_str = str(e)
                print(f"\n[Antigravity Agent] Execution notice: {err_str}", file=sys.stderr)

                # Dynamic Google API 429 cooldown handling
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "Quota exceeded" in err_str:
                    delay = extract_retry_delay(err_str, default=22.0, buffer=3.0)
                    msg = (
                        f"Google rate limit (429) encountered. Cooldown window active; "
                        f"sleeping {delay:.1f}s before resuming session..."
                    )
                    logger.log_section("⏳ Rate Limit Backoff", msg)
                    print(f"[Antigravity Agent] {msg}", file=sys.stderr)
                    await asyncio.sleep(delay)
                    continue

                if turn < max_turns:
                    logger.log_section("⚠️ Turn Notice", f"Encountered: `{err_str}`. Retrying in 5s...")
                    print("[Antigravity Agent] Retrying turn in 5s...", file=sys.stderr)
                    await asyncio.sleep(5)
                    continue
                else:
                    logger.log_section("❌ Fatal Failure", f"Max turns exceeded: `{err_str}`")
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
        logger.log_section("⏰ Timeout Reached", timeout_msg)
        print(f"\n[Antigravity Agent] {timeout_msg}\n", file=sys.stderr)
        with open(ESCALATION_FILE, "w", encoding="utf-8") as f:
            f.write(timeout_msg)
        sys.exit(1)
    finally:
        export_jsonl_transcripts()


if __name__ == "__main__":
    asyncio.run(main())
