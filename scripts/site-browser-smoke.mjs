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

const editorGenerations = {
  cm5: {
    appearance: {
      activeLine: '.recorder-card .CodeMirror-line',
      activeLineGutter: '.recorder-card .CodeMirror-linenumber',
      cursor: '.recorder-card .CodeMirror-cursor',
      editor: '.recorder-card .CodeMirror',
      gutter: '.recorder-card .CodeMirror-gutters',
      line: '.recorder-card .CodeMirror-line',
      lineNumber: '.recorder-card .CodeMirror-linenumber',
      selection: '.recorder-card .CodeMirror-selected',
    },
    content: '.CodeMirror',
    documentEditor: '.CodeMirror-code',
    documentLine: '.CodeMirror-line',
  },
  cm6: {
    appearance: {
      activeLine: '.recorder-card .cm-activeLine',
      activeLineGutter: '.recorder-card .cm-activeLineGutter',
      cursor: '.recorder-card .cm-cursor',
      editor: '.recorder-card .cm-editor',
      gutter: '.recorder-card .cm-gutters',
      line: '.recorder-card .cm-line',
      lineNumber: '.recorder-card .cm-lineNumbers .cm-gutterElement',
      selection: '.recorder-card .cm-selectionBackground',
    },
    content: '.cm-content',
    documentEditor: '.cm-content',
    documentLine: '.cm-line',
  },
};
const responsiveViewports = [
  {name: 'desktop', width: 1280, height: 900, editorHeight: 330},
  {name: 'tablet', width: 768, height: 900},
  {name: 'mobile', width: 320, height: 900, editorHeight: 300},
];
const editorViewports = responsiveViewports.filter(
    (viewport) => viewport.editorHeight,
);
const responsiveRoutes = [
  {path: '/', nav: '.primary-navigation .nav-cta', destination: '/demo/'},
  {path: '/demo/', nav: '.primary-navigation .nav-home', destination: '/'},
  {
    path: '/migration/',
    nav: '.site-header .brand',
    destination: '/',
    task: '.guide-index a[href="#install"]',
    minimumHeaderItems: 1,
  },
  {
    path: '/v1/',
    nav: '.primary-navigation .nav-cta',
    destination: '/v1/demo/',
  },
  {
    path: '/v1/demo/',
    nav: '.primary-navigation .nav-home',
    destination: '/v1/',
  },
];

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

  await verifyPage(page, `${origin}/`, 'CodeMirror 6');
  await verifyPage(page, `${origin}/migration/`, 'CM5');
  await verifyPage(page, `${origin}/v1/`, 'CodeMirror 5');
  await verifyVersionGuidance(page, origin);
  await verifyResponsiveGeometry(page, origin);
  await verifyResponsiveNavigation(page, origin);
  await verifyEditorAppearance(page, origin);

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

async function verifyVersionGuidance(page, origin) {
  await page.goto(`${origin}/`);
  await clickVersionNotice(page, '/v1/');
  await clickVersionNotice(page, '/');

  await page.goto(`${origin}/demo/`);
  await clickVersionNotice(page, '/v1/demo/');
  await clickVersionNotice(page, '/demo/');
  await clickHome(page, '/');

  await page.goto(`${origin}/v1/demo/`);
  await clickHome(page, '/v1/');
}

async function clickVersionNotice(page, expectedPath) {
  assert.equal(
      await page.locator('.site-header .version-switcher').count(),
      0,
      'Version guidance must stay outside the header',
  );
  const link = page.locator('.version-notice a');
  await link.waitFor({state: 'visible'});
  assert.equal(
      await link.evaluate((element) => element.closest('.site-header') === null),
      true,
      'Version guidance must be contextual hero copy',
  );
  await link.focus();
  assert.notEqual(
      await link.evaluate((element) =>
        globalThis.getComputedStyle(element).outlineStyle),
      'none',
      'Version guidance must retain a visible keyboard focus indicator',
  );
  await link.click();
  await page.waitForURL((url) => url.pathname === expectedPath);
  assert.equal(new URL(page.url()).pathname, expectedPath);
  await assertAuthorCredit(page);
}

async function verifyResponsiveGeometry(page, origin) {
  await forEachViewport(page, responsiveViewports, async (viewport) => {
    for (const route of responsiveRoutes) {
      await page.goto(`${origin}${route.path}`, {waitUntil: 'domcontentloaded'});
      await page.locator('h1').waitFor({state: 'visible'});
      const layout = await readHeaderLayout(page);
      assert.ok(
          layout.overflow <= 0,
          `${route.path} must not overflow the ${viewport.name} viewport`,
      );
      assert.ok(
          layout.visibleItems >= (route.minimumHeaderItems ?? 2),
          `${route.path} must retain visible header navigation at ` +
            `${viewport.name} width`,
      );
      assert.deepEqual(
          layout.overlaps,
          [],
          `${route.path} header items must not collide at ${viewport.name} ` +
            'width',
      );

      const notice = page.locator('.version-notice');
      if (await notice.count()) {
        await notice.waitFor({state: 'visible'});
      }
    }
  });
}

