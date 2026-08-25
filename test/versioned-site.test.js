import {
  existsSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';

import {afterEach, describe, expect, test} from 'vitest';

const projectRoot = process.cwd();
const builder = join(projectRoot, 'scripts/build-versioned-site.mjs');
const productionManifest = JSON.parse(readFileSync(
    join(projectRoot, '.github/pages-sources.json'),
    'utf8',
));
const expectedV1Commit =
  '149c86f954d0798642101bc1000e770a57e1ee18';

const mainStaticFiles = [
  'README.md',
  'assets/project-artwork.png',
  'demo/index.html',
  'demo/main.js',
  'demo/main.js.LICENSE.txt',
  'demo/style.css',
  'docs/migration-contract.json',
  'homepage.css',
  'index.html',
  'migration/index.html',
  'migration/style.css',
];
const v1StaticFiles = [
  'assets/project-artwork.png',
  'demo/index.html',
  'demo/main.js',
  'demo/main.js.LICENSE.txt',
  'demo/style.css',
  'demo/vendor/codemirror/5.65.21/LICENSE',
  'demo/vendor/codemirror/5.65.21/addon/edit/closebrackets.js',
  'demo/vendor/codemirror/5.65.21/lib/codemirror.css',
  'demo/vendor/codemirror/5.65.21/lib/codemirror.js',
  'demo/vendor/codemirror/5.65.21/mode/javascript/javascript.js',
  'homepage.css',
  'index.html',
];

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, {force: true, recursive: true});
  }
});

function write(root, file, content = `${file}\n`) {
  const destination = join(root, file);
  mkdirSync(dirname(destination), {recursive: true});
  writeFileSync(destination, content);
}

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function initializeRepository(root, branch) {
  mkdirSync(root, {recursive: true});
  execFileSync('git', ['init', '--quiet', '--initial-branch', branch, root]);
  git(root, 'config', 'user.email', 'pages-test@example.com');
  git(root, 'config', 'user.name', 'Pages test');
}

function commitAll(root, message) {
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '--message', message);
  return git(root, 'rev-parse', 'HEAD');
}

function createFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'cm-record-pages-'));
  temporaryDirectories.push(fixtureRoot);

  const mainRoot = join(fixtureRoot, 'main');
  const v1Root = join(fixtureRoot, 'v1');
  const output = join(fixtureRoot, 'site');

  initializeRepository(v1Root, 'v1');
  write(v1Root, 'package.json', JSON.stringify({version: '1.1.8'}));
  for (const file of v1StaticFiles) write(v1Root, file, `v1:${file}\n`);
  write(v1Root, 'CNAME', 'should-not-be-copied.example\n');
  write(v1Root, 'demo/index.js', 'not allowlisted\n');
  const v1Commit = commitAll(v1Root, 'Create v1 site');
  git(v1Root, 'update-ref', 'refs/remotes/origin/v1', v1Commit);

  initializeRepository(mainRoot, 'main');
  write(mainRoot, 'package.json', JSON.stringify({version: '2.0.0'}));
  for (const file of mainStaticFiles) {
    write(mainRoot, file, `main:${file}\n`);
  }
  write(mainRoot, 'CNAME', 'should-not-be-copied.example\n');
  write(mainRoot, 'demo/index.js', 'not allowlisted\n');
  write(mainRoot, '.github/pages-sources.json', JSON.stringify({
    schemaVersion: 1,
    v1: {branch: 'v1', commit: v1Commit},
  }));
  const mainCommit = commitAll(mainRoot, 'Create main site');

  return {fixtureRoot, mainCommit, mainRoot, output, v1Commit, v1Root};
}

function buildSite(fixture, overrides = {}) {
  const values = {
    mainRoot: fixture.mainRoot,
    mainSha: fixture.mainCommit,
    output: fixture.output,
    v1BranchRef: 'refs/remotes/origin/v1',
    v1Root: fixture.v1Root,
    ...overrides,
  };

  return spawnSync(process.execPath, [
    builder,
    '--main-root', values.mainRoot,
    '--v1-root', values.v1Root,
    '--output', values.output,
    '--main-sha', values.mainSha,
    '--v1-branch-ref', values.v1BranchRef,
  ], {encoding: 'utf8'});
}

function listFiles(root) {
  const files = [];

  function visit(directory) {
    for (const entry of readdirSync(directory, {withFileTypes: true})) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else files.push(relative(root, path));
    }
  }

  visit(root);
  return files.sort();
}

function readArtifact(root) {
  return Object.fromEntries(listFiles(root).map((file) => [
    file,
    readFileSync(join(root, file), 'utf8'),
  ]));
}

