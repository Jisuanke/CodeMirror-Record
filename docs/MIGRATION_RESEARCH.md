---
title: CodeMirror 5 to CodeMirror 6 migration research
audience: maintainers and migration-page authoring agents
status: source notes, not the final user-facing guide
last_verified: 2026-08-24
---

# CodeMirror 5 to CodeMirror 6 migration research

## Research question

What must a `codemirror-record` consumer change when moving from CodeMirror 5
and `codemirror-record@1` to CodeMirror 6 and `codemirror-record@2`, and which
parts of the recorder/player contract must remain unchanged?

This note uses first-party sources only: the official CodeMirror 5 manual, the
official CodeMirror 6 migration/system/reference documentation, and this
package's released v1 documentation and current v2 source.

## Decision-ready summary

1. CodeMirror 6 is an architectural migration, not an in-place upgrade of the
   `CodeMirror` object. A CM5 instance is replaced by an `EditorView`; mutable
   method calls become immutable state plus dispatched transactions; named
   options become extensions; and CM5 events become transaction/view update
   mechanisms. The official [CodeMirror 5 to 6 migration guide][cm6-migration]
   explicitly organizes the migration around those changes.
2. The required `codemirror-record` application-level change is to pass a CM6
   `EditorView` to `CodeRecord` and `CodePlay`. The named exports and recorder /
   player method names are intentionally retained in the [current v2 API
   documentation](../README.md#api), matching the [released v1.1.6 API][record-v1-api].
   The current v2 runtime deliberately rejects a CM5-shaped object; see
   [`assertEditorView`](../src/codemirror6.js).
3. Recorded data must not be converted by consumers. The current CM6 recorder
   converts CM6 offsets and transactions to the established CM5-style wire
   representation, and the CM6 player converts those legacy positions back at
   playback time; see [`CodeRecord`](../src/CodeRecord.js) and the
   [CM6 adapter](../src/codemirror6.js). This is the seam that permits old JSON
   to be loaded directly by v2 and v2 JSON to remain readable by v1.
4. A migration page must distinguish the package's stable public methods from
   the editor runtime API. Statements such as “the recorder API is retained”
   must not be generalized to “CodeMirror 6 is API-compatible with CodeMirror
   5”. The latter is false by design; the official guide provides translations
   precisely because the editor APIs differ.[^migration-scope]
5. Directional selections, multiple selections, transaction grouping, event
   origins, read-only focus behavior, and undo history are the highest-risk
   areas. They need explicit guidance and tests rather than a generic “replace
   CodeMirror with EditorView” instruction.
6. Maintained v1.1.8 and v2 normalize a historical ungrouped interval
   `t: [start, end]` with no `l` to one operation at `end`. Published v0.3.1
   through v1.1.7 players exposed the interval array as a non-numeric duration
   when it was the terminal record. This is a classified reader bug, not a
   payload migration: stored bytes remain unchanged, and both maintained
   writers emit a scalar for new ungrouped records.
7. Published v0.3.1 through v1.1.7 players also indexed a compressed scalar
   `t` as if it were `[start, end]`, producing invalid logical times, duration,
   and affected seek behavior. Maintained readers expand every operation at
   that scalar time, and maintained writers serialize a new equal-time
   compressed group as `t: [time, time]`. Stored bytes remain unchanged.
   In differential checks, exclude operation time only for operations expanded
   from an affected record, duration only when the terminal record has that
   shape, and any seek comparison for a payload containing the shape. Content
   and selection traces still match.

## Authoritative source index

| Source | What it establishes |
| --- | --- |
| [CodeMirror 5 manual][cm5-manual] | CM5 construction, `{line, ch}` coordinates, content/selection methods, events, options, operations, and history |
| [Official CM5 to CM6 migration guide][cm6-migration] | First-party before/after mappings for construction, positions, documents, selections, changes, configuration, events, and `fromTextArea` |
| [CodeMirror 6 system guide][cm6-guide] | Immutable state, transaction model, simultaneous change coordinates, extensions, and baseline editor setup |
| [CodeMirror 6 reference][cm6-ref] | Exact `EditorState`, `Transaction`, `EditorSelection`, `EditorView`, `ViewUpdate`, history, and facet contracts |
| [CM6 dynamic configuration example][cm6-config] | Extension precedence, `Compartment`, reconfiguration, and `appendConfig` |
| [CM6 read-only example][cm6-readonly] | Difference between state-level `readOnly`, DOM-level `editable`, and focusability |
| [Released `codemirror-record` v1.1.6 API][record-v1-api] | Existing recorder/player surface and legacy recording schema |
| [Current v2 README](../README.md#api) and [source](../src/CodeRecord.js) | Stable CM6 surface and the transaction-to-legacy adapter |

## Machine-readable migration contract

The following block is intentionally concise so another agent can treat it as
the migration page's factual contract.

```yaml
runtime_change:
  from: CodeMirror 5 CodeMirror instance
  to: CodeMirror 6 EditorView
package_change:
  from: codemirror-record@1 + codemirror@5
  to: codemirror-record@2 + @codemirror/state@6 + @codemirror/view@6
recorder_surface:
  retained:
    - CodeRecord(editor)
    - listen()
    - recordExtraActivity(value)
    - getRecords()
player_surface:
  retained:
    - CodePlay(editor, options)
    - addOperations(records)
    - play()
    - pause()
    - seek(milliseconds)
    - clear()
    - getStatus()
    - getCurrentTime()
    - getDuration()
    - on(event, listener)
    - off(event, listener)
wire_contract:
  action: do_not_transform
  invariant: serialized positions remain zero-based CM5-style line/character pairs
  compatibility_goal: recordings move directly between v1 and v2 players
editor_api_changes:
  construction: CodeMirror(...) -> new EditorView(...)
  value_read: getValue() -> state.doc.toString()
  updates: direct mutating methods -> dispatch(transaction specs)
  positions: zero-based line/ch objects -> UTF-16 document offsets
  events: on/off editor events -> update listeners, plugins, fields, or filters
  options: named options/setOption -> extensions/Compartments
  readonly: one CM5 option -> separate CM6 readOnly and editable facets
  history: built in by CM5 -> explicit CM6 extension or basicSetup
```

The package commands above reflect the current v2 peer dependencies in
[`package.json`](../package.json). Language support, `basicSetup`, and other CM6
features may require additional `@codemirror/*` packages.[^module-system]

## 1. Installation and module changes

### CodeMirror itself

CM5 could be loaded as browser scripts/styles or through AMD/CommonJS, and its
language modes lived under the monolithic distribution. CM6 is split into npm
packages under `@codemirror`; browser use expects a module loader or bundler.
The most important low-level packages are `@codemirror/state` and
`@codemirror/view`. The umbrella `codemirror` package provides `basicSetup`, but
language support is still installed separately.[^module-system]

```bash
# Before: CodeMirror 5 maintenance line
npm install codemirror-record@^1 codemirror@^5

# After: minimal dependencies expected by codemirror-record v2
npm install codemirror-record@^2 @codemirror/state@^6 @codemirror/view@^6

# Optional baseline editor conveniences and JavaScript language support
npm install codemirror@^6 @codemirror/lang-javascript@^6
```

Migration-page instruction: do not tell users to load a CM6 build by swapping a
CM5 `<script src>` URL. They must migrate imports and bundle the module graph.
The official [bundling guidance][cm6-bundling] exists for users who still need a
single browser script.

### `codemirror-record`

The package major selects the editor adapter:

| Editor | Recorder package | Object passed to `CodeRecord` / `CodePlay` |
| --- | --- | --- |
| CodeMirror 5 | `codemirror-record@1` | CM5 `CodeMirror` instance |
| CodeMirror 6 | `codemirror-record@2` | CM6 `EditorView` |

The v1 and v2 API pages show the same named constructors and method families;
the editor argument is the deliberate breaking change.[^record-api]

## 2. Editor construction

CM5's `CodeMirror(place, options)` constructor accepted content under the
`value` option. CM6's corresponding UI object is `EditorView`; it accepts a
`parent` plus either a pre-created `EditorState` or top-level `doc`, `selection`,
and `extensions` inputs.[^construction]

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
  readOnly: true,
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

`CodeRecord.listen()` installs its own CM6 update listener dynamically, so the
consumer does not have to include a recorder extension during `EditorState`
creation; this is visible in the v2 [`listen` implementation](../src/CodeRecord.js).

### `fromTextArea` has no direct CM6 equivalent

CM6 intentionally does not provide `CodeMirror.fromTextArea`. The official
migration guide recommends creating an `EditorView`, inserting `view.dom`, and
explicitly copying `view.state.doc.toString()` back into the textarea when the
form is submitted.[^from-textarea]

## 3. Documents, values, and coordinates

CM5 positions are zero-based `{line, ch}` objects. CM6 state positions are
numeric offsets counted in UTF-16 code units from the start of the document.
CM6 `Text.line(n)` uses one-based line numbers, even though document offsets
remain zero-based.[^positions]

### Direct value/document mappings

| CodeMirror 5 | CodeMirror 6 |
| --- | --- |
| `cm.getValue()` | `view.state.doc.toString()` |
| `cm.getRange(a, b)` | `view.state.sliceDoc(a, b)` |
| `cm.getLine(n)` | `view.state.doc.line(n + 1).text` |
| `cm.lineCount()` | `view.state.doc.lines` |
| `cm.indexFromPos(pos)` | convert with the clipping `cm5PositionToOffset` helper below |
| `cm.posFromIndex(offset)` | clip the offset, use `doc.lineAt(offset)`, and derive zero-based line/ch |

These are the official migration guide's document and position mappings.[^documents]

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

These helpers are appropriate at an application boundary that still consumes
CM5-style coordinates. Normal CM6 application code should use offsets. A
`codemirror-record` consumer must not run these conversions over serialized
recordings—the v2 adapter already performs them, including CM5-like clipping of
out-of-range playback positions; see
[`codeMirror5PositionToOffset`](../src/codemirror6.js).

## 4. Changes and transactions

CM5 changed the document through editor methods and used `cm.operation` to
batch work and defer expensive DOM updates. CM6 describes document, selection,
and extension changes in transaction specs and applies them through
`view.dispatch`; multiple changes in one transaction are atomic.[^transactions]

### Direct update mappings

| CodeMirror 5 | CodeMirror 6 |
| --- | --- |
| `cm.replaceRange(text, from, to)` | `view.dispatch({changes: {from, to, insert: text}})` |
| `cm.setValue(text)` while retaining configuration/history | replace `0..view.state.doc.length` in a transaction |
| Load a logically new document and discard history | if it belongs to the same recording, dispatch the equivalent replacement first; then call `view.setState(newState)` and reinstall with `recorder.listen()`. Otherwise start a new recorder and baseline |
| `cm.replaceSelection(text)` | `view.dispatch(view.state.replaceSelection(text))` |
| `cm.operation(() => manyEdits())` | dispatch one transaction containing a `changes` array or `ChangeSet` |

When a transaction has multiple ordinary change specs, all `from`/`to`
coordinates refer to the transaction's starting document. Selection positions
in that transaction refer to the document after its changes. Code that truly
has sequential changes should compose `ChangeSet` values or use the explicitly
sequential transaction-spec behavior.[^change-coordinates]

This distinction is critical to recording. A CM6 update may contain multiple
transactions, and each transaction may contain multiple changes. The CM6
`ChangeSet.iterChanges` API reports old-document and new-document ranges. The
recorder must preserve transaction boundaries and use the correct document for
each coordinate conversion rather than diffing DOM text.[^change-iteration]

The v2 recorder follows that model by iterating `update.transactions`,
then translating each transaction's `changes` and `newSelection` to legacy
segments in [`CodeRecord.viewUpdateListener`](../src/CodeRecord.js).

## 5. Selections

CM6 still models anchor/head direction and supports multiple ranges, but all
positions are offsets. `SelectionRange.from`/`to` are normalized lower/upper
bounds; `anchor`/`head` retain direction. Code that records selection direction
must use `anchor` and `head`, not `from` and `to`.[^selection-range]

| CodeMirror 5 | CodeMirror 6 |
| --- | --- |
| `cm.getCursor()` | `view.state.selection.main.head` |
| `cm.listSelections()` | `view.state.selection.ranges` |
| `cm.getSelection()` | slice `selection.main.from..to` from state |
| `cm.getSelections()` | slice each range in `selection.ranges` |
| `cm.somethingSelected()` | `selection.ranges.some(range => !range.empty)` |
| `cm.setCursor(pos)` | Convert `pos` to an offset, then dispatch `{selection: {anchor: offset}}` |
| `cm.setSelection(anchor, head)` | Convert both positions to offsets, then dispatch numeric `anchor`/`head` |
| `cm.setSelections(ranges, primary)` | Normalize touching/overlapping input according to the application's CM5 semantics, then convert with `EditorSelection.range` and `EditorSelection.create` |

The official migration guide supplies these method mappings.[^selections]

Convert each anchor/head to offsets with `EditorSelection.range`, then call
`EditorSelection.create(selectionRanges, primaryIndex)`.

This recipe assumes `cm5Ranges` is an already-normalized
`cm.listSelections()` snapshot. With CM5's default
`selectionsMayTouch: false`, raw touching or overlapping `setSelections`
inputs can merge differently from CM6, including a different retained
direction. Normalize those inputs while CM5 is available or define and test an
application-specific merge rule before conversion.

```js
const selectionRanges = cm5Ranges.map(({anchor, head = anchor}) =>
  EditorSelection.range(
    cm5PositionToOffset(view.state.doc, anchor),
    cm5PositionToOffset(view.state.doc, head),
  ));
const previousPrimaryIndex = view.state.selection.mainIndex;
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

CM6 states reduce an incoming multiple selection to its main range by default;
they do not reject it. Enable `EditorState.allowMultipleSelections.of(true)`
when creating the state to retain every range. Preserve an explicitly supplied
CM5 `primary` argument. When it is omitted, CM5 preserves its previous primary
index and clamps it to `ranges.length - 1`; mirror that rule with the formula
above. For a live CM5 snapshot, match `cm5.getCursor('anchor'/'head')` against
`cm5.listSelections()` and pass the matching index. `EditorSelection.create`
otherwise defaults to the first range. It accepts `SelectionRange` instances,
not raw `{anchor, head}` objects. Ranges are sorted and overlapping ranges are
merged.[^multiple-selections]

The v2 player enables the multiple-selection facet when necessary so
legacy multi-cursor records can play on a default state; see
[`ensureMultipleSelections`](../src/codemirror6.js). A migration page should
still teach consumers to enable the facet for their own multi-cursor UI logic.

## 6. Read-only behavior

CM5's `readOnly` option combines two ideas: `true` blocks user edits, while the
special value `"nocursor"` also prevents focus.[^cm5-readonly]

CM6 deliberately separates them:

- `EditorState.readOnly.of(true)` tells editing commands and input handlers not
  to change the state.
- `EditorView.editable.of(false)` removes DOM `contenteditable`; it does not by
  itself prevent programmatic API changes.
- With `editable` off, the content is not naturally focusable. Add
  `EditorView.contentAttributes.of({tabindex: '0'})` if read-only keyboard
  interaction or focus is still needed.[^cm6-readonly]

Recommended mappings:

| CM5 intent | CM6 extensions |
| --- | --- |
| Read-only but focusable/selectable editor | `EditorState.readOnly.of(true)` |
| `readOnly: "nocursor"`-like non-interactive player | `EditorState.readOnly.of(true)` plus `EditorView.editable.of(false)` |
| Uneditable but still keyboard-focusable | both facets above plus a `tabindex` content attribute |

`CodePlay` applies document changes through `view.dispatch`, so a player may use
the read-only facets without making playback depend on simulated user input;
see the current [`applyEditorOperation`](../src/codemirror6.js).

## 7. Events, update listeners, and origins

CM5 exposed `on`/`off` events. Its `change` event contained `from`, `to`,
line-array `text`/`removed`, and an `origin`; `changes` batched changes per
operation; `cursorActivity` covered both selection movement and document
changes; `beforeChange` and `beforeSelectionChange` could filter updates.[^cm5-events]

CM6 does not expose an equivalent editor event emitter. State transitions are
transactions; imperative observers receive `ViewUpdate` values; editor-coupled
behavior belongs in state fields or view plugins; and pre-update modification
belongs in change filters, transaction filters, or transaction extenders.[^cm6-events]

### Common application observer

```js
const appObserver = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    onDocumentValue(update.state.doc.toString());
  }
  if (!update.startState.selection.eq(update.state.selection)) {
    onSelection(update.state.selection);
  }
});

