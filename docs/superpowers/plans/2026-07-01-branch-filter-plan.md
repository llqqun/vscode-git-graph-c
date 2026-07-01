# Branch Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggle button in the Git Graph control bar that filters the commit table to show only commits on the current branch's first-parent chain.

**Architecture:** Pure client-side filtering in `web/main.ts`. The `computeCurrentBranchCommits()` method walks the first-parent chain from `commitHead` to build a Set of visible commit hashes. `renderTable()` skips rows not in this set. State (`branchFilterEnabled`) is persisted in WebViewState.

**Tech Stack:** TypeScript (ES6 target), vanilla DOM, existing CSS patterns.

---

### Task 1: Add filter button HTML

**Files:**
- Modify: `D:\code\vscode-git-graph-c\src\gitGraphView.ts` (controls HTML template)

- [ ] **Step 1: Add `branchFilterBtn` div to controls HTML**

Insert a new `<div id="branchFilterBtn">` element in the controls bar HTML, between `#fetchBtn` and `#refreshBtn`.

In the `getHtmlForWebview` method (around line 727), after the `#fetchBtn` line, add:

```html
<div id="branchFilterBtn" title="Show Current Branch Only"></div>
```

The resulting controls section should be:

```html
<div id="findBtn" title="Find"></div>
<div id="terminalBtn" title="Open a Terminal for this Repository"></div>
<div id="settingsBtn" title="Repository Settings"></div>
<div id="fetchBtn"></div>
<div id="branchFilterBtn" title="Show Current Branch Only"></div>
<div id="refreshBtn"></div>
```

---

### Task 2: Add CSS for filter button

**Files:**
- Modify: `D:\code\vscode-git-graph-c\web\styles\main.css`

- [ ] **Step 1: Style `#branchFilterBtn` and adjust sibling positions**

Add `#branchFilterBtn` to the button selector group and position it. The button should sit between `#fetchBtn` and `#refreshBtn`.

Find the selector at line 815:
```css
#findBtn, #terminalBtn, #settingsBtn, #fetchBtn, #refreshBtn{
```

Change to:
```css
#findBtn, #terminalBtn, #settingsBtn, #fetchBtn, #branchFilterBtn, #refreshBtn{
```

Add `#branchFilterBtn` positioning. After the `#fetchBtn` rule (line 834-837), add:

```css
#branchFilterBtn{
	display:block;
	right:40px;
}
```

When fetch is supported (`.fetchSupported`), all right-side buttons shift. At line 882-896, add `#branchFilterBtn` positioning under `fetchSupported`:

```css
#controls.fetchSupported #branchFilterBtn{
	display:none;
}
```

- [ ] **Step 3: Add `#branchFilterBtn` to SVG icon size group**

Find the selector at line 862:
```css
#findBtn svg, #terminalBtn svg, #settingsBtn svg, #fetchBtn svg{
```

Change to:
```css
#findBtn svg, #terminalBtn svg, #settingsBtn svg, #fetchBtn svg, #branchFilterBtn svg{
```

- [ ] **Step 4: Add hover and active styles**

Find the hover selector at line 855:
```css
#findBtn:hover svg, #terminalBtn:hover svg, #settingsBtn:hover svg, #fetchBtn:hover svg, #refreshBtn:hover svg{
```

Change to:
```css
#findBtn:hover svg, #terminalBtn:hover svg, #settingsBtn:hover svg, #fetchBtn:hover svg, #branchFilterBtn:hover svg, #refreshBtn:hover svg{
```

---

### Task 3: Implement filter logic in web/main.ts

**Files:**
- Modify: `D:\code\vscode-git-graph-c\web\main.ts`

- [ ] **Step 1: Add `branchFilterEnabled` field**

In the `GitGraphView` class, add after `private onlyFollowFirstParent: boolean = false;` (line 12):

```typescript
private branchFilterEnabled: boolean = false;
private readonly branchFilterBtnElem: HTMLElement;
```

- [ ] **Step 2: Initialize button in constructor**

After the `terminalBtn` event listener block (after line 163) and before the closing `}` of the constructor, add:

