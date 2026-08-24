---
title: Migrate CodeMirror Record from CodeMirror 5 to CodeMirror 6
schema_version: 1
document_id: codemirror-record-cm5-to-cm6
audience:
  - application_developers
  - coding_agents
from:
  editor: codemirror@5
  recorder: codemirror-record@1
to:
  editor: "@codemirror/state@6 + @codemirror/view@6"
  recorder: codemirror-record@2
wire_contract:
  transform: forbidden
  format: established-v1-json
  verification: bidirectional-release-gate
canonical_html: https://codemirror-record.haoranyu.com/migration/
machine_contract: ./migration-contract.json
last_verified: 2026-08-24
---

# Migrate CodeMirror Record from CodeMirror 5 to CodeMirror 6

This is the canonical migration runbook for humans and coding agents. It moves
an application from CodeMirror 5 with `codemirror-record@1` to CodeMirror 6
with `codemirror-record@2` while preserving the recorder/player interface and
the established recording JSON contract.

The CodeMirror editor API changes substantially. The `codemirror-record`
surface does not: construct `CodeRecord` and `CodePlay` with the new editor
object, then keep the same recorder and player calls.

- Current CodeMirror 6 documentation: [default README](../README.md)
- CodeMirror 5 maintenance documentation:
  [`v1` README](https://github.com/Jisuanke/CodeMirror-Record/tree/v1#readme)
- Rendered version of this guide:
  [migration page](https://codemirror-record.haoranyu.com/migration/)

<a id="quick-decision"></a>

## Quick decision

| Application editor | Install | Pass to `CodeRecord` / `CodePlay` |
| --- | --- | --- |
| CodeMirror 5 | `codemirror-record@^1` + `codemirror@^5` | CM5 `CodeMirror` instance |
| CodeMirror 6 | `codemirror-record@^2` + CM6 state/view packages | CM6 `EditorView` |

Upgrade the editor and recorder package together. Do not pass a CM5 instance
to v2 or an `EditorView` to v1. If the application must host both editor
generations, install the recorder majors under npm aliases and keep each
adapter next to its matching editor runtime.

> **Do not transform existing recordings.** Treat the serialized string from
> `getRecords()` as an opaque payload and pass it directly to
> `CodePlay.addOperations()`. Do not rewrite line/character positions into CM6
> offsets. The v2 adapter performs the coordinate translation at its boundary.

<a id="migration-contract"></a>

## Machine-readable migration contract

Load [migration-contract.json](./migration-contract.json) before automating a
migration. It is the single structured source for package coordinates, the
retained surface, wire invariants, corrected runtime behavior, and the ordered
Markdown/HTML section map. The release tests verify that every declared field
and section is represented by both this runbook and the rendered page.

Compatibility is a release contract backed by the repository's bidirectional
package tests. It does not mean that the CodeMirror 5 and CodeMirror 6 editor
APIs are interchangeable.

### Corrected legacy runtime quirks

Package v2 keeps the public method and event names, but it does not preserve
eight accidental v1.1.6 behaviors. The same corrections ship on the maintained
CM5 line in v1.1.8 so applications can test them before changing editor
generations:

- `seek(0)` restores the configured playback speed and a normal `PAUSE` state.
- Backward seek restores the document, every directed selection, and its
  primary range.
- Terminal playback is already in `PAUSE`, and emits `pause`, before `end`
  listeners run. Do not assert the old `PLAY`-inside-`end` bug.
- Paste capture never mutates or duplicates an earlier non-cursor predecessor.
  Already-stored ambiguous v1.1.6 bytes still replay exactly as encoded.
- A replacement seek issued while an earlier seek is still running preserves
  the configured playback speed and the original `PLAY` or `PAUSE` state.
- A seek to duration during active playback emits exactly one `end` event.
- An equal-time compressed group with scalar `t` expands every logical
  operation at that timestamp. Published v0.3.1 through v1.1.7 readers indexed
  the scalar as if it were an interval, producing invalid operation times,
  terminal duration, and seeks. v1.1.8 and v2 accept the unchanged bytes;
  their writers use `t: [time, time]` for new compressed equal-time groups.
- An ungrouped record with interval `t: [start, end]` and no `l` is one
  logical operation at the interval end. Published v0.3.1 through v1.1.7
  players exposed the array as a non-numeric duration when that record was
  terminal; v1.1.8 and v2 use the end timestamp, and their writers emit a
  scalar for new ungrouped records.

These are runtime corrections, not a recording schema migration. Do not add a
payload transform for them.

<a id="package-installs"></a>

## 1. Change the installed packages

Keep the current CM5 line pinned while preparing fixtures:

```bash
npm install codemirror-record@^1 codemirror@^5
```

Then install the stable CM6 line and its required peer dependencies:

```bash
npm install codemirror-record@^2 @codemirror/state@^6 @codemirror/view@^6
```

Add only the language and editor features the application uses. For example:

```bash
npm install codemirror@^6 @codemirror/lang-javascript@^6
```

The CM6 umbrella `codemirror` package provides `basicSetup`. Language support
still comes from a separate package. Keep one resolved copy of each
`@codemirror/*` package so extension and state identities match.

<a id="before-after"></a>

## 2. Replace editor construction

The argument changes from a mutable CM5 `CodeMirror` instance to a CM6
`EditorView`. The recorder/player constructors and method calls stay in place.

### Before: CodeMirror 5

```js
import CodeMirror from 'codemirror';
import {CodePlay, CodeRecord} from 'codemirror-record';

const recordEditor = CodeMirror(recordMount, {
  value: initialDocument,
  mode: 'javascript',
  lineNumbers: true,
});

const playEditor = CodeMirror(playMount, {
  value: initialDocument,
  readOnly: 'nocursor',
});

const recorder = new CodeRecord(recordEditor);
recorder.listen();

const player = new CodePlay(playEditor);
```

### After: CodeMirror 6

```js
import {EditorState} from '@codemirror/state';
import {EditorView, lineNumbers} from '@codemirror/view';
import {javascript} from '@codemirror/lang-javascript';
import {CodePlay, CodeRecord} from 'codemirror-record';

function createEditor(parent, extensions = []) {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: initialDocument,
      extensions,
    }),
  });
}

const recordEditor = createEditor(recordMount, [
  lineNumbers(),
  javascript(),
]);

const playEditor = createEditor(playMount, [
  lineNumbers(),
  javascript(),
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
]);

const recorder = new CodeRecord(recordEditor);
recorder.listen();

const player = new CodePlay(playEditor);
```

`CodeRecord.listen()` installs its CM6 transaction listener. Do not add a
second DOM or input listener for the recorder; it can duplicate typed input and
miss programmatic transactions.

CM6 has no direct `CodeMirror.fromTextArea` equivalent. Create an `EditorView`
beside the textarea and copy `view.state.doc.toString()` back into the textarea
when the form is submitted.

<a id="api-surface"></a>

## 3. Keep the recorder/player surface

Only the editor argument changes. Retain these application-level calls:

| Surface | Retained in v2 | Migration action |
| --- | --- | --- |
| Recorder constructor | `new CodeRecord(editor)` | Pass an `EditorView` |
| Start recording | `recorder.listen()` | No call-site change |
| External activity | `recorder.recordExtraActivity(value)` | Keep the value JSON-serializable |
| Serialize | `recorder.getRecords()` | Store or transfer the returned string unchanged |
| Player constructor | `new CodePlay(editor, options)` | Pass an `EditorView`; keep options |
| Load | `player.addOperations(records)` | Pass v1 or v2 recording strings directly |
| Transport | `play()`, `pause()`, `seek(ms)`, `clear()` | No call-site change |
| Timeline reads | `getStatus()`, `getCurrentTime()`, `getDuration()` | No call-site change |
| Player events | `on()`, `off()`, `once()` | Keep the same event names |

The player options also retain their names:

| Player option | Purpose |
| --- | --- |
| `maxDelay` | Cap pauses between operations; `0` means no cap |
| `autoplay` | Start when operations are added |
| `autofocus` | Focus the player editor during playback |
| `speed` | Playback speed multiplier |
| `extraActivityHandler` | Apply recorded application activity |
| `extraActivityReverter` | Revert application activity while seeking backward |

The associated setters remain `setMaxDelay`, `setAutoplay`, `setAutofocus`,
`setSpeed`, `setExtraActivityHandler`, and `setExtraActivityReverter`.

The player event names remain `play`, `pause`, `seek`, `end`, and `clear`.
These are `CodePlay` events. They are distinct from CM5 editor events, which do
change during the editor migration.

<a id="editor-mappings"></a>

## 4. Translate application-owned editor calls

CM6 stores an immutable `EditorState` and applies updates by dispatching
transactions. Numeric positions are UTF-16 offsets. Translate application code
at the editor boundary:

| CodeMirror 5 | CodeMirror 6 |
| --- | --- |
| `cm.getValue()` | `view.state.doc.toString()` |
| `cm.getRange(a, b)` | `view.state.sliceDoc(a, b)` |
| `cm.getLine(n)` | `view.state.doc.line(n + 1).text` |
| `cm.lineCount()` | `view.state.doc.lines` |
| `cm.replaceRange(text, from, to)` | `view.dispatch({changes: {from, to, insert: text}})` |
| `cm.replaceSelection(text)` | `view.dispatch(view.state.replaceSelection(text))` |
| `cm.setValue(text)` | Dispatch a change replacing `0..view.state.doc.length` |
| `cm.operation(() => edits)` | Dispatch one transaction with a change set |
| `cm.focus()` | `view.focus()` |
| `cm.getWrapperElement()` | `view.dom` |
| Remove the editor DOM | `view.destroy()` |

When a transaction contains multiple ordinary change specs, their `from` and
`to` coordinates refer to the transaction's starting document. Selection
coordinates in the same transaction refer to the document after its changes.

Use a fresh `EditorState` with `view.setState(newState)` when loading a
logically different document whose old undo history and state fields must be
discarded. `view.setState()` is not a transaction: an attached recorder cannot
observe or serialize its document or selection replacement, and the new state
also discards the listener installed by `CodeRecord.listen()`.

Choose one explicit recording boundary:

- To keep the replacement inside the same recording, first dispatch an
  equivalent document/selection transaction while the recorder is attached.
  Then install an equivalent fresh state to clear history and immediately call
  the idempotent `recorder.listen()` again.
- To start a new logical session, drain the old recorder, call `setState`, then
  create a new `CodeRecord` whose documented initial value is that new state.

Calling `setState` and only re-running `listen()` records future transactions;
it does not retroactively record the reset.

<a id="positions"></a>

### Positions: application offsets versus recording positions

Application-owned CM5 `{line, ch}` positions become CM6 numeric offsets:

```js
function cm5PositionToOffset(doc, {line, ch}) {
  if (line < 0) return 0;
  if (line >= doc.lines) return doc.length;
  const targetLine = doc.line(line + 1);
  const clippedCh = ch == null ? targetLine.length :
    Math.max(0, Math.min(targetLine.length, ch));
  return targetLine.from + clippedCh;
}

function offsetToCm5Position(doc, offset) {
  const clippedOffset = Math.max(0, Math.min(doc.length, offset));
  const targetLine = doc.lineAt(clippedOffset);
  return {
    line: targetLine.number - 1,
    ch: clippedOffset - targetLine.from,
  };
}
```

These helpers are for application data only. Do not apply them to a serialized
`codemirror-record` payload. Recording positions deliberately remain zero-based
line/character pairs, and the package adapter converts them during record and
playback. The bounds checks preserve CM5's clipping behavior: a position before
the first line becomes document start, a position after the last line becomes
document end, and `ch` is clipped to the selected line.

<a id="selections"></a>

## 5. Translate selections without losing direction

| CodeMirror 5 | CodeMirror 6 |
| --- | --- |
| `cm.getCursor()` | `view.state.selection.main.head` |
| `cm.listSelections()` | `view.state.selection.ranges` |
| `cm.getSelection()` | Slice `selection.main.from..to` from state |
| `cm.getSelections()` | Slice every range from state |
| `cm.somethingSelected()` | Test whether any range is non-empty |
| `cm.setCursor(pos)` | Convert `pos` to an offset, then dispatch `{selection: {anchor: offset}}` |
| `cm.setSelection(anchor, head)` | Convert both positions to offsets, then dispatch `{selection: {anchor: anchorOffset, head: headOffset}}` |
| `cm.setSelections(ranges, primary)` | Normalize touching/overlapping input according to the application's CM5 semantics, convert anchor/head offsets with `EditorSelection.range`, then call `EditorSelection.create(selectionRanges, primaryIndex)` |

Use `anchor` and `head` when direction matters. `from` and `to` are normalized
lower and upper bounds and cannot preserve a backward selection by themselves.

Enable `EditorState.allowMultipleSelections.of(true)` for application-owned
multi-cursor behavior. Convert each anchor/head to offsets with
`EditorSelection.range`, then call
`EditorSelection.create(selectionRanges, primaryIndex)`.

The copyable recipe below accepts an already-normalized snapshot from
`cm.listSelections()`. CM5's default `selectionsMayTouch: false` merges some
touching or overlapping raw `setSelections` inputs, while CM6 normalization is
not identical and can choose a different merged direction. Do not pass
arbitrary pre-normalization CM5 inputs directly to this recipe. Normalize them
while CM5 is still available, or define and test the application's intended
merge behavior before converting to CM6.

```js
import {EditorSelection, EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';

const editorState = EditorState.create({
  doc: initialValue,
  extensions: [
    EditorState.allowMultipleSelections.of(true),
    // ...the rest of the application's extensions
  ],
});
const view = new EditorView({state: editorState, parent: editorMount});
const previousPrimaryIndex = view.state.selection.mainIndex;

const selectionRanges = cm5Ranges.map(({anchor, head = anchor}) =>
  EditorSelection.range(
    cm5PositionToOffset(view.state.doc, anchor),
    cm5PositionToOffset(view.state.doc, head),
  ));
if (selectionRanges.length > 0) {
  const primaryIndex = cm5PrimaryIndex ?? Math.min(
    selectionRanges.length - 1,
    previousPrimaryIndex,
  );

  view.dispatch({
    selection: EditorSelection.create(selectionRanges, primaryIndex),
  });
}
```

Pass the CM5 `primary` argument through when the application supplied one.
When it was omitted, CM5 preserved the previous primary index and clamped it
to the new last index, so use
`Math.min(selectionRanges.length - 1, previousPrimaryIndex)`. Do not simply
pick the last range. When migrating an existing CM5 snapshot, find the range
from `cm5.listSelections()` whose anchor/head equal
`cm5.getCursor('anchor')` and `cm5.getCursor('head')`, and pass that index
explicitly. An empty CM5 range list is a no-op. CM6 tracks the primary range
with `selection.mainIndex`; `EditorSelection.create` would otherwise default
to the first range. It requires `SelectionRange` instances, so raw CM5
`{anchor, head}` objects are not valid CM6 ranges.

<a id="events-transactions"></a>

## 6. Replace CM5 editor events with transaction observers

CM5 used `cm.on('change', ...)`, `changes`, `cursorActivity`, and filtering
events. CM6 describes state transitions as transactions:

| CM5 integration | CM6 integration |
| --- | --- |
| `change` / `changes` | `EditorView.updateListener`, a view plugin, or state field |
| `cursorActivity` | Compare `update.startState.selection` and `update.state.selection` |
| `beforeChange` | `EditorState.changeFilter` or a transaction filter |
| `beforeSelectionChange` | Transaction filter |
| `change.origin` | `Transaction.userEvent` annotations and `isUserEvent()` |

For a common application observer:

```js
const appObserver = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    onDocumentValue(update.state.doc.toString());
  }

  if (!update.startState.selection.eq(update.state.selection)) {
    onSelection(update.state.selection);
  }
});
```

For transaction-sensitive behavior, iterate `update.transactions`. A single
view update may contain multiple transactions, and one transaction may contain
multiple simultaneous changes. Avoid reconstructing changes by diffing DOM
text.

The v2 recorder already observes CM6 transactions and maps supported
`Transaction.userEvent` annotations into the established origin vocabulary.
Do not maintain a parallel recorder listener.

Playback is marked with the reserved `Transaction.userEvent` value
`codemirror-record.playback`. This string marker is deliberate: an
identity-based custom `Annotation` created by one CommonJS/ESM entry path can
be invisible to another copy of `@codemirror/state`. The adapter obtains the
host view's own transaction types, so playback suppression continues to work
across mixed CommonJS and ESM consumers. Application code may ignore this
user-event value, but must not attach it to ordinary edits.

<a id="options-extensions"></a>

## 7. Replace CM5 options with CM6 extensions

| CodeMirror 5 | CodeMirror 6 |
| --- | --- |
| `value` | `doc` in `EditorState` or `EditorView` configuration |
| `mode: 'javascript'` | `javascript()` from `@codemirror/lang-javascript` |
| `lineNumbers: true` | `lineNumbers()` from `@codemirror/view` |
| `extraKeys` / `keyMap` | `keymap.of([...bindings])` |
| `readOnly` | `EditorState.readOnly` and optionally `EditorView.editable` |
| `cm.setOption(name, value)` | Reconfigure an extension in a `Compartment` |

Use a `Compartment` when configuration changes at runtime:

```js
import {Compartment, EditorState} from '@codemirror/state';

const tabSize = new Compartment();
const view = new EditorView({
  parent: mount,
  extensions: [tabSize.of(EditorState.tabSize.of(2))],
});

view.dispatch({
  effects: tabSize.reconfigure(EditorState.tabSize.of(4)),
});
```

A `Compartment` reconfiguration preserves the recorder listener. A full
top-level `StateEffect.reconfigure.of(...)` does not; call
`recorder.listen()` immediately afterward to reinstall it. Keep any document
or selection change that must be recorded in a separate transaction before the
top-level reconfiguration.

CM5 CSS selectors also change. For example, `.CodeMirror` becomes `.cm-editor`,
`.CodeMirror-line` becomes `.cm-line`, and `.CodeMirror-scroll` becomes
`.cm-scroller`. Rework custom themes against the CM6 DOM and decoration APIs;
do not mutate `view.contentDOM` directly.

<a id="read-only"></a>

## 8. Split read-only state from DOM editability

CM5's `readOnly` option combined several behaviors. CM6 separates them:

| Intent | CM6 extension |
| --- | --- |
| Block editing commands but keep focus and selection | `EditorState.readOnly.of(true)` |
| Disable DOM editing for a non-interactive player | Add `EditorView.editable.of(false)` |
| Keep an uneditable editor keyboard-focusable | Add `EditorView.contentAttributes.of({tabindex: '0'})` |

`EditorView.editable.of(false)` alone does not prevent programmatic dispatch.
`EditorState.readOnly.of(true)` informs commands and input handlers that edits
are blocked. Choose both facets deliberately based on focus and selection
requirements.

Playback dispatches programmatic transactions, so a read-only player can still
replay recorded changes.

<a id="history"></a>

## 9. Install history explicitly

A bare CM6 editor has no undo history or history keybindings. Install
`history()` and `historyKeymap`, or use `basicSetup`:

```js
import {history, historyKeymap, redo, undo} from '@codemirror/commands';
import {EditorView, keymap} from '@codemirror/view';

const view = new EditorView({
  parent: mount,
  extensions: [history(), keymap.of(historyKeymap)],
});

undo(view);
redo(view);
```

CM6 has no direct `clearHistory()` method. Create a new `EditorState` and call
`view.setState(newState)` when stale history must not survive a document reset,
then immediately call `recorder.listen()` if that view is being recorded. When
the reset belongs in the current recording, dispatch the equivalent replacement
first so it is captured:

```js
import {EditorState} from '@codemirror/state';

const resetSelection = {anchor: 0};

view.dispatch({
  changes: {from: 0, to: view.state.doc.length, insert: newDocument},
  selection: resetSelection,
});

view.setState(EditorState.create({
  doc: newDocument,
  selection: resetSelection,
  extensions: applicationExtensions,
}));
recorder.listen();
```

The dispatch records the replacement; `setState` only resets local state fields
and history to the same visible document and selection.

The v2 player marks replay transactions with
`Transaction.addToHistory.of(false)`, keeping playback out of the user's undo
stack. Undo and redo actions performed while recording are ordinary visible
document changes and can be captured through their transaction annotations.

<a id="wire-format"></a>

## 10. Move recordings without conversion

The editor implementation changes; the recording seam does not. Continue to
store and transport the exact string returned by `getRecords()`:

```js
const records = recorder.getRecords();

// Store or transfer `records` without parsing or rewriting it.
player.addOperations(records);
player.play();
```

The v2 release contract requires both directions:

1. A recording produced by the released v1 CM5 recorder is accepted by the v2
   CM6 player.
2. A recording produced by the v2 CM6 recorder is accepted by the released v1
   CM5 player.

That contract includes text changes, cursor and directed selection activity,
timing, supported origins, and JSON-serializable external activities. The
repository's compatibility suite gates stable releases against real packaged
artifacts and compares both real players at every logical boundary. There are
two classified timing exceptions in published v0.3.1 through v1.1.7 readers:
an ungrouped interval `t: [start, end]` with no `l`, and a compressed record
with scalar `t` plus `l > 1`. Document, directed selection, origin, and
external-activity traces must still match, but operation time, duration, and
affected seek timing may differ. v1.1.8 and v2 use the interval end for the
first shape and the scalar time for every logical operation in the second.
The operation-time exception is limited to operations expanded from an
affected record; duration may differ only when that record is terminal, and
any seek comparison may differ when its payload contains either shape. Never
rewrite either payload to hide these reader defects.
Applications should retain representative production fixtures as an
additional integration gate.

<a id="agent-procedure"></a>

## 11. Deterministic migration procedure

1. Pin the working application to `codemirror-record@^1` and `codemirror@^5`.
2. Save representative raw `getRecords()` strings without parsing them.
3. Inventory CM5 construction, `fromTextArea`, methods, events, options, custom
   CSS, selections, read-only behavior, and history calls.
4. Install `codemirror-record@^2`, `@codemirror/state@^6`, and
   `@codemirror/view@^6` plus required language/feature packages.
5. Replace every `CodeMirror(...)` instance with an `EditorView`; move `value`
   to `doc` and options to extensions.
6. Pass the `EditorView` to existing `CodeRecord` and `CodePlay` constructors.
   Preserve recorder/player method, option, and event names.
7. Translate application-owned value, edit, position, selection, event,
   configuration, read-only, history, DOM, and cleanup integrations using the
   mappings above.
8. Load the saved v1 recording strings directly into the v2 player. Do not
   transform coordinates or operation fields.
9. Record the same high-risk interactions in v2 and load those raw strings in
   a released v1 player test fixture.
10. Run the checklist below against the application's real CM6 extension set.

<a id="agent-checklist"></a>

## 12. Verification checklist for coding agents

Treat every unchecked item as a release blocker for the application migration.

- [ ] **Dependencies:** the lockfile resolves one compatible copy of each
  required `@codemirror/*` package.
- [ ] **Construction:** every recorder and player receives an `EditorView`.
- [ ] **Recorder lifecycle:** a recordable document/selection replacement is
  dispatched before `view.setState(newState)` (or starts a new recording
  baseline), and after every `setState` or full top-level
  `StateEffect.reconfigure.of(...)` the attached recorder calls the idempotent
  `recorder.listen()` again.
- [ ] **No transform:** saved recording strings reach `addOperations()` without
  parsing, coordinate conversion, schema migration, or reserialization.
- [ ] **Old to new:** representative v1 CM5 recordings finish in the expected
  CM6 document, selection, timing, and application state.
- [ ] **New to old:** representative v2 CM6 recordings finish in the expected
  released v1 CM5 document, selection, timing, and application state.
- [ ] **Selections:** forward/backward selections, multi-cursor state, and the
  primary range replay correctly.
- [ ] **Input origins:** typing, multiline edits, deletion, paste, drop, IME
  composition, undo, and redo are covered where the application uses them.
- [ ] **Playback:** play, pause/resume, seek to zero, seek forward/backward,
  speed, max delay, end, and clear behave as expected.
- [ ] **External activity:** handlers and reverters receive the original
  JSON-serializable values in both playback directions.
- [ ] **Read-only and focus:** the player matches the intended keyboard focus,
  selection, and editability behavior.
- [ ] **History:** the application installs history where needed and replay does
  not create user undo entries.
- [ ] **Cleanup:** replaced views call `view.destroy()` and obsolete CM5 DOM/CSS
  hooks are removed.

<a id="first-party-sources"></a>

## First-party sources

- [CodeMirror 5 manual](https://codemirror.net/5/doc/manual.html)
- [Official CodeMirror 5 to 6 migration guide](https://codemirror.net/docs/migration/)
- [CodeMirror 6 system guide](https://codemirror.net/docs/guide/)
- [CodeMirror 6 reference](https://codemirror.net/docs/ref/)
- [CM6 dynamic configuration example](https://codemirror.net/examples/config/)
- [CM6 read-only example](https://codemirror.net/examples/readonly/)
- [CM6 bundling example](https://codemirror.net/examples/bundle/)
- [Current CodeMirror Record README](../README.md)
- [CodeMirror Record CM5 maintenance README](https://github.com/Jisuanke/CodeMirror-Record/tree/v1#readme)

When this guide and a CodeMirror API source disagree, follow the official
CodeMirror source. When this guide and the package surface disagree, treat the
current major's README and TypeScript declarations as authoritative and update
this runbook in the same change.