async function verifyResponsiveNavigation(page, origin) {
  await forEachViewport(page, responsiveViewports, async () => {
    for (const route of responsiveRoutes) {
      await page.goto(`${origin}${route.path}`, {waitUntil: 'domcontentloaded'});
      await page.locator('h1').waitFor({state: 'visible'});
      if (route.task) {
        await page.locator(route.task).click();
        await page.waitForFunction(() => globalThis.location.hash === '#install');
        await page.locator('#install').waitFor({state: 'visible'});
      }

      const navLink = page.locator(route.nav);
      await navLink.waitFor({state: 'visible'});
      await navLink.click();
      await page.waitForURL((url) => url.pathname === route.destination);
    }
  });
}

async function forEachViewport(page, viewports, verify) {
  const originalViewport = page.viewportSize();
  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await verify(viewport);
    }
  } finally {
    await page.setViewportSize(
        originalViewport ?? {width: 1280, height: 720},
    );
  }
}

async function readHeaderLayout(page) {
  return page.evaluate(() => {
    const browserDocument = globalThis.document;
    const viewportWidth = globalThis.window.innerWidth;
    const items = [
      ...browserDocument.querySelectorAll(
          '.site-header .brand, .site-header nav a',
      ),
    ].filter((element) => {
      const rectangle = element.getBoundingClientRect();
      const style = globalThis.getComputedStyle(element);
      return rectangle.width > 0 && rectangle.height > 0 &&
        style.visibility !== 'hidden';
    }).map((element) => {
      const rectangle = element.getBoundingClientRect();
      return {
        label: element.textContent.replace(/\s+/g, ' ').trim(),
        bottom: rectangle.bottom,
        left: rectangle.left,
        right: rectangle.right,
        top: rectangle.top,
      };
    });
    const overlaps = [];
    for (let first = 0; first < items.length; first += 1) {
      const item = items[first];
      if (item.left < -0.5 || item.right > viewportWidth + 0.5) {
        overlaps.push(`${item.label} leaves the viewport`);
      }
      for (let second = first + 1; second < items.length; second += 1) {
        const other = items[second];
        if (
          Math.min(item.right, other.right) - Math.max(item.left, other.left) >
            0.5 &&
          Math.min(item.bottom, other.bottom) - Math.max(item.top, other.top) >
            0.5
        ) {
          overlaps.push(`${item.label} overlaps ${other.label}`);
        }
      }
    }
    return {
      overflow: Math.max(
          browserDocument.documentElement.scrollWidth,
          browserDocument.body.scrollWidth,
      ) - viewportWidth,
      overlaps,
      visibleItems: items.length,
    };
  });
}

async function verifyEditorAppearance(page, origin) {
  await forEachViewport(page, editorViewports, async (viewport) => {
    const cm6 = await readEditorAppearance(
        page,
        `${origin}/demo/`,
        'cm6',
    );
    const cm5 = await readEditorAppearance(
        page,
        `${origin}/v1/demo/`,
        'cm5',
    );

    assert.deepEqual(
        cm6.paint,
        cm5.paint,
        `${viewport.name} CM6 editor paint must match the CM5 demo`,
    );
    assert.deepEqual(cm6.paint.colors, {
      activeLine: 'rgba(0, 0, 0, 0)',
      activeLineGutter: 'rgba(0, 0, 0, 0)',
      definition: 'rgb(125, 211, 252)',
      globalVariable: 'rgb(226, 232, 240)',
      gutter: 'rgb(5, 12, 25)',
      gutterBorder: 'rgb(51, 65, 85)',
      keyword: 'rgb(196, 181, 253)',
      lineNumber: 'rgb(148, 163, 184)',
      localVariable: 'rgb(125, 211, 252)',
      page: 'rgb(7, 16, 31)',
      property: 'rgb(248, 250, 252)',
      propertyDefinition: 'rgb(248, 250, 252)',
      selection: 'rgba(56, 189, 248, 0.24)',
      string: 'rgb(134, 239, 172)',
      text: 'rgb(226, 232, 240)',
    });
    assert.ok(
        cm6.paint.root.fontFamily.includes('SFMono-Regular'),
        'CM6 editor must use the same project monospace stack as CM5',
    );
    assert.equal(cm6.paint.root.fontSize, '13px');
    assert.equal(cm6.paint.root.lineHeight, '21.45px');

    for (const appearance of [cm6, cm5]) {
      assert.ok(
          Math.abs(appearance.geometry.editorHeight - viewport.editorHeight) <=
            0.5,
          `${appearance.generation} ${viewport.name} editor height must be ` +
            `${viewport.editorHeight}px`,
      );
      assert.ok(
          appearance.geometry.frameLeft >= 0 &&
            appearance.geometry.frameRight <= viewport.width + 0.5,
          `${appearance.generation} editor frame must stay inside the viewport`,
      );
      assert.equal(
          appearance.geometry.scrollWidth,
          viewport.width,
          `${appearance.generation} ${viewport.name} demo must not overflow`,
      );
    }
    assert.ok(
        Math.abs(cm6.geometry.frameWidth - cm5.geometry.frameWidth) <= 1,
        `${viewport.name} editor frame widths must match`,
    );
    assert.ok(
        Math.abs(cm6.geometry.lineTopInset - cm5.geometry.lineTopInset) <= 1,
        `${viewport.name} first-line top insets must match`,
    );
  });
}