```typescript
this.branchFilterBtnElem = document.getElementById('branchFilterBtn')!;
this.branchFilterBtnElem.innerHTML = this.branchFilterEnabled ? SVG_ICONS.eyeClosed : SVG_ICONS.eyeOpen;
this.branchFilterBtnElem.title = this.branchFilterEnabled ? 'Show All Commits' : 'Show Current Branch Only';
this.branchFilterBtnElem.addEventListener('click', () => {
	this.branchFilterEnabled = !this.branchFilterEnabled;
	this.branchFilterBtnElem.innerHTML = this.branchFilterEnabled ? SVG_ICONS.eyeClosed : SVG_ICONS.eyeOpen;
	this.branchFilterBtnElem.title = this.branchFilterEnabled ? 'Show All Commits' : 'Show Current Branch Only';
	alterClass(this.branchFilterBtnElem, 'active', this.branchFilterEnabled);
	this.saveState();
	this.render();
});
```

- [ ] **Step 3: Add `computeCurrentBranchCommits()` method**

Add after the `getCommits()` method (after line 552):

```typescript
private computeCurrentBranchCommits(): Set<string> | null {
	if (!this.branchFilterEnabled || this.commitHead === null) return null;
	const visible = new Set<string>();
	let current: string | null = this.commitHead;
	while (current !== null) {
		visible.add(current);
		const commitIndex = this.commitLookup[current];
		if (typeof commitIndex === 'undefined') break;
		const commit = this.commits[commitIndex];
		if (commit.parents.length > 0) {
			current = commit.parents[0];
		} else {
			current = null;
		}
	}
	return visible;
}
```

- [ ] **Step 4: Modify `renderTable()` to filter commits**

In `renderTable()`, after the `for (let i = 0; i < this.commits.length; i++) {` loop start (around line 830), add:

```typescript
const branchCommits = this.computeCurrentBranchCommits();
```

Then wrap the `html += ...` line inside a conditional that skips filtered commits. Find the line:

```typescript
html += '<tr class="commit' + (commit.hash === currentHash ? ' current' : '') + ...
```

Wrap it with:

```typescript
if (branchCommits === null || branchCommits.has(commit.hash) || commit.hash === UNCOMMITTED) {
	html += '<tr class="commit' + (commit.hash === currentHash ? ' current' : '') + ...
```

And add the closing `}` after the `</tr>` concatenation.

- [ ] **Step 5: Modify `saveState()` to persist filter state**

In `saveState()` (around line 697), add `branchFilterEnabled` to the `VSCODE_API.setState()` call object:

```typescript
branchFilterEnabled: this.branchFilterEnabled,
```

- [ ] **Step 6: Restore filter state from prevState**

In the constructor's state restoration block (around line 129), after the `loadCommits(...)` line, add restoration of the button state. Since the button isn't created until later in the constructor, restore from `prevState`:

Find the section where `prevState` is used:
```typescript
this.loadCommits(prevState.commits, prevState.commitHead, prevState.gitTags, prevState.moreCommitsAvailable, prevState.onlyFollowFirstParent);
```

After this line, add:
```typescript
if (typeof prevState.branchFilterEnabled === 'boolean') {
	this.branchFilterEnabled = prevState.branchFilterEnabled;
}
```

- [ ] **Step 7: Update button state on repo info load**

In the `loadRepoInfo` method, after the `renderFetchButton()` call (around line 248 area), add a call to keep the filter button visually in sync when HEAD becomes null:

Find the `renderFetchButton()` call in `loadRepoInfo` and add after it:

```typescript
if (this.branchFilterEnabled && this.gitBranchHead === null) {
	this.branchFilterEnabled = false;
	this.branchFilterBtnElem.innerHTML = SVG_ICONS.eyeOpen;
	this.branchFilterBtnElem.title = 'Show Current Branch Only';
	alterClass(this.branchFilterBtnElem, 'active', false);
	this.saveState();
}
```

---

### Task 4: Compile and verify

**Files:** None (verification only)

- [ ] **Step 1: Compile the extension**

Run at `D:\code\vscode-git-graph-c`:
```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All existing tests pass.

- [ ] **Step 3: Manual verification**

1. `npm run compile` (full build)
2. Press F5 in VS Code to launch Extension Development Host
3. Open a Git repo with merge commits
4. Click the new eye icon toggle button
5. Verify only first-parent chain commits are shown in the table
6. Click again to verify all commits return
