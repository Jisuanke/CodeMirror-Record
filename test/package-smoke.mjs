import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {
  EditorSelection,
  EditorState,
  Transaction,
} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {JSDOM} from 'jsdom';

import {installDomGlobals} from '../scripts/fixtures/install-dom-globals.mjs';

const require = createRequire(import.meta.url);
const commonJs = require('../dist/index.cjs');
const commonJsState = require('@codemirror/state');
const commonJsView = require('@codemirror/view');
const esModule = await import(pathToFileURL(
    new URL('../dist/index.mjs', import.meta.url).pathname,
));

const expectedExports = ['CodePlay', 'CodeRecord'];
assert.deepEqual(Object.keys(commonJs).sort(), expectedExports);
assert.deepEqual(Object.keys(esModule).sort(), expectedExports);

for (const filename of ['index.cjs', 'index.mjs', 'main.js']) {
  const bundle = await readFile(new URL(`../dist/${filename}`, import.meta.url));
  assert.ok(bundle.byteLength < 100_000, `${filename} unexpectedly bundles CM6`);
  assert.doesNotMatch(
      bundle.toString(),
      /Unrecognized extension value in extension set/,
      `${filename} contains a bundled copy of @codemirror/state`,
  );
  assert.ok(
      bundle.toString().endsWith('\n'),
      `${filename} must honor the repository final-newline policy`,
  );
}

const demoBundle = await readFile(new URL('../demo/main.js', import.meta.url));
assert.ok(
    demoBundle.toString().endsWith('\n'),
    'demo/main.js must honor the repository final-newline policy',
);

const dom = new JSDOM('<div id="record"></div><div id="play"></div>', {
  pretendToBeVisual: true,
});
installDomGlobals(dom);
if (!globalThis.Range.prototype.getClientRects) {
  globalThis.Range.prototype.getClientRects = () => [];
}

const recordView = new EditorView({
  parent: globalThis.document.getElementById('record'),
  state: EditorState.create({
    extensions: [EditorState.allowMultipleSelections.of(true)],
  }),
});
const recorder = new commonJs.CodeRecord(recordView);
recorder.listen();
recordView.dispatch({
  changes: {from: 0, insert: 'cross-module'},
  selection: EditorSelection.create([
    EditorSelection.range(4, 1),
    EditorSelection.cursor(8),
  ], 1),
  annotations: Transaction.userEvent.of('input.type'),
});
const records = recorder.getRecords();
assert.equal(JSON.parse(records)[0].o[0].a, 'cross-module');

const playView = new EditorView({
  parent: globalThis.document.getElementById('play'),
  state: EditorState.create(),
});
const crossEntryRecorder = new esModule.CodeRecord(playView);
crossEntryRecorder.listen();
const player = new commonJs.CodePlay(playView, {maxDelay: 0});
player.addOperations(records);
const playbackEnded = new Promise((resolve) => player.once('end', resolve));
player.play();
await playbackEnded;
assert.equal(playView.state.doc.toString(), 'cross-module');
assert.deepEqual(selectionOffsets(playView), [[4, 1], [8, 8]]);
assert.equal(playView.state.selection.mainIndex, 1);
assert.equal(
    crossEntryRecorder.getRecords(),
    '[]',
    'playback through CommonJS must not be re-recorded through ESM',
);

const reverseRecordHost = globalThis.document.createElement('div');
const reversePlayHost = globalThis.document.createElement('div');
globalThis.document.body.append(reverseRecordHost, reversePlayHost);
const reverseRecordView = new commonJsView.EditorView({
  parent: reverseRecordHost,
  state: commonJsState.EditorState.create({
    extensions: [
      commonJsState.EditorState.allowMultipleSelections.of(true),
    ],
  }),
});
const reverseRecorder = new esModule.CodeRecord(reverseRecordView);
reverseRecorder.listen();
reverseRecordView.dispatch({
  changes: {from: 0, insert: 'esm-on-cjs'},
  selection: commonJsState.EditorSelection.create([
    commonJsState.EditorSelection.range(3, 1),
    commonJsState.EditorSelection.cursor(8),
  ], 1),
  annotations: commonJsState.Transaction.userEvent.of('input.type'),
});
const reverseRecords = reverseRecorder.getRecords();
assert.equal(JSON.parse(reverseRecords)[0].o[0].a, 'esm-on-cjs');

const reversePlayView = new commonJsView.EditorView({
  parent: reversePlayHost,
  state: commonJsState.EditorState.create(),
});
const reversePlayer = new esModule.CodePlay(reversePlayView, {maxDelay: 0});
reversePlayer.addOperations(reverseRecords);
const reversePlaybackEnded = new Promise(
    (resolve) => reversePlayer.once('end', resolve),
);
reversePlayer.play();
await reversePlaybackEnded;
assert.equal(reversePlayView.state.doc.toString(), 'esm-on-cjs');
assert.deepEqual(selectionOffsets(reversePlayView), [[3, 1], [8, 8]]);
assert.equal(reversePlayView.state.selection.mainIndex, 1);

recordView.destroy();
playView.destroy();
reverseRecordView.destroy();
reversePlayView.destroy();
dom.window.close();

function selectionOffsets(view) {
  return view.state.selection.ranges.map((range) => [
    range.anchor,
    range.head,
  ]);
}
