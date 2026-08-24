/* global document, window */

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from 'playwright';

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
);
const publicNpmRegistry = 'https://registry.npmjs.org/';
const publicNpmEnvironment = {
  ...process.env,
  npm_config_registry: publicNpmRegistry,
};
delete publicNpmEnvironment.NPM_CONFIG_REGISTRY;

const packageMetadata = JSON.parse(await readFile(
    join(repositoryRoot, 'package.json'),
    'utf8',
));
const releaseArtifacts = JSON.parse(await readFile(join(
    repositoryRoot,
    'scripts',
    'fixtures',
    'release-artifacts.json',
), 'utf8'));
assert.equal(releaseArtifacts.publicNpmRegistry, publicNpmRegistry);

const legacyVersions = ['1.1.5', '1.1.8'];
const codeMirror5ArtifactMetadata = releaseArtifacts.codeMirror5Artifact;
assert.ok(codeMirror5ArtifactMetadata, 'CM5 has no reviewed release artifact');
assert.equal(
    codeMirror5ArtifactMetadata.provenance,
    'npm-registry',
    'CM5 is not pinned to the public npm registry',
);
assert.match(codeMirror5ArtifactMetadata.version, /^\d+\.\d+\.\d+$/);
assert.match(
    codeMirror5ArtifactMetadata.integrity,
    /^sha512-[A-Za-z0-9+/]+={0,2}$/,
);
const codeMirror5Version = codeMirror5ArtifactMetadata.version;
const codeMirror5Integrity = codeMirror5ArtifactMetadata.integrity;
const expectedPayload =
  '[{"t":[10,20],"l":2,"o":[{"o":"i","i":[0,0],"a":"XY"}]},' +
  '{"t":30,"o":[{"o":"d","i":[[0,4],[0,5]]}]},' +
  '{"t":40,"o":[{"activity":{"kind":"golden","value":1},"o":"e"}]},' +
  '{"t":50,"o":[' +
  '{"o":"o","i":[[0,3],[0,0]]},' +
  '{"o":"o","i":[[1,3],[1,0]]}' +
  ']}]';
const expectedState = {
  document: 'XYab\ndef',
  selection: {
    mainIndex: 1,
    ranges: [
      {anchor: 3, head: 0},
      {anchor: 8, head: 5},
    ],
  },
};
const expectedActivities = [{kind: 'golden', value: 1}];
const expectedDuration = 50;
const exactV2RegistrySpec =
  `${packageMetadata.name}@${packageMetadata.version}`;
const v2PackageSpec = process.env.V2_PACKAGE_SPEC;
const v2ExpectedIntegrity = process.env.V2_EXPECTED_INTEGRITY;

validateV2Environment();

const temporaryRoot = await mkdtemp(join(
    tmpdir(),
    'codemirror-record-browser-cross-generation-',
));
let browser;

try {
  const artifactDirectory = join(temporaryRoot, 'artifacts');
  await mkdir(artifactDirectory);

  const legacyArtifacts = new Map();
  for (const version of legacyVersions) {
    const reviewed = releaseArtifacts.legacyArtifacts[version];
    assert.ok(reviewed, `v${version} has no reviewed release artifact`);
    assert.equal(
        reviewed.provenance,
        'npm-registry',
        `v${version} is not pinned to the public npm registry`,
    );
    legacyArtifacts.set(version, await prepareExactArtifact({
      expectedIntegrity: reviewed.integrity,
      expectedName: packageMetadata.name,
      expectedVersion: version,
      packageSpec: `${packageMetadata.name}@${version}`,
      temporaryDirectory: artifactDirectory,
    }));
  }

  const codeMirror5Artifact = await prepareExactArtifact({
    expectedIntegrity: codeMirror5Integrity,
    expectedName: 'codemirror',
    expectedVersion: codeMirror5Version,
    packageSpec: `codemirror@${codeMirror5Version}`,
    temporaryDirectory: artifactDirectory,
  });
  const v2Artifact = await prepareV2Artifact(artifactDirectory);
  const installed = await installBrowserArtifacts({
    codeMirror5Artifact,
    legacyArtifacts,
    temporaryRoot,
    v2Artifact,
  });

  browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  const runtimes = [
    await createLegacyRuntime(
        context,
        installed,
        'cm5-v1.1.5',
        '1.1.5',
    ),
    await createLegacyRuntime(
        context,
        installed,
        'cm5-v1.1.8',
        '1.1.8',
    ),
    await createModernRuntime(context, installed),
  ];

  const captures = new Map();
  for (const runtime of runtimes) {
    const capture = await runtime.page.evaluate(
        () => window.browserCrossGeneration.capture(),
    );
    assert.equal(
        capture.payload,
        expectedPayload,
        `${runtime.name} recorder changed the established wire bytes`,
    );
    assert.equal(capture.document, expectedState.document, runtime.name);
    assert.deepEqual(capture.selection, expectedState.selection, runtime.name);
    captures.set(runtime.name, capture.payload);
  }

  let playbackCells = 0;
  for (const producer of runtimes) {
    const payload = captures.get(producer.name);
    for (const consumer of runtimes) {
      const result = await consumer.page.evaluate(
          (wireBytes) => window.browserCrossGeneration.play(wireBytes),
          payload,
      );
      const direction = `${producer.name} -> ${consumer.name}`;
      assert.equal(
          result.payload,
          payload,
          `${direction} transformed the wire string`,
      );
      assert.equal(result.document, expectedState.document, direction);
      assert.equal(result.duration, expectedDuration, direction);
      assert.deepEqual(result.selection, expectedState.selection, direction);
      assert.deepEqual(result.activities, expectedActivities, direction);
      playbackCells++;
    }
  }
  assert.equal(
      playbackCells,
      9,
      'The 3 × 3 producer/consumer playback matrix must remain complete',
  );

  for (const runtime of runtimes) {
    assert.deepEqual(
        runtime.errors,
        [],
        `${runtime.name} emitted browser errors`,
    );
  }

  console.log(
      'Browser cross-generation interoperability passed: three exact ' +
      `recorders and ${playbackCells} unchanged-wire playback cells.`,
  );
} finally {
  await browser?.close();
  await rm(temporaryRoot, {recursive: true, force: true});
}

