/** Marks transactions created by the player so recorders can ignore them. */
export const playbackUserEvent = 'codemirror-record.playback';

const runtimeTypesByView = new WeakMap();

/**
 * Resolve constructors and extension types from the editor itself.
 *
 * CodeMirror's conditional exports give CommonJS and ESM separate module
 * identities even when npm installs one physical copy. Reading the public
 * constructors from the supplied view keeps every transaction, selection,
 * facet, and state effect in that view's own runtime.
 *
 * @param {EditorView} view CodeMirror editor view
 * @return {object} Matching CodeMirror runtime types
 */
export function getEditorRuntimeTypes(view) {
  let runtimeTypes = runtimeTypesByView.get(view);
  if (runtimeTypes === undefined) {
    const emptyTransaction = view.state.update({filter: false});
    const viewEffect = view.constructor.scrollIntoView(0);
    runtimeTypes = {
      ChangeSet: emptyTransaction.changes.constructor,
      EditorSelection: view.state.selection.constructor,
      EditorState: view.state.constructor,
      EditorView: view.constructor,
      StateEffect: viewEffect.constructor,
      Transaction: emptyTransaction.constructor,
    };
    runtimeTypesByView.set(view, runtimeTypes);
  }
  return runtimeTypes;
}

/**
 * Fail early when the v2 runtime receives an editor from the CM5 generation.
 *
 * @param {object} view Candidate CodeMirror 6 editor view
 * @throws {TypeError} When view is not a CodeMirror 6 EditorView
 */
export function assertEditorView(view) {
  // Avoid instanceof here. A consumer can load this package through CommonJS
  // while constructing its view through ESM, giving one physical peer install
  // two legitimate module identities.
  const isEditorView = view !== null && typeof view === 'object' &&
    typeof view.dispatch === 'function' &&
    typeof view.update === 'function' &&
    view.state !== null && typeof view.state === 'object' &&
    typeof view.state.facet === 'function' &&
    view.state.doc !== null && typeof view.state.doc === 'object' &&
    typeof view.state.doc.lineAt === 'function' &&
    view.contentDOM !== null && typeof view.contentDOM === 'object';
  if (!isEditorView) {
    throw new TypeError(
        'codemirror-record v2 requires a CodeMirror 6 EditorView. ' +
        'For CodeMirror 5, use codemirror-record@1 or the cm5 dist-tag.',
    );
  }
}

/**
 * Add the annotations and flags shared by every playback transaction.
 *
 * @param {object} spec CodeMirror transaction specification
 * @return {object} Playback transaction specification
 */
function playbackSpec(view, spec) {
  const {Transaction} = getEditorRuntimeTypes(view);
  return {
    ...spec,
    annotations: [
      Transaction.userEvent.of(playbackUserEvent),
      Transaction.addToHistory.of(false),
    ],
    filter: false,
  };
}

/**
 * Enable the CM6 facet required to faithfully restore legacy multi-selections.
 *
 * @param {EditorView} view CodeMirror editor view
 */
export function ensureMultipleSelections(view) {
  const {
    EditorState,
    StateEffect,
  } = getEditorRuntimeTypes(view);
  if (!view.state.facet(EditorState.allowMultipleSelections)) {
    view.dispatch(playbackSpec(view, {
      effects: StateEffect.appendConfig.of(
          EditorState.allowMultipleSelections.of(true),
      ),
    }));
  }
}

/**
 * Read a CodeMirror 6 editor value.
 *
 * @param {EditorView} view CodeMirror editor view
 * @return {string} Current document text
 */
export function getEditorValue(view) {
  return view.state.doc.toString();
}

/**
 * Convert a legacy CodeMirror 5 position to a CodeMirror 6 offset.
 *
 * Invalid and out-of-range positions are clamped like CodeMirror 5 positions.
 *
 * @param {Text} doc CodeMirror document
 * @param {object} position Legacy `{line, ch}` position
 * @return {number} Document offset
 */
export function codeMirror5PositionToOffset(doc, position) {
  const lineNumber = Math.min(
      Math.max(Number.isFinite(position.line) ? position.line : 0, 0),
      doc.lines - 1,
  );
  const line = doc.line(lineNumber + 1);
  const character = Math.min(
      Math.max(Number.isFinite(position.ch) ? position.ch : 0, 0),
      line.length,
  );
  return line.from + character;
}

/**
 * Restore both document and selection in one marked playback transaction.
 *
 * @param {EditorView} view CodeMirror editor view
 * @param {string} value Document value to restore
 * @param {EditorSelection} selection Selection belonging to that value
 */
export function restoreEditorState(view, value, selection) {
  if (selection.ranges.length > 1) {
    ensureMultipleSelections(view);
  }
  view.dispatch(playbackSpec(view, {
    changes: {from: 0, to: view.state.doc.length, insert: value},
    selection,
  }));
}

/**
 * Apply every cursor segment in a legacy operation as one CM6 transaction.
 *
 * Each edit position is resolved against the document produced by the previous
 * edit, matching CodeMirror 5's `changes` callback. The composed change set is
 * then dispatched once, which also makes CM6 multi-change records safe from
 * cross-transaction offset drift.
 *
 * @param {EditorView} view CodeMirror editor view
 * @param {Array<object>} segments Legacy operation segments
 * @param {boolean} content Whether segments change document content
 */
export function applyEditorOperation(view, segments, content) {
  const {
    ChangeSet,
    EditorSelection,
  } = getEditorRuntimeTypes(view);
  if (segments.length > 1) {
    ensureMultipleSelections(view);
  }
  let document = view.state.doc;
  let changes = ChangeSet.empty(document.length);
  let selection = view.state.selection;

  if (!content) {
    const ranges = segments.map((segment) => EditorSelection.range(
        codeMirror5PositionToOffset(document, segment.from),
        codeMirror5PositionToOffset(document, segment.to),
    ));
    selection = EditorSelection.create(ranges, ranges.length - 1);
  } else {
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      const from = codeMirror5PositionToOffset(document, segment.from);
      const to = codeMirror5PositionToOffset(document, segment.to);
      const localChanges = ChangeSet.of({
        from,
        to,
        insert: segment.insert,
      }, document.length);

      if (segment.select) {
        const ranges = index === 0 ? [] :
          selection.map(localChanges).ranges;
        const cursor = EditorSelection.cursor(from + segment.insert.length);
        selection = EditorSelection.create([...ranges, cursor], ranges.length);
      } else {
        selection = selection.map(localChanges);
      }

      changes = changes.compose(localChanges);
      document = localChanges.apply(document);
    }
  }

  view.dispatch(playbackSpec(view, {changes, selection}));
}
