import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import {parseArgs} from 'node:util';

import {chromium} from 'playwright';

const {values} = parseArgs({
  options: {
    'block-external-assets': {type: 'boolean', default: false},
    'site-dir': {type: 'string'},
  },
  strict: true,
});

assert.ok(values['site-dir'], 'Usage: --site-dir <assembled-site-directory>');

const siteDirectory = resolve(values['site-dir']);
const siteStats = await stat(siteDirectory);
assert.ok(siteStats.isDirectory(), `Site directory not found: ${siteDirectory}`);

const failures = [];
let browser;
let server;

try {
  server = await startStaticServer(siteDirectory);
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();

  if (values['block-external-assets']) {
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (
        ['http:', 'https:'].includes(requestUrl.protocol) &&
        requestUrl.origin !== origin
      ) {
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
  }

  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => {
    if (
      request.url().startsWith(origin) ||
      ['script', 'stylesheet'].includes(request.resourceType())
    ) {
      failures.push(
          `request: ${request.url()} (${request.failure()?.errorText})`,
      );
    }
  });
  page.on('response', (response) => {
    if (
      response.url().startsWith(origin) &&
      response.status() >= 400
    ) {
      failures.push(`response: ${response.status()} ${response.url()}`);
    }
  });

  await verifyPage(page, `${origin}/`, 'CM6 v2');
  await verifyPage(page, `${origin}/migration/`, 'CM5');
  await verifyPage(page, `${origin}/v1/`, 'CM5 v1');
  await verifyVersionNavigation(page, origin);

  const cm6 = await verifyDemo(page, `${origin}/demo/`, 'cm6');
  const cm5 = await verifyDemo(page, `${origin}/v1/demo/`, 'cm5');

  assert.deepEqual(failures, []);
  console.log(
      'Versioned site browser smoke passed: ' +
      `CM6 replayed ${cm6.characters} characters from ${cm6.entries} ` +
      `entries; CM5 replayed ${cm5.characters} characters from ` +
      `${cm5.entries} entries.`,
  );
} finally {
  await browser?.close();
  await closeServer(server);
}

async function verifyPage(page, url, expectedText) {
  const response = await page.goto(url, {waitUntil: 'domcontentloaded'});
  assert.equal(response?.status(), 200, `${url} must return HTTP 200`);
  await page.locator('h1').waitFor({state: 'visible'});
  await assertAuthorCredit(page);
  const renderedText = (await page.locator('body').innerText())
      .replace(/\s+/g, ' ')
      .toLowerCase();
  assert.ok(
      renderedText.includes(expectedText.toLowerCase()),
      `${url} must identify ${expectedText}`,
  );
  await verifyLocalLinks(page);
}

async function verifyVersionNavigation(page, origin) {
  await page.goto(`${origin}/`);
  await clickVersion(page, 'cm5', '/v1/');
  await clickVersion(page, 'cm6', '/');

  await page.goto(`${origin}/demo/`);
  await clickVersion(page, 'cm5', '/v1/demo/');
  await clickVersion(page, 'cm6', '/demo/');
  await clickHome(page, '/');

  await page.goto(`${origin}/v1/demo/`);
  await clickHome(page, '/v1/');
}

async function clickVersion(page, version, expectedPath) {
  const link = page.locator(
      `nav[aria-label="Editor version"] a[data-version="${version}"]`,
  );
  await link.click();
  await page.waitForURL((url) => url.pathname === expectedPath);
  assert.equal(new URL(page.url()).pathname, expectedPath);
  assert.equal(
      await page.locator(
          `nav[aria-label="Editor version"] a[data-version="${version}"]`,
      ).getAttribute('aria-current'),
      'page',
  );
  await assertAuthorCredit(page);
}

async function clickHome(page, expectedPath) {
  await page.locator('.primary-navigation .nav-home').click();
  await page.waitForURL((url) => url.pathname === expectedPath);
  assert.equal(new URL(page.url()).pathname, expectedPath);
}

