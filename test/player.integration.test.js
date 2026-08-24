import {EditorState, StateEffect, Transaction} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import {CodePlay} from '../src';
import {playbackUserEvent} from '../src/codemirror6';

const views = [];

/**
 * Create a real CodeMirror 6 view for a player test.
 *
 * @param {string} doc Initial document
 * @param {Array<object>} extensions Additional state extensions
 * @return {EditorView} Editor view
 */
function createView(doc = '', extensions = [], allowMultipleSelections = true) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        ...(allowMultipleSelections ?
          [EditorState.allowMultipleSelections.of(true)] : []),
        ...extensions,
      ],
    }),
  });
  views.push(view);
  return view;
}

/**
 * Add literal v1 records through the public player interface.
 *
 * @param {CodePlay} player Player instance
 * @param {Array<object>} records Record objects
 */
function addRecords(player, records) {
  player.addOperations(JSON.stringify(records));
}

/**
 * Return absolute anchor/head offsets for every editor selection.
 *
 * @param {EditorView} view Editor view
 * @return {Array<Array<number>>} Selection offsets
 */
function selectionOffsets(view) {
  return view.state.selection.ranges.map((range) => [
    range.anchor,
    range.head,
  ]);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  while (views.length > 0) {
    views.pop().destroy();
  }
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('CodeMirror 6 player compatibility', () => {
  test('is paused before end listeners are notified', () => {
    const view = createView();
    const player = new CodePlay(view, {maxDelay: 0});
    let statusAtEnd = null;
    player.once('end', () => {
      statusAtEnd = player.getStatus();
    });

    addRecords(player, [{
      t: 10,
      o: [{o: 'i', i: [0, 0], a: 'done'}],
    }]);
    player.play();
    vi.advanceTimersByTime(10);

    expect(statusAtEnd).toBe('PAUSE');
    expect(player.getStatus()).toBe('PAUSE');
  });

  test('accepts an empty incremental batch as a no-op', () => {
    const view = createView();
    const player = new CodePlay(view, {autoplay: true});
    const playListener = vi.fn();
    player.on('play', playListener);

    expect(() => addRecords(player, [])).not.toThrow();
    expect(player.getDuration()).toBe(0);
    expect(player.getStatus()).toBe('PAUSE');
    expect(playListener).not.toHaveBeenCalled();
  });

  test('uses the end of an uncompressed legacy time interval', () => {
    const view = createView('A');
    const player = new CodePlay(view, {maxDelay: 0});

    addRecords(player, [{
      t: [3, 4],
      o: [{o: 'i', i: [0, 1], a: 'B'}],
    }]);

    expect(player.getDuration()).toBe(4);
    expect(player.getCurrentTime()).toBe(0);

    player.play();
    vi.advanceTimersByTime(3);
    expect(view.state.doc.toString()).toBe('A');
    expect(player.getCurrentTime()).toBe(3);

    vi.advanceTimersByTime(1);
    expect(view.state.doc.toString()).toBe('AB');
    expect(player.getCurrentTime()).toBe(4);
  });

  test(
      'applies one legacy operation as one unfiltered non-history transaction',
      () => {
        const transactions = [];
        const transactionFilter = vi.fn((transaction) => transaction);
        const view = createView('ab\ncd', [
          EditorState.transactionFilter.of(transactionFilter),
          EditorView.updateListener.of((update) => {
            transactions.push(...update.transactions);
          }),
        ]);
        const player = new CodePlay(view, {maxDelay: 0});

        addRecords(player, [{
          t: 10,
          o: [
            {o: 'd', i: [[0, 2], [1, 0]]},
            {o: 'i', i: [0, 3], a: ['X']},
          ],
        }]);
        player.play();
        vi.advanceTimersByTime(10);

        expect(view.state.doc.toString()).toBe('abcXd');
        expect(transactions).toHaveLength(1);
        expect(transactions[0].isUserEvent(playbackUserEvent)).toBe(true);
        expect(
            transactions[0].annotation(Transaction.addToHistory),
        ).toBe(false);
        expect(transactionFilter).not.toHaveBeenCalled();
      },
  );

  test('replays adjacent indentation deletion and brace insertion', () => {
    const view = createView('  \n}');
    const player = new CodePlay(view, {maxDelay: 0});

    addRecords(player, [{
      t: 10,
      o: [
        {o: 'i', i: [0, 2], a: '}'},
        {o: 'i', i: [[0, 0], [0, 2]], a: ''},
      ],
    }]);
    player.play();
    vi.advanceTimersByTime(10);

    expect(view.state.doc.toString()).toBe('}\n}');
  });

  test.each([
    {
      name: 'single input',
      doc: 'abc',
      records: [{t: 10, o: [{o: 'i', i: [0, 1], a: 'X'}]}],
      expectedDoc: 'aXbc',
      expectedSelection: [[2, 2]],
    },
    {
      name: 'compressed input',
      doc: '',
      records: [{
        t: [10, 30],
        l: 3,
        o: [{o: 'i', i: [0, 0], a: 'abc'}],
      }],
      expectedDoc: 'abc',
      expectedSelection: [[3, 3]],
    },
    {
      name: 'equal-time compressed input with scalar time',
      doc: '',
      records: [{
        t: 10,
        l: 3,
        o: [{o: 'i', i: [0, 0], a: 'abc'}],
      }],
      expectedDoc: 'abc',
      expectedSelection: [[3, 3]],
    },
    {
      name: 'compressed deletion',
      doc: 'abcdef',
      records: [{
        t: [10, 20],
        l: 2,
        o: [{o: 'd', i: [[0, 3], [0, 5]], d: [[1, 2]]}],
      }],
      expectedDoc: 'abcf',
      expectedSelection: [[3, 3]],
    },
    {
      name: 'multi-line paste replacement',
      doc: 'hello',
      records: [
        {
          t: 10,
          o: [{o: 'p', i: [[0, 1], [0, 4]], a: ['A', 'B']}],
        },
        {t: 11, o: [{o: 'o', i: [1, 1]}]},
      ],
      expectedDoc: 'hA\nBo',
      expectedSelection: [[4, 4]],
    },
    {
      name: 'compressed cursor movement',
      doc: 'abcdef',
      records: [{
        t: [10, 30],
        l: 3,
        o: [{o: 'o', i: [[0, 1], [0, 3]]}],
      }],
      expectedDoc: 'abcdef',
      expectedSelection: [[3, 3]],
    },
    {
      name: 'compressed selection expansion',
      doc: 'abcdef',
      records: [{
        t: [10, 30],
        l: 3,
        o: [{o: 'l', i: [0, 1], s: [[0, [[2, 4]]]]}],
      }],
      expectedDoc: 'abcdef',
      expectedSelection: [[1, 4]],
    },
    {
      name: 'multi-cursor input',
      doc: 'aa\nbb\ncc',
      records: [{
        t: 10,
        o: [
          {o: 'i', i: [2, 1], a: 'Y'},
          {o: 'i', i: [0, 1], a: 'X'},
        ],
      }],
      expectedDoc: 'aXa\nbb\ncYc',
      expectedSelection: [[2, 2], [9, 9]],
    },
    {
      name: 'multiple cursor and selection ranges',
      doc: 'aa\nbb\ncc',
      records: [{
        t: 10,
        o: [
          {o: 'o', i: [[0, 0], [0, 2]]},
          {o: 'o', i: [2, 1]},
        ],
      }],
      expectedDoc: 'aa\nbb\ncc',
      expectedSelection: [[0, 2], [7, 7]],
    },
    {
      name: 'set value',
      doc: 'old\nvalue',
      records: [{
        t: 10,
        o: [{
          o: 's',
          i: [[0, 0], [1, 5]],
          a: ['new', 'document'],
        }],
      }],
      expectedDoc: 'new\ndocument',
      expectedSelection: [[12, 12]],
    },
  ])('replays the v1 $name record', ({
    doc,
    records,
    expectedDoc,
    expectedSelection,
  }) => {
    const view = createView(doc);
    const player = new CodePlay(view, {maxDelay: 0});

    addRecords(player, records);
    player.play();
    vi.advanceTimersByTime(100);

    expect(view.state.doc.toString()).toBe(expectedDoc);
    expect(selectionOffsets(view)).toEqual(expectedSelection);
  });

  test('replays legacy content origins and an omitted origin', () => {
    const view = createView();
    const player = new CodePlay(view, {maxDelay: 0});

    addRecords(player, [
      {t: 10, o: [{o: 'k', i: [0, 0], a: 'K'}]},
      {t: 20, o: [{o: 'm', i: [0, 1], a: 'M'}]},
      {t: 30, o: [{o: 'n', i: [0, 2], a: 'N'}]},
      {t: 40, o: [{i: [0, 3], a: '?'}]},
    ]);
    player.play();
    vi.advanceTimersByTime(40);

    expect(view.state.doc.toString()).toBe('KMN?');
    expect(player.getDuration()).toBe(40);
  });

  test('replays multiple cursors in a default CodeMirror 6 state', () => {
    const view = createView('aa\nbb\ncc', [], false);
    const player = new CodePlay(view, {maxDelay: 0});

    addRecords(player, [{
      t: 10,
      o: [
        {o: 'i', i: [2, 1], a: 'Y'},
        {o: 'i', i: [0, 1], a: 'X'},
      ],
    }]);
    player.play();
    vi.advanceTimersByTime(10);

    expect(view.state.doc.toString()).toBe('aXa\nbb\ncYc');
    expect(selectionOffsets(view)).toEqual([[2, 2], [9, 9]]);
    expect(view.state.selection.mainIndex).toBe(0);
  });

  test('restores multiple-selection support after host reconfiguration', () => {
    const view = createView('aa\nbb\ncc', [], false);
    const player = new CodePlay(view, {maxDelay: 0});
    view.dispatch({effects: StateEffect.reconfigure.of([])});

    addRecords(player, [{
      t: 10,
      o: [
        {o: 'i', i: [2, 1], a: 'Y'},
        {o: 'i', i: [0, 1], a: 'X'},
      ],
    }]);
    player.play();
    vi.advanceTimersByTime(10);

    expect(selectionOffsets(view)).toEqual([[2, 2], [9, 9]]);
  });

  test('restores a stored multi-selection when seeking after reconfiguration', () => {
    const view = createView('abcdef', [], false);
    const player = new CodePlay(view, {maxDelay: 0});

    addRecords(player, [
      {
        t: 10,
        o: [
          {o: 'o', i: [[0, 0], [0, 2]]},
          {o: 'o', i: [[0, 5], [0, 3]]},
        ],
      },
      {t: 20, o: [{o: 'i', i: [0, 6], a: '!'}]},
    ]);
    player.play();
    vi.advanceTimersByTime(20);
    expect(view.state.doc.toString()).toBe('abcdef!');

    view.dispatch({effects: StateEffect.reconfigure.of([])});
    player.seek(15);

    expect(view.state.doc.toString()).toBe('abcdef');
    expect(selectionOffsets(view)).toEqual([[0, 2], [5, 3]]);
    expect(view.state.selection.mainIndex).toBe(1);
  });

  test('accepts documented false, zero, and null option values', () => {
    const view = createView();
    const player = new CodePlay(view, {
      maxDelay: 25,
      autoplay: true,
      autofocus: true,
      speed: 2,
      extraActivityHandler: vi.fn(),
      extraActivityReverter: vi.fn(),
    });

    player.setMaxDelay(0);
    player.setAutoplay(false);
    player.setAutofocus(false);
    player.setSpeed(0);
    player.setExtraActivityHandler(null);
    player.setExtraActivityReverter(null);

    expect({
      maxDelay: player.maxDelay,
      autoplay: player.autoplay,
      autofocus: player.autofocus,
      speed: player.speed,
      extraActivityHandler: player.extraActivityHandler,
      extraActivityReverter: player.extraActivityReverter,
    }).toEqual({
      maxDelay: 0,
      autoplay: false,
      autofocus: false,
      speed: 0,
      extraActivityHandler: null,
      extraActivityReverter: null,
    });
  });

  test(
      'freezes at zero speed and resumes from the same timeline position',
      () => {
        const view = createView();
        const player = new CodePlay(view, {maxDelay: 0, speed: 0});
        addRecords(player, [
          {t: 100, o: [{o: 'i', i: [0, 0], a: 'A'}]},
        ]);

        player.play();
        vi.advanceTimersByTime(1000);

        expect(view.state.doc.toString()).toBe('');
        expect(player.getCurrentTime()).toBe(0);

        player.setSpeed(2);
        vi.advanceTimersByTime(49);
        expect(view.state.doc.toString()).toBe('');
        expect(player.getCurrentTime()).toBe(98);

        vi.advanceTimersByTime(1);
        expect(view.state.doc.toString()).toBe('A');
        expect(player.getCurrentTime()).toBe(100);
        expect(player.getStatus()).toBe('PAUSE');
      },
  );

  test(
      'pauses, resumes, and clears playback without losing option values',
      () => {
        const view = createView();
        const handler = vi.fn();
        const player = new CodePlay(view, {
          maxDelay: 0,
          speed: 1,
          extraActivityHandler: handler,
        });
        addRecords(player, [
          {t: 100, o: [{o: 'i', i: [0, 0], a: 'A'}]},
          {t: 200, o: [{o: 'e', activity: 'later'}]},
        ]);

        expect(player.getDuration()).toBe(200);
        expect(player.getCurrentTime()).toBe(0);
        expect(player.getStatus()).toBe('PAUSE');

        player.play();
        vi.advanceTimersByTime(40);
        player.pause();
        expect(player.getCurrentTime()).toBe(40);
        expect(player.getStatus()).toBe('PAUSE');

        vi.advanceTimersByTime(100);
        expect(player.getCurrentTime()).toBe(40);
        expect(view.state.doc.toString()).toBe('');

        player.play();
        vi.advanceTimersByTime(59);
        expect(player.getCurrentTime()).toBe(99);
        expect(view.state.doc.toString()).toBe('');

        vi.advanceTimersByTime(1);
        vi.advanceTimersByTime(25);
        expect(view.state.doc.toString()).toBe('A');
        expect(player.getCurrentTime()).toBe(125);

        player.clear();
        vi.advanceTimersByTime(1000);
        expect(view.state.doc.toString()).toBe('A');
        expect(handler).not.toHaveBeenCalled();
        expect(player.getStatus()).toBe('PAUSE');
        expect(player.getCurrentTime()).toBe(0);
        expect(player.getDuration()).toBe(0);
        expect(player.maxDelay).toBe(0);
        expect(player.speed).toBe(1);
        expect(player.extraActivityHandler).toBe(handler);
      },
  );

  test(
      'seeks forward and backward through content, selections, and extras',
      () => {
        const view = createView('x');
        const handler = vi.fn();
        const reverter = vi.fn();
        const player = new CodePlay(view, {
          maxDelay: 0,
          extraActivityHandler: handler,
          extraActivityReverter: reverter,
        });
        addRecords(player, [
          {t: 10, o: [{o: 'i', i: [0, 0], a: 'A'}]},
          {t: 20, o: [{o: 'o', i: [[0, 0], [0, 1]]}]},
          {t: 30, o: [{o: 'i', i: [0, 2], a: 'B'}]},
          {t: 40, o: [{o: 'e', activity: 'flash'}]},
        ]);
        player.play();
        vi.advanceTimersByTime(40);

        expect(view.state.doc.toString()).toBe('AxB');
        expect(selectionOffsets(view)).toEqual([[3, 3]]);
        expect(handler).toHaveBeenCalledTimes(1);

        player.seek(25);
        vi.runAllTimers();
        expect(view.state.doc.toString()).toBe('Ax');
        expect(selectionOffsets(view)).toEqual([[0, 1]]);
        expect(reverter).toHaveBeenCalledTimes(1);
        expect(player.getCurrentTime()).toBe(25);
        expect(player.getStatus()).toBe('PAUSE');

        player.seek(0);
        vi.advanceTimersByTime(0);
        expect(view.state.doc.toString()).toBe('x');
        expect(selectionOffsets(view)).toEqual([[0, 0]]);
        expect(player.getCurrentTime()).toBe(0);
        expect(player.speed).toBe(1);

        player.seek(25);
        vi.runAllTimers();
        expect(view.state.doc.toString()).toBe('Ax');
        expect(selectionOffsets(view)).toEqual([[0, 1]]);
        expect(player.getCurrentTime()).toBe(25);

        player.seek(40);
        vi.runAllTimers();
        expect(view.state.doc.toString()).toBe('AxB');
        expect(selectionOffsets(view)).toEqual([[3, 3]]);
        expect(handler).toHaveBeenCalledTimes(2);
        expect(player.getCurrentTime()).toBe(40);
      },
  );

  test('preserves the original state across replacement seeks', () => {
    const view = createView();
    const player = new CodePlay(view, {maxDelay: 0, speed: 3});
    addRecords(player, [
      {t: 10, o: [{o: 'i', i: [0, 0], a: 'a'}]},
      {t: 20, o: [{o: 'i', i: [0, 1], a: 'b'}]},
      {t: 30, o: [{o: 'i', i: [0, 2], a: 'c'}]},
    ]);

    player.seek(30);
    player.seek(20);
    vi.runAllTimers();

    expect(view.state.doc.toString()).toBe('ab');
    expect(player.getCurrentTime()).toBe(20);
    expect(player.getStatus()).toBe('PAUSE');
    expect(player.speed).toBe(3);
  });

  test('emits end once when active playback seeks to the duration', () => {
    const view = createView();
    const player = new CodePlay(view, {maxDelay: 0});
    const endListener = vi.fn();
    player.on('end', endListener);
    addRecords(player, [
      {t: 10, o: [{o: 'i', i: [0, 0], a: 'a'}]},
      {t: 20, o: [{o: 'i', i: [0, 1], a: 'b'}]},
    ]);

    player.play();
    vi.advanceTimersByTime(5);
    player.seek(player.getDuration());
    vi.runAllTimers();

    expect(view.state.doc.toString()).toBe('ab');
    expect(player.getStatus()).toBe('PAUSE');
    expect(endListener).toHaveBeenCalledTimes(1);
  });

  test('honors maxDelay and can disable the delay cap with zero', () => {
    const view = createView();
    const player = new CodePlay(view, {maxDelay: 20});
    addRecords(player, [
      {t: 100, o: [{o: 'i', i: [0, 0], a: 'A'}]},
    ]);

    player.play();
    vi.advanceTimersByTime(19);
    expect(view.state.doc.toString()).toBe('');
    vi.advanceTimersByTime(1);
    expect(view.state.doc.toString()).toBe('A');
    expect(player.getCurrentTime()).toBe(100);

    player.clear();
    player.setMaxDelay(0);
    addRecords(player, [
      {t: 100, o: [{o: 'i', i: [0, 1], a: 'B'}]},
    ]);
    player.play();
    vi.advanceTimersByTime(99);
    expect(view.state.doc.toString()).toBe('A');
    vi.advanceTimersByTime(1);
    expect(view.state.doc.toString()).toBe('AB');
  });

  test('toggles autoplay and autofocus after construction', () => {
    const view = createView();
    const focus = vi.spyOn(view, 'focus');
    const player = new CodePlay(view, {
      maxDelay: 0,
      autoplay: true,
      autofocus: true,
    });

    addRecords(player, [
      {t: 10, o: [{o: 'i', i: [0, 0], a: 'A'}]},
    ]);
    expect(player.getStatus()).toBe('PLAY');
    expect(focus).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10);

    player.clear();
    player.setAutoplay(false);
    player.setAutofocus(false);
    focus.mockClear();
    addRecords(player, [
      {t: 10, o: [{o: 'i', i: [0, 1], a: 'B'}]},
    ]);
    expect(player.getStatus()).toBe('PAUSE');
    expect(view.state.doc.toString()).toBe('A');

    player.play();
    expect(focus).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(view.state.doc.toString()).toBe('AB');
  });

  test('emits all five player events and supports removing a listener', () => {
    const view = createView();
    const player = new CodePlay(view, {maxDelay: 0});
    const events = [];
    const removedListener = vi.fn();

    for (const event of ['play', 'pause', 'seek', 'end', 'clear']) {
      player.on(event, () => events.push(event));
    }
    player.on('play', removedListener);
    player.off('play', removedListener);
    addRecords(player, [
      {t: 10, o: [{o: 'i', i: [0, 0], a: 'A'}]},
    ]);

    player.play();
    vi.advanceTimersByTime(10);
    player.seek(0);
    player.clear();

    expect(events).toEqual(['play', 'pause', 'end', 'seek', 'clear']);
    expect(removedListener).not.toHaveBeenCalled();
  });
});
