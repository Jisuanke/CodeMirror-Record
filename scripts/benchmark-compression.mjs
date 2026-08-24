import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {JSDOM} from 'jsdom';

import {installDomGlobals} from './fixtures/install-dom-globals.mjs';

const dom = new JSDOM('<main></main>', {pretendToBeVisual: true});

installDomGlobals(dom);
if (!globalThis.Range.prototype.getClientRects) {
  globalThis.Range.prototype.getClientRects = () => [];
}
if (!globalThis.Range.prototype.getBoundingClientRect) {
  globalThis.Range.prototype.getBoundingClientRect =
    () => new globalThis.DOMRect();
}

const {
  EditorSelection,
  EditorState,
  Transaction,
} = await import('@codemirror/state');
const {EditorView} = await import('@codemirror/view');
// A package self-reference follows the public `exports` map to dist/index.mjs.
// This keeps the benchmark on the same built seam used by ESM consumers.
const {CodePlay, CodeRecord} = await import('codemirror-record');

const initialClockTime = Date.parse('2026-01-01T00:00:00Z');
const maximumAggregateRatio = 0.40;
const scenarios = [
  {
    name: 'typing',
    initialDocument: '',
    perform({dispatch, view}) {
      for (const character of 'const total = items.length + tax;') {
        dispatch({
          changes: {
            from: view.state.doc.length,
            insert: character,
          },
          selection: EditorSelection.cursor(view.state.doc.length + 1),
          annotations: Transaction.userEvent.of('input.type'),
        });
      }
    },
  },
  {
    name: 'deletion',
    initialDocument: 'prefix-compress-this-repeated-tail-0123456789',
    perform({dispatch, view}) {
      for (let index = 0; index < 24; index++) {
        const end = view.state.doc.length;
        dispatch({
          changes: {from: end - 1, to: end},
          selection: EditorSelection.cursor(end - 1),
          annotations: Transaction.userEvent.of('delete.backward'),
        });
      }
    },
  },
  {
    name: 'cursor-selection',
    initialDocument: '0123456789abcdefghijklmnopqrstuvwxyz',
    perform({dispatch}) {
      for (let position = 1; position <= 10; position++) {
        dispatch({selection: EditorSelection.cursor(position)});
      }
      for (let head = 11; head <= 24; head++) {
        dispatch({selection: EditorSelection.single(10, head)});
      }
    },
  },
  {
    name: 'mixed-editing',
    initialDocument: 'value = draft;',
    perform({dispatch, view}) {
      let insertionPosition = 0;
      for (const character of 'const ') {
        dispatch({
          changes: {from: insertionPosition, insert: character},
          selection: EditorSelection.cursor(insertionPosition + 1),
          annotations: Transaction.userEvent.of('input.type'),
        });
        insertionPosition++;
      }

      const draftFrom = view.state.doc.toString().indexOf('draft');
      for (let head = draftFrom + 1;
        head <= draftFrom + 'draft'.length;
        head++) {
        dispatch({
          selection: EditorSelection.single(draftFrom, head),
        });
      }

      dispatch({
        changes: {
          from: draftFrom,
          to: draftFrom + 'draft'.length,
          insert: 'ready',
        },
        selection: EditorSelection.cursor(draftFrom + 'ready'.length),
        annotations: Transaction.userEvent.of('input.paste'),
      });

      for (let index = 0; index < 2; index++) {
        const cursor = view.state.selection.main.head;
        dispatch({
          changes: {from: cursor - 1, to: cursor},
          selection: EditorSelection.cursor(cursor - 1),
          annotations: Transaction.userEvent.of('delete.backward'),
        });
      }

      const cursor = view.state.selection.main.head;
      for (let position = cursor - 1; position >= cursor - 4; position--) {
        dispatch({selection: EditorSelection.cursor(position)});
      }
    },
  },
];

const results = [];

