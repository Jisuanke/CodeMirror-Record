import type {EditorView} from '@codemirror/view';
import {
  EditorSelection,
  EditorState,
  type Text,
} from '@codemirror/state';
import {
  CodePlay,
  CodeRecord,
  type CodePlayOptions,
} from '../../src';

declare const view: EditorView;

const options: CodePlayOptions = {
  maxDelay: 3000,
  autoplay: false,
  autofocus: true,
  speed: 2,
  extraActivityHandler: (activity) => console.log(activity),
  extraActivityReverter: null,
};

const recorder = new CodeRecord(view);
recorder.listen();
recorder.recordExtraActivity({kind: 'preview'});
const records: string = recorder.getRecords();

const player = new CodePlay(view, options);
player.addOperations(records);
player.on('play', () => undefined);
player.off('play', () => undefined);
player.setAutoplay(false);
player.setMaxDelay(0);
const status: 'PLAY' | 'PAUSE' = player.getStatus();
console.log(status);

type Cm5Position = {line: number; ch?: number | null};
type Cm5SelectionRange = {
  anchor: Cm5Position;
  head?: Cm5Position;
};

function cm5PositionToOffset(doc: Text, {line, ch}: Cm5Position): number {
  if (line < 0) return 0;
  if (line >= doc.lines) return doc.length;
  const targetLine = doc.line(line + 1);
  const clippedCh = ch == null ? targetLine.length :
    Math.max(0, Math.min(targetLine.length, ch));
  return targetLine.from + clippedCh;
}

cm5PositionToOffset(view.state.doc, {line: 0});
cm5PositionToOffset(view.state.doc, {line: 0, ch: null});

declare const cm5Ranges: Cm5SelectionRange[];
declare const cm5PrimaryIndex: number | undefined;

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
  const migratedSelection = EditorSelection.create(
    selectionRanges,
    primaryIndex,
  );
  const multiSelectionState = EditorState.create({
    doc: view.state.doc,
    extensions: [EditorState.allowMultipleSelections.of(true)],
  });
  multiSelectionState.update({selection: migratedSelection});
}

// @ts-expect-error Raw anchor/head objects are not SelectionRange instances.
EditorSelection.create([{anchor: 0, head: 1}], 0);

// @ts-expect-error The established interface accepts serialized records.
player.addOperations([]);
// @ts-expect-error Only documented player events are accepted.
player.on('stop', () => undefined);
