#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';

const fullGitSha = /^[0-9a-f]{40}$/;
const requiredArguments = [
  '--main-root',
  '--v1-root',
  '--output',
  '--main-sha',
  '--v1-branch-ref',
];
const siteRoutes = ['/', '/demo/', '/migration/', '/v1/', '/v1/demo/'];

const mainStaticFiles = [
  'index.html',
  'homepage.css',
  'assets/project-artwork.png',
  'README.md',
  'demo/index.html',
  'demo/style.css',
  'demo/main.js',
  'demo/main.js.LICENSE.txt',
  'migration/index.html',
  'migration/style.css',
  'docs/migration-contract.json',
];
const v1StaticFiles = [
  'index.html',
  'homepage.css',
  'assets/project-artwork.png',
  'demo/index.html',
  'demo/style.css',
  'demo/main.js',
  'demo/main.js.LICENSE.txt',
  'demo/vendor/codemirror/5.65.21/LICENSE',
  'demo/vendor/codemirror/5.65.21/addon/edit/closebrackets.js',
  'demo/vendor/codemirror/5.65.21/lib/codemirror.css',
  'demo/vendor/codemirror/5.65.21/lib/codemirror.js',
  'demo/vendor/codemirror/5.65.21/mode/javascript/javascript.js',
];

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const values = new Map();

  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];

    if (!requiredArguments.includes(name)) {
      fail(`unknown argument: ${name ?? '(missing)'}`);
    }
    if (value === undefined || value.startsWith('--')) {
      fail(`missing value for ${name}`);
    }
    if (values.has(name)) fail(`duplicate argument: ${name}`);
    values.set(name, value);
  }

  for (const name of requiredArguments) {
    if (!values.has(name)) fail(`missing required argument: ${name}`);
  }

  return {
    mainRoot: values.get('--main-root'),
    mainSha: values.get('--main-sha'),
    output: values.get('--output'),
    v1BranchRef: values.get('--v1-branch-ref'),
    v1Root: values.get('--v1-root'),
  };
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function resolveExistingDirectory(path, label) {
  const resolved = resolve(path);
  const stats = lstatIfPresent(resolved);
  if (!stats) fail(`${label} does not exist: ${resolved}`);
  const physicalPath = realpathSync(resolved);
  if (!lstatSync(physicalPath).isDirectory()) {
    fail(`${label} must be a directory: ${resolved}`);
  }
  return physicalPath;
}

function resolvePhysicalCandidate(path) {
  const requested = resolve(path);
  let existingAncestor = requested;
  const missingSegments = [];

  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) {
      fail(`cannot resolve output path: ${requested}`);
    }
    missingSegments.unshift(basename(existingAncestor));
    existingAncestor = parent;
  }

  return join(realpathSync(existingAncestor), ...missingSegments);
}

function isWithin(path, directory) {
  const difference = relative(directory, path);
  return difference === '' ||
    (!difference.startsWith('..') && !isAbsolute(difference));
}

function pathsOverlap(first, second) {
  return isWithin(first, second) || isWithin(second, first);
}

function validatePaths(options) {
  const mainRoot = resolveExistingDirectory(options.mainRoot, 'main root');
  const v1Root = resolveExistingDirectory(options.v1Root, 'v1 root');

  if (pathsOverlap(mainRoot, v1Root)) {
    fail('main and v1 source roots must not overlap');
  }

  const requestedOutput = resolve(options.output);
  const outputStats = lstatIfPresent(requestedOutput);
  if (outputStats?.isSymbolicLink()) {
    fail('output path must not be a symbolic link');
  }
  if (outputStats && !outputStats.isDirectory()) {
    fail('an existing output path must be a directory');
  }

  const output = resolvePhysicalCandidate(requestedOutput);
  if (pathsOverlap(output, mainRoot) || pathsOverlap(output, v1Root)) {
    fail('output must not overlap a source root');
  }
  if (outputStats) validateExistingOutput(output);

  return {mainRoot, output, requestedOutput, v1Root};
}