describe('versioned Pages source manifest', () => {
  test('pins the reviewed v1 site commit instead of a floating branch', () => {
    expect(productionManifest).toEqual({
      schemaVersion: 1,
      v1: {
        branch: 'v1',
        commit: expectedV1Commit,
      },
    });
  });
});

describe('versioned Pages builder CLI', () => {
  test('builds a deterministic, allowlisted site from exact source commits',
      () => {
        const fixture = createFixture();
        const firstBuild = buildSite(fixture);

        expect(firstBuild.status, firstBuild.stderr).toBe(0);
        expect(listFiles(fixture.output)).toEqual([
          '.nojekyll',
          'README.md',
          'assets/project-artwork.png',
          'demo/index.html',
          'demo/main.js',
          'demo/main.js.LICENSE.txt',
          'demo/style.css',
          'docs/migration-contract.json',
          'homepage.css',
          'index.html',
          'migration/index.html',
          'migration/style.css',
          'site-build.json',
          'v1/assets/project-artwork.png',
          'v1/demo/index.html',
          'v1/demo/main.js',
          'v1/demo/main.js.LICENSE.txt',
          'v1/demo/style.css',
          'v1/demo/vendor/codemirror/5.65.21/LICENSE',
          'v1/demo/vendor/codemirror/5.65.21/addon/edit/closebrackets.js',
          'v1/demo/vendor/codemirror/5.65.21/lib/codemirror.css',
          'v1/demo/vendor/codemirror/5.65.21/lib/codemirror.js',
          'v1/demo/vendor/codemirror/5.65.21/mode/javascript/javascript.js',
          'v1/homepage.css',
          'v1/index.html',
        ]);
        expect(readFileSync(join(fixture.output, 'index.html'), 'utf8'))
            .toBe('main:index.html\n');
        expect(readFileSync(join(fixture.output, 'v1/index.html'), 'utf8'))
            .toBe('v1:index.html\n');
        expect(readFileSync(join(fixture.output, '.nojekyll'), 'utf8'))
            .toBe('');
        const expectedProvenance = {
          schemaVersion: 1,
          sources: {
            main: {commit: fixture.mainCommit},
            v1: {branch: 'v1', commit: fixture.v1Commit},
          },
          routes: ['/', '/demo/', '/migration/', '/v1/', '/v1/demo/'],
        };
        const provenance = readFileSync(
            join(fixture.output, 'site-build.json'),
            'utf8',
        );
        expect(JSON.parse(provenance)).toEqual(expectedProvenance);
        expect(provenance).toBe(
            `${JSON.stringify(expectedProvenance, null, 2)}\n`,
        );
        expect(existsSync(join(fixture.output, 'CNAME'))).toBe(false);
        expect(existsSync(join(fixture.output, 'demo/index.js'))).toBe(false);

        const firstArtifact = readArtifact(fixture.output);
        write(fixture.output, 'stale.txt', 'stale\n');
        const secondBuild = buildSite(fixture);
        expect(secondBuild.status, secondBuild.stderr).toBe(0);
        expect(readArtifact(fixture.output)).toEqual(firstArtifact);
      });

  test('rejects a v1 checkout whose commit differs from the manifest pin',
      () => {
        const fixture = createFixture();
        write(fixture.v1Root, 'index.html', 'later v1 content\n');
        commitAll(fixture.v1Root, 'Change v1 site');

        const result = buildSite(fixture);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('v1 HEAD does not match the manifest');
        expect(existsSync(fixture.output)).toBe(false);
      });

  test('rejects modified allowlisted content even when HEAD is exact', () => {
    const fixture = createFixture();
    write(fixture.mainRoot, 'index.html', 'uncommitted replacement\n');

    const result = buildSite(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('source file index.html does not match HEAD');
    expect(existsSync(fixture.output)).toBe(false);
  });

  test('rejects a main checkout that differs from --main-sha', () => {
    const fixture = createFixture();

    const result = buildSite(fixture, {mainSha: '0'.repeat(40)});

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('main HEAD does not match --main-sha');
    expect(existsSync(fixture.output)).toBe(false);
  });

  test('rejects a pinned v1 commit outside the required v1 branch', () => {
    const fixture = createFixture();
    git(fixture.v1Root, 'checkout', '--quiet', '--orphan', 'unrelated');
    git(fixture.v1Root, 'rm', '--quiet', '-r', '--force', '.');
    write(fixture.v1Root, 'unrelated.txt', 'unrelated branch\n');
    const unrelatedCommit = commitAll(fixture.v1Root, 'Unrelated history');
    git(fixture.v1Root, 'update-ref', 'refs/remotes/origin/v1', unrelatedCommit);
    git(fixture.v1Root, 'checkout', '--quiet', '--detach', fixture.v1Commit);

    const result = buildSite(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('is not reachable from refs/remotes/origin/v1');
    expect(existsSync(fixture.output)).toBe(false);
  });

  test.each([
    ['main', 'package.json', JSON.stringify({version: '1.9.0'}),
      'main package major must be 2'],
    ['v1', 'package.json', JSON.stringify({version: '2.0.0'}),
      'v1 package major must be 1'],
  ])('rejects an invalid %s package generation',
      (source, file, content, error) => {
        const fixture = createFixture();
        const root = source === 'main' ? fixture.mainRoot : fixture.v1Root;
        write(root, file, content);
        const changedCommit = commitAll(root, `Change ${source} package`);
        if (source === 'main') fixture.mainCommit = changedCommit;
        else {
          fixture.v1Commit = changedCommit;
          git(root, 'update-ref', 'refs/remotes/origin/v1', changedCommit);
          write(fixture.mainRoot, '.github/pages-sources.json', JSON.stringify({
            schemaVersion: 1,
            v1: {branch: 'v1', commit: changedCommit},
          }));
          fixture.mainCommit = commitAll(fixture.mainRoot, 'Update v1 pin');
        }

        const result = buildSite(fixture);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(error);
        expect(existsSync(fixture.output)).toBe(false);
      });

  test('rejects an output path that overlaps a source checkout', () => {
    const fixture = createFixture();

    const result = buildSite(fixture, {
      output: join(fixture.mainRoot, 'generated-site'),
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('output must not overlap a source root');
    expect(existsSync(join(fixture.mainRoot, 'generated-site'))).toBe(false);
  });

  test('rejects an output symlink without modifying its target', () => {
    const fixture = createFixture();
    const target = join(fixture.fixtureRoot, 'symlink-target');
    mkdirSync(target);
    write(target, 'keep.txt', 'keep\n');
    symlinkSync(target, fixture.output, 'dir');

    const result = buildSite(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('output path must not be a symbolic link');
    expect(lstatSync(fixture.output).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(target, 'keep.txt'), 'utf8')).toBe('keep\n');
  });

  test('refuses to recursively replace an unrelated existing directory', () => {
    const fixture = createFixture();
    mkdirSync(fixture.output);
    write(fixture.output, 'keep.txt', 'keep\n');

    const result = buildSite(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
        'refusing to replace an output not created by this assembler',
    );
    expect(readFileSync(join(fixture.output, 'keep.txt'), 'utf8')).toBe('keep\n');
  });

  test.each([
    ['symbolic link', (fixture) => {
      rmSync(join(fixture.v1Root, 'index.html'));
      symlinkSync('homepage.css', join(fixture.v1Root, 'index.html'));
    }],
    ['hard link', (fixture) => {
      rmSync(join(fixture.v1Root, 'index.html'));
      linkSync(
          join(fixture.v1Root, 'homepage.css'),
          join(fixture.v1Root, 'index.html'),
      );
    }],
  ])('rejects a %s in an allowlisted source path', (_, changeSource) => {
    const fixture = createFixture();
    changeSource(fixture);

    const result = buildSite(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/source file .* must be a regular, unlinked file/);
    expect(existsSync(fixture.output)).toBe(false);
  });

  test.each([
    [{schemaVersion: 2, v1: {branch: 'v1', commit: 'a'.repeat(40)}},
      'schemaVersion must be 1'],
    [{schemaVersion: 1, v1: {branch: 'maintenance', commit: 'a'.repeat(40)}},
      'v1.branch must be "v1"'],
    [{schemaVersion: 1, v1: {branch: 'v1', commit: 'not-a-sha'}},
      'v1.commit must be a full 40-character Git SHA'],
  ])('rejects an invalid Pages source manifest', (manifest, error) => {
    const fixture = createFixture();
    write(
        fixture.mainRoot,
        '.github/pages-sources.json',
        JSON.stringify(manifest),
    );
    fixture.mainCommit = commitAll(fixture.mainRoot, 'Break source manifest');

    const result = buildSite(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(error);
    expect(existsSync(fixture.output)).toBe(false);
  });

  test('resolves source and output paths before checking overlap', () => {
    const fixture = createFixture();
    const sourceAlias = join(fixture.fixtureRoot, 'main-alias');
    symlinkSync(realpathSync(fixture.mainRoot), sourceAlias, 'dir');

    const result = buildSite(fixture, {
      output: join(sourceAlias, 'generated-site'),
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('output must not overlap a source root');
  });
});