async function readEditorAppearance(page, url, generation) {
  const response = await page.goto(url, {waitUntil: 'domcontentloaded'});
  assert.equal(response?.status(), 200, `${url} must return HTTP 200`);

  const selectors = editorGenerations[generation].appearance;

  await page.locator(selectors.editor).waitFor({state: 'visible'});
  const input = page.locator('#recording-editor-input');
  await input.focus();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(
      "\nconst profile = {role: 'maintainer'};\nprofile.role;",
  );
  await page.waitForFunction((selector) =>
    [...globalThis.document.querySelectorAll(selector)].some((line) =>
      line.textContent === 'profile.role;',
    ), selectors.line);
  const appearance = await page.evaluate(({editorGeneration, target}) => {
    const browserDocument = globalThis.document;
    const readComputedStyle = globalThis.getComputedStyle;
    const styleProperties = {
      line: ['backgroundColor', 'fontFamily', 'fontSize', 'lineHeight'],
      lineNumber: ['color', 'fontFamily', 'fontSize', 'lineHeight'],
      root: ['backgroundColor', 'color', 'fontFamily', 'fontSize', 'lineHeight'],
      token: ['color', 'fontStyle', 'fontWeight'],
    };
    const readStyles = (element, properties) => {
      const computed = readComputedStyle(element);
      return Object.fromEntries(properties.map((property) => [
        property,
        computed[property],
      ]));
    };
    const visible = (element) => {
      const rectangle = element.getBoundingClientRect();
      return rectangle.width > 0 && rectangle.height > 0;
    };
    const findToken = (line, text) => {
      const matches = [...line.querySelectorAll('*')].filter((element) =>
        element.children.length === 0 && element.textContent === text,
      );
      if (matches.length === 0) {
        throw new Error(`Unable to find rendered token ${text}`);
      }
      return matches[0];
    };

    const editor = browserDocument.querySelector(target.editor);
    const frame = editor.closest('.editor-frame');
    const gutter = browserDocument.querySelector(target.gutter);
    const activeLine = [...browserDocument.querySelectorAll(target.activeLine)]
        .find(visible);
    const activeLineGutter = [
      ...browserDocument.querySelectorAll(target.activeLineGutter),
    ].find(visible);
    const lines = [...browserDocument.querySelectorAll(target.line)]
        .filter(visible);
    const lineNumber = [...browserDocument.querySelectorAll(target.lineNumber)]
        .find((element) => element.textContent.trim() === '1' && visible(element));
    if (
      !frame || !gutter || !activeLine || !activeLineGutter ||
      lines.length < 7 || !lineNumber
    ) {
      throw new Error(`Incomplete ${editorGeneration} editor rendering`);
    }

    const profileDefinitionLine = lines.find((line) =>
      line.textContent.includes('const profile ='),
    );
    const profileAccessLine = lines.find((line) =>
      line.textContent === 'profile.role;',
    );
    const globalReferenceLine = lines.find((line) =>
      line.textContent === "greet('developer');",
    );
    if (!profileDefinitionLine || !profileAccessLine || !globalReferenceLine) {
      throw new Error(`Incomplete ${editorGeneration} semantic token sample`);
    }

    const editorStyle = readStyles(editor, styleProperties.root);
    const activeLineStyle = readComputedStyle(activeLine);
    const activeLineGutterStyle = readComputedStyle(activeLineGutter);
    const lineStyle = readStyles(lines[0], styleProperties.line);
    const gutterStyle = readComputedStyle(gutter);
    const lineNumberStyle = readStyles(lineNumber, styleProperties.lineNumber);
    const keyword = readStyles(
        findToken(lines[0], 'function'),
        styleProperties.token,
    );
    const definition = readStyles(
        findToken(lines[0], 'greet'),
        styleProperties.token,
    );
    const localVariable = readStyles(
        findToken(lines[1], 'name'),
        styleProperties.token,
    );
    const globalVariable = readStyles(
        findToken(globalReferenceLine, 'greet'),
        styleProperties.token,
    );
    const propertyDefinition = readStyles(
        findToken(profileDefinitionLine, 'role'),
        styleProperties.token,
    );
    const property = readStyles(
        findToken(profileAccessLine, 'role'),
        styleProperties.token,
    );
    const string = readStyles(
        findToken(lines[1], "'Hello, '"),
        styleProperties.token,
    );
    const editorRectangle = editor.getBoundingClientRect();
    const frameRectangle = frame.getBoundingClientRect();
    const lineRectangle = lines[0].getBoundingClientRect();

    return {
      generation: editorGeneration,
      geometry: {
        editorHeight: editorRectangle.height,
        frameLeft: frameRectangle.left,
        frameRight: frameRectangle.right,
        frameWidth: frameRectangle.width,
        lineTopInset: lineRectangle.top - editorRectangle.top,
        scrollWidth: browserDocument.documentElement.scrollWidth,
      },
      paint: {
        colors: {
          activeLine: activeLineStyle.backgroundColor,
          activeLineGutter: activeLineGutterStyle.backgroundColor,
          definition: definition.color,
          globalVariable: globalVariable.color,
          gutter: gutterStyle.backgroundColor,
          gutterBorder: gutterStyle.borderRightColor,
          keyword: keyword.color,
          lineNumber: lineNumberStyle.color,
          localVariable: localVariable.color,
          page: editorStyle.backgroundColor,
          property: property.color,
          propertyDefinition: propertyDefinition.color,
          string: string.color,
          text: editorStyle.color,
        },
        activeLine: {backgroundColor: activeLineStyle.backgroundColor},
        activeLineGutter: {
          backgroundColor: activeLineGutterStyle.backgroundColor,
        },
        definition,
        globalVariable,
        gutter: {
          backgroundColor: gutterStyle.backgroundColor,
          borderRightColor: gutterStyle.borderRightColor,
        },
        keyword,
        line: lineStyle,
        lineNumber: lineNumberStyle,
        localVariable,
        property,
        propertyDefinition,
        root: editorStyle,
        string,
      },
    };
  }, {editorGeneration: generation, target: selectors});

  await page.keyboard.press('Home');
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  const selection = await readVisibleElementStyle(
      page,
      selectors.selection,
      ['backgroundColor'],
  );

  await page.keyboard.press('ArrowLeft');
  const cursor = await readVisibleElementStyle(
      page,
      selectors.cursor,
      ['borderLeftColor', 'borderLeftWidth'],
      {requireWidth: false},
  );

  appearance.paint.colors.selection = selection.backgroundColor;
  appearance.paint.cursor = cursor;
  appearance.paint.selection = selection;
  return appearance;
}

