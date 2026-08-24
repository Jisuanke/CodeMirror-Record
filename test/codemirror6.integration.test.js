import {EditorSelection, EditorState, Transaction} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {afterEach, describe, expect, test, vi} from 'vitest';

import {CodePlay, CodeRecord} from '../src';

const views = [];

function createView(doc = '', extensions = []) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({doc, extensions}),
  });
  views.push(view);
  return view;
}

afterEach(() => {
  vi.useRealTimers();
  while (views.length > 0) {
    views.pop().destroy();
  }
  document.body.replaceChildren();
});

describe('CodeMirror 6 recorder compatibility', () => {
  test('rejects a CodeMirror 5-shaped editor with migration guidance', () => {
    const codeMirror5Editor = {on: vi.fn(), getValue: vi.fn()};

    expect(() => new CodeRecord(codeMirror5Editor)).toThrow(
        /CodeMirror 6 EditorView.*codemirror-record@1/,
    );
  });

  test('records a text transaction through the existing public interface', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const view = createView();
    const recorder = new CodeRecord(view);

    recorder.listen();
    vi.advanceTimersByTime(25);
    view.dispatch({
      changes: {from: 0, insert: 'hello'},
      selection: EditorSelection.single(5),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(JSON.parse(recorder.getRecords())).toEqual([
      {
        t: 25,
        o: [{o: 'i', i: [0, 0], a: 'hello'}],
      },
    ]);
  });

  test('records a directed selection in the legacy cursor format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const view = createView('hello');
    const recorder = new CodeRecord(view);

    recorder.listen();
    vi.advanceTimersByTime(10);
    view.dispatch({selection: EditorSelection.single(4, 1)});

    expect(JSON.parse(recorder.getRecords())).toEqual([
      {
        t: 10,
        o: [{o: 'o', i: [[0, 4], [0, 1]]}],
      },
    ]);
  });
});

