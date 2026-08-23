const assert = require('node:assert/strict');
const {after, before, test} = require('node:test');

const {JSDOM} = require('jsdom');

let CodeMirror;
let CodePlay;
let CodeRecord;
let dom;

const initialDocument = 'A😀B\nCé\n尾Z';
const timeline = JSON.stringify([
  {t: 10, o: [{o: 'o', i: [[0, 3], [0, 1]]}]},
  {t: [20, 30], l: 3, o: [{o: 'i', i: [0, 3], a: 'λβγ'}]},
  {t: 40, o: [{o: 'e', activity: {id: 'one'}}]},
  {t: 50, o: [{o: 'd', i: [[1, 0], [1, 2]]}]},
  {t: 60, o: [{o: 'e', activity: {id: 'two'}}]},
  {t: 70, o: [
    {o: 'o', i: [[0, 6], [0, 3]]},
    {o: 'o', i: [[2, 1], [2, 0]]},
  ]},
  {t: 80, o: [{o: 'o', i: [[2, 1], [0, 0]]}]},
]);

before(() => {
  dom = new JSDOM('<main></main>', {pretendToBeVisual: true});
  dom.window.focus = () => {};
  for (const name of [
    'DOMRect',
    'HTMLElement',
    'MutationObserver',
    'Node',
    'Range',
    'Text',
    'Window',
  ]) {
    globalThis[name] = dom.window[name];
  }
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.navigator = dom.window.navigator;
  globalThis.innerHeight = dom.window.innerHeight;
  globalThis.innerWidth = dom.window.innerWidth;
  globalThis.requestAnimationFrame =
    dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame =
    dom.window.cancelAnimationFrame.bind(dom.window);
  if (!globalThis.Range.prototype.getClientRects) {
    globalThis.Range.prototype.getClientRects = () => [];
  }
  if (!globalThis.Range.prototype.getBoundingClientRect) {
    globalThis.Range.prototype.getBoundingClientRect =
      () => new globalThis.DOMRect();
  }

  CodeMirror = require('codemirror');
  ({CodePlay, CodeRecord} = require('../dist/main.js'));
});

after(() => {
  dom.window.close();
});

test('seek(0) and an exact-boundary seek restore playback state', async () => {
  const {player} = createTimelinePlayer({speed: 3});

  await seekTo(player, 80);
  await seekTo(player, 30);
  player.seek(30);
  assert.equal(player.getStatus(), 'PAUSE');
  assert.equal(player.getCurrentTime(), 30);
  assert.equal(player.speed, 3);
  assert.equal(player.seekTime, null);
  assert.equal(player.speedBeforeSeeking, null);

  await seekTo(player, 0);
  assert.equal(player.getCurrentTime(), 0);
  assert.equal(player.getStatus(), 'PAUSE');
  assert.equal(player.speed, 3);
  assert.equal(player.seekTime, null);
  assert.equal(player.speedBeforeSeeking, null);
});

test('a newer seek replaces an in-flight seek without losing baseline state',
    async () => {
      const {editor, player} = createTimelinePlayer({speed: 3});

      player.seek(30);
      player.seek(25);
      await waitForSeek(player, 25);

      assert.deepEqual(editorState(editor), {
        document: 'A😀λβB\nCé\n尾Z',
        selection: {ranges: [[5, 5]], mainIndex: 0},
      });
      assert.equal(player.speed, 3);
      assert.equal(player.seekTime, null);
      assert.equal(player.speedBeforeSeeking, null);
    });

test('backward seek restores all directed selections and the primary range',
    async () => {
      const {editor, player} = createTimelinePlayer();

      await seekTo(player, 80);
      await seekTo(player, 70);

      assert.deepEqual(editorState(editor), {
        document: 'A😀λβγB\n\n尾Z',
        selection: {
          ranges: [[6, 3], [10, 9]],
          mainIndex: 1,
        },
      });
    });

test('reverse then forward seek does not skip or duplicate compressed input',
    async () => {
      const {editor, player, reverted} = createTimelinePlayer();

      await seekTo(player, 80);
      await seekTo(player, 25);
      assert.deepEqual(editorState(editor), {
        document: 'A😀λβB\nCé\n尾Z',
        selection: {ranges: [[5, 5]], mainIndex: 0},
      });
      assert.deepEqual(reverted, [{id: 'two'}, {id: 'one'}]);

      await seekTo(player, 30);
      assert.deepEqual(editorState(editor), {
        document: 'A😀λβγB\nCé\n尾Z',
        selection: {ranges: [[6, 6]], mainIndex: 0},
      });
    });

test('terminal pause state and event precede end', async () => {
  const editor = createEditor('');
  const player = new CodePlay(editor, {maxDelay: 1, speed: 100});
  const events = [];
  player.addOperations(JSON.stringify([
    {t: 1, o: [{o: 'i', i: [0, 0], a: 'x'}]},
  ]));
  player.on('pause', () => events.push(['pause', player.getStatus()]));
  player.on('end', () => events.push(['end', player.getStatus()]));

  await playToEnd(player);

  assert.deepEqual(events, [
    ['pause', 'PAUSE'],
    ['end', 'PAUSE'],
  ]);
});

