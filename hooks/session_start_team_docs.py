#!/usr/bin/env python3
"""
SessionStart hook for chrome-tabgroup-controller lite team.
Injects workflow.md + role prompt when agent starts or auto-compacts.
"""
import json
import os
import subprocess
import sys


PROJECT_ROOT = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

TEAM_CONFIGS = {
    "ctc": {
        "docs_dir": os.path.join(PROJECT_ROOT, "docs/tmux/chrome-tabgroup-controller"),
        "roles": {"PO", "WORKER"},
    },
}


def get_tmux_role():
    """Get the role from tmux @role_name option using $TMUX_PANE (not cursor pane)."""
    tmux_pane = os.environ.get("TMUX_PANE")
    if not tmux_pane:
        return None
    try:
        result = subprocess.run(
            ["tmux", "show-options", "-pt", tmux_pane, "-qv", "@role_name"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        pass
    return None


def get_tmux_session():
    """Get the current tmux session name."""
    try:
        result = subprocess.run(
            ["tmux", "display-message", "-p", "#S"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        pass
    return None


def read_file_content(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except (FileNotFoundError, IOError):
        return None


def main():
    try:
        json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    session = get_tmux_session()
    if session not in TEAM_CONFIGS:
        sys.exit(0)

    team_config = TEAM_CONFIGS[session]
    docs_dir = team_config["docs_dir"]
    valid_roles = team_config["roles"]

    role = get_tmux_role()
    if not role or role not in valid_roles:
        sys.exit(0)

    context_parts = []

    overview_content = read_file_content(os.path.join(docs_dir, "workflow.md"))
    if overview_content:
        context_parts.append(f"=== TEAM WORKFLOW DOCUMENTATION ===\n\n{overview_content}")

    prompt_content = read_file_content(os.path.join(docs_dir, "prompts", f"{role}_PROMPT.md"))
    if prompt_content:
        context_parts.append(f"=== YOUR ROLE: {role} ===\n\n{prompt_content}")

    if context_parts:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": "\n\n" + "\n\n".join(context_parts)
            }
        }
        print(json.dumps(output))

    sys.exit(0)


if __name__ == "__main__":
    main()
