import {
  EditorSelection,
  EditorState,
  StateEffect,
  Transaction,
} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {afterEach, describe, expect, test, vi} from 'vitest';

import {CodePlay, CodeRecord} from '../src';

const views = [];
const initialTime = new Date('2026-01-01T00:00:00Z');

function createView(doc = '', extensions = [], config = {}) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    ...config,
    parent,
    state: EditorState.create({doc, extensions}),
  });
  views.push(view);
  return view;
}

function startRecording(view) {
  vi.useFakeTimers();
  vi.setSystemTime(initialTime);
  const recorder = new CodeRecord(view);
  recorder.listen();
  return recorder;
}

function recordsFrom(recorder) {
  return JSON.parse(recorder.getRecords());
}

afterEach(() => {
  vi.useRealTimers();
  while (views.length > 0) {
    views.pop().destroy();
  }
  document.body.replaceChildren();
});

describe('CodeMirror 6 recorder integration', () => {
  test.each([
    ['input.type', 'i', 'z'],
    ['input.paste', 'p', ['z']],
    ['input.type.compose', 'c', ['z']],
  ])('maps %s to legacy origin %s', (userEvent, origin, added) => {
    const view = createView();
    const recorder = startRecording(view);

    vi.advanceTimersByTime(8);
    view.dispatch({
      changes: {from: 0, insert: 'z'},
      selection: EditorSelection.single(1),
      annotations: Transaction.userEvent.of(userEvent),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 8,
        o: [{o: origin, i: [0, 0], a: added}],
      },
    ]);
  });

  test('keeps an interval timestamp for equal-time compressed input', () => {
    const view = createView();
    const recorder = startRecording(view);

    vi.advanceTimersByTime(10);
    view.dispatch({
      changes: {from: 0, insert: 'a'},
      selection: EditorSelection.single(1),
      annotations: Transaction.userEvent.of('input.type'),
    });
    view.dispatch({
      changes: {from: 1, insert: 'b'},
      selection: EditorSelection.single(2),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordsFrom(recorder)).toEqual([{
      t: [10, 10],
      l: 2,
      o: [{o: 'i', i: [0, 0], a: 'ab'}],
    }]);
  });

  test('compresses a continuous typed run longer than two characters', () => {
    const view = createView();
    const recorder = startRecording(view);

    for (const character of 'abcd') {
      vi.advanceTimersByTime(10);
      const from = view.state.doc.length;
      view.dispatch({
        changes: {from, insert: character},
        selection: EditorSelection.cursor(from + 1),
        annotations: Transaction.userEvent.of('input.type'),
      });
    }

    expect(recordsFrom(recorder)).toEqual([{
      t: [10, 40],
      l: 4,
      o: [{o: 'i', i: [0, 0], a: 'abcd'}],
    }]);
  });

  test('does not merge a single-character input with a later bulk input', () => {
    const view = createView();
    const recorder = startRecording(view);

    vi.advanceTimersByTime(10);
    view.dispatch({
      changes: {from: 0, insert: 'a'},
      selection: EditorSelection.cursor(1),
      annotations: Transaction.userEvent.of('input.type'),
    });
    vi.advanceTimersByTime(10);
    view.dispatch({
      changes: {from: 1, insert: 'bc'},
      selection: EditorSelection.cursor(3),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {t: 10, o: [{o: 'i', i: [0, 0], a: 'a'}]},
      {t: 20, o: [{o: 'i', i: [0, 1], a: 'bc'}]},
    ]);
  });

  test('compresses and replays a long typed run across a newline', () => {
    const recordedView = createView();
    const recorder = startRecording(recordedView);

    for (const character of ['a', '\n', 'b', 'c']) {
      vi.advanceTimersByTime(10);
      const from = recordedView.state.doc.length;
      recordedView.dispatch({
        changes: {from, insert: character},
        selection: EditorSelection.cursor(from + 1),
        annotations: Transaction.userEvent.of('input.type'),
      });
    }

    const records = recorder.getRecords();
    expect(JSON.parse(records)).toEqual([{
      t: [10, 40],
      l: 4,
      o: [{o: 'i', i: [0, 0], a: 'a\nbc'}],
    }]);

    const playedView = createView();
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(records);
    player.play();
    vi.runAllTimers();

    expect(playedView.state.doc.toString()).toBe('a\nbc');
    expect(playedView.state.selection.toJSON()).toEqual(
        recordedView.state.selection.toJSON(),
    );
  });

  test('maps a delete transaction to the legacy delete origin', () => {
    const view = createView('abc');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(9);
    view.dispatch({
      changes: {from: 1, to: 2},
      selection: EditorSelection.single(1),
      annotations: Transaction.userEvent.of('delete.backward'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 9,
        o: [{o: 'd', i: [[0, 1], [0, 2]]}],
      },
    ]);
  });

  test('maps a cut transaction to the legacy cut origin', () => {
    const view = createView('hello');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(10);
    view.dispatch({
      changes: {from: 0, to: 1},
      annotations: Transaction.userEvent.of('delete.cut'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 10,
        o: [{o: 'x', i: [[0, 0], [0, 1]]}],
      },
    ]);
  });

  test('maps dropped input to the legacy drag origin', () => {
    const view = createView('ab');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(12);
    view.dispatch({
      changes: {from: 1, insert: '📦'},
      selection: EditorSelection.single(3),
      annotations: Transaction.userEvent.of('input.drop'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 12,
        o: [{o: 'r', i: [0, 1], a: ['📦']}],
      },
    ]);
  });

  test('maps a moved drop to the legacy drag origin', () => {
    const view = createView('abc');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(14);
    view.dispatch({
      changes: {from: 0, to: 1},
      annotations: Transaction.userEvent.of('move.drop'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 14,
        o: [{o: 'r', i: [[0, 0], [0, 1]]}],
      },
    ]);
  });

  test('maps a transaction without a user event to setValue', () => {
    const view = createView();
    const recorder = startRecording(view);

    vi.advanceTimersByTime(16);
    view.dispatch({changes: {from: 0, insert: 'ready'}});

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 16,
        o: [{o: 's', i: [0, 0], a: ['ready']}],
      },
      {
        t: 16,
        o: [{o: 'o', i: [0, 0]}],
      },
    ]);
  });

  test('derives input for a partial unannotated insertion', () => {
    const view = createView('ab');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(18);
    view.dispatch({changes: {from: 1, insert: 'X'}});

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 18,
        o: [{o: 'i', i: [0, 1], a: 'X'}],
      },
      {
        t: 18,
        o: [{o: 'o', i: [0, 0]}],
      },
    ]);
  });

  test('records a change-only transaction selection the player cannot infer', () => {
    const view = createView('abcd');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(10);
    view.dispatch({
      changes: {from: 3, insert: 'X'},
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(view.state.selection.toJSON()).toEqual({
      ranges: [{anchor: 0, head: 0}],
      main: 0,
    });
    expect(recordsFrom(recorder)).toEqual([
      {
        t: 10,
        o: [{o: 'i', i: [0, 3], a: 'X'}],
      },
      {
        t: 10,
        o: [{o: 'o', i: [0, 0]}],
      },
    ]);
  });

  test('derives delete for a partial unannotated deletion', () => {
    const view = createView('abc');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(19);
    view.dispatch({changes: {from: 1, to: 2}});

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 19,
        o: [{o: 'd', i: [[0, 1], [0, 2]]}],
      },
      {
        t: 19,
        o: [{o: 'o', i: [0, 0]}],
      },
    ]);
  });

  test('derives each origin in a mixed unannotated change set', () => {
    const view = createView('abcd');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(20);
    view.dispatch({
      changes: [
        {from: 0, to: 1},
        {from: 3, insert: 'X'},
      ],
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 20,
        o: [
          {o: 'i', i: [0, 3], a: 'X'},
          {o: 'd', i: [[0, 0], [0, 1]]},
        ],
      },
      {
        t: 20,
        o: [{o: 'o', i: [0, 0]}],
      },
    ]);
  });

  test('records a cross-line Unicode replacement in legacy coordinates', () => {
    const view = createView('A😀中\nβeta\n終Z');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(20);
    view.dispatch({
      changes: {from: 1, to: 11, insert: '🙂\n新'},
      selection: EditorSelection.single(5),
      annotations: Transaction.userEvent.of('input.paste'),
    });

    expect(view.state.doc.toString()).toBe('A🙂\n新Z');
    expect(recordsFrom(recorder)).toEqual([
      {
        t: 20,
        o: [{
          o: 'p',
          i: [[0, 1], [2, 1]],
          a: ['🙂', '新'],
        }],
      },
    ]);
  });

  test('keeps individual changes in descending document order', () => {
    const view = createView('abcd');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(22);
    view.dispatch({
      changes: [
        {from: 0, to: 1, insert: 'A'},
        {from: 1, to: 2, insert: 'B'},
        {from: 3, to: 4, insert: 'D'},
      ],
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 22,
        o: [
          {o: 'i', i: [[0, 3], [0, 4]], a: 'D'},
          {o: 'i', i: [[0, 1], [0, 2]], a: 'B'},
          {o: 'i', i: [[0, 0], [0, 1]], a: 'A'},
        ],
      },
      {
        t: 22,
        o: [{o: 'o', i: [0, 0]}],
      },
    ]);
  });

  test('records the retained selection after a changes-only multi-edit', () => {
    const view = createView('aa\nbb\ncc');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(10);
    view.dispatch({
      changes: [
        {from: 1, insert: 'X'},
        {from: 7, insert: 'Y'},
      ],
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(view.state.selection.main).toMatchObject({anchor: 0, head: 0});
    expect(recordsFrom(recorder)).toEqual([
      {
        t: 10,
        o: [
          {o: 'i', i: [2, 1], a: 'Y'},
          {o: 'i', i: [0, 1], a: 'X'},
        ],
      },
      {
        t: 10,
        o: [{o: 'o', i: [0, 0]}],
      },
    ]);
  });

  test('omits a paste selection inferred from the transaction changes', () => {
    const view = createView('abcd');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(10);
    view.dispatch({
      changes: {from: 1, to: 4, insert: 'A\nB'},
      selection: EditorSelection.single(4),
      annotations: Transaction.userEvent.of('input.paste'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 10,
        o: [{
          o: 'p',
          i: [[0, 1], [0, 4]],
          a: ['A', 'B'],
        }],
      },
    ]);
  });

  test('records a non-inferred selection after a paste transaction', () => {
    const view = createView('abcd');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(10);
    view.dispatch({
      changes: {from: 1, to: 4, insert: 'A\nB'},
      selection: EditorSelection.single(0),
      annotations: Transaction.userEvent.of('input.paste'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 10,
        o: [{
          o: 'p',
          i: [[0, 1], [0, 4]],
          a: ['A', 'B'],
        }],
      },
      {
        t: 10,
        o: [{o: 'o', i: [0, 0]}],
      },
    ]);
  });

  test('keeps a selection transaction before a later paste', () => {
    const view = createView('abcd');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(5);
    view.dispatch({selection: EditorSelection.single(1)});
    vi.advanceTimersByTime(5);
    view.dispatch({
      changes: {from: 1, to: 2, insert: 'X'},
      selection: EditorSelection.single(2),
      annotations: Transaction.userEvent.of('input.paste'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 5,
        o: [{o: 'o', i: [0, 1]}],
      },
      {
        t: 10,
        o: [{
          o: 'p',
          i: [[0, 1], [0, 2]],
          a: ['X'],
        }],
      },
    ]);
  });

  test('removes an explicit selection inferred from a normal edit', () => {
    const view = createView('ab');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(10);
    view.dispatch({
      changes: {from: 1, insert: 'X'},
      selection: EditorSelection.single(2),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 10,
        o: [{o: 'i', i: [0, 1], a: 'X'}],
      },
    ]);
  });

  test('keeps an explicit selection that is not inferred from the edit', () => {
    const view = createView('ab');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(11);
    view.dispatch({
      changes: {from: 1, insert: 'X'},
      selection: EditorSelection.single(0),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 11,
        o: [{o: 'i', i: [0, 1], a: 'X'}],
      },
      {
        t: 11,
        o: [{o: 'o', i: [0, 0]}],
      },
    ]);
  });

  test('preserves a reverse cross-line selection', () => {
    const view = createView('a😀\n終z');
    const recorder = startRecording(view);

    vi.advanceTimersByTime(24);
    view.dispatch({selection: EditorSelection.single(5, 1)});

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 24,
        o: [{o: 'o', i: [[1, 1], [0, 1]]}],
      },
    ]);
  });

  test('records every range in an explicit multiple selection', () => {
    const view = createView(
        'abcd\nefgh',
        [EditorState.allowMultipleSelections.of(true)],
    );
    const recorder = startRecording(view);

    vi.advanceTimersByTime(26);
    view.dispatch({
      selection: EditorSelection.create([
        EditorSelection.range(1, 3),
        EditorSelection.range(8, 6),
      ], 1),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 26,
        o: [
          {o: 'o', i: [[0, 1], [0, 3]]},
          {o: 'o', i: [[1, 3], [1, 1]]},
        ],
      },
    ]);
  });

  test('stores the main selection last for legacy player compatibility', () => {
    const view = createView(
        'abcd\nefgh',
        [EditorState.allowMultipleSelections.of(true)],
    );
    const recorder = startRecording(view);

    vi.advanceTimersByTime(27);
    view.dispatch({
      selection: EditorSelection.create([
        EditorSelection.range(1, 3),
        EditorSelection.range(8, 6),
      ], 0),
    });

    expect(recordsFrom(recorder)).toEqual([{
      t: 27,
      o: [
        {o: 'o', i: [[1, 3], [1, 1]]},
        {o: 'o', i: [[0, 1], [0, 3]]},
      ],
    }]);
  });

  test('timestamps every transaction in a multi-transaction update', () => {
    const view = createView('', [], {
      dispatchTransactions(transactions, currentView) {
        currentView.update(transactions);
      },
    });
    const recorder = startRecording(view);
    const baseTime = initialTime.getTime();
    const insertion = view.state.update({
      changes: {from: 0, insert: 'A'},
      selection: EditorSelection.single(1),
      annotations: [
        Transaction.userEvent.of('input.paste'),
        Transaction.time.of(baseTime + 30),
      ],
    });
    const cut = insertion.state.update({
      changes: {from: 0, to: 1},
      selection: EditorSelection.single(0),
      annotations: [
        Transaction.userEvent.of('delete.cut'),
        Transaction.time.of(baseTime + 70),
      ],
    });

    view.dispatch([insertion, cut]);

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 30,
        o: [{o: 'p', i: [0, 0], a: ['A']}],
      },
      {
        t: 70,
        o: [{o: 'x', i: [[0, 0], [0, 1]]}],
      },
    ]);
  });

  test('listen is idempotent', () => {
    const view = createView();
    const recorder = startRecording(view);

    recorder.listen();
    vi.advanceTimersByTime(28);
    view.dispatch({
      changes: {from: 0, insert: 'a'},
      selection: EditorSelection.single(1),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 28,
        o: [{o: 'i', i: [0, 0], a: 'a'}],
      },
    ]);
  });

  test('listen reinstalls a listener removed by state reconfiguration', () => {
    const view = createView();
    const recorder = startRecording(view);

    view.dispatch({effects: StateEffect.reconfigure.of([])});
    recorder.listen();
    vi.advanceTimersByTime(30);
    view.dispatch({
      changes: {from: 0, insert: 'b'},
      selection: EditorSelection.single(1),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 30,
        o: [{o: 'i', i: [0, 0], a: 'b'}],
      },
    ]);
  });

  test('listen reinstalls a listener removed by view.setState', () => {
    const view = createView();
    const recorder = startRecording(view);

    view.setState(EditorState.create({doc: ''}));
    recorder.listen();
    vi.advanceTimersByTime(31);
    view.dispatch({
      changes: {from: 0, insert: 'c'},
      selection: EditorSelection.single(1),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 31,
        o: [{o: 'i', i: [0, 0], a: 'c'}],
      },
    ]);
  });

  test('records a document reset before replacing state and clearing history', () => {
    const recordView = createView('old');
    const recorder = startRecording(recordView);

    vi.advanceTimersByTime(10);
    const resetSelection = EditorSelection.single(0);
    recordView.dispatch({
      changes: {from: 0, to: recordView.state.doc.length, insert: 'reset'},
      selection: resetSelection,
    });
    recordView.setState(EditorState.create({
      doc: 'reset',
      selection: resetSelection,
    }));
    recorder.listen();
    vi.advanceTimersByTime(5);
    recordView.dispatch({
      changes: {from: 5, insert: '!'},
      selection: EditorSelection.single(6),
      annotations: Transaction.userEvent.of('input.type'),
    });

    const playView = createView('old');
    const player = new CodePlay(playView, {maxDelay: 0});
    player.addOperations(recorder.getRecords());
    player.play();
    vi.runAllTimers();

    expect(playView.state.doc.toString()).toBe('reset!');
    expect(playView.state.selection.main.toJSON()).toEqual({
      anchor: 6,
      head: 6,
    });
  });

  test('getRecords drains incremental content and extra activity batches', () => {
    const view = createView();
    const recorder = startRecording(view);

    vi.advanceTimersByTime(4);
    view.dispatch({
      changes: {from: 0, insert: 'x'},
      selection: EditorSelection.single(1),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 4,
        o: [{o: 'i', i: [0, 0], a: 'x'}],
      },
    ]);
    expect(recordsFrom(recorder)).toEqual([]);

    vi.advanceTimersByTime(5);
    recorder.recordExtraActivity({kind: 'focus', active: true});

    expect(recordsFrom(recorder)).toEqual([
      {
        t: 9,
        o: [{
          o: 'e',
          activity: {kind: 'focus', active: true},
        }],
      },
    ]);
    expect(recordsFrom(recorder)).toEqual([]);
  });
});
