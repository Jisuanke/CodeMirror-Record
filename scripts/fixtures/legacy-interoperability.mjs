import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInThisContext} from 'node:vm';
import {JSDOM} from 'jsdom';

import {installDomGlobals} from './install-dom-globals.mjs';

const require = createRequire(import.meta.url);
const publicNpmRegistry = 'https://registry.npmjs.org/';
const legacyGoldens = await Promise.all(
    ['1.1.5', '1.1.6', '1.1.7', '1.1.8'].map(async (version) => ({
      version,
      value: JSON.parse(await readFile(
          new URL(`./legacy-v${version}-golden.json`, import.meta.url),
          'utf8',
      )),
    })),
);
verifyRegistryBackedCorpora();
if (process.argv.includes('--verify-registry-integrity-only')) {
  process.exit(0);
}

const dom = new JSDOM('<main></main>', {pretendToBeVisual: true});
// CodeMirror 5 focuses its hidden input while replaying. jsdom deliberately
// reports window.focus() as unimplemented, so provide the harmless browser
// primitive the compatibility harness expects instead of burying real errors
// under hundreds of environment warnings.
dom.window.focus = () => {};

installDomGlobals(dom);
if (!globalThis.Range.prototype.getClientRects) {
  globalThis.Range.prototype.getClientRects = () => [];
}
if (!globalThis.Range.prototype.getBoundingClientRect) {
  globalThis.Range.prototype.getBoundingClientRect =
    () => new globalThis.DOMRect();
}

const CodeMirror = require('codemirror');
const legacyPackage = loadLegacyPackage('cm-record-v1');
const {
  CodePlay: LegacyCodePlay,
  CodeRecord: LegacyCodeRecord,
} = legacyPackage;
const {version: legacyPackageVersion} = require('cm-record-v1/package.json');
const {
  CodeRecord: ImmutableIntervalCodeRecord,
} = require('cm-record-v1-interval-producer');
const {
  version: immutableIntervalProducerVersion,
} = require('cm-record-v1-interval-producer/package.json');
const {
  EditorSelection,
  EditorState,
  Transaction,
} = await import('@codemirror/state');
const {EditorView} = await import('@codemirror/view');
const {
  CodePlay: ModernCodePlay,
  CodeRecord: ModernCodeRecord,
} = await import('codemirror-record');

function loadLegacyPackage(packageName) {
  const packageExports = require(packageName);
  if (
    typeof packageExports.CodePlay === 'function' &&
    typeof packageExports.CodeRecord === 'function'
  ) {
    return packageExports;
  }

  // Early releases shipped a browser webpack entry that executes its module
  // but discards the entry exports. Evaluate those exact reviewed bytes with
  // only an observation of the bootstrap result; no source is substituted.
  const entryPath = require.resolve(packageName);
  const bundle = readFileSync(entryPath, 'utf8');
  const bootstrapCall = 'o(o.s=0)}([';
  assert.ok(
      bundle.startsWith('!function') && bundle.includes(bootstrapCall),
      `${packageName} has an unknown non-CommonJS bundle wrapper`,
  );
  const exportSlot = '__CODEMIRROR_RECORD_RESTORED_EXPORTS__';
  assert.equal(globalThis[exportSlot], undefined);
  const instrumentedBundle = bundle.replace(
      bootstrapCall,
      `globalThis.${exportSlot}=o(o.s=0)}([`,
  );
  runInThisContext(instrumentedBundle, {filename: entryPath});
  const restoredExports = globalThis[exportSlot];
  delete globalThis[exportSlot];
  assert.equal(typeof restoredExports.CodePlay, 'function');
  assert.equal(typeof restoredExports.CodeRecord, 'function');
  return restoredExports;
}

const modernViews = [];
const initialClockTime = Date.parse('2026-01-01T00:00:00Z');
const [legacyMajor, legacyMinor, legacyPatch] = legacyPackageVersion
    .split('.')
    .map(Number);
const legacyIsPreV1 = legacyMajor === 0;
assert.equal(
    immutableIntervalProducerVersion,
    '1.1.6',
    'ungrouped interval fixture must use the immutable v1.1.6 producer',
);

