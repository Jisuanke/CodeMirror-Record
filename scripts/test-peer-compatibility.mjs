import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicNpmRegistry = 'https://registry.npmjs.org/';
const publicNpmEnvironment = {
  ...process.env,
  npm_config_registry: publicNpmRegistry,
};
delete publicNpmEnvironment.NPM_CONFIG_REGISTRY;
const packageMetadata = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
);
const releaseArtifacts = JSON.parse(await readFile(join(
    root,
    'scripts',
    'fixtures',
    'release-artifacts.json',
), 'utf8'));
assert.equal(releaseArtifacts.publicNpmRegistry, publicNpmRegistry);
const legacyCandidateVersion = process.env.LEGACY_CANDIDATE_VERSION ??
  releaseArtifacts.legacyCandidateVersion;
assert.match(
    legacyCandidateVersion,
    /^\d+\.\d+\.\d+$/,
    'LEGACY_CANDIDATE_VERSION must be an exact semantic version',
);
const exactLegacyCandidateSpec =
  `${packageMetadata.name}@${legacyCandidateVersion}`;
const exactV2RegistrySpec =
  `${packageMetadata.name}@${packageMetadata.version}`;
const v2PackageSpec = process.env.V2_PACKAGE_SPEC;
const v2ExpectedIntegrity = process.env.V2_EXPECTED_INTEGRITY;
const legacyPackageOverride = process.env.LEGACY_PACKAGE_SPEC;
const legacyExpectedIntegrity = process.env.LEGACY_EXPECTED_INTEGRITY;
validateExactPackageEnvironment({
  expectedIntegrity: v2ExpectedIntegrity,
  expectedIntegrityVariable: 'V2_EXPECTED_INTEGRITY',
  exactRegistrySpec: exactV2RegistrySpec,
  packageSpec: v2PackageSpec,
  packageSpecVariable: 'V2_PACKAGE_SPEC',
});
validateExactPackageEnvironment({
  expectedIntegrity: legacyExpectedIntegrity,
  expectedIntegrityVariable: 'LEGACY_EXPECTED_INTEGRITY',
  exactRegistrySpec: exactLegacyCandidateSpec,
  packageSpec: legacyPackageOverride,
  packageSpecVariable: 'LEGACY_PACKAGE_SPEC',
});
const temporaryRoot = await mkdtemp(join(tmpdir(), 'codemirror-record-'));
const legacyInteroperabilityTest = await readFile(join(
    root,
    'scripts',
    'fixtures',
    'legacy-interoperability.mjs',
), 'utf8');
const legacyGoldenGenerator = await readFile(join(
    root,
    'scripts',
    'fixtures',
    'generate-legacy-golden.mjs',
), 'utf8');
const domGlobalsInstaller = await readFile(join(
    root,
    'scripts',
    'fixtures',
    'install-dom-globals.mjs',
), 'utf8');
const committedLegacyCorpusVersions = ['1.1.5', '1.1.6', '1.1.7', '1.1.8'];
const committedLegacyCorpora = new Map(await Promise.all(
    committedLegacyCorpusVersions.map(async (version) => {
      const bytes = await readFile(join(
          root,
          'scripts',
          'fixtures',
          `legacy-v${version}-golden.json`,
      ), 'utf8');
      return [version, {bytes, value: JSON.parse(bytes)}];
    }),
));
const legacyGolden = committedLegacyCorpora.get('1.1.6').value;
// Explicit maintenance path: select one version and review stdout before
// replacing the committed corpus. Normal CI validates every committed byte and
// never writes. Keep the bare flag as an alias for the historical v1.1.6
// command, while maintained releases use an explicit version.
const printLegacyGoldenArguments = process.argv.filter((argument) =>
  argument === '--print-legacy-golden' ||
  argument.startsWith('--print-legacy-golden='),
);
assert.ok(
    printLegacyGoldenArguments.length <= 1,
    'select at most one --print-legacy-golden version',
);
const printLegacyGoldenVersion = printLegacyGoldenArguments.length === 0 ?
  undefined : printLegacyGoldenArguments[0] === '--print-legacy-golden' ?
    '1.1.6' :
    printLegacyGoldenArguments[0].slice('--print-legacy-golden='.length);