function validateV2Environment() {
  if (v2PackageSpec === undefined) {
    assert.equal(
        v2ExpectedIntegrity,
        undefined,
        'V2_EXPECTED_INTEGRITY requires V2_PACKAGE_SPEC',
    );
    return;
  }

  assert.match(
      v2ExpectedIntegrity ?? '',
      /^sha512-[A-Za-z0-9+/]+={0,2}$/,
      'V2_EXPECTED_INTEGRITY must be an npm sha512 SRI',
  );
  assert.ok(
      v2PackageSpec === exactV2RegistrySpec ||
        (isAbsolute(v2PackageSpec) && v2PackageSpec.endsWith('.tgz')),
      'V2_PACKAGE_SPEC must be the exact registry version or an absolute .tgz',
  );
}

async function prepareV2Artifact(temporaryDirectory) {
  if (v2PackageSpec !== undefined) {
    return prepareExactArtifact({
      expectedIntegrity: v2ExpectedIntegrity,
      expectedName: packageMetadata.name,
      expectedVersion: packageMetadata.version,
      packageSpec: v2PackageSpec,
      temporaryDirectory,
    });
  }

  const packResult = JSON.parse(runNpm([
    'pack',
    '--json',
    '--pack-destination',
    temporaryDirectory,
  ], repositoryRoot));
  assert.equal(packResult.length, 1, 'npm pack must return one v2 artifact');
  const [packedArtifact] = packResult;
  assert.equal(packedArtifact.name, packageMetadata.name);
  assert.equal(packedArtifact.version, packageMetadata.version);
  assert.match(
      packedArtifact.integrity,
      /^sha512-[A-Za-z0-9+/]+={0,2}$/,
      'locally packed v2 has no npm sha512 SRI',
  );
  const tarball = join(temporaryDirectory, packedArtifact.filename);
  assert.equal(await integrityOfFile(tarball), packedArtifact.integrity);
  return {integrity: packedArtifact.integrity, tarball};
}

async function prepareExactArtifact({
  expectedIntegrity,
  expectedName,
  expectedVersion,
  packageSpec,
  temporaryDirectory,
}) {
  const exactRegistrySpec = `${expectedName}@${expectedVersion}`;
  const fromRegistry = packageSpec === exactRegistrySpec;
  if (fromRegistry) {
    const registryMetadata = JSON.parse(runNpm([
      'view',
      packageSpec,
      'name',
      'version',
      'dist.integrity',
      '--json',
    ], repositoryRoot));
    assert.equal(registryMetadata.name, expectedName);
    assert.equal(registryMetadata.version, expectedVersion);
    assert.equal(registryMetadata['dist.integrity'], expectedIntegrity);
  } else {
    assert.ok(isAbsolute(packageSpec) && packageSpec.endsWith('.tgz'));
    assert.equal(await integrityOfFile(packageSpec), expectedIntegrity);
  }

  const packResult = JSON.parse(runNpm([
    'pack',
    packageSpec,
    '--json',
    '--pack-destination',
    temporaryDirectory,
  ], repositoryRoot));
  assert.equal(packResult.length, 1, `npm pack returned ${packageSpec}`);
  const [packedArtifact] = packResult;
  assert.equal(packedArtifact.name, expectedName);
  assert.equal(packedArtifact.version, expectedVersion);
  assert.equal(packedArtifact.integrity, expectedIntegrity);
  const downloadedTarball = join(
      temporaryDirectory,
      packedArtifact.filename,
  );
  const tarball = fromRegistry ? downloadedTarball : packageSpec;
  assert.equal(await integrityOfFile(tarball), expectedIntegrity);
  return {integrity: expectedIntegrity, tarball};
}

