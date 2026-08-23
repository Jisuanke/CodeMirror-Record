const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {spawnSync} = require('node:child_process');
const test = require('node:test');
const {join} = require('node:path');

const root = process.cwd();
const packageMetadata = require('../package.json');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const license = readFileSync(join(root, 'LICENSE'), 'utf8');

test('identifies the maintained CodeMirror 5 release line', () => {
  assert.equal(packageMetadata.version, '1.1.7');
  assert.match(readme, /release\/1\.x/);
  assert.match(readme, /codemirror-record@\^1 codemirror@\^5/);
  assert.match(readme, /codemirror-record@cm5/);
  assert.equal(packageMetadata.publishConfig.tag, 'cm5');
  assert.match(packageMetadata.scripts.prepublishOnly, /require-publish-tag/);
});

test('refuses to publish the CM5 line under any tag except cm5', () => {
  const script = join(root, 'scripts', 'require-publish-tag.cjs');
  const accepted = spawnSync(process.execPath, [script], {
    env: {...process.env, npm_config_tag: 'cm5'},
  });
  const rejected = spawnSync(process.execPath, [script], {
    env: {...process.env, npm_config_tag: 'latest'},
  });

  assert.equal(accepted.status, 0);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr.toString(), /npm publish --tag cm5/);
});

test('links both ways to the default CodeMirror 6 line and migration guide',
    () => {
      assert.match(readme, /tree\/master#readme/);
      assert.match(readme, /blob\/master\/docs\/MIGRATING\.md/);
      assert.match(readme, /codemirror-record\.haoranyu\.com\/migration\//);
    });

test('ships the declared MIT license text', () => {
  assert.match(license, /^MIT License/);
  assert.match(license, /Copyright \(c\) 2019-2026 Haoran Yu/);
});