function verifyRegistryBackedCorpora() {
  for (const {value: corpus} of legacyGoldens) {
    const source = corpus.generator.source;
    if (source?.kind !== 'npm-registry') {
      continue;
    }
    assert.equal(
        typeof source.spec,
        'string',
        'npm-registry corpus provenance requires source.spec',
    );
    assert.equal(
        typeof source.integrity,
        'string',
        `${source.spec} corpus provenance requires source.integrity`,
    );
    const registryIntegrity = JSON.parse(execFileSync('npm', [
      'view',
      source.spec,
      'dist.integrity',
      '--json',
      '--registry',
      publicNpmRegistry,
      `--@codemirror:registry=${publicNpmRegistry}`,
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
    assert.equal(
        registryIntegrity,
        source.integrity,
        `${source.spec} registry integrity differs from its immutable corpus`,
    );
  }
}

function legacyVersionIsAtLeast(major, minor, patch) {
  return legacyMajor > major ||
    (legacyMajor === major && legacyMinor > minor) ||
    (legacyMajor === major && legacyMinor === minor &&
      legacyPatch >= patch);
}

const maintainedLegacyBaseline = [1, 1, 8];

// Keep each compatibility capability independent. That prevents a future
// maintenance release from accidentally turning an unrelated semver threshold
// into a blanket "strict" switch.
const legacySupportsSeekToStart = legacyVersionIsAtLeast(1, 1, 7);
const legacyRestoresDocumentAtExactReverseBoundary =
  legacyVersionIsAtLeast(1, 1, 7);
const legacyRestoresSelectionsWhileReversing =
  legacyVersionIsAtLeast(1, 1, 7);
// v1.1.7 fixed state seeking but its parser still expands scalar `t` plus `l`
// into NaN/undefined operation times. v1.1.8 is the first strict baseline for
// equal-millisecond v1 recorder output.
const legacyReportsExpandedLogicalOperationTimes =
  legacyVersionIsAtLeast(...maintainedLegacyBaseline);
// Every immutable public reader from v0.3.1 through v1.1.7 preserves the
// producer's ungrouped [startTime, endTime] array as its operation time and
// duration. v1.1.8 is the first reader that normalizes this shape.
const legacyNormalizesUngroupedIntervalTime =
  legacyVersionIsAtLeast(...maintainedLegacyBaseline);

function createHost(label) {
  const host = globalThis.document.createElement('div');
  host.dataset.compatibilityFixture = label;
  globalThis.document.querySelector('main').append(host);
  return host;
}

function withControlledClock(callback) {
  const RealDate = globalThis.Date;
  let currentTime = initialClockTime;

  class ControlledDate extends RealDate {
    constructor(...arguments_) {
      if (arguments_.length === 0) {
        super(currentTime);
      } else {
        super(...arguments_);
      }
    }

    static now() {
      return currentTime;
    }
  }

  globalThis.Date = ControlledDate;
  try {
    return callback((relativeTime, action) => {
      currentTime = initialClockTime + relativeTime;
      return action();
    });
  } finally {
    globalThis.Date = RealDate;
  }
}

function withTickingClock(callback) {
  const RealDate = globalThis.Date;
  let currentTime = initialClockTime;

  class TickingDate extends RealDate {
    constructor(...arguments_) {
      if (arguments_.length === 0) {
        super(currentTime++);
      } else {
        super(...arguments_);
      }
    }
  }

  globalThis.Date = TickingDate;
  try {
    return callback();
  } finally {
    globalThis.Date = RealDate;
  }
}

function offsetRange(anchor, head = anchor) {
  return {anchor, head};
}

const legacyRuntime = {
  name: 'CodeMirror 5 v1 recorder',
  supportsSeekToStart: legacySupportsSeekToStart,
  restoresDocumentAtExactReverseBoundary:
    legacyRestoresDocumentAtExactReverseBoundary,
  restoresSelectionsWhileReversing:
    legacyRestoresSelectionsWhileReversing,
  reportsExpandedLogicalOperationTimes:
    legacyReportsExpandedLogicalOperationTimes,
  normalizesUngroupedIntervalTime:
    legacyNormalizesUngroupedIntervalTime,

  capture(initialDocument, action, options = {}) {
    const editor = CodeMirror(createHost('legacy-record'), {
      value: initialDocument,
    });
    const records = withControlledClock((at) => {
      const recorder = new LegacyCodeRecord(editor);
      recorder.listen();
      action({at, editor, recorder, runtime: this, options});
      return recorder.getRecords();
    });
    return {editor, records};
  },

  createPlayer(initialDocument, records, options = {}) {
    const editor = CodeMirror(createHost('legacy-play'), {
      value: initialDocument,
    });
    const player = new LegacyCodePlay(editor, {
      maxDelay: 1,
      speed: 1,
      ...options,
    });
    player.addOperations(records);
    return {editor, player, runtime: this};
  },

  edit(editor, change) {
    if (change.origin === 'setValue') {
      editor.setValue(change.insert);
      return;
    }
    editor.replaceRange(
        change.insert,
        editor.posFromIndex(change.from),
        editor.posFromIndex(change.to ?? change.from),
        change.origin,
    );
  },

  setSelections(editor, ranges, mainIndex) {
    editor.setSelections(ranges.map((range) => ({
      anchor: editor.posFromIndex(range.anchor),
      head: editor.posFromIndex(range.head),
    })), mainIndex);
  },

  recordMultipleChanges(editor) {
    editor.operation(() => {
      editor.replaceRange(
          'Y',
          editor.posFromIndex(7),
          undefined,
          '+input',
      );
      editor.replaceRange(
          'X',
          editor.posFromIndex(1),
          undefined,
          '+input',
      );
    });
  },

  recordMultiCursorInput(editor, positions, insert) {
    editor.operation(() => {
      for (const position of positions.toSorted((a, b) => b - a)) {
        editor.replaceRange(
            insert,
            editor.posFromIndex(position),
            undefined,
            '+input',
        );
      }
    });
  },

  recordMultiCursorDeletion(editor, ranges) {
    editor.operation(() => {
      for (const range of ranges.toSorted((a, b) => b.from - a.from)) {
        editor.replaceRange(
            '',
            editor.posFromIndex(range.from),
            editor.posFromIndex(range.to),
            '+delete',
        );
      }
    });
  },

  recordMixedOriginChanges(editor) {
    editor.operation(() => {
      editor.replaceRange(
          'X',
          editor.posFromIndex(6),
          undefined,
          '+input',
      );
      editor.replaceRange(
          '',
          editor.posFromIndex(1),
          editor.posFromIndex(2),
          '+delete',
      );
    });
  },

  document(editor) {
    return editor.getValue();
  },

  selection(editor) {
    const ranges = editor.listSelections().map((range) => [
      editor.indexFromPos(range.anchor),
      editor.indexFromPos(range.head),
    ]);
    const primary = [
      editor.indexFromPos(editor.getCursor('anchor')),
      editor.indexFromPos(editor.getCursor('head')),
    ];
    return {
      ranges,
      mainIndex: ranges.findIndex((range) =>
        range[0] === primary[0] && range[1] === primary[1]),
    };
  },
};

const modernUserEvents = {
  '*compose': 'input.type.compose',
  '+delete': 'delete.backward',
  '+input': 'input.type',
  cut: 'delete.cut',
  drag: 'input.drop',
  paste: 'input.paste',
};

const modernRuntime = {
  name: 'CodeMirror 6 v2 recorder',
  supportsSeekToStart: true,
  restoresDocumentAtExactReverseBoundary: true,
  restoresSelectionsWhileReversing: true,
  reportsExpandedLogicalOperationTimes: true,
  normalizesUngroupedIntervalTime: true,

  capture(initialDocument, action, options = {}) {
    const extensions = options.allowMultipleSelections ?
      [EditorState.allowMultipleSelections.of(true)] : [];
    const editor = new EditorView({
      parent: createHost('modern-record'),
      state: EditorState.create({
        doc: initialDocument,
        extensions,
      }),
    });
    modernViews.push(editor);
    const records = withControlledClock((at) => {
      const recorder = new ModernCodeRecord(editor);
      recorder.listen();
      action({at, editor, recorder, runtime: this, options});
      return recorder.getRecords();
    });
    return {editor, records};
  },

  createPlayer(initialDocument, records, options = {}) {
    const editor = new EditorView({
      parent: createHost('modern-play'),
      state: EditorState.create({doc: initialDocument}),
    });
    modernViews.push(editor);
    const player = new ModernCodePlay(editor, {
      maxDelay: 1,
      speed: 1,
      ...options,
    });
    player.addOperations(records);
    return {editor, player, runtime: this};
  },

  edit(editor, change) {
    const userEvent = modernUserEvents[change.origin];
    const spec = {
      changes: {
        from: change.from,
        to: change.to ?? change.from,
        insert: change.insert,
      },
    };
    if (userEvent !== undefined) {
      spec.annotations = Transaction.userEvent.of(userEvent);
    }
    if (change.origin !== 'setValue' && !change.preserveSelection) {
      spec.selection = EditorSelection.cursor(
          change.from + change.insert.length,
      );
    }
    editor.dispatch(spec);
  },

  setSelections(editor, ranges, mainIndex) {
    editor.dispatch({
      selection: EditorSelection.create(ranges.map((range) =>
        EditorSelection.range(range.anchor, range.head),
      ), mainIndex),
    });
  },

  recordMultipleChanges(editor) {
    editor.dispatch({
      changes: [
        {from: 1, insert: 'X'},
        {from: 7, insert: 'Y'},
      ],
      annotations: Transaction.userEvent.of('input.type'),
    });
  },

  recordMultiCursorInput(editor, positions, insert) {
    const sortedPositions = positions.toSorted((a, b) => a - b);
    let insertedBefore = 0;
    const cursors = sortedPositions.map((position) => {
      const cursor = position + insertedBefore + insert.length;
      insertedBefore += insert.length;
      return EditorSelection.cursor(cursor);
    });
    editor.dispatch({
      changes: sortedPositions.map((position) => ({
        from: position,
        insert,
      })),
      selection: EditorSelection.create(cursors),
      annotations: Transaction.userEvent.of('input.type'),
    });
  },

  recordMultiCursorDeletion(editor, ranges) {
    const sortedRanges = ranges.toSorted((a, b) => a.from - b.from);
    let removedBefore = 0;
    const cursors = sortedRanges.map((range) => {
      const cursor = range.from - removedBefore;
      removedBefore += range.to - range.from;
      return EditorSelection.cursor(cursor);
    });
    editor.dispatch({
      changes: sortedRanges.map((range) => ({
        from: range.from,
        to: range.to,
        insert: '',
      })),
      selection: EditorSelection.create(cursors),
      annotations: Transaction.userEvent.of('delete.backward'),
    });
  },

  recordMixedOriginChanges(editor) {
    editor.dispatch({
      changes: [
        {from: 1, to: 2, insert: ''},
        {from: 6, insert: 'X'},
      ],
    });
  },

  document(editor) {
    return editor.state.doc.toString();
  },

  selection(editor) {
    return {
      ranges: editor.state.selection.ranges.map((range) => [
        range.anchor,
        range.head,
      ]),
      mainIndex: editor.state.selection.mainIndex,
    };
  },
};

function parsedRecords(records) {
  return JSON.parse(records);
}

function recordsForOrigin(records, origin) {
  return parsedRecords(records).filter((record) =>
    record.o[0].o === origin,
  );
}

function expandedTimes(record) {
  if (!Array.isArray(record.t)) {
    return Array.from({length: record.l ?? 1}, () => record.t);
  }
  if (record.l === undefined) {
    return [record.t[1]];
  }
  return Array.from({length: record.l}, (_, index) => {
    if (index === record.l - 1) {
      return record.t[1];
    }
    return Math.floor(
        record.t[0] +
        (record.t[1] - record.t[0]) / (record.l - 1) * index,
    );
  });
}

async function verifyEqualTimeInput(direction) {
  const {records} = direction.producer.capture('', ({at, editor, runtime}) => {
    at(10, () => runtime.edit(editor, {
      from: 0,
      insert: 'a',
      origin: '+input',
    }));
    at(10, () => runtime.edit(editor, {
      from: 1,
      insert: 'b',
      origin: '+input',
    }));
    at(10, () => runtime.edit(editor, {
      from: 2,
      insert: 'c',
      origin: '+input',
    }));
  });
  const inputRecords = recordsForOrigin(records, 'i');
  const message =
    `${label(direction, 'equal-time input timeline')}\n${records}`;

  assert.deepEqual(
      inputRecords.flatMap(expandedTimes),
      [10, 10, 10],
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument: '',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('', records);
  assert.equal(session.player.getDuration(), 10, message);
  await playToEnd(session);
  assertDocument(session, 'abc', message);
}

function captureRealLegacyTickingInput(Recorder, fixtureLabel) {
  const editor = CodeMirror(createHost('legacy-ticking-record'), {
    value: 'A',
  });
  let rawTimeInterval;
  const records = withTickingClock(() => {
    const recorder = new Recorder(editor);
    recorder.listen();
    // Keep this fixture to one content record. The edit still travels through
    // the real CM5 `changes` event and the published recorder; only the
    // unrelated cursor listener is removed so the content interval remains the
    // terminal duration under test.
    editor.off('cursorActivity', recorder.cursorActivityListener);
    editor.replaceRange(
        'B',
        editor.posFromIndex(1),
        undefined,
        '+input',
    );
    const contentOperation = recorder.operations.find((operation) =>
      operation.ops?.some((change) => change.origin === '+input'),
    );
    assert.ok(
        contentOperation,
        `${fixtureLabel} real CM5 recorder missed the ticking edit`,
    );
    rawTimeInterval = [
      contentOperation.startTime,
      contentOperation.endTime,
    ];
    return recorder.getRecords();
  });
  return {editor, rawTimeInterval, records};
}

async function verifyRealLegacyUngroupedInterval() {
  const {editor, rawTimeInterval, records} = captureRealLegacyTickingInput(
      ImmutableIntervalCodeRecord,
      'immutable v1.1.6',
  );
  const message =
    'real immutable CM5 v1.1.6 ticking-clock ungrouped interval -> ' +
    `CM5 v${legacyPackageVersion} and CM6 v2\n${records}`;
  const parsed = parsedRecords(records);

  assert.equal(legacyRuntime.document(editor), 'AB', message);
  assert.equal(parsed.length, 1, message);
  assert.equal(parsed[0].o[0].o, 'i', message);
  assert.equal(parsed[0].l, undefined, message);
  assert.ok(rawTimeInterval[0] < rawTimeInterval[1], message);
  assert.deepEqual(parsed[0].t, rawTimeInterval, message);

  const intendedEnd = rawTimeInterval[1];
  if (legacyIsPreV1) {
    const modernTrace = await captureNaturalTrace(
        modernRuntime,
        'A',
        records,
        message,
    );
    assert.equal(modernTrace.at(-1).duration, intendedEnd, message);
    assert.equal(modernTrace.at(-1).document, 'AB', message);

    const legacyPlayback = await playPayloadWithLegacyPublicApi(
        'A',
        records,
        message,
    );
    assert.equal(legacyPlayback.editor.getValue(), 'AB', message);
    assert.deepEqual(
        legacyPlayback.operationTimes,
        [rawTimeInterval],
        `${message}: classified v0.3.1-v1.1.7 reader interval defect`,
    );
    return;
  }

  const traces = await verifySamePayloadAcrossPlayers({
    initialDocument: 'A',
    records,
    message,
  });
  assert.equal(traces.modernNatural.at(-1).duration, intendedEnd, message);
  assert.equal(traces.modernNatural.at(-1).document, 'AB', message);

  const modernSession = modernRuntime.createPlayer('A', records);
  assert.equal(modernSession.player.getDuration(), intendedEnd, message);
  await seekTo(modernSession, intendedEnd);
  assertDocument(modernSession, 'AB', message);
  assert.equal(modernSession.player.getCurrentTime(), intendedEnd, message);

  const legacySession = legacyRuntime.createPlayer('A', records);
  if (legacyRuntime.normalizesUngroupedIntervalTime) {
    assert.equal(legacySession.player.getDuration(), intendedEnd, message);
    await seekTo(legacySession, intendedEnd);
    assertDocument(legacySession, 'AB', message);
    assert.equal(legacySession.player.getCurrentTime(), intendedEnd, message);
  } else {
    assert.deepEqual(
        legacySession.player.getDuration(),
        rawTimeInterval,
        `${message}: classified immutable-v1 duration corruption`,
    );
    await playToEnd(legacySession, 1);
    assertDocument(legacySession, 'AB', message);
    assert.deepEqual(
        legacySession.player.lastOperationTime,
        rawTimeInterval,
        `${message}: classified immutable-v1 operation-time corruption`,
    );
  }

  if (legacyRuntime.normalizesUngroupedIntervalTime) {
    const maintainedCapture = captureRealLegacyTickingInput(
        LegacyCodeRecord,
        `maintained v${legacyPackageVersion}`,
    );
    const maintainedMessage =
      `real maintained CM5 v${legacyPackageVersion} scalar writer\n` +
      maintainedCapture.records;
    const maintainedRecords = parsedRecords(maintainedCapture.records);
    assert.equal(
        legacyRuntime.document(maintainedCapture.editor),
        'AB',
        maintainedMessage,
    );
    assert.equal(maintainedRecords.length, 1, maintainedMessage);
    assert.equal(maintainedRecords[0].l, undefined, maintainedMessage);
    assert.equal(
        maintainedRecords[0].t,
        maintainedCapture.rawTimeInterval[1],
        maintainedMessage,
    );
    await verifySamePayloadAcrossPlayers({
      initialDocument: 'A',
      records: maintainedCapture.records,
      message: maintainedMessage,
    });
  }
}

async function verifyScalarCompressedTimingClassification() {
  const records =
    '[{"t":10,"l":2,"o":[{"o":"i","i":[0,0],"a":"xy"}]}]';
  const message =
    'literal compressed scalar-t bytes -> ' +
    `CM5 v${legacyPackageVersion} and CM6 v2\n${records}`;

  const modernTrace = await captureNaturalTrace(
      modernRuntime,
      '',
      records,
      message,
  );
  assert.equal(modernTrace.at(-1).duration, 10, message);
  assert.equal(modernTrace.at(-1).document, 'xy', message);

  const legacyPlayback = await playPayloadWithLegacyPublicApi(
      '',
      records,
      message,
  );
  assert.equal(legacyPlayback.editor.getValue(), 'xy', message);
  if (legacyRuntime.reportsExpandedLogicalOperationTimes) {
    assert.deepEqual(legacyPlayback.operationTimes, [10, 10], message);
  } else {
    assert.equal(
        legacyPlayback.operationTimes.every((time) => !Number.isFinite(time)),
        true,
        `${message}: classified v0.3.1-v1.1.7 scalar-t reader defect`,
    );
  }
}

function label(direction, capability) {
  return `${direction.producer.name} -> ${direction.consumer.name}: ` +
    capability;
}

function assertDocument(session, expected, message) {
  assert.equal(
      session.runtime.document(session.editor),
      expected,
      message,
  );
}

async function playToEnd(session, expectedOperationCount) {
  if (typeof session.player.once === 'function') {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${session.runtime.name} playback did not end`));
      }, 2000);
      session.player.once('end', () => {
        clearTimeout(timeout);
        resolve();
      });
      session.player.play();
    });
  } else {
    // v1.0.x predates the EventEmitter API. Its wire reader and timeline
    // methods are still public, so use those seams to observe completion.
    session.player.play();
    if (expectedOperationCount === undefined) {
      await waitFor(
          () => session.player.getStatus() === 'PAUSE' &&
            session.player.getCurrentTime() >= session.player.getDuration(),
          `${session.runtime.name} playback did not reach its duration`,
      );
    } else {
      await waitFor(
          () => session.player.playedOperations.length ===
            expectedOperationCount,
          `${session.runtime.name} playback skipped logical operations`,
      );
    }
  }

  // Published v1 leaves its status at PLAY after emitting end. Pausing here
  // stabilizes getCurrentTime before exercising its public seek API.
  session.player.pause();
}

async function playPayloadWithLegacyPublicApi(
    initialDocument,
    records,
    message,
) {
  const editor = CodeMirror(createHost('legacy-public-player'), {
    value: initialDocument,
  });
  const player = new LegacyCodePlay(editor, {maxDelay: 1, speed: 1});
  const expectedOperationCount = logicalOperationTimes(records).length;
  const operationTimes = [];
  let resolvePlayback;
  const playbackComplete = new Promise((resolve) => {
    resolvePlayback = resolve;
  });
  const originalPlayChange = player.playChange;
  player.playChange = function(editor_, currentOperation) {
    const result = originalPlayChange.call(this, editor_, currentOperation);
    operationTimes.push(Array.isArray(currentOperation.t) ?
      [...currentOperation.t] : currentOperation.t);
    if (operationTimes.length === expectedOperationCount) {
      resolvePlayback();
    }
    return result;
  };

  if (typeof player.listen === 'function') {
    player.listen();
  }

  if (typeof player.addOperations === 'function') {
    player.addOperations(records);
    assert.equal(
        typeof player.play,
        'function',
        `${message}: addOperations requires the public play API`,
    );
    player.play();
  } else {
    assert.equal(
        typeof player.addOperation,
        'function',
        `${message}: v0.3-v0.4 player requires addOperation`,
    );
    player.addOperation(records);
  }

  await Promise.race([
    playbackComplete,
    new Promise((_, reject) => setTimeout(() => reject(new Error(
        `${message}: CM5 v${legacyPackageVersion} playback did not finish`,
    )), 2000)),
  ]);
  if (typeof player.pause === 'function') {
    player.pause();
  }
  assert.equal(
      operationTimes.length,
      expectedOperationCount,
      `${message}: legacy public player skipped logical operations`,
  );
  return {editor, operationTimes, player};
}

async function waitFor(predicate, failureMessage) {
  const timeoutAt = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() >= timeoutAt) {
      throw new Error(failureMessage);
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

async function seekTo(session, time) {
  session.player.seek(time);
  await waitFor(
      () => session.player.getStatus() === 'PAUSE' &&
        session.player.getCurrentTime() === time,
      `${session.runtime.name} did not settle at ${time}ms`,
  );
}

function logicalOperationTimes(records) {
  return parsedRecords(records).flatMap(expandedTimes);
}

function hasScalarCompressedTimeline(records) {
  return parsedRecords(records).some((record) =>
    record.l !== undefined && !Array.isArray(record.t),
  );
}

function hasHistoricalScalarTimingDefect(runtime, records) {
  return !runtime.reportsExpandedLogicalOperationTimes &&
    hasScalarCompressedTimeline(records);
}

function hasHistoricalScalarDurationDefect(runtime, records) {
  const terminalRecord = parsedRecords(records).at(-1);
  return !runtime.reportsExpandedLogicalOperationTimes &&
    terminalRecord?.l !== undefined &&
    !Array.isArray(terminalRecord.t);
}

function hasUngroupedIntervalTimeline(records) {
  return parsedRecords(records).some((record) =>
    record.l === undefined && Array.isArray(record.t),
  );
}

function hasHistoricalUngroupedIntervalDefect(runtime, records) {
  const terminalRecord = parsedRecords(records).at(-1);
  return !runtime.normalizesUngroupedIntervalTime &&
    terminalRecord?.l === undefined &&
    Array.isArray(terminalRecord.t);
}

function hasHistoricalSeekTimingDefect(runtime, records) {
  return hasHistoricalScalarTimingDefect(runtime, records) ||
    (!runtime.normalizesUngroupedIntervalTime &&
      hasUngroupedIntervalTimeline(records));
}

function hasHistoricalOperationTimeDefect(runtime, operation) {
  return (
    !runtime.reportsExpandedLogicalOperationTimes ||
    !runtime.normalizesUngroupedIntervalTime
  ) && !Number.isFinite(operation.t);
}

function snapshotSession(session, extras, time) {
  const documentValue = session.runtime.document(session.editor);
  return {
    time,
    duration: session.player.getDuration(),
    document: documentValue,
    utf16Length: documentValue.length,
    selection: cloneJson(session.runtime.selection(session.editor)),
    extras: cloneJson(extras),
  };
}

function createInstrumentedSession(runtime, initialDocument, records, message) {
  const extras = [];
  const session = runtime.createPlayer(
      initialDocument,
      cloneExactRecordBytes(records, `${message}: ${runtime.name}`),
      {
        extraActivityHandler(activity) {
          extras.push({kind: 'handle', activity: cloneJson(activity)});
        },
        extraActivityReverter(activity) {
          extras.push({kind: 'revert', activity: cloneJson(activity)});
        },
      },
  );
  const originalPlayChange = session.player.playChange;
  const allLogicalTimes = logicalOperationTimes(records);
  let activeTrace = null;
  let activeLogicalTimes = [];

  session.player.playChange = function(editor, currentOperation) {
    const result = originalPlayChange.call(this, editor, currentOperation);
    if (activeTrace !== null) {
      const logicalTime = activeLogicalTimes.shift();
      assert.notEqual(
          logicalTime,
          undefined,
          `${message}: ${runtime.name} emitted an extra logical operation`,
      );
      if (!hasHistoricalOperationTimeDefect(runtime, currentOperation)) {
        assert.equal(
            currentOperation.t,
            logicalTime,
            `${message}: ${runtime.name} expanded logical operation time`,
        );
        assert.equal(
            this.lastOperationTime,
            logicalTime,
            `${message}: ${runtime.name} public logical operation time`,
        );
      }
      activeTrace.push(snapshotSession(
          session,
          extras,
          logicalTime,
      ));
    }
    return result;
  };

  return {
    extras,
    session,
    traceInto(trace, times = allLogicalTimes) {
      activeTrace = trace;
      activeLogicalTimes = [...times];
    },
    stopTracing() {
      assert.equal(
          activeLogicalTimes.length,
          0,
          `${message}: ${runtime.name} skipped logical operations`,
      );
      activeTrace = null;
      activeLogicalTimes = [];
    },
  };
}

function assertNaturalTraceShape(trace, records, runtime, message) {
  const times = logicalOperationTimes(records);
  assert.deepEqual(
      trace.map((snapshot) => snapshot.time),
      [0, ...times],
      `${message}: ${runtime.name} natural logical-operation timeline`,
  );
  const duration = times.at(-1) ?? 0;
  for (const snapshot of trace) {
    if (hasHistoricalScalarDurationDefect(runtime, records)) {
      assert.equal(
          snapshot.duration,
          undefined,
          `${message}: classified historical scalar-t duration defect`,
      );
    } else if (hasHistoricalUngroupedIntervalDefect(runtime, records)) {
      assert.deepEqual(
          snapshot.duration,
          parsedRecords(records).at(-1).t,
          `${message}: classified historical ungrouped-interval duration defect`,
      );
    } else {
      assert.equal(
          snapshot.duration,
          duration,
          `${message}: ${runtime.name} duration at ${snapshot.time}ms`,
      );
    }
    assert.equal(
        snapshot.utf16Length,
        snapshot.document.length,
        `${message}: ${runtime.name} UTF-16 length at ${snapshot.time}ms`,
    );
  }
}

async function captureNaturalTrace(runtime, initialDocument, records, message) {
  const instrumented = createInstrumentedSession(
      runtime,
      initialDocument,
      records,
      `${message}: natural playback`,
  );
  const trace = [snapshotSession(
    instrumented.session,
    instrumented.extras,
    0,
  )];
  instrumented.traceInto(trace);
  await playToEnd(
      instrumented.session,
      logicalOperationTimes(records).length,
  );
  instrumented.stopTracing();
  assertNaturalTraceShape(trace, records, runtime, message);
  return trace;
}

function semanticState(snapshot) {
  return {
    document: snapshot.document,
    utf16Length: snapshot.utf16Length,
    selection: cloneJson(snapshot.selection),
  };
}

function semanticStateAt(trace, time) {
  let matchingSnapshot = trace[0];
  for (const snapshot of trace) {
    if (snapshot.time > time) {
      break;
    }
    matchingSnapshot = snapshot;
  }
  return semanticState(matchingSnapshot);
}

function assertSemanticStatesAtBoundaries(trace, naturalTrace, message) {
  for (const snapshot of trace) {
    assert.deepEqual(
        semanticState(snapshot),
        semanticStateAt(naturalTrace, snapshot.time),
        `${message}: semantic state at ${snapshot.time}ms`,
    );
  }
}

function assertNaturalReplayStates(
    trace,
    naturalTrace,
    minimumTime,
    message,
) {
  const expectedStates = [
    semanticStateAt(naturalTrace, minimumTime),
    ...naturalTrace.slice(1)
        .filter((snapshot) => snapshot.time > minimumTime)
        .map(semanticState),
  ];
  assert.deepEqual(
      trace.map(semanticState),
      expectedStates,
      message,
  );
}

function supportsStrictReverseState(runtime) {
  return runtime.supportsSeekToStart &&
    runtime.restoresDocumentAtExactReverseBoundary &&
    runtime.restoresSelectionsWhileReversing;
}

function projectSeekSnapshot(snapshot, capabilities) {
  const projected = {
    time: snapshot.time,
    duration: snapshot.duration,
    extras: cloneJson(snapshot.extras),
  };
  if (capabilities.restoresDocumentAtExactReverseBoundary) {
    projected.document = snapshot.document;
    projected.utf16Length = snapshot.utf16Length;
  }
  if (capabilities.restoresSelectionsWhileReversing) {
    projected.selection = cloneJson(snapshot.selection);
  }
  return projected;
}

function projectSeekTrace(trace, capabilities) {
  return trace.map((snapshot) =>
    projectSeekSnapshot(snapshot, capabilities),
  );
}

async function captureReverseForwardTrace(
    runtime,
    initialDocument,
    records,
    minimumTime,
    message,
) {
  const instrumented = createInstrumentedSession(
      runtime,
      initialDocument,
      records,
      `${message}: reverse-forward playback`,
  );
  await playToEnd(instrumented.session);

  const boundaryTimes = [
    0,
    ...new Set(logicalOperationTimes(records)),
  ].filter((time) => time >= minimumTime);
  const reverseTargets = boundaryTimes.toReversed();
  const reverse = [snapshotSession(
    instrumented.session,
    instrumented.extras,
    reverseTargets[0],
  )];
  for (const time of reverseTargets.slice(1)) {
    await seekTo(instrumented.session, time);
    reverse.push(snapshotSession(
        instrumented.session,
        instrumented.extras,
        time,
    ));
  }

  const forwardAgain = [snapshotSession(
    instrumented.session,
    instrumented.extras,
    minimumTime,
  )];
  const expectedReplayTimes = logicalOperationTimes(records).filter(
      (time) => time > minimumTime,
  );
  instrumented.traceInto(forwardAgain, expectedReplayTimes);
  await playToEnd(instrumented.session);
  instrumented.stopTracing();
  assert.deepEqual(
      forwardAgain.map((snapshot) => snapshot.time),
      [minimumTime, ...expectedReplayTimes],
      `${message}: ${runtime.name} natural forward-after-reverse timeline`,
  );
  return {forwardAgain, reverse};
}

async function verifySamePayloadAcrossPlayers({
  initialDocument,
  records,
  message,
}) {
  const immutableBytes = cloneExactRecordBytes(records, message);
  const legacyNatural = await captureNaturalTrace(
      legacyRuntime,
      initialDocument,
      immutableBytes,
      message,
  );
  const modernNatural = await captureNaturalTrace(
      modernRuntime,
      initialDocument,
      immutableBytes,
      message,
  );

  // Every producer payload is handed, byte-for-byte, to both real players.
  // The hook observes natural continuous playback after each expanded logical
  // wire operation, including equal-time and compressed groups.
  const historicalDurationDefect =
    hasHistoricalScalarDurationDefect(legacyRuntime, records) ||
    hasHistoricalUngroupedIntervalDefect(legacyRuntime, records);
  if (historicalDurationDefect) {
    assert.deepEqual(
        legacyNatural.map((snapshot) => {
          const projected = {...snapshot};
          delete projected.duration;
          return projected;
        }),
        modernNatural.map((snapshot) => {
          const projected = {...snapshot};
          delete projected.duration;
          return projected;
        }),
        `${message}: historical timing trace outside the classified defect`,
    );
  } else {
    assert.deepEqual(
        legacyNatural,
        modernNatural,
        `${message}: CM5 and CM6 natural playback traces diverged`,
    );
  }
  assert.equal(
      records,
      immutableBytes,
      `${message}: playback mutated the producer payload bytes`,
  );

  const logicalTimes = logicalOperationTimes(records);
  const earliestPositiveTime = logicalTimes.find((time) => time > 0) ?? 0;
  const minimumTime = legacyRuntime.supportsSeekToStart ?
    0 : earliestPositiveTime;
  const modernSeekTrace = await captureReverseForwardTrace(
      modernRuntime,
      initialDocument,
      immutableBytes,
      minimumTime,
      message,
  );

  assertSemanticStatesAtBoundaries(
      modernSeekTrace.reverse,
      modernNatural,
      `${message}: CM6 reverse`,
  );
  assertNaturalReplayStates(
      modernSeekTrace.forwardAgain,
      modernNatural,
      minimumTime,
      `${message}: CM6 forward after reverse`,
  );
  if (hasHistoricalSeekTimingDefect(legacyRuntime, records)) {
    // Immutable v1 players cannot seek their scalar-compressed or ungrouped
    // interval wire defects because their public duration and extracted
    // operation times are invalid. The payload still runs above in the exact
    // logical order and is strict in the fixed CM5 maintenance baseline. Do
    // not broaden this exception to any other payload shape or runtime.
    return {legacyNatural, modernNatural};
  }

  const legacySeekTrace = await captureReverseForwardTrace(
      legacyRuntime,
      initialDocument,
      immutableBytes,
      minimumTime,
      message,
  );

  if (supportsStrictReverseState(legacyRuntime)) {
    // The maintained CM5 baseline must restore the complete UTF-16 document
    // and every
    // ordered/directed selection (including mainIndex) for every fixture row.
    assert.deepEqual(
        legacySeekTrace,
        modernSeekTrace,
        `${message}: maintained CM5 and CM6 reverse-forward traces diverged`,
    );
    assertSemanticStatesAtBoundaries(
        legacySeekTrace.reverse,
        legacyNatural,
        `${message}: maintained CM5 reverse`,
    );
    assertNaturalReplayStates(
        legacySeekTrace.forwardAgain,
        legacyNatural,
        minimumTime,
        `${message}: maintained CM5 forward after reverse`,
    );
  } else {
    // Immutable v1.0.0-v1.1.6 has three narrowly classified seek defects:
    // seek(0) leaks a sentinel, exact reverse boundaries may keep one content
    // operation, and reverse does not restore selections. Time, duration,
    // external-activity order/count, and every fresh natural playback state
    // remain strict. v1.1.7 takes the complete-state branch above.
    assert.deepEqual(
        projectSeekTrace(legacySeekTrace.reverse, legacyRuntime),
        projectSeekTrace(modernSeekTrace.reverse, legacyRuntime),
        `${message}: historical reverse trace exceeded classified defects`,
    );
    assert.deepEqual(
        projectSeekTrace(legacySeekTrace.forwardAgain, legacyRuntime),
        projectSeekTrace(modernSeekTrace.forwardAgain, legacyRuntime),
        `${message}: historical replay trace exceeded classified defects`,
    );
  }

  return {legacyNatural, modernNatural};
}

async function verifyCompressedInput(direction) {
  const {records} = direction.producer.capture('', ({at, editor, runtime}) => {
    for (const [time, insert, from] of [
      [10, 'a', 0],
      [20, 'b', 1],
      [30, 'c', 2],
      [1300, 'Z', 3],
    ]) {
      at(time, () => runtime.edit(editor, {
        from,
        insert,
        origin: '+input',
      }));
    }
  });
  const inputRecords = recordsForOrigin(records, 'i');
  const message =
    `${label(direction, 'compressed input and timing boundary')}\n${records}`;

  // The writer may choose a different valid compression boundary. Compare the
  // expanded timeline and playback semantics rather than requiring v1's exact
  // byte grouping.
  assert.deepEqual(
      inputRecords.flatMap(expandedTimes),
      [10, 20, 30, 1300],
      message,
  );
  assert.equal(inputRecords.some((record) => record.l > 1), true, message);
  assert.equal(inputRecords.at(-1).t, 1300, message);
  assert.equal(inputRecords.at(-1).l, undefined, message);
  assert.equal(inputRecords.at(-1).o[0].a, 'Z', message);
  await verifySamePayloadAcrossPlayers({
    initialDocument: '',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('', records);
  assert.equal(session.player.getDuration(), 1300, message);
  await seekTo(session, 25);
  assertDocument(session, 'ab', message);
  await seekTo(session, 1300);
  assertDocument(session, 'abcZ', message);
  await seekTo(session, 25);
  assertDocument(session, 'ab', message);
  await seekTo(session, 30);
  assertDocument(session, 'abc', message);
}

async function verifyCompressedDeletion(direction) {
  const {records} = direction.producer.capture(
      'abcdef',
      ({at, editor, runtime}) => {
        at(10, () => runtime.edit(editor, {
          from: 4,
          to: 5,
          insert: '',
          origin: '+delete',
        }));
        at(20, () => runtime.edit(editor, {
          from: 3,
          to: 4,
          insert: '',
          origin: '+delete',
        }));
      },
  );
  const deletionRecords = recordsForOrigin(records, 'd');
  const message = label(direction, 'compressed deletion');

  assert.equal(deletionRecords.length, 1, message);
  assert.deepEqual(deletionRecords[0].t, [10, 20], message);
  assert.equal(deletionRecords[0].l, 2, message);
  assert.deepEqual(deletionRecords[0].o[0].d, [[1, 2]], message);
  await verifySamePayloadAcrossPlayers({
    initialDocument: 'abcdef',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('abcdef', records);
  await playToEnd(session);
  assertDocument(session, 'abcf', message);
}

async function verifyVariableWidthMultilineDeletion(direction) {
  const initialDocument = 'abXYZ\nqrsTAIL';
  const {records} = direction.producer.capture(
      initialDocument,
      ({at, editor, runtime}) => {
        for (const [time, from, to] of [
          [10, 5, 6],
          [20, 2, 5],
          [30, 0, 2],
        ]) {
          at(time, () => runtime.edit(editor, {
            from,
            to,
            insert: '',
            origin: '+delete',
          }));
        }
      },
  );
  const deletionRecords = recordsForOrigin(records, 'd');
  const message =
    `${label(direction, 'variable-width multiline deletion')}\n${records}`;

  assert.deepEqual(
      deletionRecords.flatMap(expandedTimes),
      [10, 20, 30],
      message,
  );
  assert.equal(
      deletionRecords.some((record) => (record.l ?? 1) > 1),
      true,
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument,
    records,
    message,
  });

  const session = direction.consumer.createPlayer(initialDocument, records);
  assert.equal(session.player.getDuration(), 30, message);
  await seekTo(session, 15);
  assertDocument(session, 'abXYZqrsTAIL', message);
  await seekTo(session, 25);
  assertDocument(session, 'abqrsTAIL', message);
  await seekTo(session, 30);
  assertDocument(session, 'qrsTAIL', message);
  await seekTo(session, 15);
  assertDocument(session, 'abXYZqrsTAIL', message);
}

async function verifyEqualTimeDeletion(direction) {
  const {records} = direction.producer.capture(
      'abcdef',
      ({at, editor, runtime}) => {
        for (const [from, to] of [[4, 5], [3, 4], [2, 3]]) {
          at(10, () => runtime.edit(editor, {
            from,
            to,
            insert: '',
            origin: '+delete',
          }));
        }
      },
  );
  const deletionRecords = recordsForOrigin(records, 'd');
  const message =
    `${label(direction, 'equal-time deletion timeline')}\n${records}`;

  assert.deepEqual(
      deletionRecords.flatMap(expandedTimes),
      [10, 10, 10],
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument: 'abcdef',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('abcdef', records);
  assert.equal(session.player.getDuration(), 10, message);
  await playToEnd(session);
  assertDocument(session, 'abf', message);
}

async function verifyCompressedComposition(direction) {
  const {records} = direction.producer.capture('', ({at, editor, runtime}) => {
    at(10, () => runtime.edit(editor, {
      from: 0,
      insert: '你',
      origin: '*compose',
    }));
    at(20, () => runtime.edit(editor, {
      from: 1,
      insert: '好',
      origin: '*compose',
    }));
  });
  const compositionRecords = recordsForOrigin(records, 'c');
  const message = label(direction, 'compressed IME composition');

  assert.equal(compositionRecords.length, 1, message);
  assert.deepEqual(compositionRecords[0].t, [10, 20], message);
  assert.equal(compositionRecords[0].l, 2, message);
  assert.deepEqual(compositionRecords[0].o[0].a, ['你', '好'], message);
  await verifySamePayloadAcrossPlayers({
    initialDocument: '',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('', records);
  await playToEnd(session);
  assertDocument(session, '你好', message);
}

async function verifyEqualTimeComposition(direction) {
  const {records} = direction.producer.capture('', ({at, editor, runtime}) => {
    at(10, () => runtime.edit(editor, {
      from: 0,
      insert: '你',
      origin: '*compose',
    }));
    at(10, () => runtime.edit(editor, {
      from: 1,
      insert: '好',
      origin: '*compose',
    }));
  });
  const compositionRecords = recordsForOrigin(records, 'c');
  const message =
    `${label(direction, 'equal-time IME composition timeline')}\n${records}`;

  assert.deepEqual(
      compositionRecords.flatMap(expandedTimes),
      [10, 10],
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument: '',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('', records);
  assert.equal(session.player.getDuration(), 10, message);
  await playToEnd(session);
  assertDocument(session, '你好', message);
}

const changeOriginCases = [
  {
    name: 'paste replacement',
    origin: 'paste',
    wireOrigin: 'p',
    initialDocument: 'hello',
    change: {from: 1, to: 4, insert: 'A\nB'},
    expectedDocument: 'hA\nBo',
  },
  {
    name: 'drag/drop insertion',
    origin: 'drag',
    wireOrigin: 'r',
    initialDocument: 'ab',
    change: {from: 1, insert: '📦'},
    expectedDocument: 'a📦b',
  },
  {
    name: 'cut deletion',
    origin: 'cut',
    wireOrigin: 'x',
    initialDocument: 'hello',
    change: {from: 1, to: 4, insert: ''},
    expectedDocument: 'ho',
  },
  {
    name: 'full-document setValue',
    origin: 'setValue',
    wireOrigin: 's',
    initialDocument: 'old',
    change: {from: 0, to: 3, insert: 'new\nvalue'},
    expectedDocument: 'new\nvalue',
  },
];

async function verifyChangeOrigins(direction) {
  for (const testCase of changeOriginCases) {
    const {records} = direction.producer.capture(
        testCase.initialDocument,
        ({at, editor, runtime}) => {
          at(12, () => runtime.edit(editor, {
            ...testCase.change,
            origin: testCase.origin,
          }));
        },
    );
    const message = label(direction, testCase.name);
    const matchingRecords = recordsForOrigin(records, testCase.wireOrigin);
    assert.equal(matchingRecords.length, 1, message);
    assert.equal(matchingRecords[0].t, 12, message);
    await verifySamePayloadAcrossPlayers({
      initialDocument: testCase.initialDocument,
      records,
      message,
    });

    const session = direction.consumer.createPlayer(
        testCase.initialDocument,
        records,
    );
    await playToEnd(session);
    assertDocument(session, testCase.expectedDocument, message);
  }
}

async function verifyModernChangeOnlySelection() {
  const initialDocument = 'abcd';
  const {editor, records} = modernRuntime.capture(
      initialDocument,
      ({at, editor, runtime}) => {
        at(10, () => runtime.edit(editor, {
          from: 3,
          insert: 'X',
          origin: '+input',
          preserveSelection: true,
        }));
      },
  );
  const message =
    'CM6 change-only transaction preserves its mapped selection in both players';
  const expectedSelection = {ranges: [[0, 0]], mainIndex: 0};

  assert.equal(modernRuntime.document(editor), 'abcXd', message);
  assert.deepEqual(modernRuntime.selection(editor), expectedSelection, message);
  assert.equal(
      parsedRecords(records).some((record) =>
        record.o.some((operation) => operation.o === 'o'),
      ),
      true,
      `${message}: v2 writer omitted the required cursor record`,
  );

  const traces = await verifySamePayloadAcrossPlayers({
    initialDocument,
    records,
    message,
  });
  for (const [runtimeName, trace] of [
    ['CM5', traces.legacyNatural],
    ['CM6', traces.modernNatural],
  ]) {
    assert.equal(trace.at(-1).document, 'abcXd', `${message}: ${runtimeName}`);
    assert.deepEqual(
        trace.at(-1).selection,
        expectedSelection,
        `${message}: ${runtimeName}`,
    );
  }
}

async function verifyMultipleChangesStayInOneOperation(direction) {
  const initialDocument = 'aa\nbb\ncc';
  const {editor, records} = direction.producer.capture(
      initialDocument,
      ({at, editor, runtime}) => {
        at(10, () => runtime.recordMultipleChanges(editor));
      },
  );
  const expectedSelection = direction.producer.selection(editor);
  const contentRecord = parsedRecords(records).find((record) =>
    record.o.length === 2 && record.o.every((operation) =>
      operation.o === 'i',
    ),
  );
  const message = label(direction, 'multi-change operation boundary');

  assert.ok(contentRecord, message);
  assert.equal(contentRecord.t, 10, message);
  await verifySamePayloadAcrossPlayers({
    initialDocument,
    records,
    message,
  });

  const session = direction.consumer.createPlayer(initialDocument, records);
  await playToEnd(session);
  assertDocument(session, 'aXa\nbb\ncYc', message);
  if (direction.producer === modernRuntime) {
    assert.deepEqual(
        session.runtime.selection(session.editor),
        expectedSelection,
        `${message}: v2 producer selection`,
    );
  }
}

async function verifyMixedOriginOperation(direction) {
  const initialDocument = 'abc\ndef';
  const {records} = direction.producer.capture(
      initialDocument,
      ({at, editor, runtime}) => {
        at(10, () => runtime.recordMixedOriginChanges(editor));
      },
  );
  const parsed = parsedRecords(records);
  const mixedRecord = parsed.find((record) => {
    const origins = new Set(record.o.map((operation) => operation.o));
    return origins.has('i') && origins.has('d');
  });
  const message =
    `${label(direction, 'mixed-origin operation boundary')}\n${records}`;

  assert.ok(mixedRecord, message);
  assert.equal(mixedRecord.t, 10, message);
  assert.equal(mixedRecord.o.length, 2, message);
  await verifySamePayloadAcrossPlayers({
    initialDocument,
    records,
    message,
  });

  const session = direction.consumer.createPlayer(initialDocument, records);
  assert.equal(session.player.getDuration(), 10, message);
  await playToEnd(session);
  assertDocument(session, 'ac\ndeXf', message);
  if (direction.consumer.supportsSeekToStart) {
    await seekTo(session, 0);
    assertDocument(session, initialDocument, message);
    await seekTo(session, 10);
    assertDocument(session, 'ac\ndeXf', message);
  } else {
    // Immutable v1.0.0-v1.1.6 players leak their zero-seek sentinel. That is
    // a historical runtime bug, not a wire incompatibility. Restart through
    // the public constructor and still verify forward playback of these bytes.
    const restarted = direction.consumer.createPlayer(
        initialDocument,
        records,
    );
    await seekTo(restarted, 10);
    assertDocument(restarted, 'ac\ndeXf', message);
  }
}

async function verifyCompressedMultiCursorInput(direction) {
  const initialDocument = 'aa\nbb\ncc';
  const {records} = direction.producer.capture(
      initialDocument,
      ({at, editor, runtime}) => {
        for (const [time, positions, insert] of [
          [10, [1, 7], 'X'],
          [20, [2, 9], 'Y'],
          [30, [3, 11], 'Z'],
        ]) {
          at(time, () => runtime.recordMultiCursorInput(
              editor,
              positions,
              insert,
          ));
        }
      },
  );
  const inputRecords = recordsForOrigin(records, 'i');
  const message =
    `${label(direction, 'compressed multi-cursor input')}\n${records}`;

  assert.deepEqual(
      inputRecords.flatMap(expandedTimes),
      [10, 20, 30],
      message,
  );
  assert.equal(
      inputRecords.some((record) =>
        (record.l ?? 1) > 1 && record.o.length === 2,
      ),
      true,
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument,
    records,
    message,
  });

  const session = direction.consumer.createPlayer(initialDocument, records);
  await seekTo(session, 15);
  assertDocument(session, 'aXa\nbb\ncXc', message);
  await seekTo(session, 25);
  assertDocument(session, 'aXYa\nbb\ncXYc', message);
  await seekTo(session, 30);
  assertDocument(session, 'aXYZa\nbb\ncXYZc', message);
  await seekTo(session, 15);
  assertDocument(session, 'aXa\nbb\ncXc', message);
}

async function verifyCompressedMultiCursorDeletion(direction) {
  const initialDocument = 'abcd\nefgh\nijkl';
  const {records} = direction.producer.capture(
      initialDocument,
      ({at, editor, runtime}) => {
        for (const [time, ranges] of [
          [10, [{from: 2, to: 3}, {from: 11, to: 12}]],
          [20, [{from: 1, to: 2}, {from: 9, to: 10}]],
          [30, [{from: 0, to: 1}, {from: 7, to: 8}]],
        ]) {
          at(time, () => runtime.recordMultiCursorDeletion(editor, ranges));
        }
      },
  );
  const deletionRecords = recordsForOrigin(records, 'd');
  const message =
    `${label(direction, 'compressed multi-cursor deletion')}\n${records}`;

  assert.deepEqual(
      deletionRecords.flatMap(expandedTimes),
      [10, 20, 30],
      message,
  );
  assert.equal(
      deletionRecords.some((record) =>
        (record.l ?? 1) > 1 && record.o.length === 2,
      ),
      true,
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument,
    records,
    message,
  });

  const session = direction.consumer.createPlayer(initialDocument, records);
  await seekTo(session, 15);
  assertDocument(session, 'abd\nefgh\nikl', message);
  await seekTo(session, 25);
  assertDocument(session, 'ad\nefgh\nkl', message);
  await seekTo(session, 30);
  assertDocument(session, 'd\nefghkl', message);
  await seekTo(session, 15);
  assertDocument(session, 'abd\nefgh\nikl', message);
}

async function verifyCompressedCursor(direction) {
  const {records} = direction.producer.capture(
      'abcdef',
      ({at, editor, runtime}) => {
        for (const [time, position] of [[10, 1], [20, 2], [30, 3]]) {
          at(time, () => runtime.setSelections(
              editor,
              [offsetRange(position)],
              0,
          ));
        }
      },
  );
  const cursorRecords = recordsForOrigin(records, 'o');
  const message = `${label(direction, 'compressed cursor movement')}\n${
    records}`;

  assert.deepEqual(
      cursorRecords.flatMap(expandedTimes),
      [10, 20, 30],
      message,
  );
  assert.equal(
      cursorRecords.some((record) => (record.l ?? 1) > 1),
      true,
      message,
  );
  assert.deepEqual(
      cursorRecords.at(-1).o[0].i.at(-1),
      [0, 3],
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument: 'abcdef',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('abcdef', records);
  await playToEnd(session);
  assert.deepEqual(session.runtime.selection(session.editor), {
    ranges: [[3, 3]],
    mainIndex: 0,
  }, message);
}

async function verifyEqualTimeCursor(direction) {
  const {records} = direction.producer.capture(
      'abcdef',
      ({at, editor, runtime}) => {
        for (const position of [1, 2, 3]) {
          at(10, () => runtime.setSelections(
              editor,
              [offsetRange(position)],
              0,
          ));
        }
      },
  );
  const cursorRecords = recordsForOrigin(records, 'o');
  const message =
    `${label(direction, 'equal-time cursor timeline')}\n${records}`;

  assert.deepEqual(
      cursorRecords.flatMap(expandedTimes),
      [10, 10, 10],
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument: 'abcdef',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('abcdef', records);
  assert.equal(session.player.getDuration(), 10, message);
  await playToEnd(session);
  assert.deepEqual(session.runtime.selection(session.editor), {
    ranges: [[3, 3]],
    mainIndex: 0,
  }, message);
}

async function verifyCompressedSelection(direction) {
  const {records} = direction.producer.capture(
      'abcdef',
      ({at, editor, runtime}) => {
        for (const [time, head] of [[10, 2], [20, 3], [30, 4]]) {
          at(time, () => runtime.setSelections(
              editor,
              [offsetRange(1, head)],
              0,
          ));
        }
      },
  );
  const selectionRecords = recordsForOrigin(records, 'l');
  const message = label(direction, 'compressed selection expansion');

  assert.equal(selectionRecords.length, 1, message);
  assert.deepEqual(selectionRecords[0].t, [10, 30], message);
  assert.equal(selectionRecords[0].l, 3, message);
  assert.deepEqual(selectionRecords[0].o[0].s, [
    [0, [[2, 4]]],
  ], message);
  await verifySamePayloadAcrossPlayers({
    initialDocument: 'abcdef',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('abcdef', records);
  await playToEnd(session);
  assert.deepEqual(session.runtime.selection(session.editor), {
    ranges: [[1, 4]],
    mainIndex: 0,
  }, message);
}

async function verifyEqualTimeSelection(direction) {
  const {records} = direction.producer.capture(
      'abcdef',
      ({at, editor, runtime}) => {
        for (const head of [2, 3, 4]) {
          at(10, () => runtime.setSelections(
              editor,
              [offsetRange(1, head)],
              0,
          ));
        }
      },
  );
  const message =
    `${label(direction, 'equal-time selection timeline')}\n${records}`;

  // Writers may avoid the v1-invalid scalar compressed shape altogether.
  const cursorAndSelectionRecords = parsedRecords(records).filter((record) =>
    record.o[0].o === 'l' || record.o[0].o === 'o',
  );
  assert.deepEqual(
      cursorAndSelectionRecords.flatMap(expandedTimes),
      [10, 10, 10],
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument: 'abcdef',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('abcdef', records);
  assert.equal(session.player.getDuration(), 10, message);
  await playToEnd(session);
  assert.deepEqual(session.runtime.selection(session.editor), {
    ranges: [[1, 4]],
    mainIndex: 0,
  }, message);
}

async function verifyDirectedMultipleSelections(direction) {
  const ranges = [offsetRange(1, 3), offsetRange(8, 6)];
  const expectedRanges = ranges.map((range) => [range.anchor, range.head]);
  const mainIndex = direction.producer === legacyRuntime ? 1 : 0;
  const {editor, records} = direction.producer.capture(
      'abcd\nefgh',
      ({at, editor: recordedEditor, runtime}) => {
        at(26, () => runtime.setSelections(
            recordedEditor,
            ranges,
            mainIndex,
        ));
      },
      {allowMultipleSelections: true},
  );
  const message = label(
      direction,
      'directed multiple selections and supported main range',
  );

  assert.deepEqual(direction.producer.selection(editor), {
    ranges: expectedRanges,
    mainIndex,
  }, message);
  const wireRecords = recordsForOrigin(records, 'o');
  assert.equal(wireRecords.length, 1, message);
  assert.equal(wireRecords[0].o.length, 2, message);
  await verifySamePayloadAcrossPlayers({
    initialDocument: 'abcd\nefgh',
    records,
    message,
  });

  const session = direction.consumer.createPlayer('abcd\nefgh', records);
  await playToEnd(session);
  assert.deepEqual(session.runtime.selection(session.editor), {
    ranges: expectedRanges,
    mainIndex,
  }, message);
}

function captureSeekTimeline(runtime) {
  return runtime.capture('seed', ({at, editor, recorder}) => {
    at(10, () => runtime.edit(editor, {
      from: 0,
      insert: 'A',
      origin: '+input',
    }));
    // v1's paste-preservation rule expects the pre-paste selection to be the
    // immediately preceding record, as it is during an interactive paste.
    at(19, () => runtime.setSelections(
        editor,
        [offsetRange(5)],
        0,
    ));
    at(20, () => runtime.edit(editor, {
      from: 5,
      insert: 'B',
      origin: 'paste',
    }));
    at(30, () => recorder.recordExtraActivity({
      kind: 'phase',
      value: 'inserted',
    }));
    at(40, () => runtime.edit(editor, {
      from: 0,
      to: 1,
      insert: '',
      origin: 'cut',
    }));
    at(50, () => recorder.recordExtraActivity({
      kind: 'phase',
      value: 'done',
    }));
    at(60, () => runtime.setSelections(
        editor,
        [offsetRange(5, 0)],
        0,
    ));
  });
}

async function verifyExtrasAndSeeking(direction) {
  const {editor: recordedEditor, records} =
    captureSeekTimeline(direction.producer);
  const extras = recordsForOrigin(records, 'e');
  const message = `${label(direction, 'extras and observable seek state')}\n` +
    records;
  assert.equal(
      direction.producer.document(recordedEditor),
      'seedB',
      message,
  );
  const cuts = recordsForOrigin(records, 'x');
  assert.equal(cuts.length, 1, message);
  assert.deepEqual(cuts[0].o[0].i, [[0, 0], [0, 1]], message);
  assert.deepEqual(extras.map((record) => ({
    time: record.t,
    activity: record.o[0].activity,
  })), [
    {time: 30, activity: {kind: 'phase', value: 'inserted'}},
    {time: 50, activity: {kind: 'phase', value: 'done'}},
  ], message);
  await verifySamePayloadAcrossPlayers({
    initialDocument: 'seed',
    records,
    message,
  });

  const handled = [];
  const reverted = [];
  const session = direction.consumer.createPlayer('seed', records, {
    extraActivityHandler(activity) {
      handled.push(activity);
    },
    extraActivityReverter(activity) {
      reverted.push(activity);
    },
  });

  assert.equal(session.player.getDuration(), 60, message);
  await playToEnd(session);
  assertDocument(session, 'seedB', message);
  assert.deepEqual(session.runtime.selection(session.editor), {
    ranges: [[5, 0]],
    mainIndex: 0,
  }, message);
  assert.deepEqual(handled.map((activity) => activity.value), [
    'inserted',
    'done',
  ], message);

  await seekTo(session, 45);
  assertDocument(session, 'seedB', message);
  assert.deepEqual(reverted.map((activity) => activity.value), ['done']);

  await seekTo(session, 25);
  assertDocument(session, 'AseedB', message);
  assert.deepEqual(reverted.map((activity) => activity.value), [
    'done',
    'inserted',
  ], message);

  await seekTo(session, 15);
  assertDocument(session, 'Aseed', message);

  await seekTo(session, 45);
  assertDocument(session, 'seedB', message);
  assert.deepEqual(handled.map((activity) => activity.value), [
    'inserted',
    'done',
    'inserted',
  ], message);

  await seekTo(session, 60);
  assertDocument(session, 'seedB', message);
  assert.deepEqual(session.runtime.selection(session.editor), {
    ranges: [[5, 0]],
    mainIndex: 0,
  }, message);
  assert.deepEqual(handled.map((activity) => activity.value), [
    'inserted',
    'done',
    'inserted',
    'done',
  ], message);
}

async function verifyExtraPayloadTypes(direction) {
  const payloads = [
    null,
    false,
    0,
    'text',
    ['array', 1],
    {nested: {ok: true}},
  ];
  const {records} = direction.producer.capture(
      '',
      ({at, recorder}) => {
        payloads.forEach((payload, index) => {
          at((index + 1) * 5, () => recorder.recordExtraActivity(payload));
        });
      },
  );
  const message = label(direction, 'JSON-serializable extra payload types');
  assert.deepEqual(
      recordsForOrigin(records, 'e').map((record) => record.o[0].activity),
      payloads,
      message,
  );
  await verifySamePayloadAcrossPlayers({
    initialDocument: '',
    records,
    message,
  });

  const handled = [];
  const session = direction.consumer.createPlayer('', records, {
    extraActivityHandler(activity) {
      handled.push(activity);
    },
  });
  await playToEnd(session);
  assert.deepEqual(handled, payloads, message);
}

// This scenario is deliberately specified in UTF-16 offsets. The emoji takes
// two code units, so a player that accidentally treats wire columns as Unicode
// code points diverges at the first content boundary instead of merely ending
// with a plausibly similar document.
const differentialInitialDocument = 'A😀B\nCé\n尾Z';
const differentialTimes = [10, 20, 25, 30, 40, 50, 60, 70, 80];
const differentialDuration = 80;
const differentialActivityOne = {id: 'one', nested: ['α', 1]};
const differentialActivityTwo = {id: 'two', nested: ['β', 2]};

const differentialSemanticStates = new Map([
  [0, {
    document: 'A😀B\nCé\n尾Z',
    selection: {ranges: [[0, 0]], mainIndex: 0},
  }],
  [10, {
    document: 'A😀B\nCé\n尾Z',
    selection: {ranges: [[3, 1]], mainIndex: 0},
  }],
  [20, {
    document: 'A😀λB\nCé\n尾Z',
    selection: {ranges: [[4, 4]], mainIndex: 0},
  }],
  [25, {
    document: 'A😀λβB\nCé\n尾Z',
    selection: {ranges: [[5, 5]], mainIndex: 0},
  }],
  [30, {
    document: 'A😀λβγB\nCé\n尾Z',
    selection: {ranges: [[6, 6]], mainIndex: 0},
  }],
  [40, {
    document: 'A😀λβγB\nCé\n尾Z',
    selection: {ranges: [[6, 6]], mainIndex: 0},
  }],
  [50, {
    document: 'A😀λβγB\n\n尾Z',
    selection: {ranges: [[8, 8]], mainIndex: 0},
  }],
  [60, {
    document: 'A😀λβγB\n\n尾Z',
    selection: {ranges: [[8, 8]], mainIndex: 0},
  }],
  [70, {
    document: 'A😀λβγB\n\n尾Z',
    selection: {ranges: [[6, 3], [10, 9]], mainIndex: 1},
  }],
  [80, {
    document: 'A😀λβγB\n\n尾Z',
    selection: {ranges: [[10, 0]], mainIndex: 0},
  }],
]);

// CM6 maps a transaction's existing selection instead of applying CM5's
// implicit post-edit cursor. The v1 wire language represents that atomic CM6
// result as a content operation followed by a same-time cursor operation.
// Keep the intermediate wire state in the oracle because both real players
// expose every logical operation boundary.
const modernDifferentialStateSequence = [
  [0, differentialSemanticStates.get(0)],
  [10, differentialSemanticStates.get(10)],
  [20, differentialSemanticStates.get(20)],
  [20, {
    document: differentialSemanticStates.get(20).document,
    selection: differentialSemanticStates.get(10).selection,
  }],
  [25, differentialSemanticStates.get(25)],
  [25, {
    document: differentialSemanticStates.get(25).document,
    selection: differentialSemanticStates.get(10).selection,
  }],
  [30, differentialSemanticStates.get(30)],
  [30, {
    document: differentialSemanticStates.get(30).document,
    selection: differentialSemanticStates.get(10).selection,
  }],
  [40, {
    document: differentialSemanticStates.get(40).document,
    selection: differentialSemanticStates.get(10).selection,
  }],
  [50, differentialSemanticStates.get(50)],
  [50, {
    document: differentialSemanticStates.get(50).document,
    selection: differentialSemanticStates.get(10).selection,
  }],
  [60, {
    document: differentialSemanticStates.get(60).document,
    selection: differentialSemanticStates.get(10).selection,
  }],
  [70, differentialSemanticStates.get(70)],
  [80, differentialSemanticStates.get(80)],
];

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneExactRecordBytes(records, message) {
  assert.equal(typeof records, 'string', `${message}: record payload type`);
  const clonedBytes = JSON.stringify(cloneJson(JSON.parse(records)));
  assert.equal(
      clonedBytes,
      records,
      `${message}: a deep clone did not preserve the exact record bytes`,
  );
  return clonedBytes;
}

function differentialEvents(...events) {
  return events.map(([kind, activity]) => ({
    kind,
    activity: cloneJson(activity),
  }));
}

function forwardEventsAt(time) {
  const events = [];
  if (time >= 40) {
    events.push(['handle', differentialActivityOne]);
  }
  if (time >= 60) {
    events.push(['handle', differentialActivityTwo]);
  }
  return differentialEvents(...events);
}

function expectedDifferentialSnapshot(time, events, semanticState) {
  semanticState ??= differentialSemanticStates.get(time);
  assert.ok(semanticState, `missing differential state for ${time}ms`);
  return {
    time,
    duration: differentialDuration,
    document: semanticState.document,
    utf16Length: semanticState.document.length,
    selection: cloneJson(semanticState.selection),
    extras: events,
  };
}

function captureDifferentialPayload(runtime) {
  return runtime.capture(
      differentialInitialDocument,
      ({at, editor, recorder}) => {
        at(10, () => runtime.setSelections(
            editor,
            [offsetRange(3, 1)],
            0,
        ));
        for (const [time, from, insert] of [
          [20, 3, 'λ'],
          [25, 4, 'β'],
          [30, 5, 'γ'],
        ]) {
          at(time, () => runtime.edit(editor, {
            from,
            insert,
            origin: '+input',
            preserveSelection: true,
          }));
        }
        at(40, () => recorder.recordExtraActivity(
            cloneJson(differentialActivityOne),
        ));
        at(50, () => runtime.edit(editor, {
          from: 8,
          to: 10,
          insert: '',
          origin: '+delete',
          preserveSelection: true,
        }));
        at(60, () => recorder.recordExtraActivity(
            cloneJson(differentialActivityTwo),
        ));
        at(70, () => runtime.setSelections(
            editor,
            [offsetRange(6, 3), offsetRange(10, 9)],
            1,
        ));
        at(80, () => runtime.setSelections(
            editor,
            [offsetRange(10, 0)],
            0,
        ));
      },
      {allowMultipleSelections: true},
  );
}

async function verifyBidirectionalDifferentialTrace(producer) {
  assert.equal(differentialInitialDocument.length, 10);
  assert.equal([...differentialInitialDocument].length, 9);
  const {editor, records} = captureDifferentialPayload(producer);
  const message = `${producer.name} same-payload differential trace\n` +
    records;
  assert.equal(producer.document(editor), 'A😀λβγB\n\n尾Z', message);
  assert.deepEqual(
      producer.selection(editor),
      {ranges: [[10, 0]], mainIndex: 0},
      message,
  );
  const expectedStateSequence = producer === modernRuntime ?
    modernDifferentialStateSequence :
    [0, ...differentialTimes].map((time) => [
      time,
      differentialSemanticStates.get(time),
    ]);
  const expectedTimes = expectedStateSequence.slice(1)
      .map(([time]) => time);
  assert.deepEqual(
      parsedRecords(records).flatMap(expandedTimes),
      expectedTimes,
      `${message}: expanded logical timestamps`,
  );
  if (producer === legacyRuntime) {
    assert.equal(
        parsedRecords(records).some((record) => (record.l ?? 1) > 1),
        true,
        `${message}: CM5 fixture must exercise compressed timeline expansion`,
    );
  } else {
    assert.equal(
        parsedRecords(records).some((record) =>
          record.t === 20 && record.o[0].o === 'o',
        ),
        true,
        `${message}: CM6 fixture must retain the mapped transaction selection`,
    );
  }

  const traces = await verifySamePayloadAcrossPlayers({
    initialDocument: differentialInitialDocument,
    records,
    message,
  });
  const expectedNaturalTrace = expectedStateSequence.map(
      ([time, semanticState]) => expectedDifferentialSnapshot(
          time,
          forwardEventsAt(time),
          semanticState,
      ),
  );

  // This UTF-16 scenario also carries an independently specified semantic
  // oracle, so identical bugs in both player generations cannot cancel out.
  assert.deepEqual(
      traces.legacyNatural,
      expectedNaturalTrace,
      `${message}: CM5 natural semantic trace`,
  );
  assert.deepEqual(
      traces.modernNatural,
      expectedNaturalTrace,
      `${message}: CM6 natural semantic trace`,
  );
}

async function verifyLiteralRealPeerPayloads() {
  const legacyOriginRecords =
    '[{"t":10,"o":[{"o":"k","i":[0,0],"a":"K"}]},' +
    '{"t":20,"o":[{"o":"m","i":[0,1],"a":"M"}]},' +
    '{"t":30,"o":[{"o":"n","i":[0,2],"a":"N"}]},' +
    '{"t":40,"o":[{"i":[0,3],"a":"?"}]}]';
  const originMessage =
    'literal legacy k/m/n/omitted-origin bytes through both real players';
  assert.deepEqual(
      parsedRecords(legacyOriginRecords).map((record) => record.o[0].o),
      ['k', 'm', 'n', undefined],
      originMessage,
  );
  const originTraces = await verifySamePayloadAcrossPlayers({
    initialDocument: '',
    records: legacyOriginRecords,
    message: originMessage,
  });
  assert.equal(
      originTraces.modernNatural.at(-1).document,
      'KMN?',
      originMessage,
  );

  const compressedSelectionRecords =
    '[{"t":[10,30],"l":3,"o":[' +
    '{"o":"l","i":[0,0],"s":[[0,[1]],[1,[[1,2]]]]},' +
    '{"o":"l","i":[3,3],"s":[[3,[2]],[2,[[2,1]]]]}' +
    ']}]';
  const selectionMessage =
    'literal compressed multiline multi-cursor selection-s bytes';
  const selectionTraces = await verifySamePayloadAcrossPlayers({
    initialDocument: 'abc\ndef\nghi\njkl',
    records: compressedSelectionRecords,
    message: selectionMessage,
  });
  assert.deepEqual(
      selectionTraces.modernNatural.slice(1).map((snapshot) =>
        snapshot.selection,
      ),
      [
        {ranges: [[0, 1], [15, 14]], mainIndex: 1},
        {ranges: [[0, 5], [15, 10]], mainIndex: 1},
        {ranges: [[0, 6], [15, 9]], mainIndex: 1},
      ],
      selectionMessage,
  );
}

async function verifyModernLiteralPayloadsInLegacyPlayer() {
  const cases = [
    {
      name: 'v2 multiline input positions',
      initialDocument: 'A\nB',
      records:
        '[{"t":10,"o":[{"o":"i","i":[0,1],"a":"x"}]},' +
        '{"t":20,"o":[{"o":"i","i":[1,0],"a":"y"}]}]',
      finalDocument: 'Ax\nyB',
      cursor: {line: 1, ch: 1, offset: 4},
    },
    {
      name: 'v2 multiline composition positions',
      initialDocument: 'A\nB',
      records:
        '[{"t":10,"o":[{"o":"c","i":[0,0],"a":["x"]}]},' +
        '{"t":20,"o":[{"o":"c","i":[1,1],"a":["y"]}]}]',
      finalDocument: 'xA\nBy',
      cursor: {line: 1, ch: 2, offset: 5},
    },
    {
      name: 'v2 ordered deletion replacements',
      initialDocument: 'abcd',
      records:
        '[{"t":10,"o":[{"o":"d","i":[[0,2],[0,3]],"a":["X"]}]},' +
        '{"t":20,"o":[{"o":"d","i":[[0,1],[0,2]],"a":["Y"]}]}]',
      finalDocument: 'aYXd',
      cursor: {line: 0, ch: 2, offset: 2},
    },
    {
      name: 'v2 two-newline replacement and explicit cursor',
      initialDocument: 'abcdef',
      records:
        '[{"t":10,"o":[{"o":"i","i":[[0,2],[0,3]],' +
        '"a":"\\n\\n"}]},{"t":10,"o":[{"o":"o","i":[2,0]}]}]',
      finalDocument: 'ab\n\ndef',
      cursor: {line: 2, ch: 0, offset: 4},
    },
    {
      name: 'v2 empty replacement and explicit cursor',
      initialDocument: 'abcdef',
      records:
        '[{"t":10,"o":[{"o":"i","i":[[0,2],[0,3]],"a":""}]},' +
        '{"t":10,"o":[{"o":"o","i":[0,2]}]}]',
      finalDocument: 'abdef',
      cursor: {line: 0, ch: 2, offset: 2},
    },
    {
      name: 'v2 cursor to non-empty selection',
      initialDocument: 'abcdef',
      records:
        '[{"t":10,"o":[{"o":"o","i":[0,1]}]},' +
        '{"t":20,"o":[{"o":"o","i":[[0,2],[0,4]]}]}]',
      finalDocument: 'abcdef',
      minimumLegacyVersion: [0, 3, 3],
      selections: [[2, 4]],
    },
    {
      name: 'v2 uncompressed multi-cursor multiline composition',
      initialDocument: 'AB',
      records:
        '[{"t":10,"o":[' +
        '{"o":"c","i":[0,2],"a":["b"]},' +
        '{"o":"c","i":[0,0],"a":["a"]}]},' +
        '{"t":20,"o":[' +
        '{"o":"c","i":[0,3],"a":["x","y"]},' +
        '{"o":"c","i":[0,1],"a":["c"]}]}]',
      finalDocument: 'acABx\nyb',
      minimumLegacyVersion: [0, 3, 3],
      selections: [[2, 2], [7, 7]],
      uncompressed: true,
    },
  ];

  for (const fixture of cases) {
    if (
      fixture.minimumLegacyVersion !== undefined &&
      !legacyVersionIsAtLeast(...fixture.minimumLegacyVersion)
    ) {
      continue;
    }
    const message =
      `${fixture.name}: v2 bytes -> CM5 v${legacyPackageVersion} player`;
    if (fixture.uncompressed) {
      assert.equal(
          parsedRecords(fixture.records).every((record) =>
            record.l === undefined,
          ),
          true,
          `${message}: payload must stay uncompressed`,
      );
    }
    const playback = await playPayloadWithLegacyPublicApi(
        fixture.initialDocument,
        fixture.records,
        message,
    );
    assert.equal(playback.editor.getValue(), fixture.finalDocument, message);
    if (fixture.selections !== undefined) {
      const selections = playback.editor.listSelections().map((selection) => [
        playback.editor.indexFromPos(selection.anchor),
        playback.editor.indexFromPos(selection.head),
      ]).toSorted((left, right) => left[0] - right[0]);
      assert.deepEqual(selections, fixture.selections, message);
    } else {
      const cursor = playback.editor.getCursor();
      assert.equal(cursor.line, fixture.cursor.line, message);
      assert.equal(cursor.ch, fixture.cursor.ch, message);
      assert.equal(
          playback.editor.indexFromPos(cursor),
          fixture.cursor.offset,
          message,
      );
    }
  }
}

async function verifyPreV1RecorderInModernPlayer() {
  let recordedExtraActivity = false;
  const capture = legacyRuntime.capture(
      'AB',
      ({at, editor, recorder}) => {
        at(10, () => editor.replaceRange(
            'x',
            {line: 0, ch: 1},
            undefined,
            '+input',
        ));
        at(20, () => editor.replaceRange(
            'y',
            {line: 0, ch: 2},
            undefined,
            '+input',
        ));
        if (typeof recorder.recordExtraActivity === 'function') {
          at(30, () => recorder.recordExtraActivity({
            kind: 'pre-v1-real-producer',
            version: legacyPackageVersion,
          }));
          recordedExtraActivity = true;
        }
      },
  );
  const message =
    `real CM5 v${legacyPackageVersion} recorder -> CM6 v2 player\n` +
    capture.records;
  assert.equal(capture.editor.getValue(), 'AxyB', message);

  const extras = [];
  const session = modernRuntime.createPlayer('AB', capture.records, {
    extraActivityHandler(activity) {
      extras.push(cloneJson(activity));
    },
  });
  await playToEnd(session, logicalOperationTimes(capture.records).length);
  assertDocument(session, 'AxyB', message);
  assert.deepEqual(
      modernRuntime.selection(session.editor),
      {ranges: [[3, 3]], mainIndex: 0},
      message,
  );
  assert.deepEqual(
      extras,
      recordedExtraActivity ? [{
        kind: 'pre-v1-real-producer',
        version: legacyPackageVersion,
      }] : [],
      `${message}: capability-gated extra activity`,
  );
}

async function verifyCommittedLegacyGolden() {
  for (const {version, value: legacyGolden} of legacyGoldens) {
    const message =
      `packed v2 player consumes the immutable v${version} corpus`;
    const traces = await verifySamePayloadAcrossPlayers({
      initialDocument: legacyGolden.initialDocument,
      records: legacyGolden.records,
      message,
    });
    const finalSnapshot = traces.modernNatural.at(-1);

    assert.equal(finalSnapshot.duration, 50, message);
    assert.equal(finalSnapshot.document, legacyGolden.finalDocument, message);
    assert.deepEqual(
        finalSnapshot.selection.ranges[0],
        legacyGolden.finalSelection,
        message,
    );
    assert.deepEqual(finalSnapshot.extras, [{
      kind: 'handle',
      activity: {kind: 'golden', value: 1},
    }], message);
  }
}

const directions = [
  {producer: legacyRuntime, consumer: modernRuntime},
  {producer: modernRuntime, consumer: legacyRuntime},
];

try {
  await verifyRealLegacyUngroupedInterval();
  await verifyScalarCompressedTimingClassification();
  await verifyModernLiteralPayloadsInLegacyPlayer();
  if (legacyIsPreV1) {
    await verifyPreV1RecorderInModernPlayer();
  } else {
    await verifyCommittedLegacyGolden();
    await verifyLiteralRealPeerPayloads();
    await verifyBidirectionalDifferentialTrace(legacyRuntime);
    await verifyBidirectionalDifferentialTrace(modernRuntime);
    await verifyModernChangeOnlySelection();
    for (const direction of directions) {
      await verifyCompressedInput(direction);
      await verifyEqualTimeInput(direction);
      await verifyCompressedDeletion(direction);
      await verifyVariableWidthMultilineDeletion(direction);
      await verifyEqualTimeDeletion(direction);
      await verifyCompressedComposition(direction);
      await verifyEqualTimeComposition(direction);
      await verifyChangeOrigins(direction);
      await verifyMultipleChangesStayInOneOperation(direction);
      await verifyMixedOriginOperation(direction);
      await verifyCompressedMultiCursorInput(direction);
      await verifyCompressedMultiCursorDeletion(direction);
      await verifyCompressedCursor(direction);
      await verifyEqualTimeCursor(direction);
      await verifyCompressedSelection(direction);
      await verifyEqualTimeSelection(direction);
      await verifyDirectedMultipleSelections(direction);
      await verifyExtrasAndSeeking(direction);
      await verifyExtraPayloadTypes(direction);
    }
  }
} finally {
  while (modernViews.length > 0) {
    modernViews.pop().destroy();
  }
  dom.window.close();
}
