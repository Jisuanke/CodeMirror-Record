/* global window */

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';

import {chromium} from 'playwright';

const repositoryRoot = process.cwd();
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
const errors = [];
let browser;
let server;

try {
  server = await startServer(repositoryRoot);
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  await context.grantPermissions(
      ['clipboard-read', 'clipboard-write'],
      {origin},
  );
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => {
    errors.push(`request: ${request.url()} (${request.failure()?.errorText})`);
  });

  await page.goto(`${origin}/test/browser/fixture.html`);
  await page.waitForFunction(() => window.browserSmokeReady === true);

  const editor = page.locator('#record-editor .cm-content');
  await editor.click();
  await moveToDocumentEnd(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('TYPED', {delay: 8});
  await expectDocumentSuffix(page, '\nTYPED');

  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Shift+ArrowLeft');
  }
  const directedSelection = await recordingState(page);
  assert.equal(directedSelection.selection.ranges.length, 1);
  assert.ok(
      directedSelection.selection.ranges[0].anchor >
      directedSelection.selection.ranges[0].head,
      'Shift+ArrowLeft must create a backward directed selection',
  );

  await page.evaluate(async () => navigator.clipboard.writeText('PASTED'));
  await page.keyboard.press(`${modifier}+V`);
  await expectDocumentSuffix(page, '\nPASTED');

  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Shift+ArrowLeft');
  }
  await page.keyboard.press(`${modifier}+X`);
  await expectDocumentSuffix(page, '\n');

  await selectFirstWord(page, 'seed');
  await page.keyboard.press(`${modifier}+D`);
  const multipleSelection = await recordingState(page);
  assert.equal(
      multipleSelection.selection.ranges.length,
      2,
      `${modifier}+D must create two real editor selections`,
  );
  await page.keyboard.type('PAIR');
  await page.waitForFunction(
      () => window.browserSmoke.recordingState().document.startsWith(
          'PAIR PAIR',
      ),
  );

  await dragTextIntoEditor(page, editor);
  await page.waitForFunction(
      () => window.browserSmoke.recordingState().document.includes('DROP'),
  );

  await editor.click();
  await moveToDocumentEnd(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', {
    text: '你',
    selectionStart: 1,
    selectionEnd: 1,
  });
  await cdp.send('Input.imeSetComposition', {
    text: '你好',
    selectionStart: 2,
    selectionEnd: 2,
  });
  await cdp.send('Input.insertText', {text: '你好'});
  await expectDocumentSuffix(page, '你好');

  await selectFirstWord(page, 'PAIR');
  await page.keyboard.press(`${modifier}+D`);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  const expected = await recordingState(page);
  assert.equal(expected.selection.ranges.length, 2);
  assert.ok(
      expected.selection.ranges.every((range) => range.anchor > range.head),
      'The final two selections must both retain their backward direction',
  );

  const payload = await page.evaluate(() => window.browserSmoke.capture());
  const wireRecords = JSON.parse(payload);
  const wireOrigins = wireRecords.flatMap(
      (record) => record.o.map((operation) => operation.o),
  );
  for (const [origin, behavior] of [
    ['i', 'keyboard input'],
    ['o', 'directed or multiple selection'],
    ['p', 'paste'],
    ['x', 'cut'],
    ['r', 'drag/drop'],
    ['c', 'IME composition'],
  ]) {
    assert.ok(
        wireOrigins.includes(origin),
        `Serialized payload must contain ${behavior} origin "${origin}"`,
    );
  }
  assert.ok(
      wireRecords.some((record) =>
        record.o.length === 2 &&
        record.o.every((operation) => operation.o === 'i'),
      ),
      'Actual keyboard input at two selections must serialize two changes',
  );

  const evidence = await page.evaluate(
      () => window.browserSmoke.eventEvidence(),
  );
  assertTrustedEvent(evidence.browserEvents, 'keydown');
  assertTrustedEvent(evidence.browserEvents, 'paste');
  assertTrustedEvent(evidence.browserEvents, 'cut');
  assertTrustedEvent(evidence.browserEvents, 'drop');
  assertTrustedEvent(evidence.browserEvents, 'compositionstart');
  assertTrustedEvent(evidence.browserEvents, 'compositionupdate');
  for (const userEvent of [
    'input.type',
    'input.paste',
    'delete.cut',
    'input.drop',
    'input.type.compose',
  ]) {
    assert.ok(
        evidence.transactionEvents.some(
            (value) => value === userEvent || value.startsWith(`${userEvent}.`),
        ),
        `CM6 must annotate a transaction as ${userEvent}`,
    );
  }

  const replayed = await page.evaluate(
      (recording) => window.browserSmoke.play(recording),
      payload,
  );
  assert.equal(replayed.status, 'PAUSE');
  assert.equal(replayed.document, expected.document);
  assert.deepEqual(replayed.selection, expected.selection);

  const umdRoundTrip = await page.evaluate(
      () => window.browserSmoke.umdRoundTrip(),
  );
  assert.deepEqual(umdRoundTrip.exports, {
    CodePlay: 'function',
    CodeRecord: 'function',
  });
  const expectedUmdFinalState = {
    document: 'alpha\nbeta\nUMD',
    selection: {
      mainIndex: 0,
      ranges: [
        {anchor: 2, head: 0},
        {anchor: 14, head: 11},
      ],
    },
  };
  assert.deepEqual(umdRoundTrip.source, expectedUmdFinalState);
  assert.deepEqual(umdRoundTrip.replayed, {
    ...expectedUmdFinalState,
    status: 'PAUSE',
  });
  assert.ok(
      umdRoundTrip.payload.some((record) =>
        record.o.some((operation) => operation.o === 'i'),
      ),
      'The UMD recorder must serialize its content transaction',
  );
  assert.ok(
      umdRoundTrip.payload.some((record) =>
        record.o.length === 2 &&
        record.o.every((operation) => operation.o === 'o'),
      ),
      'The UMD recorder must serialize both directed selections',
  );
  assert.deepEqual(errors, []);

  console.log(
      `Browser smoke passed: ${wireRecords.length} wire records, ` +
      `${expected.document.length} replayed characters, exact directed ` +
      'multi-selection restored.',
  );
} finally {
  await browser?.close();
  await closeServer(server);
}