test('seek to the end while playing emits one terminal end', async () => {
  const {player} = createTimelinePlayer();
  const events = [];
  player.on('play', () => events.push('play'));
  player.on('end', () => events.push('end'));

  player.play();
  assert.equal(player.getStatus(), 'PLAY');
  player.seek(80);
  await waitForSeek(player, 80);

  assert.deepEqual(events, ['play', 'end']);
  assert.equal(player.getStatus(), 'PAUSE');
});

test('expands an equal-time compressed group from a scalar timestamp',
    async () => {
      const editor = createEditor('');
      const player = new CodePlay(editor, {maxDelay: 1});
      player.addOperations(JSON.stringify([
        {t: 10, l: 2, o: [{o: 'i', i: [0, 0], a: 'ab'}]},
      ]));

      assert.equal(player.getDuration(), 10);
      await playToEnd(player);
      assert.equal(editor.getValue(), 'ab');
      assert.equal(player.getCurrentTime(), 10);
    });

test('uses the end of an uncompressed legacy time interval', async () => {
  const editor = createEditor('A');
  const player = new CodePlay(editor, {maxDelay: 1});
  player.addOperations(JSON.stringify([
    {t: [3, 4], o: [{o: 'i', i: [0, 1], a: 'B'}]},
  ]));

  assert.equal(player.getDuration(), 4);
  await playToEnd(player);
  assert.equal(editor.getValue(), 'AB');
  assert.equal(player.getCurrentTime(), 4);
});

test('never writes a compressed group with a scalar timestamp', () => {
  const contentCases = [
    [
      rawContentOperation('+input', 0, 0, ['a'], ['']),
      rawContentOperation('+input', 1, 1, ['b'], ['']),
    ],
    [
      rawContentOperation('*compose', 0, 0, ['a'], ['']),
      rawContentOperation('*compose', 1, 1, ['b'], ['']),
    ],
    [
      rawContentOperation('+delete', 2, 3, [''], ['c']),
      rawContentOperation('+delete', 1, 2, [''], ['b']),
    ],
  ];
  const cursorCases = [
    [rawCursorOperation(0, 0), rawCursorOperation(1, 1)],
    [rawCursorOperation(0, 1), rawCursorOperation(0, 2)],
  ];

  for (const operations of [...contentCases, ...cursorCases]) {
    const recorder = new CodeRecord(createEditor('abc'));
    recorder.operations = operations;
    const records = JSON.parse(recorder.getRecords());

    assert.equal(records.length, 2);
    assert.ok(records.every((record) =>
      !('l' in record) && typeof(record.t) === 'number',
    ));
  }
});

test('writes real uncompressed operations at scalar end timestamps', () => {
  const editor = createEditor('');
  const RealDate = globalThis.Date;
  let currentTime = RealDate.parse('2026-01-01T00:00:00Z');

  class TickingDate extends RealDate {
    constructor(...arguments_) {
      super(...(arguments_.length === 0 ? [currentTime] : arguments_));
      if (arguments_.length === 0) {
        currentTime += 1;
      }
    }

    static now() {
      return currentTime;
    }
  }

  globalThis.Date = TickingDate;
  try {
    const recorder = new CodeRecord(editor);
    recorder.listen();
    editor.replaceRange('x', editor.posFromIndex(0), undefined, '+input');
    recorder.recordExtraActivity({kind: 'tick'});

    const content = recorder.operations.find((operation) =>
      'ops' in operation && operation.ops[0].origin === '+input',
    );
    const extra = recorder.operations.find((operation) =>
      'ops' in operation && operation.ops[0].origin === 'extra',
    );
    assert.ok(content.startTime < content.endTime);
    assert.ok(extra.startTime < extra.endTime);
    const contentEndTime = content.endTime;
    const extraEndTime = extra.endTime;

    assert.deepEqual(JSON.parse(recorder.getRecords()), [
      {t: contentEndTime, o: [{o: 'i', i: [0, 0], a: 'x'}]},
      {t: extraEndTime, o: [{activity: {kind: 'tick'}, o: 'e'}]},
    ]);
  } finally {
    globalThis.Date = RealDate;
  }
});

test('paste preservation clones only a cursor predecessor', () => {
  const recorder = new CodeRecord(createEditor('seed'));
  const content = contentOperation('+input', 10);
  const paste = contentOperation('paste', 20);
  recorder.operations = [content, paste];

  recorder.removeRedundantCursorOperations();

  assert.deepEqual(recorder.operations, [content, paste]);
  assert.equal(content.startTime, 10);
  assert.equal(content.endTime, 10);

  const cursor = {
    startTime: 15,
    endTime: 15,
    delayDuration: 5,
    crs: [{
      anchor: {line: 0, ch: 1},
      head: {line: 0, ch: 1},
    }],
    combo: 1,
  };
  recorder.operations = [cursor, contentOperation('paste', 20)];
  recorder.removeRedundantCursorOperations();

  assert.equal(recorder.operations.length, 2);
  assert.equal(recorder.operations[0].ops[0].origin, 'paste');
  assert.notEqual(recorder.operations[1], cursor);
  assert.deepEqual(recorder.operations[1].crs, cursor.crs);
  assert.equal(recorder.operations[1].startTime, 21);
  assert.equal(recorder.operations[1].endTime, 21);
  assert.equal(cursor.startTime, 15);
  assert.equal(cursor.endTime, 15);
});