function validateExistingOutput(output) {
  const provenancePath = join(output, 'site-build.json');
  const provenanceStats = lstatIfPresent(provenancePath);

  if (
    !provenanceStats ||
    !provenanceStats.isFile() ||
    provenanceStats.isSymbolicLink() ||
    provenanceStats.nlink !== 1 ||
    realpathSync(provenancePath) !== provenancePath
  ) {
    fail('refusing to replace an output not created by this assembler');
  }

  const provenance = parseJson(
      readFileSync(provenancePath),
      'Existing output site-build.json',
  );
  if (
    provenance?.schemaVersion !== 1 ||
    !fullGitSha.test(provenance?.sources?.main?.commit ?? '') ||
    provenance?.sources?.v1?.branch !== 'v1' ||
    !fullGitSha.test(provenance?.sources?.v1?.commit ?? '') ||
    JSON.stringify(provenance?.routes) !== JSON.stringify(siteRoutes)
  ) {
    fail('refusing to replace an output with invalid provenance');
  }
}

function readSafeSourceFile(root, file) {
  const path = join(root, file);
  const stats = lstatIfPresent(path);

  if (!stats || !stats.isFile() || stats.isSymbolicLink() ||
      stats.nlink !== 1) {
    fail(`source file ${file} must be a regular, unlinked file`);
  }
  if (realpathSync(path) !== path || !isWithin(path, root)) {
    fail(`source file ${file} must not pass through a symbolic link`);
  }

  return readFileSync(path);
}

function parseJson(buffer, label) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    fail(`${label} must contain valid JSON`);
  }
}

function readAndValidateManifest(mainRoot) {
  const source = readSafeSourceFile(
      mainRoot,
      '.github/pages-sources.json',
  );
  const manifest = parseJson(source, 'Pages source manifest');

  if (manifest?.schemaVersion !== 1) {
    fail('Pages source manifest schemaVersion must be 1');
  }
  if (manifest?.v1?.branch !== 'v1') {
    fail('Pages source manifest v1.branch must be "v1"');
  }
  if (!fullGitSha.test(manifest?.v1?.commit ?? '')) {
    fail('Pages source manifest v1.commit must be a full 40-character Git SHA');
  }

  return {manifest, source};
}

function readAndValidatePackage(root, label, requiredMajor) {
  const source = readSafeSourceFile(root, 'package.json');
  const packageMetadata = parseJson(source, `${label} package.json`);
  const majorMatch = typeof packageMetadata?.version === 'string' ?
    packageMetadata.version.match(/^(\d+)\./) : null;
  const major = majorMatch ? Number(majorMatch[1]) : Number.NaN;

  if (major !== requiredMajor) {
    fail(`${label} package major must be ${requiredMajor}`);
  }

  return source;
}

