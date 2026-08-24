import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';
import {JSDOM} from 'jsdom';

import {installDomGlobals} from './install-dom-globals.mjs';

const require = createRequire(import.meta.url);
const dom = new JSDOM('<main></main>', {pretendToBeVisual: true});

installDomGlobals(dom);
if (!globalThis.Range.prototype.getClientRects) {
  globalThis.Range.prototype.getClientRects = () => [];
}
if (!globalThis.Range.prototype.getBoundingClientRect) {
  globalThis.Range.prototype.getBoundingClientRect =
    () => new globalThis.DOMRect();
}

const CodeMirror = require('codemirror');
const {CodeRecord} = loadLegacyPackage('cm-record-v1');
const codeMirrorMetadata = require('codemirror/package.json');
const legacyPackageMetadata = require('cm-record-v1/package.json');
const sourceMetadata = process.env.LEGACY_CORPUS_SOURCE ?
  JSON.parse(process.env.LEGACY_CORPUS_SOURCE) : undefined;
const initialDocument = 'abc\ndef';
const initialClockTime = Date.parse('2026-01-01T00:00:00Z');
const RealDate = globalThis.Date;
let currentTime = initialClockTime;

function loadLegacyPackage(packageName) {
  const packageExports = require(packageName);
  if (typeof packageExports.CodeRecord === 'function') {
    return packageExports;
  }
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
  assert.equal(typeof restoredExports.CodeRecord, 'function');
  return restoredExports;
}

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
  const host = globalThis.document.createElement('div');
  globalThis.document.querySelector('main').append(host);
  const editor = CodeMirror(host, {value: initialDocument});
  const recorder = new CodeRecord(editor);
  recorder.listen();
  const at = (relativeTime, action) => {
    currentTime = initialClockTime + relativeTime;
    action();
  };

  at(10, () => editor.replaceRange(
      'X',
      editor.posFromIndex(0),
      undefined,
      '+input',
  ));
  at(20, () => editor.replaceRange(
      'Y',
      editor.posFromIndex(1),
      undefined,
      '+input',
  ));
  at(30, () => editor.replaceRange(
      '',
      editor.posFromIndex(4),
      editor.posFromIndex(5),
      '+delete',
  ));
  const supportsExtraActivity =
    typeof recorder.recordExtraActivity === 'function';
  if (supportsExtraActivity) {
    at(40, () => recorder.recordExtraActivity({kind: 'golden', value: 1}));
  }
  at(50, () => editor.setSelection(
      editor.posFromIndex(0),
      editor.posFromIndex(3),
  ));

  const selection = editor.listSelections()[0];
  const generator = {
    package: 'codemirror-record',
    packageVersion: legacyPackageMetadata.version,
    codeMirrorVersion: codeMirrorMetadata.version,
  };
  if (sourceMetadata) {
    generator.source = sourceMetadata;
  }
  const corpus = {
    schema: 1,
    generator,
    scenario: supportsExtraActivity ?
      'compressed input, deletion, selection, and extra activity' :
      'compressed input, deletion, and selection',
    initialDocument,
    finalDocument: editor.getValue(),
    finalSelection: [
      editor.indexFromPos(selection.anchor),
      editor.indexFromPos(selection.head),
    ],
    records: recorder.getRecords(),
  };

  process.stdout.write(`${JSON.stringify(corpus, null, 2)}\n`);
} finally {
  globalThis.Date = RealDate;
  dom.window.close();
}
