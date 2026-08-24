import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {describe, expect, test} from 'vitest';

const corpusDirectory = join(process.cwd(), 'scripts', 'fixtures');
const corpusCases = [
  {
    filename: 'legacy-v1.1.5-golden.json',
    packageVersion: '1.1.5',
    provenances: [{
      sha256:
        '3e010474dce38eac905e245648a30ccd2373c03a4f6536c176f1a4140bfd8be5',
      source: {
        kind: 'npm-registry',
        spec: 'codemirror-record@1.1.5',
        integrity:
          'sha512-o5eFNMb/NmSOwA/gca2roeae5L8wG+7ehkpIEWNrom4jZ3e0mJxXNPlpzaEPZEqcG5duOXpkvMUMc5m9ha1qBQ==',
      },
    }],
  },
  {
    filename: 'legacy-v1.1.7-golden.json',
    packageVersion: '1.1.7',
    provenances: [{
      sha256:
        '722dc397bc13d4f8c73bf70a798ee64d5f4dcb60e116331df37be8c06b28bdd4',
      source: {
        kind: 'npm-registry',
        spec: 'codemirror-record@1.1.7',
        integrity:
          'sha512-if1hp4NyH7+Lpwx79PNrYfa2WA4IxrL15dJ83pDWhLdx/wXCfPvh6hF4RzLuAltDaJc/13A82KbaeKJi0n8Nsw==',
      },
    }],
  },
  {
    filename: 'legacy-v1.1.8-golden.json',
    packageVersion: '1.1.8',
    provenances: [{
      sha256:
        '28849c5465617fddad1b8d69f8fb16567f926e3642d6250355509608a7293091',
      source: {
        kind: 'npm-registry',
        spec: 'codemirror-record@1.1.8',
        integrity:
          'sha512-2WCdbc2le6Rolih7q4pfJltvLECXYx/N7DoS/tZbozOdvLI+/opAhwJQtYtfyaEWpSC/HYfyCYV3PIwcbO0HoA==',
      },
    }],
  },
];

describe('immutable CodeMirror 5 recorder corpora', () => {
  test.each(corpusCases)(
      '$filename preserves reviewed bytes',
      ({filename, provenances}) => {
        const bytes = readFileSync(join(corpusDirectory, filename));
        const corpus = JSON.parse(bytes);
        const provenance = provenances.find(({source}) =>
          JSON.stringify(source) === JSON.stringify(corpus.generator.source),
        );

        expect(provenance).toBeDefined();
        expect(createHash('sha256').update(bytes).digest('hex'))
            .toBe(provenance.sha256);
      },
  );

  test.each(corpusCases)(
      '$filename identifies its real producer',
      ({filename, packageVersion, provenances}) => {
        const corpus = readCorpus(filename);

        expect(corpus.generator).toMatchObject({
          package: 'codemirror-record',
          packageVersion,
          codeMirrorVersion: '5.65.21',
        });
        expect(provenances.map(({source}) => source))
            .toContainEqual(corpus.generator.source);
      },
  );

  test('published v1.1.7 and v1.1.8 preserve the v1.1.5 wire bytes', () => {
    const published = readCorpus('legacy-v1.1.5-golden.json');
    const seekMaintenance = readCorpus('legacy-v1.1.7-golden.json');
    const maintained = readCorpus('legacy-v1.1.8-golden.json');

    expect(seekMaintenance.records).toBe(published.records);
    expect(maintained.records).toBe(published.records);
  });

  test('real-registry mode verifies every registry-backed corpus SRI', () => {
    const registrySources = registryCorpusSources();
    const result = runRegistryIntegrityGate(Object.fromEntries(
        registrySources.map((source) => [source.spec, source.integrity]),
    ));

    expect(result.status, result.stderr).toBe(0);
    expect(result.queries).toEqual(registrySources.map(({spec}) => spec));
  });

  test('real-registry mode rejects an SRI that differs from npm', () => {
    const registrySources = registryCorpusSources();
    const driftSource = registrySources.at(-1);
    const integrities = Object.fromEntries(
        registrySources.map((source) => [source.spec, source.integrity]),
    );
    integrities[driftSource.spec] = 'sha512-registry-does-not-match';
    const result = runRegistryIntegrityGate(integrities);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`${driftSource.spec} registry integrity`);
    expect(result.stderr).toContain('sha512-registry-does-not-match');
  });

  test('every postpublication corpus names an exact registry artifact', () => {
    const registrySources = registryCorpusSources();

    expect(registrySources).toHaveLength(corpusCases.length);
    expect(registrySources.map(({spec}) => spec)).toEqual([
      'codemirror-record@1.1.5',
      'codemirror-record@1.1.7',
      'codemirror-record@1.1.8',
    ]);
  });
});

function readCorpus(filename) {
  return JSON.parse(readFileSync(join(corpusDirectory, filename), 'utf8'));
}

function registryCorpusSources() {
  return corpusCases.map(({filename}) => readCorpus(filename).generator.source)
      .filter(({kind}) => kind === 'npm-registry');
}

function runRegistryIntegrityGate(integrities) {
  const fakeNpmDirectory = mkdtempSync(join(
      tmpdir(),
      'codemirror-record-fake-npm-',
  ));
  const fakeNpmPath = join(fakeNpmDirectory, 'npm');
  const queryLogPath = join(fakeNpmDirectory, 'queries.log');
  writeFileSync(fakeNpmPath, `#!/usr/bin/env node
const {appendFileSync} = require('node:fs');
const [
  ,
  ,
  command,
  spec,
  field,
  format,
  registryFlag,
  registry,
  scopedRegistryFlag,
] = process.argv;
if (
  command !== 'view' ||
  field !== 'dist.integrity' ||
  format !== '--json' ||
  registryFlag !== '--registry' ||
  registry !== 'https://registry.npmjs.org/' ||
  scopedRegistryFlag !==
    '--@codemirror:registry=https://registry.npmjs.org/'
) {
  process.stderr.write('unexpected fake npm invocation\\n');
  process.exit(64);
}
appendFileSync(process.env.FAKE_NPM_QUERY_LOG, spec + '\\n');
const integrities = JSON.parse(process.env.FAKE_NPM_INTEGRITIES);
if (!(spec in integrities)) {
  process.stderr.write('unexpected registry lookup for ' + spec + '\\n');
  process.exit(65);
}
const result = integrities[spec];
if (result?.npmError) {
  process.stdout.write(JSON.stringify({error: {code: result.npmError}}) + '\\n');
  process.exit(1);
}
process.stdout.write(JSON.stringify(result) + '\\n');
`);
  chmodSync(fakeNpmPath, 0o755);

  try {
    const environment = {
      ...process.env,
      PATH: `${fakeNpmDirectory}:${process.env.PATH}`,
      FAKE_NPM_INTEGRITIES: JSON.stringify(integrities),
      FAKE_NPM_QUERY_LOG: queryLogPath,
    };
    const result = spawnSync(process.execPath, [
      join(corpusDirectory, 'legacy-interoperability.mjs'),
      '--verify-registry-integrity-only',
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: environment,
    });
    let queries = [];
    try {
      queries = readFileSync(queryLogPath, 'utf8').trim().split('\n')
          .filter(Boolean);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    return {...result, queries};
  } finally {
    rmSync(fakeNpmDirectory, {recursive: true, force: true});
  }
}