function runGit(root, args, allowedStatuses = [0]) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) throw result.error;
  if (!allowedStatuses.includes(result.status)) {
    const detail = result.stderr.trim() || result.stdout.trim();
    fail(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function resolveCommit(root, reference) {
  return runGit(root, ['rev-parse', '--verify', `${reference}^{commit}`])
      .stdout.trim();
}

function validateSourcesAtHead(root, sources) {
  const files = [...sources.keys()];
  const result = runGit(root, ['ls-tree', '-r', '-z', 'HEAD', '--', ...files]);
  const headBlobs = new Map();

  for (const record of result.stdout.split('\0')) {
    if (!record) continue;
    const match = record.match(
        /^[0-7]+ blob ([0-9a-f]{40})\t(.+)$/,
    );
    if (match) headBlobs.set(match[2], match[1]);
  }

  for (const [file, source] of sources) {
    const headBlob = headBlobs.get(file);
    if (!headBlob) fail(`source file ${file} must be tracked at HEAD`);

    const contentHash = createHash('sha1')
        .update(`blob ${source.length}\0`)
        .update(source)
        .digest('hex');
    if (contentHash !== headBlob) {
      fail(`source file ${file} does not match HEAD`);
    }
  }
}

function validateGitSources(options, paths, manifest) {
  if (!fullGitSha.test(options.mainSha)) {
    fail('--main-sha must be a full 40-character Git SHA');
  }

  const mainHead = resolveCommit(paths.mainRoot, 'HEAD');
  if (mainHead !== options.mainSha) {
    fail(`main HEAD does not match --main-sha: ${mainHead}`);
  }

  const v1Head = resolveCommit(paths.v1Root, 'HEAD');
  if (v1Head !== manifest.v1.commit) {
    fail(`v1 HEAD does not match the manifest: ${v1Head}`);
  }

  const allowedBranchRefs = [
    `refs/heads/${manifest.v1.branch}`,
    `refs/remotes/origin/${manifest.v1.branch}`,
  ];
  if (!allowedBranchRefs.includes(options.v1BranchRef)) {
    fail('--v1-branch-ref must identify the manifest v1 branch');
  }
  resolveCommit(paths.v1Root, options.v1BranchRef);
  const reachability = runGit(
      paths.v1Root,
      ['merge-base', '--is-ancestor', manifest.v1.commit, options.v1BranchRef],
      [0, 1],
  );
  if (reachability.status === 1) {
    fail(`${manifest.v1.commit} is not reachable from ${options.v1BranchRef}`);
  }
}

function collectFiles(root, files, destinationPrefix = '') {
  return files.map((file) => {
    const content = readSafeSourceFile(root, file);
    return {
      content,
      destination: join(destinationPrefix, file),
      source: file,
    };
  });
}

function writeArtifact(output, files, provenance) {
  rmSync(output, {force: true, recursive: true});
  mkdirSync(output, {recursive: true});

  for (const file of files) {
    const destination = join(output, file.destination);
    mkdirSync(dirname(destination), {recursive: true});
    writeFileSync(destination, file.content, {mode: 0o644});
  }

  writeFileSync(join(output, '.nojekyll'), '', {mode: 0o644});
  writeFileSync(
      join(output, 'site-build.json'),
      `${JSON.stringify(provenance, null, 2)}\n`,
      {mode: 0o644},
  );
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const paths = validatePaths(options);
  const manifestInput = readAndValidateManifest(paths.mainRoot);
  const manifest = manifestInput.manifest;

  const mainPackage = readAndValidatePackage(paths.mainRoot, 'main', 2);
  const v1Package = readAndValidatePackage(paths.v1Root, 'v1', 1);
  validateGitSources(options, paths, manifest);

  const mainFiles = collectFiles(paths.mainRoot, mainStaticFiles);
  const v1Files = collectFiles(paths.v1Root, v1StaticFiles, 'v1');
  validateSourcesAtHead(paths.mainRoot, new Map([
    ['.github/pages-sources.json', manifestInput.source],
    ['package.json', mainPackage],
    ...mainFiles.map((file) => [file.source, file.content]),
  ]));
  validateSourcesAtHead(paths.v1Root, new Map([
    ['package.json', v1Package],
    ...v1Files.map((file) => [file.source, file.content]),
  ]));

  const files = [...mainFiles, ...v1Files];
  const provenance = {
    schemaVersion: 1,
    sources: {
      main: {commit: options.mainSha},
      v1: {branch: manifest.v1.branch, commit: manifest.v1.commit},
    },
    routes: siteRoutes,
  };

  const outputStats = lstatIfPresent(paths.requestedOutput);
  if (outputStats?.isSymbolicLink()) {
    fail('output path must not be a symbolic link');
  }
  writeArtifact(paths.output, files, provenance);
  process.stdout.write(`Built versioned site at ${paths.output}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`build-versioned-site: ${error.message}\n`);
  process.exitCode = 1;
}