if (printLegacyGoldenVersion !== undefined) {
  assert.ok(
      committedLegacyCorpusVersions.includes(printLegacyGoldenVersion),
      `unknown legacy golden version ${printLegacyGoldenVersion}`,
  );
}

const scenarios = [
  {
    name: 'minimum-core',
    dependencies: [
      '@codemirror/state@6.0.0',
      '@codemirror/view@6.0.0',
    ],
  },
  {
    name: 'latest-core',
    dependencies: [
      '@codemirror/state@latest',
      '@codemirror/view@latest',
    ],
  },
  {
    name: 'umbrella-package',
    dependencies: ['codemirror@6'],
  },
];

// Every published stable CM5 release through the maintained v1.1.8 baseline
// stays in the executable matrix.
const legacyVersions = Object.keys(releaseArtifacts.legacyArtifacts);
const requestedLegacyVersions = process.argv
    .filter((argument) => argument.startsWith('--legacy-version='))
    .map((argument) => argument.slice('--legacy-version='.length));
for (const version of requestedLegacyVersions) {
  assert.ok(
      legacyVersions.includes(version),
      `unknown focused legacy version ${version}`,
  );
}
const legacyVersionsUnderTest = requestedLegacyVersions.length > 0 ?
  requestedLegacyVersions : legacyVersions;
if (legacyPackageOverride !== undefined) {
  assert.ok(
      legacyVersionsUnderTest.includes(legacyCandidateVersion),
      `LEGACY_PACKAGE_SPEC requires v${legacyCandidateVersion} in the ` +
        'selected matrix',
  );
}
if (printLegacyGoldenVersion !== undefined) {
  assert.ok(
      legacyVersionsUnderTest.includes(printLegacyGoldenVersion),
      '--print-legacy-golden must select a version in the test matrix',
  );
}
if (printLegacyGoldenVersion === legacyCandidateVersion) {
  assert.ok(
      legacyPackageOverride,
      `printing the v${legacyCandidateVersion} corpus requires the exact ` +
        'registry artifact or retained tarball',
  );
}

