# Branch Filter: Show Current Branch Commits Only

**Date**: 2026-07-01
**Status**: Design

## 1. Feature Summary

Add a toggle button in the Git Graph control bar that, when enabled, filters the commit table to show only commits on the current branch's direct path (first-parent chain from HEAD). Commits brought in from merged branches are hidden.

## 2. Algorithm

```
computeCurrentBranchCommits(commits, commitHead, commitLookup):
  visible = Set()
  current = commitHead
  while current != null:
    visible.add(current)
    commit = commits[commitLookup[current]]
    if commit.parents.length > 0:
      current = commit.parents[0]  // follow first parent
    else:
      current = null
  return visible
```

- UNCOMMITTED changes (`*`) are always visible
- If `commitHead` is null (empty repo / no HEAD), filtering is disabled
- Works correctly with detached HEAD (commitHead is still a valid hash)

## 3. UI

- **Location**: Control bar, between Fetch button and Find button
- **Icon (off)**: `eyeOpen` SVG, tooltip `"Show Current Branch Only"`
- **Icon (on)**: `eyeClosed` SVG with `.active` class, tooltip `"Show All Commits"`
- **Interaction**: Click toggles state; re-renders table immediately; no git reload
- **Disabled state**: When no HEAD exists, button is disabled with tooltip `"No current branch"`

## 4. Scope

### In scope
- Toggle button in control bar
- Client-side filtering of commit table rows based on first-parent traversal from HEAD
- State persisted in WebViewState (survives panel close/reopen)
- Works with "Load More Commits"

### Out of scope
- SVG graph lines are NOT filtered (graph remains full)
- No changes to backend/git commands
- No new extension settings in package.json
- No changes to the `onlyFollowFirstParent` config

## 5. Files Changed

| File | Changes |
|------|---------|
| `web/main.ts` | Add `branchFilterEnabled` field; `computeCurrentBranchCommits()` method; modify `renderTable()` to skip filtered commits; modify `saveState()`; modify constructor to restore state and bind button; modify `clearCommits()` |
| `web/styles/main.css` | Add `.branchFilterBtn.active` style |

## 6. Data Flow

```
User clicks toggle
  → this.branchFilterEnabled = !this.branchFilterEnabled
  → this.saveState()
  → this.render()
    → renderGraph()        // unchanged
    → renderTable()        // skips rows not in visible set
```

## 7. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty repo / no HEAD | Button disabled, tooltip "No current branch" |
| Detached HEAD | Filter works from detached HEAD position |
| Switching repos | Filter state preserved (toggle stays as-is) |
| Load More Commits | New commits immediately filtered by existing toggle |
| Toggle off after on | All commits visible again (instant) |
| First commit in repo (no parents) | Still shown (traversal stops at root) |

## 8. Test Suggestions

- Toggle on → only first-parent chain commits visible
- Toggle off → all commits visible
- Toggle on then Load More → new commits filtered
- Empty repo → button disabled
- State persists across panel close/reopen
- Works correctly with merge commits