async function readVisibleElementStyle(
    page,
    selector,
    properties,
    {requireWidth = true} = {},
) {
  const options = {properties, requireWidth, selector};
  await page.waitForFunction((target) =>
    [...globalThis.document.querySelectorAll(target.selector)]
        .some((element) => {
          const rectangle = element.getBoundingClientRect();
          const style = globalThis.getComputedStyle(element);
          return (!target.requireWidth || rectangle.width > 0) &&
            rectangle.height > 0 && style.visibility !== 'hidden';
        }), options);
  return page.locator(selector).evaluateAll((elements, target) => {
    const element = elements.find((candidate) => {
      const rectangle = candidate.getBoundingClientRect();
      const style = globalThis.getComputedStyle(candidate);
      return (!target.requireWidth || rectangle.width > 0) &&
        rectangle.height > 0 && style.visibility !== 'hidden';
    });
    const style = globalThis.getComputedStyle(element);
    return Object.fromEntries(target.properties.map((property) => [
      property,
      style[property],
    ]));
  }, options);
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

  const editorSelector = editorGenerations[generation].content;
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
  const config = editorGenerations[generation];
  return page.locator(config.documentEditor).evaluateAll(
      (editors, lineSelector) => editors.map((editor) => [
        ...editor.querySelectorAll(lineSelector),
      ].map((line) => line.textContent).join('\n')),
      config.documentLine,
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
