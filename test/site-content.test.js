const assert = require('node:assert/strict');
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

function versionLinks(document) {
  return [...document.querySelectorAll(
      'nav[aria-label="Editor version"] a',
  )].map((link) => ({
    current: link.getAttribute('aria-current'),
    href: link.getAttribute('href'),
    text: link.textContent.replace(/\s+/g, ' ').trim(),
  }));
}

test('publishes the CM5 homepage at its versioned canonical URL', () => {
  assert.equal(
      homepage.querySelector('link[rel="canonical"]').href,
      'https://codemirror-record.haoranyu.com/v1/',
  );
  assert.equal(
      homepage.querySelector('meta[property="og:url"]').content,
      'https://codemirror-record.haoranyu.com/v1/',
  );
  assert.deepEqual(versionLinks(homepage), [
    {current: 'page', href: './', text: 'CM5 v1'},
    {current: null, href: '../', text: 'CM6 v2'},
  ]);
});

test('keeps the CM5 demo within v1 while linking to the CM6 demo', () => {
  assert.equal(
      demo.querySelector('link[rel="canonical"]').href,
      'https://codemirror-record.haoranyu.com/v1/demo/',
  );
  assert.equal(
      demo.querySelector('meta[property="og:url"]').content,
      'https://codemirror-record.haoranyu.com/v1/demo/',
  );
  assert.deepEqual(versionLinks(demo), [
    {current: 'page', href: './', text: 'CM5 v1'},
    {current: null, href: '../../demo/', text: 'CM6 v2'},
  ]);
  assert.equal(
      demo.querySelector('.primary-navigation .nav-home').getAttribute('href'),
      '../',
  );
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
