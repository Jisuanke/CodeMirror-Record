import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {describe, expect, test} from 'vitest';

import * as library from '../src';

const packagePath = join(process.cwd(), 'package.json');
const packageMetadata = JSON.parse(readFileSync(packagePath, 'utf8'));
const compatibilityScript = join(
    process.cwd(),
    'scripts',
    'test-peer-compatibility.mjs',
);
const ciWorkflow = readFileSync(
    join(process.cwd(), '.github/workflows/ci.yml'),
    'utf8',
);
const releaseRunbook = readFileSync(
    join(process.cwd(), 'docs', 'RELEASING.md'),
    'utf8',
);

describe('public package interface', () => {
  test('keeps the two established named exports', () => {
    expect(Object.keys(library).sort()).toEqual(['CodePlay', 'CodeRecord']);
  });

  test('keeps the documented recorder and player methods', () => {
    expect(codeRecordMethods()).toEqual(expect.arrayContaining([
      'getRecords',
      'listen',
      'recordExtraActivity',
    ]));
    expect(codePlayMethods()).toEqual(expect.arrayContaining([
      'addOperations',
      'clear',
      'getCurrentTime',
      'getDuration',
      'getStatus',
      'pause',
      'play',
      'seek',
      'setAutofocus',
      'setAutoplay',
      'setExtraActivityHandler',
      'setExtraActivityReverter',
      'setMaxDelay',
      'setSpeed',
    ]));
  });

  test('publishes CodeMirror 6 as a major version with peer dependencies', () => {
    expect(packageMetadata.name).toBe('codemirror-record');
    expect(packageMetadata.version).toBe('2.0.0');
    expect(packageMetadata.author).toBe('Haoran Yu & Jisuanke Team');
    expect(packageMetadata.description).toContain('CodeMirror 6');
    expect(packageMetadata.peerDependencies).toEqual({
      '@codemirror/state': '^6.0.0',
      '@codemirror/view': '^6.0.0',
    });
    expect(packageMetadata.types).toBe('./src/index.d.ts');
    expect(packageMetadata.publishConfig.tag).toBe('cm6');
    expect(packageMetadata.scripts.prepublishOnly).toContain(
        'require-publish-tag',
    );
    expect(packageMetadata.files).toEqual(expect.arrayContaining([
      'LICENSE',
      'docs/COMPRESSION.md',
      'docs/MIGRATING.md',
      'docs/migration-contract.json',
      'docs/RELEASING.md',
      'scripts/require-publish-tag.cjs',
    ]));
  });

  test('pins every public CodeMirror 5 package artifact in the release matrix', () => {
    const releaseArtifacts = JSON.parse(readFileSync(join(
        process.cwd(),
        'scripts',
        'fixtures',
        'release-artifacts.json',
    ), 'utf8'));

    expect(releaseArtifacts.codeMirror5Artifact).toEqual({
      version: '5.65.21',
      integrity:
        'sha512-6teYk0bA0nR3QP0ihGMoxuKzpl5W80FpnHpBJpgy66NK3cZv5b/' +
        'd/HY8PnRvfSsCG1MTfr92u2WUl+wT0E40mQ==',
      provenance: 'npm-registry',
    });

    expect(Object.keys(releaseArtifacts.legacyArtifacts)).toEqual([
      '0.3.1',
      '0.3.2',
      '0.3.3',
      '0.3.4',
      '0.3.5',
      '0.4.0',
      '0.4.1',
      '0.4.2',
      '0.4.3',
      '0.4.4',
      '0.4.5',
      '0.4.6',
      '0.4.7',
      '0.5.0',
      '0.5.1',
      '0.5.2',
      '0.5.3',
      '0.5.4',
      '0.6.0',
      '0.6.1',
      '1.0.0',
      '1.0.1',
      '1.0.2',
      '1.1.0',
      '1.1.1',
      '1.1.2',
      '1.1.3',
      '1.1.4',
      '1.1.5',
      '1.1.6',
      '1.1.7',
      '1.1.8',
    ]);
    expect(releaseArtifacts.legacyArtifacts['1.1.7']).toEqual({
      integrity:
        'sha512-if1hp4NyH7+Lpwx79PNrYfa2WA4IxrL15dJ83pDWhLdx/' +
        'wXCfPvh6hF4RzLuAltDaJc/13A82KbaeKJi0n8Nsw==',
      provenance: 'npm-registry',
    });
    expect(releaseArtifacts.legacyArtifacts['1.1.8'].integrity).toBe(
        'sha512-2WCdbc2le6Rolih7q4pfJltvLECXYx/N7DoS/tZbozOdvLI+/opAhwJQtYtfyaEWpSC/HYfyCYV3PIwcbO0HoA==',
    );
    expect(releaseArtifacts.legacyArtifacts['1.1.8'].provenance)
        .toBe('npm-registry');
    for (const artifact of Object.values(releaseArtifacts.legacyArtifacts)) {
      expect(artifact.integrity).toMatch(/^sha512-[A-Za-z0-9+/]+={0,2}$/);
      expect(artifact.provenance).toBe('npm-registry');
    }
    expect(releaseArtifacts.v2PackageFiles).toEqual(
        requiredPackedFiles().map(({path}) => path),
    );
    expect(new Set(releaseArtifacts.v2PackageFiles).size)
        .toBe(releaseArtifacts.v2PackageFiles.length);
  });

  test('release runbook pins registries, identities, and resumable writes', () => {
    expect(releaseRunbook).toContain(
        'CODEMIRROR_NPM_REGISTRY_FLAG="--@codemirror:registry=' +
          '$PUBLIC_NPM_REGISTRY"',
    );
    expect(releaseRunbook).toContain('verify_public_lockfile package-lock.json');
    expect(releaseRunbook).toContain(
        'EXPECTED_V1_RELEASE_COMMIT=ee6cf90fa6533247c780001511496bf557b47f88',
    );
    expect(releaseRunbook).toContain(
        'EXPECTED_V1_PREVIOUS_CM5_RELEASE_COMMIT=' +
          '84d7e90405ed96db3a963bc489fb3e00124848f1',
    );
    expect(releaseRunbook).toContain(
        'EXPECTED_V1_BRANCH_COMMIT=45f0d71ec072b54f2d6ce0524eac58bf045630eb',
    );
    expect(releaseRunbook).toContain('V2_BRANCH=main');
    expect(releaseRunbook).toContain(
        'git switch --detach "$V1_RELEASE_COMMIT"',
    );
    expect(releaseRunbook).toContain(
        'git merge-base --is-ancestor "$V1_RELEASE_COMMIT" ' +
          '"$V1_BRANCH_COMMIT"',
    );
    expect(releaseRunbook).not.toContain('STAGING_BRANCH');
    expect(releaseRunbook).not.toContain('codex/codemirror6-support');
    expect(releaseRunbook).toContain(
        'EXPECTED_V1_INTEGRITY=sha512-2WCdbc2le6Rolih7q4pfJltvLECXYx/' +
          'N7DoS/tZbozOdvLI+/opAhwJQtYtfyaEWpSC/HYfyCYV3PIwcbO0HoA==',
    );
    expect(releaseRunbook).toContain(
        'EXPECTED_V1_PREVIOUS_CM5_INTEGRITY=sha512-if1hp4NyH7+' +
          'Lpwx79PNrYfa2WA4IxrL15dJ83pDWhLdx/wXCfPvh6hF4RzLuAltDaJc/' +
          '13A82KbaeKJi0n8Nsw==',
    );
    expect(releaseRunbook).toContain(
        'cmp "$V1_PREVIOUS_CM5_TAG_TARBALL"',
    );
    expect(releaseRunbook).toContain(
        '"--print-legacy-golden=$V1_PREVIOUS_CM5_VERSION"',
    );
    expect(releaseRunbook).toContain(
        'LEGACY_CANDIDATE_VERSION="$V1_PREVIOUS_CM5_VERSION"',
    );
    expect(releaseRunbook).toContain('if V1_PUBLISHED_METADATA=$(npm_public view');
    expect(releaseRunbook).toContain('if V2_PUBLISHED_METADATA=$(npm_public view');
    expect(releaseRunbook).toContain('verify_stable_github_release()');
    expect(releaseRunbook).toContain(
        'if gh release view "v$V1_VERSION" --repo "$REPOSITORY"',
    );
    expect(releaseRunbook).toContain(
        'if gh release view "v$V2_VERSION" --repo "$REPOSITORY"',
    );
    expect(releaseRunbook).toContain('--json tagName,isDraft,isPrerelease');
    expect(releaseRunbook).toContain(
        'gh api "repos/$REPOSITORY/releases/latest" --jq .tag_name',
    );
    expect(releaseRunbook.indexOf(
        'git push origin "refs/tags/v$V1_VERSION:refs/tags/v$V1_VERSION"',
    )).toBeLessThan(releaseRunbook.indexOf(
        'npm_public publish "$V1_TARBALL" --tag cm5',
    ));
    expect(releaseRunbook.indexOf(
        'git push origin "refs/tags/v$V2_VERSION:refs/tags/v$V2_VERSION"',
    )).toBeLessThan(releaseRunbook.indexOf(
        'npm_public publish "$V2_TARBALL" --tag cm6',
    ));
  });

  test('release runbook byte-checks and launches every public page asset', () => {
    const v1BranchCheck =
      'test "$(git ls-remote origin refs/heads/v1 | cut -f1)" = ' +
      '"$V1_BRANCH_COMMIT"';
    const incorrectV1BranchCheck =
      'test "$(git ls-remote origin refs/heads/v1 | cut -f1)" = ' +
      '"$V1_RELEASE_COMMIT"';

    expect(releaseRunbook).toContain('*.html|*.json|*.js|*.css');
    expect(releaseRunbook).toContain(
        'done < <(git ls-tree -r --name-only "$MAIN_COMMIT")',
    );
    expect(releaseRunbook).toContain("import {chromium} from 'playwright';");
    expect(releaseRunbook).toContain(
        "await page.locator('#sample-edit').click();",
    );
    expect(releaseRunbook.split(v1BranchCheck).length - 1)
        .toBeGreaterThanOrEqual(4);
    expect(releaseRunbook).not.toContain(incorrectV1BranchCheck);
  });

  test('refuses to publish v2 under any tag except cm6', () => {
    const script = join(
        process.cwd(),
        'scripts',
        'require-publish-tag.cjs',
    );
    const accepted = spawnSync(process.execPath, [script], {
      env: {...process.env, npm_config_tag: 'cm6'},
    });
    const rejected = spawnSync(process.execPath, [script], {
      env: {...process.env, npm_config_tag: 'latest'},
    });

    expect(accepted.status).toBe(0);
    expect(rejected.status).toBe(1);
    expect(rejected.stderr.toString()).toContain('npm publish --tag cm6');
  });

  test('requires a pinned prepublish SRI for registry artifact checks', () => {
    const result = runCompatibilityCheck({
      PATH: '/codemirror-record-test-no-tools',
      V2_PACKAGE_SPEC: 'codemirror-record@2.0.0',
    });

    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain(
        'V2_EXPECTED_INTEGRITY is required when V2_PACKAGE_SPEC is set',
    );
  });

  test('registry artifact checks reject mutable package specifications', () => {
    const result = runCompatibilityCheck({
      PATH: '/codemirror-record-test-no-tools',
      V2_EXPECTED_INTEGRITY: 'sha512-release-candidate',
      V2_PACKAGE_SPEC: 'codemirror-record@cm6',
    });

    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain(
        'V2_PACKAGE_SPEC must equal codemirror-record@2.0.0 or be an ' +
          'absolute .tgz path',
    );
  });

  test('artifact checks reject relative retained-tarball paths', () => {
    const result = runCompatibilityCheck({
      PATH: '/codemirror-record-test-no-tools',
      V2_EXPECTED_INTEGRITY: 'sha512-release-candidate',
      V2_PACKAGE_SPEC: './codemirror-record-2.0.0.tgz',
    });

    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain(
        'V2_PACKAGE_SPEC must equal codemirror-record@2.0.0 or be an ' +
          'absolute .tgz path',
    );
  });

  test('retained v2 artifact checks independently hash the exact bytes', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'codemirror-record-v2-'));
    const tarball = join(fixture, 'codemirror-record-2.0.0.tgz');
    writeFileSync(tarball, 'tampered retained v2 bytes');

    try {
      const result = runCompatibilityCheck({
        PATH: '/codemirror-record-test-no-tools',
        V2_EXPECTED_INTEGRITY: 'sha512-release-candidate',
        V2_PACKAGE_SPEC: tarball,
      });

      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
          'retained v2 tarball integrity differs from ' +
            'V2_EXPECTED_INTEGRITY',
      );
    } finally {
      rmSync(fixture, {recursive: true, force: true});
    }
  });

  test('retained v2 artifact is the exact tarball exercised by installs', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'codemirror-record-v2-'));
    const fakeBin = mkdtempSync(join(tmpdir(), 'codemirror-record-npm-'));
    const tarball = join(fixture, 'codemirror-record-2.0.0.tgz');
    const tarballBytes = 'retained v2 release artifact';
    const expectedIntegrity = integrityOf(tarballBytes);
    const fakeNpm = join(fakeBin, 'npm');
    writeFileSync(tarball, tarballBytes);
    writeFileSync(fakeNpm, `#!${process.execPath}\n` +
      `const args = process.argv.slice(2);\n` +
      `if (!args.includes('--registry') || ` +
      `!args.includes('https://registry.npmjs.org/') || ` +
      `!args.includes('--@codemirror:registry=https://registry.npmjs.org/')) {\n` +
      `  process.stderr.write('public-registry-not-pinned');\n` +
      `  process.exit(42);\n` +
      `}\n` +
      `if (args[0] === 'pack') {\n` +
      `  process.stdout.write(${JSON.stringify(JSON.stringify([{
        filename: 'codemirror-record-2.0.0.tgz',
        files: requiredPackedFiles(),
        integrity: expectedIntegrity,
        name: 'codemirror-record',
        version: '2.0.0',
      }]))});\n` +
      `} else if (args[0] === 'install' && ` +
      `args.includes(${JSON.stringify(tarball)})) {\n` +
      `  process.stderr.write('exact-retained-v2-artifact-installed');\n` +
      `  process.exit(43);\n` +
      `} else {\n` +
      `  process.stderr.write('unexpected-npm-command:' + args.join(' '));\n` +
      `  process.exit(44);\n` +
      `}\n`);
    chmodSync(fakeNpm, 0o755);

    try {
      const result = runCompatibilityCheck({
        PATH: fakeBin,
        V2_EXPECTED_INTEGRITY: expectedIntegrity,
        V2_PACKAGE_SPEC: tarball,
      });

      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
          'exact-retained-v2-artifact-installed',
      );
    } finally {
      rmSync(fixture, {recursive: true, force: true});
      rmSync(fakeBin, {recursive: true, force: true});
    }
  });

  test('retained v2 artifact checks assert package name and version', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'codemirror-record-v2-'));
    const fakeBin = mkdtempSync(join(tmpdir(), 'codemirror-record-npm-'));
    const tarball = join(fixture, 'codemirror-record-2.0.0.tgz');
    const tarballBytes = 'wrong package metadata';
    const expectedIntegrity = integrityOf(tarballBytes);
    const fakeNpm = join(fakeBin, 'npm');
    writeFileSync(tarball, tarballBytes);
    writeFileSync(fakeNpm, `#!${process.execPath}\n` +
      `process.stdout.write(${JSON.stringify(JSON.stringify([{
        filename: 'not-codemirror-record-2.0.0.tgz',
        files: requiredPackedFiles(),
        integrity: expectedIntegrity,
        name: 'not-codemirror-record',
        version: '2.0.0',
      }]))});\n`);
    chmodSync(fakeNpm, 0o755);

    try {
      const result = runCompatibilityCheck({
        PATH: fakeBin,
        V2_EXPECTED_INTEGRITY: expectedIntegrity,
        V2_PACKAGE_SPEC: tarball,
      });

      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
          'retained v2 tarball contains a different package name',
      );
    } finally {
      rmSync(fixture, {recursive: true, force: true});
      rmSync(fakeBin, {recursive: true, force: true});
    }
  });

  test('retained v2 artifacts reject unexpected packed files', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'codemirror-record-v2-'));
    const fakeBin = mkdtempSync(join(tmpdir(), 'codemirror-record-npm-'));
    const tarball = join(fixture, 'codemirror-record-2.0.0.tgz');
    const tarballBytes = 'v2 artifact with an unexpected file';
    const expectedIntegrity = integrityOf(tarballBytes);
    const fakeNpm = join(fakeBin, 'npm');
    writeFileSync(tarball, tarballBytes);
    writeFileSync(fakeNpm, `#!${process.execPath}\n` +
      `process.stdout.write(${JSON.stringify(JSON.stringify([{
        filename: 'codemirror-record-2.0.0.tgz',
        files: [...requiredPackedFiles(), {path: 'dist/stale.js'}],
        integrity: expectedIntegrity,
        name: 'codemirror-record',
        version: '2.0.0',
      }]))});\n`);
    chmodSync(fakeNpm, 0o755);

    try {
      const result = runCompatibilityCheck({
        PATH: fakeBin,
        V2_EXPECTED_INTEGRITY: expectedIntegrity,
        V2_PACKAGE_SPEC: tarball,
      });

      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
          'packed v2 artifact file manifest differs from the reviewed allowlist',
      );
    } finally {
      rmSync(fixture, {recursive: true, force: true});
      rmSync(fakeBin, {recursive: true, force: true});
    }
  });

  test('legacy overrides require a pinned SRI', () => {
    const result = runCompatibilityCheck({
      PATH: '/codemirror-record-test-no-tools',
      LEGACY_PACKAGE_SPEC: '/tmp/codemirror-record-1.1.8.tgz',
    });

    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain(
        'LEGACY_EXPECTED_INTEGRITY is required when ' +
          'LEGACY_PACKAGE_SPEC is set',
    );
  });

  test('v1.1.8 corpus regeneration requires an exact reviewed artifact', () => {
    const result = runCompatibilityCheck({}, [
      '--legacy-version=1.1.8',
      '--print-legacy-golden=1.1.8',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain(
        'printing the v1.1.8 corpus requires the exact registry artifact ' +
          'or retained tarball',
    );
  });

  test('corpus regeneration rejects unknown and duplicate targets', () => {
    const unknown = runCompatibilityCheck({}, [
      '--print-legacy-golden=1.1.9',
    ]);
    const duplicate = runCompatibilityCheck({}, [
      '--print-legacy-golden=1.1.5',
      '--print-legacy-golden=1.1.6',
    ]);

    expect(unknown.status).toBe(1);
    expect(unknown.stderr.toString()).toContain(
        'unknown legacy golden version 1.1.9',
    );
    expect(duplicate.status).toBe(1);
    expect(duplicate.stderr.toString()).toContain(
        'select at most one --print-legacy-golden version',
    );
  });

  test('legacy overrides reject tags, ranges, and relative tarballs', () => {
    for (const legacyPackageSpec of [
      'codemirror-record@cm5',
      'codemirror-record@^1.1.0',
      './codemirror-record-1.1.8.tgz',
    ]) {
      const result = runCompatibilityCheck({
        PATH: '/codemirror-record-test-no-tools',
        LEGACY_EXPECTED_INTEGRITY: 'sha512-release-candidate',
        LEGACY_PACKAGE_SPEC: legacyPackageSpec,
      });

      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
          'LEGACY_PACKAGE_SPEC must equal codemirror-record@1.1.8 or be ' +
            'an absolute .tgz path',
      );
    }
  });

  test('legacy candidate validation derives the exact version from the environment', () => {
    const result = runCompatibilityCheck({
      LEGACY_CANDIDATE_VERSION: '1.1.9',
      LEGACY_EXPECTED_INTEGRITY: 'sha512-release-candidate',
      LEGACY_PACKAGE_SPEC: 'codemirror-record@cm5',
      PATH: '/codemirror-record-test-no-tools',
    });

    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain(
        'LEGACY_PACKAGE_SPEC must equal codemirror-record@1.1.9 or be an ' +
          'absolute .tgz path',
    );
  });

  test('legacy overrides independently hash the exact tarball bytes', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'codemirror-record-v1-'));
    const tarball = join(fixture, 'codemirror-record-1.1.8.tgz');
    writeFileSync(tarball, 'tampered retained v1 bytes');

    try {
      const result = runCompatibilityCheck({
        PATH: '/codemirror-record-test-no-tools',
        LEGACY_EXPECTED_INTEGRITY: 'sha512-release-candidate',
        LEGACY_PACKAGE_SPEC: tarball,
      });

      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
          'retained v1.1.8 tarball integrity differs from ' +
            'LEGACY_EXPECTED_INTEGRITY',
      );
    } finally {
      rmSync(fixture, {recursive: true, force: true});
    }
  });

  test('legacy overrides assert the package is codemirror-record v1.1.8', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'codemirror-record-v1-'));
    const fakeBin = mkdtempSync(join(tmpdir(), 'codemirror-record-npm-'));
    const tarball = join(fixture, 'codemirror-record-1.1.8.tgz');
    const tarballBytes = 'legacy artifact with wrong metadata';
    const expectedIntegrity = integrityOf(tarballBytes);
    const fakeNpm = join(fakeBin, 'npm');
    writeFileSync(tarball, tarballBytes);
    writeFileSync(fakeNpm, `#!${process.execPath}\n` +
      `process.stdout.write(${JSON.stringify(JSON.stringify([{
        filename: 'codemirror-record-1.1.7.tgz',
        files: [],
        integrity: expectedIntegrity,
        name: 'codemirror-record',
        version: '1.1.7',
      }]))});\n`);
    chmodSync(fakeNpm, 0o755);

    try {
      const result = runCompatibilityCheck({
        PATH: fakeBin,
        LEGACY_EXPECTED_INTEGRITY: expectedIntegrity,
        LEGACY_PACKAGE_SPEC: tarball,
      });

      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
          'retained v1.1.8 tarball contains a different package version',
      );
    } finally {
      rmSync(fixture, {recursive: true, force: true});
      rmSync(fakeBin, {recursive: true, force: true});
    }
  });

  test('registry artifact checks reject metadata with a different SRI', () => {
    const fakeBin = mkdtempSync(join(tmpdir(), 'codemirror-record-npm-'));
    const fakeNpm = join(fakeBin, 'npm');
    writeFileSync(fakeNpm, `#!${process.execPath}\n` +
      `process.stdout.write(${JSON.stringify(JSON.stringify({
        name: 'codemirror-record',
        version: '2.0.0',
        'dist.integrity': 'sha512-registry-artifact',
      }))});\n`);
    chmodSync(fakeNpm, 0o755);

    try {
      const result = runCompatibilityCheck({
        PATH: fakeBin,
        V2_EXPECTED_INTEGRITY: 'sha512-prepublish-artifact',
        V2_PACKAGE_SPEC: 'codemirror-record@2.0.0',
      });

      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
          'registry dist.integrity differs from V2_EXPECTED_INTEGRITY',
      );
    } finally {
      rmSync(fakeBin, {recursive: true, force: true});
    }
  });

  test('registry artifact checks hash the downloaded tarball bytes', () => {
    const expectedIntegrity = 'sha512-prepublish-artifact';
    const fakeBin = mkdtempSync(join(tmpdir(), 'codemirror-record-npm-'));
    const fakeNpm = join(fakeBin, 'npm');
    const packedFiles = [
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
    ].map((path) => ({path}));
    writeFileSync(fakeNpm, `#!${process.execPath}\n` +
      `const fs = require('node:fs');\n` +
      `const path = require('node:path');\n` +
      `if (process.argv[2] === 'view') {\n` +
      `  process.stdout.write(${JSON.stringify(JSON.stringify({
        name: 'codemirror-record',
        version: '2.0.0',
        'dist.integrity': expectedIntegrity,
      }))});\n` +
      `} else {\n` +
      `  const flag = process.argv.indexOf('--pack-destination');\n` +
      `  const filename = 'codemirror-record-2.0.0.tgz';\n` +
      `  fs.writeFileSync(path.join(process.argv[flag + 1], filename), ` +
      `'tampered registry bytes');\n` +
      `  process.stdout.write(${JSON.stringify(JSON.stringify([{
        filename: 'codemirror-record-2.0.0.tgz',
        files: packedFiles,
        integrity: expectedIntegrity,
        name: 'codemirror-record',
        version: '2.0.0',
      }]))});\n` +
      `}\n`);
    chmodSync(fakeNpm, 0o755);

    try {
      const result = runCompatibilityCheck({
        PATH: fakeBin,
        V2_EXPECTED_INTEGRITY: expectedIntegrity,
        V2_PACKAGE_SPEC: 'codemirror-record@2.0.0',
      });

      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
          'downloaded v2 tarball integrity differs from ' +
          'V2_EXPECTED_INTEGRITY',
      );
    } finally {
      rmSync(fakeBin, {recursive: true, force: true});
    }
  });

  test('makes the real-Chromium smoke test a release and CI gate', () => {
    expect(packageMetadata.scripts['test:browser']).toBe(
        'npm run build && npm run build:browser-fixture && ' +
        'node test/browser-smoke.mjs && ' +
        'node test/browser-cross-generation.mjs',
    );
    expect(readFileSync(
        join(process.cwd(), 'test/browser/fixture.js'),
        'utf8',
    )).toContain("from '../../dist/index.mjs'");
    const crossGenerationBrowserTest = readFileSync(
        join(process.cwd(), 'test/browser-cross-generation.mjs'),
        'utf8',
    );
    expect(crossGenerationBrowserTest).toContain('V2_PACKAGE_SPEC');
    expect(crossGenerationBrowserTest).toContain('V2_EXPECTED_INTEGRITY');
    expect(crossGenerationBrowserTest).toContain('v1.1.5');
    expect(crossGenerationBrowserTest).toContain('v1.1.8');
    expect(crossGenerationBrowserTest).toContain('3 × 3');
    expect(packageMetadata.scripts['test:all']).toContain(
        'npm run test:browser',
    );
    expect(ciWorkflow).toContain(
        'npx playwright install --with-deps chromium',
    );
    expect(ciWorkflow).toMatch(/run: npm run test:all/);
    expect(ciWorkflow).toMatch(/run: npm run test:coverage/);
  });
});

