#!/usr/bin/env bash
# Auto-commit and push the current branch after each turn.
#
# Wired up as a Stop hook in .claude/settings.json so that whatever is on
# disk is also in git: every time Claude finishes a response, any changes
# are committed and pushed to the current branch's remote. No new branches
# are created — work goes straight to the branch you're already on
# (sprint-planner).
set -uo pipefail

# Always operate from the repo root, regardless of where the hook is invoked.
root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$root" || exit 0

# Nothing changed this turn -> nothing to do.
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

branch="$(git rev-parse --abbrev-ref HEAD)"

git add -A
git commit -m "Auto-sync: ${branch} ($(date -u +%Y-%m-%dT%H:%M:%SZ))" >/dev/null 2>&1

# Push the current branch to its same-named remote branch.
push_out="$(git push origin "HEAD:${branch}" 2>&1)"
if [ $? -ne 0 ]; then
  # Surface push failures to the user instead of failing silently.
  jq -n --arg m "Auto-push to '${branch}' failed: ${push_out}" '{systemMessage: $m}'
fi

exit 0