try {
  const legacyCandidate = legacyPackageOverride === undefined ?
    undefined :
    await prepareExactPackageArtifact({
      artifactLabel: `retained v${legacyCandidateVersion} tarball`,
      expectedIntegrity: legacyExpectedIntegrity,
      expectedIntegrityVariable: 'LEGACY_EXPECTED_INTEGRITY',
      expectedName: packageMetadata.name,
      expectedVersion: legacyCandidateVersion,
      exactRegistrySpec: exactLegacyCandidateSpec,
      packageSpec: legacyPackageOverride,
      registryArtifactLabel:
        `downloaded v${legacyCandidateVersion} tarball`,
      temporaryRoot,
    });
  if (legacyCandidate !== undefined) {
    const pinnedCandidate =
      releaseArtifacts.legacyArtifacts[legacyCandidateVersion];
    if (pinnedCandidate?.integrity !== undefined) {
      assert.equal(
          legacyExpectedIntegrity,
          pinnedCandidate.integrity,
          `LEGACY_EXPECTED_INTEGRITY differs from the reviewed ` +
            `v${legacyCandidateVersion} release artifact`,
      );
    }
  }

  const legacyArtifactCache = new Map();
  const getLegacyArtifact = async (version) => {
    if (legacyArtifactCache.has(version)) {
      return legacyArtifactCache.get(version);
    }
    if (
      version === legacyCandidateVersion &&
      legacyCandidate !== undefined
    ) {
      legacyArtifactCache.set(version, legacyCandidate);
      return legacyCandidate;
    }
    const reviewedArtifact = releaseArtifacts.legacyArtifacts[version];
    assert.ok(reviewedArtifact, `v${version} has no reviewed artifact pin`);
    assert.equal(
        reviewedArtifact.provenance,
        'npm-registry',
        `v${version} requires LEGACY_PACKAGE_SPEC until its reviewed ` +
          'artifact is available from the public npm registry',
    );
    assert.match(
        reviewedArtifact.integrity,
        /^sha512-[A-Za-z0-9+/]+={0,2}$/,
        `v${version} has no valid reviewed artifact SRI`,
    );
    const artifact = await prepareExactPackageArtifact({
      artifactLabel: `retained v${version} tarball`,
      expectedIntegrity: reviewedArtifact.integrity,
      expectedIntegrityVariable:
        `reviewed v${version} artifact integrity`,
      expectedName: packageMetadata.name,
      expectedVersion: version,
      exactRegistrySpec: `${packageMetadata.name}@${version}`,
      packageSpec: `${packageMetadata.name}@${version}`,
      registryArtifactLabel: `downloaded v${version} tarball`,
      temporaryRoot,
    });
    legacyArtifactCache.set(version, artifact);
    return artifact;
  };

  let packedArtifact;
  let tarball;
  if (v2PackageSpec === undefined) {
    const packResult = JSON.parse(runNpm([
      'pack',
      '--json',
      '--pack-destination',
      temporaryRoot,
    ], root));
    assert.equal(packResult.length, 1, 'npm pack must return one v2 artifact');
    [packedArtifact] = packResult;
    tarball = join(temporaryRoot, packedArtifact.filename);
  } else {
    const exactV2Artifact = await prepareExactPackageArtifact({
      artifactLabel: 'retained v2 tarball',
      expectedIntegrity: v2ExpectedIntegrity,
      expectedIntegrityVariable: 'V2_EXPECTED_INTEGRITY',
      expectedName: packageMetadata.name,
      expectedVersion: packageMetadata.version,
      exactRegistrySpec: exactV2RegistrySpec,
      packageSpec: v2PackageSpec,
      registryArtifactLabel: 'downloaded v2 tarball',
      temporaryRoot,
    });
    packedArtifact = exactV2Artifact.packedArtifact;
    tarball = exactV2Artifact.tarball;
  }
  const packedFilePaths = packedArtifact.files.map((file) => file.path);
  const packedFiles = new Set(packedFilePaths);
  assert.deepEqual(
      [...packedFilePaths].sort(),
      [...releaseArtifacts.v2PackageFiles].sort(),
      'packed v2 artifact file manifest differs from the reviewed allowlist',
  );
  for (const requiredFile of [
    'LICENSE',
    'README.md',
    'docs/COMPRESSION.md',
    'docs/MIGRATING.md',
    'docs/migration-contract.json',
    'docs/RELEASING.md',
    'dist/index.cjs',
    'dist/index.mjs',
    'dist/main.js',
    'src/index.d.ts',
  ]) {
    assert.ok(packedFiles.has(requiredFile), `${requiredFile} is not packed`);
  }

  for (const scenario of scenarios) {
    const fixture = join(temporaryRoot, scenario.name);
    await mkdir(fixture);
    await writeFile(join(fixture, 'package.json'), JSON.stringify({
      private: true,
      type: 'module',
    }));
    await writeFile(
        join(fixture, 'install-dom-globals.mjs'),
        domGlobalsInstaller,
    );
    await writeFile(join(fixture, 'smoke.mjs'), getSmokeTest());
    runNpm([
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      tarball,
      'jsdom@29.1.1',
      ...scenario.dependencies,
    ], fixture);
    await assertPublicRegistryResolutions(fixture, new Set([
      'node_modules/codemirror-record',
    ]));
    const dependencyTree = JSON.parse(runNpm([
      'ls',
      '@codemirror/state',
      '@codemirror/view',
      '--all',
      '--json',
    ], fixture));
    assertSingleCodeMirrorInstallation(
        dependencyTree,
        '@codemirror/state',
        scenario.name,
    );
    assertSingleCodeMirrorInstallation(
        dependencyTree,
        '@codemirror/view',
        scenario.name,
    );
    execFileSync(process.execPath, ['smoke.mjs'], {
      cwd: fixture,
      env: publicNpmEnvironment,
      stdio: 'inherit',
    });
  }

  for (const legacyVersion of legacyVersionsUnderTest) {
    const legacyArtifact = await getLegacyArtifact(legacyVersion);
    const immutableIntervalProducerArtifact = legacyVersion === '1.1.6' ?
      legacyArtifact : await getLegacyArtifact('1.1.6');
    const legacyFixture = join(
        temporaryRoot,
        `legacy-${legacyVersion}`,
    );
    await mkdir(legacyFixture);
    await writeFile(join(legacyFixture, 'package.json'), JSON.stringify({
      private: true,
      type: 'module',
    }));
    await writeFile(
        join(legacyFixture, 'smoke.mjs'),
        legacyInteroperabilityTest,
    );
    await writeFile(
        join(legacyFixture, 'generate-legacy-golden.mjs'),
        legacyGoldenGenerator,
    );
    await writeFile(
        join(legacyFixture, 'install-dom-globals.mjs'),
        domGlobalsInstaller,
    );
    for (const [version, corpus] of committedLegacyCorpora) {
      await writeFile(
          join(legacyFixture, `legacy-v${version}-golden.json`),
          corpus.bytes,
      );
    }
    runNpm([
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      tarball,
      `cm-record-v1@${legacyArtifact.tarball}`,
      `cm-record-v1-interval-producer@${
        immutableIntervalProducerArtifact.tarball}`,
      'codemirror@5.65.21',
      '@codemirror/state@6',
      '@codemirror/view@6',
      'jsdom@29.1.1',
    ], legacyFixture);
    await assertPublicRegistryResolutions(legacyFixture, new Set([
      'node_modules/codemirror-record',
      'node_modules/cm-record-v1',
      'node_modules/cm-record-v1-interval-producer',
    ]));
    const exactCorpus = committedLegacyCorpora.get(legacyVersion);
    const generatorEnvironment = {...publicNpmEnvironment};
    const isPrintedRegistryCorpus =
      legacyVersion === printLegacyGoldenVersion &&
      legacyPackageOverride === `${packageMetadata.name}@${legacyVersion}`;
    if (isPrintedRegistryCorpus) {
      generatorEnvironment.LEGACY_CORPUS_SOURCE = JSON.stringify({
        kind: 'npm-registry',
        spec: legacyPackageOverride,
        integrity: legacyExpectedIntegrity,
      });
    } else if (
      legacyVersion === printLegacyGoldenVersion &&
      legacyPackageOverride !== undefined
    ) {
      generatorEnvironment.LEGACY_CORPUS_SOURCE = JSON.stringify({
        kind: 'retained-release-tarball',
        package: packageMetadata.name,
        version: legacyVersion,
        integrity: legacyExpectedIntegrity,
      });
    } else if (exactCorpus?.value.generator.source !== undefined) {
      generatorEnvironment.LEGACY_CORPUS_SOURCE = JSON.stringify(
          exactCorpus.value.generator.source,
      );
    }
    const generatedGolden = execFileSync(
        process.execPath,
        ['generate-legacy-golden.mjs'],
        {
          cwd: legacyFixture,
          encoding: 'utf8',
          env: generatorEnvironment,
        },
    );
    const generatedGoldenObject = JSON.parse(generatedGolden);
    assert.equal(
        generatedGoldenObject.generator.packageVersion,
        legacyVersion,
        `golden generator loaded the wrong v${legacyVersion} package`,
    );
    assert.equal(
        generatedGoldenObject.generator.codeMirrorVersion,
        '5.65.21',
        `golden generator loaded the wrong CM5 for v${legacyVersion}`,
    );
    const expectedWireCorpus = legacyVersionIsAtLeast(
        legacyVersion,
        '0.6.0',
    ) ? legacyGolden : withoutExtraActivity(legacyGolden);
    const generatedComparison = {
      ...generatedGoldenObject,
      generator: expectedWireCorpus.generator,
    };
    const expectedComparison = {...expectedWireCorpus};
    if (!legacyVersionIsAtLeast(legacyVersion, '1.0.0')) {
      // v0 serializers used a different object-key insertion order. Keep
      // their actual bytes for playback, while comparing the wire objects
      // structurally so a cosmetic JSON ordering difference is not treated
      // as a format incompatibility.
      generatedComparison.records = JSON.parse(generatedComparison.records);
      expectedComparison.records = JSON.parse(expectedComparison.records);
    }
    assert.deepEqual(
        generatedComparison,
        expectedComparison,
        `published v${legacyVersion} output differs from the v1 wire corpus`,
    );
    const isPrintedCorpus = legacyVersion === printLegacyGoldenVersion;
    if (exactCorpus !== undefined && !isPrintedCorpus) {
      assert.equal(
          generatedGolden,
          exactCorpus.bytes,
          `v${legacyVersion} bytes differ from its immutable golden corpus`,
      );
    }
    if (isPrintedCorpus) {
      // Exercise the regenerated bytes themselves. This also lets a registry
      // provenance change be reviewed without first weakening the immutable
      // committed-corpus comparison used by normal CI.
      await writeFile(
          join(legacyFixture, `legacy-v${legacyVersion}-golden.json`),
          generatedGolden,
      );
    }
    execFileSync(process.execPath, ['smoke.mjs'], {
      cwd: legacyFixture,
      env: publicNpmEnvironment,
      stdio: 'inherit',
    });
    if (isPrintedCorpus) {
      process.stdout.write(generatedGolden);
    }
  }

  assert.equal(packageMetadata.peerDependencies['@codemirror/state'], '^6.0.0');
  assert.equal(packageMetadata.peerDependencies['@codemirror/view'], '^6.0.0');
} finally {
  await rm(temporaryRoot, {recursive: true, force: true});
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
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function legacyVersionIsAtLeast(version, minimumVersion) {
  const current = version.split('.').map(Number);
  const minimum = minimumVersion.split('.').map(Number);
  return current.some((part, index) => part > minimum[index] &&
    current.slice(0, index).every((value, prefixIndex) =>
      value === minimum[prefixIndex],
    )) || current.every((part, index) => part === minimum[index]);
}

function withoutExtraActivity(corpus) {
  return {
    ...corpus,
    scenario: 'compressed input, deletion, and selection',
    records: JSON.stringify(JSON.parse(corpus.records).filter((record) =>
      record.o[0].o !== 'e',
    )),
  };
}

function validateExactPackageEnvironment({
  expectedIntegrity,
  expectedIntegrityVariable,
  exactRegistrySpec,
  packageSpec,
  packageSpecVariable,
}) {
  if (packageSpec === undefined) {
    assert.equal(
        expectedIntegrity,
        undefined,
        `${expectedIntegrityVariable} requires ${packageSpecVariable}`,
    );
    return;
  }

  assert.ok(
      expectedIntegrity,
      `${expectedIntegrityVariable} is required when ` +
        `${packageSpecVariable} is set`,
  );
  assert.ok(
      packageSpec === exactRegistrySpec ||
        (isAbsolute(packageSpec) && packageSpec.endsWith('.tgz')),
      `${packageSpecVariable} must equal ${exactRegistrySpec} or be an ` +
        'absolute .tgz path',
  );
}

async function prepareExactPackageArtifact({
  artifactLabel,
  expectedIntegrity,
  expectedIntegrityVariable,
  expectedName,
  expectedVersion,
  exactRegistrySpec,
  packageSpec,
  registryArtifactLabel,
  temporaryRoot,
}) {
  const fromRegistry = packageSpec === exactRegistrySpec;
  if (fromRegistry) {
    const registryMetadata = JSON.parse(runNpm([
      'view',
      packageSpec,
      'name',
      'version',
      'dist.integrity',
      '--json',
    ], root));
    assert.equal(
        registryMetadata.name,
        expectedName,
        `${registryArtifactLabel} contains a different package name`,
    );
    assert.equal(
        registryMetadata.version,
        expectedVersion,
        `${registryArtifactLabel} contains a different package version`,
    );
    assert.equal(
        registryMetadata['dist.integrity'],
        expectedIntegrity,
        `registry dist.integrity differs from ${expectedIntegrityVariable}`,
    );
  } else {
    assert.equal(
        await integrityOfFile(packageSpec),
        expectedIntegrity,
        `${artifactLabel} integrity differs from ` +
          expectedIntegrityVariable,
    );
  }

  const packResult = JSON.parse(runNpm([
    'pack',
    packageSpec,
    '--json',
    '--pack-destination',
    temporaryRoot,
  ], root));
  assert.equal(
      packResult.length,
      1,
      `npm pack must return one ${artifactLabel}`,
  );
  const [packedArtifact] = packResult;
  const checkedArtifactLabel = fromRegistry ?
    registryArtifactLabel : artifactLabel;
  assert.equal(
      packedArtifact.name,
      expectedName,
      `${checkedArtifactLabel} contains a different package name`,
  );
  assert.equal(
      packedArtifact.version,
      expectedVersion,
      `${checkedArtifactLabel} contains a different package version`,
  );
  assert.equal(
      packedArtifact.integrity,
      expectedIntegrity,
      `npm pack integrity differs from ${expectedIntegrityVariable}`,
  );

  const tarball = fromRegistry ?
    join(temporaryRoot, packedArtifact.filename) : packageSpec;
  assert.equal(
      await integrityOfFile(tarball),
      expectedIntegrity,
      `${checkedArtifactLabel} integrity differs from ` +
        expectedIntegrityVariable,
  );
  return {packedArtifact, tarball};
}

async function integrityOfFile(path) {
  return 'sha512-' + createHash('sha512')
      .update(await readFile(path))
      .digest('base64');
}

async function assertPublicRegistryResolutions(fixture, localPackagePaths) {
  const packageLock = JSON.parse(await readFile(
      join(fixture, 'package-lock.json'),
      'utf8',
  ));
  for (const [packagePath, metadata] of Object.entries(
      packageLock.packages || {},
  )) {
    if (metadata.resolved === undefined) {
      continue;
    }
    if (localPackagePaths.has(packagePath)) {
      assert.ok(
          metadata.resolved.startsWith('file:'),
          `${packagePath} must resolve from its exact retained tarball`,
      );
      continue;
    }
    assert.ok(
        metadata.resolved.startsWith(publicNpmRegistry),
        `${packagePath} resolved outside the public npm registry: ` +
          metadata.resolved,
    );
  }
}

function assertSingleCodeMirrorInstallation(tree, packageName, scenarioName) {
  const versions = new Set();
  let resolvedInstallations = 0;

  visitDependencies(tree, (name, dependency) => {
    if (name !== packageName) {
      return;
    }
    versions.add(dependency.version);
    if (dependency.resolved) {
      resolvedInstallations++;
    }
  });

  assert.equal(
      versions.size,
      1,
      `${scenarioName} resolved multiple ${packageName} versions`,
  );
  assert.equal(
      resolvedInstallations,
      1,
      `${scenarioName} installed multiple physical copies of ${packageName}`,
  );
}

function visitDependencies(tree, callback) {
  for (const [name, dependency] of Object.entries(tree.dependencies || {})) {
    callback(name, dependency);
    visitDependencies(dependency, callback);
  }
}

function getSmokeTest() {
  return String.raw`
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {JSDOM} from 'jsdom';
import * as CodeMirrorState from '@codemirror/state';
import * as CodeMirrorView from '@codemirror/view';

import {installDomGlobals} from './install-dom-globals.mjs';

const dom = new JSDOM('<div id="record"></div><div id="play"></div>', {
  pretendToBeVisual: true,
});
installDomGlobals(dom);
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [];

const {
  EditorSelection,
  EditorState,
  Transaction,
} = await import('@codemirror/state');
const {EditorView} = await import('@codemirror/view');
const {CodePlay, CodeRecord} = await import('codemirror-record');
const require = createRequire(import.meta.url);
const commonJsPackage = require('codemirror-record');
const commonJsState = require('@codemirror/state');
const commonJsView = require('@codemirror/view');
assert.deepEqual(
    Object.keys(commonJsPackage).sort(),
    ['CodePlay', 'CodeRecord'],
    'packed CommonJS entry point did not execute with the public exports',
);

const commonJsEntry = require.resolve('codemirror-record');
const browserEntry = join(dirname(commonJsEntry), 'main.js');
const browserContext = {
  CodeMirrorState,
  CodeMirrorView,
  clearTimeout,
  console,
  setTimeout,
};
runInNewContext(await readFile(browserEntry, 'utf8'), browserContext, {
  filename: browserEntry,
});
assert.equal(typeof browserContext.CodePlay, 'function');
assert.equal(typeof browserContext.CodeRecord, 'function');

const recordView = new EditorView({
  parent: document.getElementById('record'),
  state: EditorState.create({
    extensions: [EditorState.allowMultipleSelections.of(true)],
  }),
});
const recorder = new CodeRecord(recordView);
recorder.listen();
recordView.dispatch({
  changes: {from: 0, insert: 'compatible'},
  selection: EditorSelection.create([
    EditorSelection.range(3, 1),
    EditorSelection.cursor(8),
  ], 1),
  annotations: Transaction.userEvent.of('input.type'),
});
const records = recorder.getRecords();
assert.equal(JSON.parse(records)[0].o[0].a, 'compatible');

const playView = new EditorView({
  parent: document.getElementById('play'),
  state: EditorState.create(),
});
const player = new CodePlay(playView, {maxDelay: 1});
player.addOperations(records);
await playToEnd(player);
assert.equal(playView.state.doc.toString(), 'compatible');
assert.deepEqual(selectionOffsets(playView), [[3, 1], [8, 8]]);
assert.equal(playView.state.selection.mainIndex, 1);

const mixedRecordView = new EditorView({
  parent: createHost(),
  state: EditorState.create({
    extensions: [EditorState.allowMultipleSelections.of(true)],
  }),
});
const mixedRecorder = new commonJsPackage.CodeRecord(mixedRecordView);
mixedRecorder.listen();
mixedRecorder.listen();
mixedRecordView.dispatch({
  changes: {from: 0, insert: 'cjs-on-esm'},
  selection: EditorSelection.create([
    EditorSelection.range(3, 1),
    EditorSelection.cursor(8),
  ], 1),
  annotations: Transaction.userEvent.of('input.type'),
});
const mixedRecords = mixedRecorder.getRecords();
assert.equal(JSON.parse(mixedRecords)[0].o[0].a, 'cjs-on-esm');

const mixedPlayView = new EditorView({
  parent: createHost(),
  state: EditorState.create(),
});
const playbackObserver = new CodeRecord(mixedPlayView);
playbackObserver.listen();
const mixedPlayer = new commonJsPackage.CodePlay(mixedPlayView, {maxDelay: 0});
mixedPlayer.addOperations(mixedRecords);
await playToEnd(mixedPlayer);
assert.equal(mixedPlayView.state.doc.toString(), 'cjs-on-esm');
assert.deepEqual(selectionOffsets(mixedPlayView), [[3, 1], [8, 8]]);
assert.equal(mixedPlayView.state.selection.mainIndex, 1);
assert.equal(
    playbackObserver.getRecords(),
    '[]',
    'CommonJS playback must not be re-recorded through the ESM entry point',
);

const reverseRecordView = new commonJsView.EditorView({
  parent: createHost(),
  state: commonJsState.EditorState.create({
    extensions: [
      commonJsState.EditorState.allowMultipleSelections.of(true),
    ],
  }),
});
const reverseRecorder = new CodeRecord(reverseRecordView);
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
  parent: createHost(),
  state: commonJsState.EditorState.create(),
});
const reversePlayer = new CodePlay(reversePlayView, {maxDelay: 0});
reversePlayer.addOperations(reverseRecords);
await playToEnd(reversePlayer);
assert.equal(reversePlayView.state.doc.toString(), 'esm-on-cjs');
assert.deepEqual(selectionOffsets(reversePlayView), [[3, 1], [8, 8]]);
assert.equal(reversePlayView.state.selection.mainIndex, 1);

recordView.destroy();
playView.destroy();
mixedRecordView.destroy();
mixedPlayView.destroy();
reverseRecordView.destroy();
reversePlayView.destroy();
dom.window.close();

function createHost() {
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

function selectionOffsets(view) {
  return view.state.selection.ranges.map((range) => [
    range.anchor,
    range.head,
  ]);
}

function playToEnd(player) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('packed package playback did not finish'));
    }, 1000);
    player.once('end', () => {
      clearTimeout(timeout);
      resolve();
    });
    player.play();
  });
}
`;
}