function codeRecordMethods() {
  return Object.getOwnPropertyNames(library.CodeRecord.prototype);
}

function codePlayMethods() {
  return Object.getOwnPropertyNames(library.CodePlay.prototype);
}

function integrityOf(bytes) {
  return 'sha512-' + createHash('sha512').update(bytes).digest('base64');
}

function requiredPackedFiles() {
  return [
    'LICENSE',
    'README.md',
    'dist/index.cjs',
    'dist/index.mjs',
    'dist/main.js',
    'docs/COMPRESSION.md',
    'docs/MIGRATING.md',
    'docs/RELEASING.md',
    'docs/migration-contract.json',
    'package.json',
    'scripts/require-publish-tag.cjs',
    'src/CodePlay.js',
    'src/CodeRecord.js',
    'src/codemirror6.js',
    'src/config.js',
    'src/func/compress/compose.js',
    'src/func/compress/cursor.js',
    'src/func/compress/index.js',
    'src/func/compress/input.js',
    'src/func/compress/remove.js',
    'src/func/compress/select.js',
    'src/func/extract/compose.js',
    'src/func/extract/cursor.js',
    'src/func/extract/index.js',
    'src/func/extract/input.js',
    'src/func/extract/remove.js',
    'src/func/extract/select.js',
    'src/index.d.ts',
    'src/index.js',
    'src/utils/minify.js',
    'src/utils/origin.js',
  ].map((path) => ({path}));
}

function compatibilityEnvironment(overrides) {
  const environment = {...process.env};
  for (const variable of [
    'LEGACY_ALLOW_UNPUBLISHED_SPEC',
    'LEGACY_CANDIDATE_VERSION',
    'LEGACY_EXPECTED_INTEGRITY',
    'LEGACY_PACKAGE_SPEC',
    'V2_EXPECTED_INTEGRITY',
    'V2_PACKAGE_SPEC',
  ]) {
    delete environment[variable];
  }
  return {...environment, ...overrides};
}

function runCompatibilityCheck(environment, arguments_ = []) {
  return spawnSync(process.execPath, [compatibilityScript, ...arguments_], {
    env: compatibilityEnvironment(environment),
  });
}
