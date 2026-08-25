const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const test = require('node:test');
const {join} = require('node:path');

const {JSDOM} = require('jsdom');

const root = process.cwd();
const homepageHtml = readFileSync(join(root, 'index.html'), 'utf8');
const demoHtml = readFileSync(join(root, 'demo/index.html'), 'utf8');
const homepage = new JSDOM(homepageHtml).window.document;
const demo = new JSDOM(demoHtml).window.document;

const expectedAuthor = 'Haoran Yu & Jisuanke Team';

test('publishes the CM5 homepage at its versioned canonical URL', () => {
  assert.equal(
      homepage.querySelector('link[rel="canonical"]').href,
      'https://codemirror-record.haoranyu.com/v1/',
  );
  assert.equal(
      homepage.querySelector('meta[property="og:url"]').content,
      'https://codemirror-record.haoranyu.com/v1/',
  );
  assert.equal(
      homepage.querySelector('.site-header .version-switcher'),
      null,
  );
  const versionNotice = homepage.querySelector('.version-notice');
  assert.ok(versionNotice);
  assert.equal(versionNotice.closest('.site-header'), null);
  assert.equal(
      versionNotice.textContent.replace(/\s+/g, ' ').trim(),
      'Upgraded to CodeMirror 6.x? Use CodeMirror Record version 2 instead.',
  );
  assert.equal(versionNotice.querySelector('a').getAttribute('href'), '../');
});

test('keeps the CM5 demo within v1 with quiet CM6 guidance', () => {
  assert.equal(
      demo.querySelector('link[rel="canonical"]').href,
      'https://codemirror-record.haoranyu.com/v1/demo/',
  );
  assert.equal(
      demo.querySelector('meta[property="og:url"]').content,
      'https://codemirror-record.haoranyu.com/v1/demo/',
  );
  assert.equal(demo.querySelector('.site-header .version-switcher'), null);
  const versionNotice = demo.querySelector('.version-notice');
  assert.ok(versionNotice);
  assert.equal(versionNotice.closest('.site-header'), null);
  assert.equal(
      versionNotice.textContent.replace(/\s+/g, ' ').trim(),
      'Upgraded to CodeMirror 6.x? Try the version 2 demo instead.',
  );
  assert.equal(
      versionNotice.querySelector('a').getAttribute('href'),
      '../../demo/',
  );
  assert.equal(
      demo.querySelector('.primary-navigation .nav-home').getAttribute('href'),
      '../',
  );
});

test('self-hosts the reviewed homepage artwork', () => {
  assert.equal(
      homepage.querySelector('.home-hero-artwork img').getAttribute('src'),
      './assets/project-artwork.png',
  );
  assert.equal(
      homepage.querySelector('meta[property="og:image"]').content,
      'https://codemirror-record.haoranyu.com/v1/assets/project-artwork.png',
  );
  assert.doesNotMatch(homepageHtml, /repository-images\.githubusercontent\.com/);
  assert.equal(
      createHash('sha256').update(readFileSync(
          join(root, 'assets/project-artwork.png'),
      )).digest('hex'),
      '2499961b317f1e8d227fb7208adc5c050e1ef6e1161362e2a819aa2f9a2a2d36',
  );
});

test('self-hosts the exact locked CodeMirror 5 runtime used by the demo', () => {
  const browserAssets = [
    ...demo.querySelectorAll('link[rel="stylesheet"][href], script[src]'),
  ].map((element) => element.getAttribute('href') || element.getAttribute('src'));

  assert.deepEqual(browserAssets, [
    './vendor/codemirror/5.65.21/lib/codemirror.css',
    './style.css?v=1.1.8',
    './vendor/codemirror/5.65.21/lib/codemirror.js',
    './vendor/codemirror/5.65.21/mode/javascript/javascript.js',
    './vendor/codemirror/5.65.21/addon/edit/closebrackets.js',
    './main.js?v=1.1.8',
  ]);

  const vendoredFiles = [
    ['LICENSE', '168a4becc968f5001e2ee2e0291b6e4daabafc1894a11ade1e11d56e96096e07'],
    ['lib/codemirror.css', 'eb494ea972d2661ef86f7f6ac656dd6786d721e49c9c1b46e1eb967e4b6f9bf3'],
    ['lib/codemirror.js', 'e98aac5ffa07bae58acd4ff07c4293059f8921c0ae0eba506929d8c6f41c9288'],
    ['mode/javascript/javascript.js', '1311c73c66308ba6f78512b4c2e770a6900c80c3629683763329668ee6111163'],
    ['addon/edit/closebrackets.js', '143c3014c29254f3531cc30be6d90205084bcfc36cffa6f9b2a46fd42a40be20'],
  ];

  const lockedCodeMirror = require('../package-lock.json')
      .packages['node_modules/codemirror'];
  assert.deepEqual(
      {
        integrity: lockedCodeMirror.integrity,
        version: lockedCodeMirror.version,
      },
      {
        integrity: 'sha512-6teYk0bA0nR3QP0ihGMoxuKzpl5W80FpnHpBJpgy66NK3cZv5b/d/HY8PnRvfSsCG1MTfr92u2WUl+wT0E40mQ==',
        version: '5.65.21',
      },
  );

  for (const [file, expectedHash] of vendoredFiles) {
    const vendoredContents = readFileSync(
        join(root, 'demo/vendor/codemirror/5.65.21', file),
    );
    assert.deepEqual(
        vendoredContents,
        readFileSync(join(root, 'node_modules/codemirror', file)),
        `${file} must remain byte-identical to the locked codemirror package`,
    );
    assert.equal(
        createHash('sha256').update(vendoredContents).digest('hex'),
        expectedHash,
        `${file} must retain the reviewed CodeMirror 5.65.21 bytes`,
    );
  }
});

test('publishes version-safe install and source links', () => {
  assert.match(
      homepageHtml,
      /npm install codemirror-record@\^1 codemirror@\^5/,
  );
  assert.match(homepageHtml, /codemirror-record@cm5/);
  assert.doesNotMatch(
      homepageHtml,
      /npm install codemirror-record codemirror@5/,
  );

  for (const document of [homepage, demo]) {
    const githubLink = document.querySelector(
        '.primary-navigation a[href*="github.com"]',
    );
    assert.match(githubLink.href, /CodeMirror-Record\/tree\/v1/);
  }

  assert.equal(
      homepage.querySelector('a[href="../migration/"]').textContent.trim(),
      'Migration',
  );
});

test('uses the project author credit and maintained v1 version everywhere', () => {
  for (const document of [homepage, demo]) {
    assert.equal(
        document.querySelector('meta[name="author"]').content,
        expectedAuthor,
    );
    assert.equal(
        document.querySelector('[data-author-credit]').textContent.trim(),
        expectedAuthor,
    );
  }

  for (const page of [homepageHtml, demoHtml]) {
    assert.match(page, /1\.1\.8/);
    assert.doesNotMatch(page, /1\.1\.6/);
  }
});