describe('CodeMirror 6 player compatibility', () => {
  test('rejects a CodeMirror 5-shaped editor with migration guidance', () => {
    const codeMirror5Editor = {on: vi.fn(), getValue: vi.fn()};

    expect(() => new CodePlay(codeMirror5Editor)).toThrow(
        /CodeMirror 6 EditorView.*codemirror-record@1/,
    );
  });

  test('round-trips a multiline typed insertion without losing newlines', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const initialDocument = 'function example() {';
    const recordedView = createView(initialDocument);
    const recorder = new CodeRecord(recordedView);

    recorder.listen();
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {
        from: recordedView.state.doc.length,
        insert: '\n  \n}',
      },
      selection: EditorSelection.single(recordedView.state.doc.length + 5),
      annotations: Transaction.userEvent.of('input.type'),
    });

    const records = recorder.getRecords();
    const playedView = createView(initialDocument);
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(records);
    player.play();
    vi.advanceTimersByTime(10);

    expect(playedView.state.doc.toString()).toBe(
        'function example() {\n  \n}',
    );
  });

  test('does not merge a character with a multi-character Enter edit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const initialDocument = 'return "ready"';
    const recordedView = createView(initialDocument);
    const recorder = new CodeRecord(recordedView);

    recorder.listen();
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: recordedView.state.doc.length, insert: ';'},
      selection: EditorSelection.single(recordedView.state.doc.length + 1),
      annotations: Transaction.userEvent.of('input.type'),
    });
    vi.advanceTimersByTime(1);
    recordedView.dispatch({
      changes: {from: recordedView.state.doc.length, insert: '\n  '},
      selection: EditorSelection.single(recordedView.state.doc.length + 3),
      annotations: Transaction.userEvent.of('input.type'),
    });

    const playedView = createView(initialDocument);
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(recorder.getRecords());
    player.play();
    vi.advanceTimersByTime(11);

    expect(playedView.state.doc.toString()).toBe('return "ready";\n  ');
  });

  test('round-trips the selection after a two-newline input replacement', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const initialDocument = 'abcdef';
    const recordedView = createView(initialDocument);
    const recorder = new CodeRecord(recordedView);

    recorder.listen();
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 2, to: 3, insert: '\n\n'},
      selection: EditorSelection.single(4),
      annotations: Transaction.userEvent.of('input.type'),
    });

    const records = recorder.getRecords();
    expect(JSON.parse(records)).toEqual([
      {
        t: 10,
        o: [{o: 'i', i: [[0, 2], [0, 3]], a: '\n\n'}],
      },
      {
        t: 10,
        o: [{o: 'o', i: [2, 0]}],
      },
    ]);
    const playedView = createView(initialDocument);
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(records);
    player.play();
    vi.runAllTimers();

    expect(recordedView.state.doc.toString()).toBe('ab\n\ndef');
    expect(playedView.state.doc.toString()).toBe(
        recordedView.state.doc.toString(),
    );
    expect(playedView.state.selection.toJSON()).toEqual(
        recordedView.state.selection.toJSON(),
    );
  });

  test('round-trips the selection after an empty input replacement', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const initialDocument = 'abcdef';
    const recordedView = createView(initialDocument);
    const recorder = new CodeRecord(recordedView);

    recorder.listen();
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 2, to: 3, insert: ''},
      selection: EditorSelection.single(2),
      annotations: Transaction.userEvent.of('input.type'),
    });

    const records = recorder.getRecords();
    expect(JSON.parse(records)).toEqual([
      {
        t: 10,
        o: [{o: 'i', i: [[0, 2], [0, 3]], a: ''}],
      },
      {
        t: 10,
        o: [{o: 'o', i: [0, 2]}],
      },
    ]);
    const playedView = createView(initialDocument);
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(records);
    player.play();
    vi.runAllTimers();

    expect(recordedView.state.doc.toString()).toBe('abdef');
    expect(playedView.state.doc.toString()).toBe(
        recordedView.state.doc.toString(),
    );
    expect(playedView.state.selection.toJSON()).toEqual(
        recordedView.state.selection.toJSON(),
    );
  });

  test('round-trips typed characters inserted on different lines', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const initialDocument = 'A\nB';
    const recordedView = createView(initialDocument);
    const recorder = new CodeRecord(recordedView);

    recorder.listen();
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 1, insert: 'x'},
      selection: EditorSelection.single(2),
      annotations: Transaction.userEvent.of('input.type'),
    });
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 3, insert: 'y'},
      selection: EditorSelection.single(4),
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(recordedView.state.doc.toString()).toBe('Ax\nyB');
    const records = recorder.getRecords();
    expect(JSON.parse(records)).toEqual([
      {t: 10, o: [{o: 'i', i: [0, 1], a: 'x'}]},
      {t: 20, o: [{o: 'i', i: [1, 0], a: 'y'}]},
    ]);
    const playedView = createView(initialDocument);
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(records);
    player.play();
    vi.advanceTimersByTime(20);

    expect(playedView.state.doc.toString()).toBe('Ax\nyB');
    expect(playedView.state.selection.toJSON()).toEqual({
      ranges: [{anchor: 4, head: 4}],
      main: 0,
    });
  });

  test('does not compress a moved cursor into a non-empty selection', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const initialDocument = 'abcdef';
    const recordedView = createView(initialDocument);
    const recorder = new CodeRecord(recordedView);

    recorder.listen();
    vi.advanceTimersByTime(10);
    recordedView.dispatch({selection: EditorSelection.cursor(1)});
    vi.advanceTimersByTime(10);
    recordedView.dispatch({selection: EditorSelection.range(2, 4)});

    const records = recorder.getRecords();
    expect(JSON.parse(records)).toEqual([
      {
        t: 10,
        o: [{o: 'o', i: [0, 1]}],
      },
      {
        t: 20,
        o: [{o: 'o', i: [[0, 2], [0, 4]]}],
      },
    ]);
    const playedView = createView(initialDocument);
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(records);
    player.play();
    vi.runAllTimers();

    expect(playedView.state.doc.toString()).toBe(
        recordedView.state.doc.toString(),
    );
    expect(playedView.state.selection.toJSON()).toEqual(
        recordedView.state.selection.toJSON(),
    );
  });

  test('round-trips consecutive IME composition transactions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const recordedView = createView();
    const recorder = new CodeRecord(recordedView);

    recorder.listen();
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 0, insert: '你'},
      selection: EditorSelection.single(1),
      annotations: Transaction.userEvent.of('input.type.compose'),
    });
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 1, insert: '好'},
      selection: EditorSelection.single(2),
      annotations: Transaction.userEvent.of('input.type.compose'),
    });

    const records = recorder.getRecords();
    expect(JSON.parse(records)).toEqual([{
      t: [10, 20],
      l: 2,
      o: [{o: 'c', i: [0, 0], a: ['你', '好']}],
    }]);

    const playedView = createView();
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(records);
    player.play();
    vi.advanceTimersByTime(20);

    expect(playedView.state.doc.toString()).toBe('你好');
  });

  test(
      'does not compress multi-cursor composition with a multiline segment',
      () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const initialDocument = 'AB';
        const recordedView = createView(initialDocument, [
          EditorState.allowMultipleSelections.of(true),
        ]);
        const recorder = new CodeRecord(recordedView);

        recorder.listen();
        vi.advanceTimersByTime(10);
        recordedView.dispatch({
          changes: [
            {from: 0, insert: 'a'},
            {from: 2, insert: 'b'},
          ],
          selection: EditorSelection.create([
            EditorSelection.cursor(1),
            EditorSelection.cursor(4),
          ]),
          annotations: Transaction.userEvent.of('input.type.compose'),
        });
        vi.advanceTimersByTime(10);
        recordedView.dispatch({
          changes: [
            {from: 1, insert: 'c'},
            {from: 3, insert: 'x\ny'},
          ],
          selection: EditorSelection.create([
            EditorSelection.cursor(2),
            EditorSelection.cursor(7),
          ]),
          annotations: Transaction.userEvent.of('input.type.compose'),
        });

        const records = recorder.getRecords();
        expect(JSON.parse(records)).toEqual([
          {
            t: 10,
            o: [
              {o: 'c', i: [0, 2], a: ['b']},
              {o: 'c', i: [0, 0], a: ['a']},
            ],
          },
          {
            t: 20,
            o: [
              {o: 'c', i: [0, 3], a: ['x', 'y']},
              {o: 'c', i: [0, 1], a: ['c']},
            ],
          },
        ]);
        const playedView = createView(initialDocument);
        const player = new CodePlay(playedView, {maxDelay: 0});
        player.addOperations(records);
        player.play();
        vi.runAllTimers();

        expect(recordedView.state.doc.toString()).toBe('acABx\nyb');
        expect(playedView.state.doc.toString()).toBe(
            recordedView.state.doc.toString(),
        );
        expect(playedView.state.selection.toJSON()).toEqual(
            recordedView.state.selection.toJSON(),
        );
      },
  );

  test('round-trips IME composition insertions on different lines', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const initialDocument = 'A\nB';
    const recordedView = createView(initialDocument);
    const recorder = new CodeRecord(recordedView);

    recorder.listen();
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 0, insert: 'x'},
      selection: EditorSelection.single(1),
      annotations: Transaction.userEvent.of('input.type.compose'),
    });
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 4, insert: 'y'},
      selection: EditorSelection.single(5),
      annotations: Transaction.userEvent.of('input.type.compose'),
    });

    expect(recordedView.state.doc.toString()).toBe('xA\nBy');
    const records = recorder.getRecords();
    expect(JSON.parse(records)).toEqual([
      {t: 10, o: [{o: 'c', i: [0, 0], a: ['x']}]},
      {t: 20, o: [{o: 'c', i: [1, 1], a: ['y']}]},
    ]);
    const playedView = createView(initialDocument);
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(records);
    player.play();
    vi.advanceTimersByTime(20);

    expect(playedView.state.doc.toString()).toBe('xA\nBy');
    expect(playedView.state.selection.toJSON()).toEqual({
      ranges: [{anchor: 5, head: 5}],
      main: 0,
    });
  });

  test('round-trips consecutive delete-event replacements', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const initialDocument = 'abcd';
    const recordedView = createView(initialDocument);
    const recorder = new CodeRecord(recordedView);

    recorder.listen();
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 2, to: 3, insert: 'X'},
      selection: EditorSelection.single(3),
      annotations: Transaction.userEvent.of('delete.backward'),
    });
    vi.advanceTimersByTime(10);
    recordedView.dispatch({
      changes: {from: 1, to: 2, insert: 'Y'},
      selection: EditorSelection.single(2),
      annotations: Transaction.userEvent.of('delete.backward'),
    });

    expect(recordedView.state.doc.toString()).toBe('aYXd');
    const records = recorder.getRecords();
    expect(JSON.parse(records)).toEqual([
      {
        t: 10,
        o: [{o: 'd', i: [[0, 2], [0, 3]], a: ['X']}],
      },
      {
        t: 20,
        o: [{o: 'd', i: [[0, 1], [0, 2]], a: ['Y']}],
      },
    ]);
    const playedView = createView(initialDocument);
    const player = new CodePlay(playedView, {maxDelay: 0});
    player.addOperations(records);
    player.play();
    vi.advanceTimersByTime(20);

    expect(playedView.state.doc.toString()).toBe('aYXd');
    expect(playedView.state.selection.toJSON()).toEqual({
      ranges: [{anchor: 2, head: 2}],
      main: 0,
    });
  });

  test('plays a legacy text record through the existing public interface', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const view = createView();
    const player = new CodePlay(view, {maxDelay: 0});
    const records = JSON.stringify([
      {t: 10, o: [{o: 'i', i: [0, 0], a: 'hello'}]},
    ]);

    player.addOperations(records);
    player.play();
    vi.advanceTimersByTime(10);

    expect(view.state.doc.toString()).toBe('hello');
    expect(player.getStatus()).toBe('PAUSE');
    expect(player.getDuration()).toBe(10);
  });

  test('does not feed playback transactions back into a recorder', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const view = createView();
    const recorder = new CodeRecord(view);
    const player = new CodePlay(view, {maxDelay: 0});

    recorder.listen();
    player.addOperations(JSON.stringify([
      {t: 10, o: [{o: 'i', i: [0, 0], a: 'hello'}]},
    ]));
    player.play();
    vi.advanceTimersByTime(10);

    expect(view.state.doc.toString()).toBe('hello');
    expect(recorder.getRecords()).toBe('[]');
  });

  test('does not record the player multiple-selection configuration', () => {
    const view = createView();
    const recorder = new CodeRecord(view);
    recorder.listen();

    new CodePlay(view);

    expect(recorder.getRecords()).toBe('[]');
  });
});
