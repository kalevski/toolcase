#!/usr/bin/env bash
# Ralph autonomous loop — Claude Code (Opus 4.7) skill-file optimizer.
# Each iteration spawns a fresh `claude --print` instance. Memory persists via
# git history, prd.json, and progress.txt.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

MAX_ITER="${1:-50}"
MODEL="${RALPH_MODEL:-claude-opus-4-7}"
PROMPT_FILE="$SCRIPT_DIR/CLAUDE.md"
PRD_FILE="$REPO_ROOT/prd.json"
PROGRESS_FILE="$REPO_ROOT/progress.txt"

if [ ! -f "$PRD_FILE" ]; then
    echo "ERR: $PRD_FILE missing" >&2
    exit 1
fi
if [ ! -f "$PROMPT_FILE" ]; then
    echo "ERR: $PROMPT_FILE missing" >&2
    exit 1
fi
if ! command -v claude >/dev/null; then
    echo "ERR: claude CLI not found in PATH" >&2
    exit 1
fi
if ! command -v jq >/dev/null; then
    echo "ERR: jq not found" >&2
    exit 1
fi

BRANCH="$(jq -r '.branchName // "ralph/work"' "$PRD_FILE")"
CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"

if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
        echo "Switching to existing branch $BRANCH"
        git checkout "$BRANCH"
    else
        echo "Creating branch $BRANCH"
        git checkout -b "$BRANCH"
    fi
fi

[ -f "$PROGRESS_FILE" ] || : > "$PROGRESS_FILE"

PROMPT_CONTENT="$(cat "$PROMPT_FILE")"

for i in $(seq 1 "$MAX_ITER"); do
    echo ""
    echo "============================================="
    echo " Ralph iteration $i / $MAX_ITER"
    echo "============================================="

    REMAINING="$(jq '[.userStories[] | select(.passes==false)] | length' "$PRD_FILE")"
    TOTAL="$(jq '.userStories | length' "$PRD_FILE")"
    echo " Remaining: $REMAINING / $TOTAL"

    if [ "$REMAINING" -eq 0 ]; then
        echo "ALL STORIES PASS. Done."
        exit 0
    fi

    set +e
    claude \
        --print \
        --model "$MODEL" \
        --dangerously-skip-permissions \
        --append-system-prompt "You are running in an autonomous Ralph loop. Make exactly one story of progress per invocation, then stop." \
        "$PROMPT_CONTENT"
    rc=$?
    set -e

    if [ $rc -ne 0 ]; then
        echo "claude exited with $rc — continuing"
    fi

    if grep -q "<promise>COMPLETE</promise>" "$PROGRESS_FILE" 2>/dev/null; then
        echo "COMPLETE marker in progress.txt. Done."
        exit 0
    fi
done

echo ""
echo "Max iterations ($MAX_ITER) reached."
REMAINING="$(jq '[.userStories[] | select(.passes==false)] | length' "$PRD_FILE")"
echo "Stories still open: $REMAINING"
exit 0