test('keeps the published v1.1.6 golden recording bytes unchanged', () => {
  const RealDate = globalThis.Date;
  const initialClockTime = Date.parse('2026-01-01T00:00:00Z');
  let currentTime = initialClockTime;
  class ControlledDate extends RealDate {
    constructor(...arguments_) {
      super(...(arguments_.length === 0 ? [currentTime] : arguments_));
    }

    static now() {
      return currentTime;
    }
  }
  globalThis.Date = ControlledDate;
  try {
    const editor = createEditor('abc\ndef');
    const recorder = new CodeRecord(editor);
    recorder.listen();
    const at = (time, action) => {
      currentTime = initialClockTime + time;
      action();
    };
    at(10, () => editor.replaceRange(
        'X', editor.posFromIndex(0), undefined, '+input',
    ));
    at(20, () => editor.replaceRange(
        'Y', editor.posFromIndex(1), undefined, '+input',
    ));
    at(30, () => editor.replaceRange(
        '', editor.posFromIndex(4), editor.posFromIndex(5), '+delete',
    ));
    at(40, () => recorder.recordExtraActivity({kind: 'golden', value: 1}));
    at(50, () => editor.setSelection(
        editor.posFromIndex(0), editor.posFromIndex(3),
    ));

    assert.equal(
        recorder.getRecords(),
        '[{"t":[10,20],"l":2,"o":[{"o":"i","i":[0,0],"a":"XY"}]},' +
        '{"t":30,"o":[{"o":"d","i":[[0,4],[0,5]]}]},' +
        '{"t":40,"o":[{"activity":{"kind":"golden","value":1},"o":"e"}]},' +
        '{"t":50,"o":[{"o":"o","i":[[0,0],[0,3]]}]}]',
    );
  } finally {
    globalThis.Date = RealDate;
  }
});

function createTimelinePlayer(options = {}) {
  const editor = createEditor(initialDocument);
  const handled = [];
  const reverted = [];
  const player = new CodePlay(editor, {
    maxDelay: 1,
    speed: 1,
    extraActivityHandler(activity) {
      handled.push(activity);
    },
    extraActivityReverter(activity) {
      reverted.push(activity);
    },
    ...options,
  });
  player.addOperations(timeline);
  return {editor, handled, player, reverted};
}

function createEditor(value) {
  const host = globalThis.document.createElement('div');
  globalThis.document.querySelector('main').append(host);
  return CodeMirror(host, {value});
}

function contentOperation(origin, time) {
  return {
    startTime: time,
    endTime: time,
    delayDuration: time,
    ops: [{
      from: {line: 0, ch: 0},
      to: {line: 0, ch: 0},
      origin,
      removed: [''],
      text: ['x'],
    }],
    combo: 1,
  };
}

function rawContentOperation(origin, from, to, text, removed) {
  return {
    startTime: 10,
    endTime: 10,
    delayDuration: 0,
    ops: [{
      from: {line: 0, ch: from},
      to: {line: 0, ch: to},
      origin,
      removed,
      text,
    }],
    combo: 1,
  };
}

function rawCursorOperation(anchor, head) {
  return {
    startTime: 10,
    endTime: 10,
    delayDuration: 0,
    crs: [{
      anchor: {line: 0, ch: anchor},
      head: {line: 0, ch: head},
    }],
    combo: 1,
  };
}

function editorState(editor) {
  const ranges = editor.listSelections().map((range) => [
    editor.indexFromPos(range.anchor),
    editor.indexFromPos(range.head),
  ]);
  const primary = [
    editor.indexFromPos(editor.getCursor('anchor')),
    editor.indexFromPos(editor.getCursor('head')),
  ];
  return {
    document: editor.getValue(),
    selection: {
      ranges,
      mainIndex: ranges.findIndex((range) =>
        range[0] === primary[0] && range[1] === primary[1]),
    },
  };
}

async function playToEnd(player) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
        () => reject(new Error('playback did not finish')),
        2000,
    );
    player.once('end', () => {
      clearTimeout(timeout);
      resolve();
    });
    player.play();
  });
}

async function seekTo(player, time) {
  player.seek(time);
  await waitForSeek(player, time);
}

async function waitForSeek(player, time) {
  const timeoutAt = Date.now() + 2000;
  while (player.getStatus() !== 'PAUSE' ||
      player.getCurrentTime() !== time) {
    if (Date.now() >= timeoutAt) {
      throw new Error(`player did not settle at ${time}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}