try {
  for (const scenario of scenarios) {
    const compressed = captureScenario(scenario, false);
    const uncompressed = captureScenario(scenario, true);

    assert.deepEqual(
        compressed.finalState,
        uncompressed.finalState,
        `${scenario.name}: recording modes produced different editor states`,
    );
    assertUncompressedV1Subset(scenario.name, uncompressed.records);

    await assertSemanticReplay(
        scenario,
        'compressed',
        compressed.records,
        compressed.finalState,
    );
    await assertSemanticReplay(
        scenario,
        'uncompressed',
        uncompressed.records,
        uncompressed.finalState,
    );

    const compressedBytes = byteLength(compressed.records);
    const uncompressedBytes = byteLength(uncompressed.records);
    const compressedOperations = JSON.parse(compressed.records).length;
    const uncompressedOperations = JSON.parse(uncompressed.records).length;

    assert.ok(
        compressedBytes < uncompressedBytes,
        `${scenario.name}: compression no longer reduces serialized bytes`,
    );
    assert.ok(
        compressedOperations < uncompressedOperations,
        `${scenario.name}: compression no longer reduces wire operations`,
    );

    results.push({
      name: scenario.name,
      logicalOperations: compressed.logicalOperations,
      compressedBytes,
      uncompressedBytes,
      compressedOperations,
      uncompressedOperations,
    });
  }

  const totals = results.reduce((total, result) => ({
    logicalOperations: total.logicalOperations + result.logicalOperations,
    compressedBytes: total.compressedBytes + result.compressedBytes,
    uncompressedBytes: total.uncompressedBytes + result.uncompressedBytes,
    compressedOperations:
      total.compressedOperations + result.compressedOperations,
    uncompressedOperations:
      total.uncompressedOperations + result.uncompressedOperations,
  }), {
    logicalOperations: 0,
    compressedBytes: 0,
    uncompressedBytes: 0,
    compressedOperations: 0,
    uncompressedOperations: 0,
  });
  const aggregateRatio = totals.compressedBytes / totals.uncompressedBytes;
  const passesAggregateCeiling = aggregateRatio <= maximumAggregateRatio;

  printResults(results, totals, passesAggregateCeiling);

  assert.ok(
      passesAggregateCeiling,
      `aggregate byte ratio ${formatPercent(aggregateRatio)} exceeds ` +
        `the ${formatPercent(maximumAggregateRatio)} regression ceiling`,
  );
} finally {
  dom.window.close();
}

/**
 * Record one deterministic scenario through the public recorder interface.
 *
 * @param {object} scenario Benchmark scenario
 * @param {boolean} flushEach Whether to drain after every logical operation
 * @return {object} Serialized records, final state, and operation count
 */
function captureScenario(scenario, flushEach) {
  return withControlledClock((advanceClock) => {
    const view = createView(scenario.initialDocument, 'record');
    const recorder = new CodeRecord(view);
    const drainedOperations = [];
    let logicalOperations = 0;
    let relativeTime = 0;

    recorder.listen();
    scenario.perform({
      view,
      dispatch(specification) {
        logicalOperations++;
        relativeTime += 20;
        advanceClock(relativeTime);
        view.dispatch(specification);
        if (flushEach) {
          drainedOperations.push(...JSON.parse(recorder.getRecords()));
        }
      },
    });

    const records = flushEach ?
      JSON.stringify(drainedOperations) :
      recorder.getRecords();
    const finalState = snapshot(view);
    view.destroy();

    return {records, finalState, logicalOperations};
  });
}

/**
 * Replay records through the public player and compare observable CM6 state.
 *
 * @param {object} scenario Benchmark scenario
 * @param {string} mode Record mode label
 * @param {string} records Serialized v1 wire records
 * @param {object} expected Expected document and selection
 */