async function installBrowserArtifacts({
  codeMirror5Artifact,
  legacyArtifacts,
  temporaryRoot,
  v2Artifact,
}) {
  const fixture = join(temporaryRoot, 'installed');
  await mkdir(fixture);
  await writeFile(join(fixture, 'package.json'), JSON.stringify({
    private: true,
  }));
  runNpm([
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--omit=peer',
    `cm-record-v115@${legacyArtifacts.get('1.1.5').tarball}`,
    `cm-record-v118@${legacyArtifacts.get('1.1.8').tarball}`,
    `cm-record-v2@${v2Artifact.tarball}`,
    `codemirror-v5@${codeMirror5Artifact.tarball}`,
  ], fixture);

  await assertInstalledPackage(fixture, 'cm-record-v115', {
    name: packageMetadata.name,
    version: '1.1.5',
  });
  await assertInstalledPackage(fixture, 'cm-record-v118', {
    name: packageMetadata.name,
    version: '1.1.8',
  });
  await assertInstalledPackage(fixture, 'cm-record-v2', {
    name: packageMetadata.name,
    version: packageMetadata.version,
  });
  await assertInstalledPackage(fixture, 'codemirror-v5', {
    name: 'codemirror',
    version: codeMirror5Version,
  });
  await assertPublicRegistryResolutions(fixture, new Set([
    'node_modules/cm-record-v115',
    'node_modules/cm-record-v118',
    'node_modules/cm-record-v2',
    'node_modules/codemirror-v5',
  ]));

  return {
    codeMirror5Css: join(
        fixture,
        'node_modules',
        'codemirror-v5',
        'lib',
        'codemirror.css',
    ),
    codeMirror5Script: join(
        fixture,
        'node_modules',
        'codemirror-v5',
        'lib',
        'codemirror.js',
    ),
    fixtureBundle: join(
        repositoryRoot,
        'test',
        'browser',
        'fixture.bundle.js',
    ),
    packageScripts: new Map([
      ['1.1.5', join(
        fixture,
        'node_modules',
        'cm-record-v115',
        'dist',
        'main.js',
      )],
      ['1.1.8', join(
        fixture,
        'node_modules',
        'cm-record-v118',
        'dist',
        'main.js',
      )],
      ['2.0.0', join(
        fixture,
        'node_modules',
        'cm-record-v2',
        'dist',
        'main.js',
      )],
    ]),
  };
}

async function assertInstalledPackage(fixture, alias, expected) {
  const installedMetadata = JSON.parse(await readFile(join(
      fixture,
      'node_modules',
      alias,
      'package.json',
  ), 'utf8'));
  assert.equal(installedMetadata.name, expected.name, `${alias} package name`);
  assert.equal(
      installedMetadata.version,
      expected.version,
      `${alias} package version`,
  );
}

async function assertPublicRegistryResolutions(fixture, localPackages) {
  const lockfile = JSON.parse(await readFile(
      join(fixture, 'package-lock.json'),
      'utf8',
  ));
  for (const [packagePath, metadata] of Object.entries(
      lockfile.packages ?? {},
  )) {
    if (metadata.resolved === undefined) {
      continue;
    }
    if (localPackages.has(packagePath)) {
      assert.ok(
          metadata.resolved.startsWith('file:'),
          `${packagePath} must resolve from its verified tarball`,
      );
      continue;
    }
    assert.ok(
        metadata.resolved.startsWith(publicNpmRegistry),
        `${packagePath} resolved outside the public registry`,
    );
  }
}

async function createLegacyRuntime(context, installed, name, version) {
  const page = await context.newPage();
  const errors = observePage(page);
  await page.setContent('<main></main>');
  await page.addStyleTag({path: installed.codeMirror5Css});
  await page.addScriptTag({path: installed.codeMirror5Script});
  await page.addScriptTag({path: installed.packageScripts.get(version)});
  await page.evaluate(installLegacyBrowserAdapter);
  const exports_ = await page.evaluate(() => ({
    CodeMirror: typeof window.CodeMirror,
    CodePlay: typeof window.CodePlay,
    CodeRecord: typeof window.CodeRecord,
  }));
  assert.deepEqual(exports_, {
    CodeMirror: 'function',
    CodePlay: 'function',
    CodeRecord: 'function',
  }, name);
  return {errors, name, page};
}