async function verifyDemo(page, url, generation) {
  const response = await page.goto(url, {waitUntil: 'domcontentloaded'});
  assert.equal(response?.status(), 200, `${url} must return HTTP 200`);
  await assertAuthorCredit(page);

  const editorSelector = generation === 'cm6' ? '.cm-content' : '.CodeMirror';
  try {
    await page.locator(editorSelector).first().waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  } catch (error) {
    const evidence = failures.length > 0 ?
      `\nObserved browser failures:\n- ${failures.join('\n- ')}` :
      '\nNo browser failure event was captured.';
    throw new Error(
        `${generation} demo did not initialize at ${url}.${evidence}`,
        {cause: error},
    );
  }
  await page.locator('#sample-edit').click();
  await assertEnabled(page, '#capture-records');
  await page.locator('#capture-records').click();

  const entries = Number(await page.locator('#operation-count').innerText());
  assert.ok(entries > 0, `${generation} demo must capture at least one entry`);
  await assertEnabled(page, '#load-operations');
  await page.locator('#load-operations').click();
  await assertEnabled(page, '#play');
  await page.locator('#speed').selectOption('3');
  await page.locator('#play').click();
  await page.locator('#player-state').filter({hasText: 'Complete'}).waitFor({
    state: 'visible',
    timeout: 20_000,
  });

  const documents = await readEditorDocuments(page, generation);
  assert.equal(documents.length, 2, `${generation} demo must render two editors`);
  assert.equal(
      documents[1],
      documents[0],
      `${generation} player must reproduce the recorder document`,
  );
  assert.match(documents[1], /new CodePlay\(replayEditor/);
  await verifyLocalLinks(page);

  return {characters: documents[1].length, entries};
}

async function verifyLocalLinks(page) {
  const pageUrl = new URL(page.url());
  const rawTargets = await page.locator('[href], [src]').evaluateAll(
      (elements) => elements.flatMap((element) => [
        element.getAttribute('href'),
        element.getAttribute('src'),
      ]).filter(Boolean),
  );
  const targets = [...new Set(rawTargets.map((target) => {
    const url = new URL(target, pageUrl);
    url.hash = '';
    return url;
  }).filter((url) => url.origin === pageUrl.origin)
      .map((url) => url.href))];

  for (const target of targets) {
    const response = await fetch(target, {method: 'HEAD'});
    assert.ok(response.ok, `${target} must resolve from ${pageUrl.pathname}`);
  }
}

async function assertEnabled(page, selector) {
  await page.waitForFunction(
      (value) => {
        const element = globalThis.document.querySelector(value);
        return element instanceof globalThis.HTMLButtonElement &&
          !element.disabled;
      },
      selector,
  );
}

async function assertAuthorCredit(page) {
  assert.equal(
      await page.locator('meta[name="author"]').getAttribute('content'),
      'Haoran Yu & Jisuanke Team',
  );
  assert.equal(
      (await page.locator('[data-author-credit]').innerText()).trim(),
      'Haoran Yu & Jisuanke Team',
  );
}

async function readEditorDocuments(page, generation) {
  if (generation === 'cm6') {
    return page.locator('.cm-content').evaluateAll((editors) =>
      editors.map((editor) => [...editor.querySelectorAll('.cm-line')]
          .map((line) => line.textContent)
          .join('\n')),
    );
  }

  return page.locator('.CodeMirror-code').evaluateAll((editors) =>
    editors.map((editor) => [...editor.querySelectorAll('.CodeMirror-line')]
        .map((line) => line.textContent)
        .join('\n')),
  );
}

async function startStaticServer(root) {
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  const staticServer = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://localhost');
      const pathname = decodeURIComponent(requestUrl.pathname);
      let filename = resolve(root, `.${pathname}`);

      if (filename !== root && !filename.startsWith(rootPrefix)) {
        sendText(response, 403, 'Forbidden');
        return;
      }

      let fileStats;
      try {
        fileStats = await stat(filename);
      } catch {
        sendText(response, 404, 'Not found');
        return;
      }

      if (fileStats.isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(301, {location: `${pathname}/${requestUrl.search}`});
          response.end();
          return;
        }
        filename = resolve(filename, 'index.html');
        try {
          fileStats = await stat(filename);
        } catch {
          sendText(response, 404, 'Not found');
          return;
        }
      }

      if (!fileStats.isFile()) {
        sendText(response, 404, 'Not found');
        return;
      }

      response.writeHead(200, {
        'content-length': fileStats.size,
        'content-type': contentType(filename),
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      createReadStream(filename).pipe(response);
    } catch (error) {
      sendText(response, 500, error.message);
    }
  });

  await new Promise((resolvePromise, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', resolvePromise);
  });
  return staticServer;
}

function contentType(filename) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
  })[extname(filename)] || 'application/octet-stream';
}

function sendText(response, status, body) {
  response.writeHead(status, {'content-type': 'text/plain; charset=utf-8'});
  response.end(body);
}

async function closeServer(staticServer) {
  if (!staticServer) {
    return;
  }
  await new Promise((resolvePromise, reject) => {
    staticServer.close((error) => error ? reject(error) : resolvePromise());
  });
}