async function assertSemanticReplay(scenario, mode, records, expected) {
  const view = createView(scenario.initialDocument, 'play');
  const player = new CodePlay(view, {maxDelay: 0});
  player.addOperations(records);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${scenario.name}: ${mode} replay timed out`));
    }, 5000);
    player.once('end', () => {
      clearTimeout(timeout);
      resolve();
    });
    player.seek(player.getDuration());
  });

  assert.deepEqual(
      snapshot(view),
      expected,
      `${scenario.name}: ${mode} replay changed observable editor state`,
  );
  view.destroy();
}

/**
 * Create a real EditorView attached to the jsdom document.
 *
 * @param {string} documentText Initial document
 * @param {string} purpose Host label
 * @return {EditorView} Editor view
 */
function createView(documentText, purpose) {
  const parent = globalThis.document.createElement('div');
  parent.dataset.benchmarkPurpose = purpose;
  globalThis.document.querySelector('main').append(parent);
  return new EditorView({
    parent,
    state: EditorState.create({doc: documentText}),
  });
}

/**
 * Capture the editor state exposed to consumers.
 *
 * @param {EditorView} view Editor view
 * @return {object} Document and selection snapshot
 */
function snapshot(view) {
  return {
    document: view.state.doc.toString(),
    selection: {
      mainIndex: view.state.selection.mainIndex,
      ranges: view.state.selection.ranges.map(({anchor, head}) => ({
        anchor,
        head,
      })),
    },
  };
}

/**
 * Replace Date only while recording so transaction timestamps are repeatable.
 *
 * @param {function} callback Recording callback
 * @return {*} Callback result
 */
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
    return callback((relativeTime) => {
      currentTime = initialClockTime + relativeTime;
    });
  } finally {
    globalThis.Date = RealDate;
  }
}

/**
 * Assert that drain-per-operation output stays in the scalar v1 subset.
 *
 * @param {string} scenarioName Scenario label
 * @param {string} records Serialized records
 */
function assertUncompressedV1Subset(scenarioName, records) {
  const operations = JSON.parse(records);
  for (const operation of operations) {
    assert.equal(
        Array.isArray(operation.t),
        false,
        `${scenarioName}: flushed operation has a compressed time interval`,
    );
    assert.equal(
        'l' in operation,
        false,
        `${scenarioName}: flushed operation has a compressed length`,
    );
  }
}

/**
 * Measure compact JSON as UTF-8, matching bytes sent or stored.
 *
 * @param {string} value Serialized records
 * @return {number} UTF-8 byte count
 */
function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

/**
 * Print stable, copyable benchmark results.
 *
 * @param {array} scenarioResults Per-scenario metrics
 * @param {object} totals Aggregate metrics
 * @param {boolean} passesAggregateCeiling Whether aggregate ratio is allowed
 */
function printResults(scenarioResults, totals, passesAggregateCeiling) {
  const headings = [
    'scenario',
    'logical',
    'wire ops (c/u)',
    'bytes (c/u)',
    'ratio',
    'saved',
  ];
  const rows = scenarioResults.map((result) => formatRow(result));
  rows.push(formatRow({name: 'TOTAL', ...totals}));
  const widths = headings.map((heading, column) => Math.max(
      heading.length,
      ...rows.map((row) => row[column].length),
  ));

  console.log(headings.map((heading, column) =>
    heading.padEnd(widths[column]),
  ).join('  '));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) {
    console.log(row.map((cell, column) =>
      cell.padEnd(widths[column]),
    ).join('  '));
  }
  console.log('\nReplay equivalence: PASS (compressed and uncompressed)');
  console.log(
      `Regression ceiling: ${passesAggregateCeiling ? 'PASS' : 'FAIL'} ` +
      `(total ratio <= ` +
      `${formatPercent(maximumAggregateRatio)})`,
  );
}

/**
 * Convert benchmark metrics to one output row.
 *
 * @param {object} result Benchmark metrics
 * @return {array<string>} Printable row
 */
function formatRow(result) {
  const ratio = result.compressedBytes / result.uncompressedBytes;
  return [
    result.name,
    String(result.logicalOperations),
    `${result.compressedOperations}/${result.uncompressedOperations}`,
    `${result.compressedBytes}/${result.uncompressedBytes}`,
    formatPercent(ratio),
    formatPercent(1 - ratio),
  ];
}

/**
 * Format a ratio as a stable one-decimal percentage.
 *
 * @param {number} ratio Fractional ratio
 * @return {string} Percentage
 */
function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(1)}%`;
}