async function createModernRuntime(context, installed) {
  const page = await context.newPage();
  const errors = observePage(page);
  await page.setContent(`
    <main>
      <p id="drag-source" draggable="true">DROP</p>
      <div id="record-editor"></div>
      <div id="play-editor"></div>
    </main>
  `);
  await page.addScriptTag({path: installed.fixtureBundle});
  await page.waitForFunction(() => window.browserSmokeReady === true);
  await page.addScriptTag({path: installed.packageScripts.get('2.0.0')});
  const exports_ = await page.evaluate(() => ({
    CodePlay: typeof window.CodePlay,
    CodeRecord: typeof window.CodeRecord,
    fixture: typeof window.browserCrossGeneration,
  }));
  assert.deepEqual(exports_, {
    CodePlay: 'function',
    CodeRecord: 'function',
    fixture: 'object',
  }, 'cm6-v2.0.0');
  return {errors, name: 'cm6-v2.0.0', page};
}

function observePage(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => {
    errors.push(`request: ${request.url()} (${request.failure()?.errorText})`);
  });
  return errors;
}

function installLegacyBrowserAdapter() {
  const initialDocument = 'abc\ndef';

  function createEditor() {
    const host = document.createElement('div');
    host.dataset.browserFixture = 'cross-generation';
    document.body.append(host);
    const editor = window.CodeMirror(host, {value: initialDocument});
    return {editor, host};
  }

  function removeEditor(editor, host) {
    editor.getWrapperElement().remove();
    host.remove();
  }

  function selectionJSON(editor) {
    const ranges = editor.listSelections().map((range) => ({
      anchor: editor.indexFromPos(range.anchor),
      head: editor.indexFromPos(range.head),
    }));
    const primary = {
      anchor: editor.indexFromPos(editor.getCursor('anchor')),
      head: editor.indexFromPos(editor.getCursor('head')),
    };
    return {
      mainIndex: ranges.findIndex((range) =>
        range.anchor === primary.anchor && range.head === primary.head,
      ),
      ranges,
    };
  }

  function withControlledClock(callback) {
    const RealDate = window.Date;
    const initialTime = RealDate.parse('2026-01-01T00:00:00Z');
    let currentTime = initialTime;

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

    window.Date = ControlledDate;
    try {
      return callback((relativeTime, action) => {
        currentTime = initialTime + relativeTime;
        return action();
      });
    } finally {
      window.Date = RealDate;
    }
  }

  window.browserCrossGeneration = {
    capture() {
      const {editor, host} = createEditor();
      try {
        return withControlledClock((at) => {
          const recorder = new window.CodeRecord(editor);
          recorder.listen();
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
          at(40, () => recorder.recordExtraActivity({
            kind: 'golden',
            value: 1,
          }));
          at(50, () => editor.setSelections([
            {
              anchor: editor.posFromIndex(3),
              head: editor.posFromIndex(0),
            },
            {
              anchor: editor.posFromIndex(8),
              head: editor.posFromIndex(5),
            },
          ], 1));
          return {
            document: editor.getValue(),
            payload: recorder.getRecords(),
            selection: selectionJSON(editor),
          };
        });
      } finally {
        removeEditor(editor, host);
      }
    },

    play(payload) {
      if (typeof payload !== 'string') {
        throw new TypeError('Cross-generation payload must remain a string');
      }
      const {editor, host} = createEditor();
      const activities = [];
      const player = new window.CodePlay(editor, {
        extraActivityHandler(activity) {
          activities.push(activity);
        },
        maxDelay: 1,
        speed: 100,
      });
      player.addOperations(payload);
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          removeEditor(editor, host);
          reject(new Error(
              'Cross-generation CM5 playback did not finish within 5 seconds',
          ));
        }, 5000);
        player.once('end', () => {
          window.clearTimeout(timeout);
          const result = {
            activities,
            document: editor.getValue(),
            duration: player.getDuration(),
            payload,
            selection: selectionJSON(editor),
          };
          player.pause();
          removeEditor(editor, host);
          resolve(result);
        });
        player.play();
      });
    },
  };
}

function runNpm(arguments_, cwd) {
  return execFileSync('npm', [
    ...arguments_,
    '--registry',
    publicNpmRegistry,
    `--@codemirror:registry=${publicNpmRegistry}`,
  ], {
    cwd,
    encoding: 'utf8',
    env: publicNpmEnvironment,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

async function integrityOfFile(path) {
  return 'sha512-' + createHash('sha512')
      .update(await readFile(path))
      .digest('base64');
}