async function recordingState(page) {
  return page.evaluate(() => window.browserSmoke.recordingState());
}

async function expectDocumentSuffix(page, suffix) {
  await page.waitForFunction(
      (expectedSuffix) => window.browserSmoke
          .recordingState()
          .document
          .endsWith(expectedSuffix),
      suffix,
  );
}

async function moveToDocumentEnd(page) {
  if (process.platform === 'darwin') {
    await page.keyboard.press('Meta+ArrowDown');
  } else {
    await page.keyboard.press('Control+End');
  }
}

async function selectFirstWord(page, word) {
  const position = await page.evaluate((text) => {
    const state = window.browserSmoke.recordingState();
    return state.document.indexOf(text) + 1;
  }, word);
  assert.ok(position > 0, `Expected to find ${word} in the recorder`);
  const coordinates = await page.evaluate(
      (offset) => window.browserSmoke.coordinatesAt(offset),
      position,
  );
  await page.mouse.dblclick(coordinates.x, coordinates.y, {delay: 40});
}

async function dragTextIntoEditor(page, editor) {
  const endCoordinates = await page.evaluate(() => {
    const state = window.browserSmoke.recordingState();
    return window.browserSmoke.coordinatesAt(state.document.length);
  });
  const editorBox = await editor.boundingBox();
  assert.ok(editorBox, 'Recorder content must have a browser layout box');
  await page.locator('#drag-source').dragTo(editor, {
    targetPosition: {
      x: endCoordinates.x - editorBox.x,
      y: endCoordinates.y - editorBox.y,
    },
  });
}

function assertTrustedEvent(events, type) {
  assert.ok(
      events.some((event) => event.type === type && event.isTrusted),
      `Chromium must deliver a trusted ${type} event to the editor`,
  );
}

function startServer(root) {
  return new Promise((resolvePromise, reject) => {
    const instance = createServer(async (request, response) => {
      try {
        const requestURL = new URL(request.url, 'http://127.0.0.1');
        const relativePath = decodeURIComponent(requestURL.pathname)
            .replace(/^\/+/, '');
        const filePath = resolve(root, relativePath);
        if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
          response.writeHead(403).end('Forbidden');
          return;
        }
        const content = await readFile(filePath);
        response.writeHead(200, {
          'Content-Type': contentType(filePath),
          'Cache-Control': 'no-store',
        });
        response.end(content);
      } catch (error) {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(
            error.code === 'ENOENT' ? 'Not found' : 'Server error',
        );
      }
    });
    instance.once('error', reject);
    instance.listen(0, '127.0.0.1', () => resolvePromise(instance));
  });
}

function closeServer(instance) {
  if (instance === undefined) {
    return Promise.resolve();
  }
  return new Promise((resolvePromise, reject) => {
    instance.close((error) => error ? reject(error) : resolvePromise());
  });
}

function contentType(filePath) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
  }[extname(filePath)] || 'application/octet-stream';
}