const view = new EditorView({
  parent: mount,
  doc: initialDocument,
  extensions: [appObserver],
});
```

`ViewUpdate.docChanged` reports document changes. `selectionSet` only means a
transaction explicitly set the selection; comparing old and new selections is
more appropriate when the application cares about any effective change,
including selection mapping caused by edits.[^view-update]

### Recorder-grade observer

For lossless recording, inspect the transactions rather than only the final
`update.state`:

```js
const recorderObserver = EditorView.updateListener.of((update) => {
  for (const transaction of update.transactions) {
    if (transaction.docChanged) {
      transaction.changes.iterChanges(
        (fromA, toA, fromB, toB, inserted) => {
          // A coordinates belong to transaction.startState.doc.
          // B coordinates and inserted belong to transaction.newDoc.
        },
        true,
      );
    }
    const resultingSelection = transaction.newSelection;
  }
});
```

CM5 `change.origin` does not have a one-to-one CM6 property. CM6 attaches
metadata as transaction annotations. `Transaction.userEvent` uses categories
such as typed input, composition, paste, drop, deletion, cut, selection, undo,
and redo; `transaction.isUserEvent(prefix)` matches both a category and its
more specific forms. `Transaction.time` is automatically attached.[^transaction-annotations]

The v2 recorder maps these annotations back to the legacy origin
strings inside [`transactionOrigin`](../src/CodeRecord.js). Consumers should
not add a second DOM/input listener to “help” the recorder; that would risk
duplicates and would miss programmatic transactions.

The player marks replay with the host runtime's
`Transaction.userEvent.of('codemirror-record.playback')`. This deliberately
replaces the issue's original custom-annotation sketch: annotation types are
identity-based, so separately resolved CommonJS and ESM `@codemirror/state`
entry paths may not recognize one another's annotation object. The stable
user-event string, created through the supplied view's own transaction
runtime, keeps playback suppression observable across those entry paths.

## 8. Options and extensions

CM5 configuration was an option object and could be changed with
`cm.setOption(name, value)`. CM6 configuration is an extension tree stored in
the state. Extension order can affect precedence.[^configuration]

Typical conceptual mappings:

| CodeMirror 5 | CodeMirror 6 |
| --- | --- |
| `value` option | `doc` in `EditorState` / `EditorView` config |
| `mode: "javascript"` | `javascript()` from `@codemirror/lang-javascript` |
| `lineNumbers: true` | `lineNumbers()` extension |
| `extraKeys` / `keyMap` | `keymap.of([...bindings])` extension |
| `readOnly` | `EditorState.readOnly` and optionally `EditorView.editable` facets |
| `cm.setOption(...)` | put the relevant extension in a `Compartment`, then dispatch its `reconfigure` effect |

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

Use `StateEffect.appendConfig` for an extension that must be installed on
demand and kept until a full top-level reconfiguration. That is how the
v2 recorder installs its private listener and how the player enables
multiple selections.[^append-config] A normal `Compartment` reconfiguration
preserves that listener. After `view.setState(newState)` or a full top-level
`StateEffect.reconfigure.of(...)`, call the idempotent `recorder.listen()`
again. `setState` itself is not a transaction and is invisible to the recorder:
dispatch an equivalent recordable document/selection change first, or treat
the new state as a new recording baseline. Do not combine a recordable change
with the top-level reconfiguration.

## 9. Undo and history

CM5 ships with undo history and exposes methods including `undo`, `redo`,
`historySize`, and `clearHistory`.[^cm5-history]

A bare CM6 `EditorView` has no undo history or default history keybindings.
Install `history()` and `keymap.of(historyKeymap)`, or use the umbrella
`basicSetup`, which includes both. Programmatic undo/redo are commands called as
`undo(view)` and `redo(view)`; depth is queried with `undoDepth(state)` and
`redoDepth(state)`.[^cm6-history]

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

There is no direct CM6 `clearHistory()` method. Loading a logically new
document should create a fresh `EditorState`; `view.setState(newState)` then
reinitializes view plugins along with the state. The system guide explicitly
recommends this reset when stale history must not survive.[^history-reset]
Because this also discards the appended recorder listener, invoke
`recorder.listen()` immediately afterward for a recorded view. If the reset
must appear in the same recording, first dispatch an equivalent document and
selection replacement; otherwise finish the old recording and create a new
recorder whose baseline is the fresh state.

Replay transactions should not pollute the user's undo stack. CM6 exposes the
`Transaction.addToHistory` annotation for this purpose, and the v2
player applies `Transaction.addToHistory.of(false)` to playback transactions in
[`playbackSpec`](../src/codemirror6.js). Undo and redo user actions themselves
still arrive as ordinary document-changing transactions with `userEvent`
annotations, so a transaction-native recorder can capture their visible effect.

## 10. Additional high-risk mappings

### DOM and CSS

CM6 has a different editor DOM and different class names. Examples include
`.CodeMirror` to `.cm-editor`, `.CodeMirror-line` to `.cm-line`, and
`.CodeMirror-scroll` to `.cm-scroller`. Syntax token class names are no longer
stable CM5 token classes, so custom CM5 CSS cannot be copied mechanically.[^dom-css]

### Direct DOM mutation

Use `view.dispatch` for content and decorations for presentation. The CM6
reference warns that direct edits to `contentDOM` are reconciled away by the
editor.[^content-dom]

### Cleanup

A CM6 view owns listeners/plugins and should be disposed with `view.destroy()`.
This replaces patterns that merely removed CM5 wrapper DOM or, for textarea
instances, called `toTextArea`.[^destroy]

## 11. Minimal end-user migration procedure

This sequence can be promoted almost verbatim into the final migration page:

1. Pin the current CM5 application to `codemirror-record@^1` while preparing the
   migration, and retain representative recording JSON fixtures.
2. Install `codemirror-record@^2`, `@codemirror/state@^6`, and
   `@codemirror/view@^6`. Add only the language and feature packages the editor
   actually uses.
3. Replace each `CodeMirror(...)` / `CodeMirror.fromTextArea(...)` construction
   with an `EditorView`. Move `value` to `doc` and convert options to extensions.
4. Continue passing the editor object to `new CodeRecord(editor)` and
   `new CodePlay(editor, options)`; keep calls such as `listen`, `getRecords`,
   `addOperations`, `play`, `pause`, and `seek`.
5. Replace application-owned `getValue`, selection, change, option, and history
   calls using the mappings in this note.
6. Do not rewrite stored recordings or turn line/character wire positions into
   offsets. Pass the existing JSON directly to `CodePlay.addOperations`.
7. Test the application's real extension set, especially multi-cursor,
   read-only/focus behavior, undo/redo, IME composition, paste/drop, and any
   app-owned update listeners.
8. Confirm both data directions using unchanged bytes: v1-produced fixtures in
   the v2 player, and v2-produced fixtures in the released v1 player.

## 12. Requirements for the final migration page

An agent authoring the public page should preserve these content rules:

- Lead with the short before/after editor-construction example.
- State explicitly that `codemirror-record`'s named recorder/player surface is
  retained while the editor object changes.
- Put **“Do not transform existing recordings”** in a prominent callout.
- Include an exact mapping table for common CM5 methods.
- Explain offsets versus legacy line/character wire positions separately; do
  not imply that the v2 wire format changed to offsets.
- Explain `readOnly` versus `editable`, including focus implications.
- Explain that history is an extension in CM6 and that playback should stay out
  of the undo stack.
- Include stable links to the CM5 maintenance README and the CM6 default README.
- Provide the install commands as copyable code, but use only npm versions and
  dist-tags that actually exist at deployment time.
- End with a verification checklist covering old-record playback, new-record
  playback in v1, selections, timing, external activities, and seek/pause.
- Add page metadata, a descriptive title/heading, semantic tables, and fenced
  code blocks so humans, search engines, and coding agents can parse the same
  document reliably.

## Package verification boundary

The CodeMirror API mappings in this note are established by official primary
documentation. Behavioral equivalence between `codemirror-record@1` and v2 is
established separately by the executable `npm run test:compat` release gate.
That gate verifies:

- every released v1 wire operation and compressed representation;
- directed single and multiple selections;
- multi-change transaction ordering and operation boundaries;
- CM6 typed input, deletion, paste, drop, composition, undo, and redo origins;
- timing, speed, max-delay, pause/resume, seek, and clear behavior;
- external activity handling and reversion;
- both producer/player directions against the real published v1 package.

That separation is important: official CodeMirror sources define how to migrate
the editor, while this repository's compatibility suite proves the recorder
wire and playback contract against real package artifacts.

## Footnotes

[^migration-scope]: [Official CodeMirror 5 to 6 migration guide][cm6-migration], especially its construction, state, transaction, configuration, and event sections.
[^module-system]: [CM6 migration guide: module system][cm6-migration]; [CM6 reference introduction][cm6-ref]; [CM6 system guide: baseline editor and modules][cm6-guide].
[^record-api]: Compare the [released v1.1.6 recorder/player API][record-v1-api] with the [current v2 API](../README.md#api) and [TypeScript declarations](../src/index.d.ts).
[^construction]: [CM5 basic usage and constructor][cm5-manual]; [CM6 migration guide: creating an editor][cm6-migration]; [CM6 `EditorViewConfig` reference][cm6-ref].
[^from-textarea]: [CM6 migration guide: `CodeMirror.fromTextArea`][cm6-migration].
[^positions]: [CM5 programming API coordinates][cm5-manual]; [CM6 migration guide: positions][cm6-migration]; [CM6 `Line` reference][cm6-ref].
[^documents]: [CM6 migration guide: getting the document and selection][cm6-migration].
[^transactions]: [CM5 `operation` method][cm5-manual]; [CM6 migration guide: making changes][cm6-migration]; [CM6 system guide: state and updates][cm6-guide].
[^change-coordinates]: [CM6 system guide: document changes][cm6-guide]; [CM6 `TransactionSpec` reference][cm6-ref].
[^change-iteration]: [CM6 `ChangeSet.iterChanges` reference][cm6-ref].
[^selection-range]: [CM6 `SelectionRange` reference][cm6-ref].
[^selections]: [CM6 migration guide: document and selection mappings][cm6-migration].
[^multiple-selections]: [CM6 system guide: multiple selections][cm6-guide]; [CM6 `EditorSelection` reference][cm6-ref].
[^cm5-readonly]: [CM5 `readOnly` option][cm5-manual].
[^cm6-readonly]: [Official CM6 read-only example][cm6-readonly]; [CM6 `readOnly` and `editable` facets][cm6-ref].
[^cm5-events]: [CM5 events reference][cm5-manual].
[^cm6-events]: [CM6 migration guide: events][cm6-migration]; [CM6 `updateListener` and view plugin reference][cm6-ref].
[^view-update]: [CM6 `ViewUpdate` reference][cm6-ref]; [CM6 `EditorSelection.eq` reference][cm6-ref].
[^transaction-annotations]: [CM6 `Transaction.time`, `Transaction.userEvent`, and `isUserEvent` reference][cm6-ref].
[^configuration]: [CM6 migration guide: configuration][cm6-migration]; [official dynamic configuration example][cm6-config].
[^append-config]: [CM6 configuration example: top-level reconfiguration and `appendConfig`][cm6-config]; [CM6 `StateEffect.appendConfig` reference][cm6-ref].
[^cm5-history]: [CM5 history methods][cm5-manual].
[^cm6-history]: [CM6 migration guide: creating an editor with history][cm6-migration]; [CM6 undo history reference][cm6-ref].
[^history-reset]: [CM6 system guide: reset a state for a new document][cm6-guide]; [CM6 `EditorView.setState` reference][cm6-ref].
[^dom-css]: [CM6 migration guide: DOM structure][cm6-migration].
[^content-dom]: [CM6 `EditorView.contentDOM` reference][cm6-ref].
[^destroy]: [CM6 `EditorView.destroy` reference][cm6-ref]; [CM5 `fromTextArea` cleanup guidance][cm5-manual].

[cm5-manual]: https://codemirror.net/5/doc/manual.html
[cm6-migration]: https://codemirror.net/docs/migration/
[cm6-guide]: https://codemirror.net/docs/guide/
[cm6-ref]: https://codemirror.net/docs/ref/
[cm6-config]: https://codemirror.net/examples/config/
[cm6-readonly]: https://codemirror.net/examples/readonly/
[cm6-bundling]: https://codemirror.net/examples/bundle/
[record-v1-api]: https://github.com/Jisuanke/CodeMirror-Record/tree/v1.1.6#api
