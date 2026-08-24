import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {EditorSelection, EditorState} from '@codemirror/state';
import {Linter} from 'eslint';
import {describe, expect, test} from 'vitest';

const homepage = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const demo = readFileSync(join(process.cwd(), 'demo/index.html'), 'utf8');
const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
const compressionDecision = readFileSync(
    join(process.cwd(), 'docs/COMPRESSION.md'),
    'utf8',
);
const migrationGuide = readFileSync(
    join(process.cwd(), 'docs/MIGRATING.md'),
    'utf8',
);
const migrationResearch = readFileSync(
    join(process.cwd(), 'docs/MIGRATION_RESEARCH.md'),
    'utf8',
);
const migrationContract = JSON.parse(readFileSync(
    join(process.cwd(), 'docs/migration-contract.json'),
    'utf8',
));
const migrationPage = readFileSync(
    join(process.cwd(), 'migration/index.html'),
    'utf8',
);
const releasePolicy = readFileSync(
    join(process.cwd(), 'docs/RELEASING.md'),
    'utf8',
);
const homepageStyles = readFileSync(
    join(process.cwd(), 'homepage.css'),
    'utf8',
);
const demoStyles = readFileSync(
    join(process.cwd(), 'demo/style.css'),
    'utf8',
);
const migrationStyles = readFileSync(
    join(process.cwd(), 'migration/style.css'),
    'utf8',
);
const migrationGuideText = normalizeRenderedText(migrationGuide);
const migrationPageText = normalizeRenderedText(
    migrationPage.replace(/<[^>]+>/g, ' '),
);
const deployedMigrationMarkdown =
  'https://raw.githubusercontent.com/Jisuanke/CodeMirror-Record/' +
  'main/docs/MIGRATING.md';

describe('public site version guidance', () => {
  test('uses one author credit across every public page', () => {
    const author = 'Haoran Yu &amp; Jisuanke Team';

    for (const page of [homepage, demo, migrationPage]) {
      expect(page).toContain(`<meta name="author" content="${author}">`);
      expect(page).toContain(`data-author-credit>${author}<`);
    }
  });

  test('publishes one agent-readable CM5 to CM6 migration contract', () => {
    expect(migrationGuide).toContain('schema_version: 1');
    expect(migrationGuide).toContain('<a id="migration-contract"></a>');
    expect(migrationGuide).toContain('Do not transform existing recordings');
    expect(migrationGuide).toContain(
        'npm install codemirror-record@^2 @codemirror/state@^6 @codemirror/view@^6',
    );
    expect(migrationGuide).toContain('CodeRecord(editor)');
    expect(migrationGuide).toContain('CodePlay(editor, options)');
    expect(migrationGuide).toContain('<a id="agent-checklist"></a>');
    expect(migrationGuide).toContain('/tree/v1#readme');
    expect(migrationGuide).toContain('https://codemirror.net/docs/migration/');
    expect(migrationGuide).toContain(
        'https://codemirror-record.haoranyu.com/migration/',
    );
    expect(migrationGuide).toContain(
        'machine_contract: ./migration-contract.json',
    );
    expect(migrationGuide).toContain(
        '[migration-contract.json](./migration-contract.json)',
    );
    expect(migrationGuide).toContain('Do not assert the old `PLAY`-inside-`end` bug');

    expect(migrationPage).toContain('rel="alternate"');
    expect(migrationPage).toContain('type="text/markdown"');
    expect(migrationPage).toContain(deployedMigrationMarkdown);
    expect(migrationPage).not.toContain('href="../docs/MIGRATING.md"');
    expect(migrationPage).toContain('type="application/json"');
    expect(migrationPage).toContain('../docs/migration-contract.json');
    expect(migrationPage).toContain('id="migration-contract"');
    expect(migrationPage).toContain('id="agent-checklist"');
    expect(migrationPage).toContain('CM5 <span aria-hidden="true">\u2192</span> wire');
    expect(migrationPage).toContain('Do not transform existing recordings');
    expect(migrationPage).toContain('/tree/v1#readme');
    expect(migrationPage).toContain('../README.md');
    expect(migrationPage).toContain(
        '<a href="#procedure"><span>11</span> Procedure</a>',
    );
    expect(migrationPage).toContain(
        '<a href="#agent-checklist"><span>12</span> Verify</a>',
    );
    expect(migrationPage).toContain('Corrected edge behavior.');
    expect(migrationPage).toContain('PLAY</code>-inside-<code>end</code> bug');
    expect(migrationPage).not.toContain(
        '<code>targetLine.from + ch</code>',
    );
    expect(migrationStyles).toContain('--cm5: #f1a2b5;');
    expect(migrationStyles).toContain('--wire: #7dd3fc;');
    expect(migrationStyles).toContain('--cm6: #4ade80;');
    expect(migrationStyles).toMatch(/@media \(max-width: 680px\)/);

    expect(migrationContract).toMatchObject({
      schemaVersion: 1,
      migration: 'codemirror-record-cm5-to-cm6',
      canonicalMarkdownUrl: deployedMigrationMarkdown,
      wireContract: {
        format: 'established-v1-json',
        recordingTransform: 'forbidden',
        traceEquality: {
          default: 'required at every logical boundary',
          exceptions: [
            {
              id: 'ungrouped-interval-reader-timing',
              payloadShape: 'ungrouped t: [start, end] with no l',
              readers:
                'published codemirror-record v0.3.1 through v1.1.7',
              allowedDifference:
                'operation time, duration, and affected seek timing only',
              durationScope:
                'only when the terminal record has this shape',
              seekScope:
                'any seek comparison for a payload containing this shape',
              canonicalLogicalTime: 'end',
              payloadTransform: 'forbidden',
            },
            {
              id: 'compressed-scalar-reader-timing',
              payloadShape: 'compressed scalar t with l > 1',
              readers:
                'published codemirror-record v0.3.1 through v1.1.7',
              allowedDifference:
                'operation time, duration, and affected seek timing only',
              durationScope:
                'only when the terminal record has this shape',
              seekScope:
                'any seek comparison for a payload containing this shape',
              canonicalLogicalTime:
                'scalar t for every expanded operation',
              maintainedWriterOutput:
                't: [time, time] for a compressed equal-time group',
              payloadTransform: 'forbidden',
            },
          ],
        },
      },
      recorderListenerLifecycle: {
        install: 'CodeRecord.listen()',
        idempotent: true,
        viewSetStateIsRecorded: false,
        sameRecordingReset:
          'dispatch equivalent document and selection transaction before ' +
          'view.setState(newState), then call recorder.listen()',
        newRecordingReset:
          'drain the old recorder, replace state, create a new CodeRecord ' +
          'with the new state as its baseline, then call listen()',
        reinstallAfter: [
          'view.setState(newState)',
          'StateEffect.reconfigure.of(...)',
        ],
        preservedBy:
          'Compartment.reconfigure(...) when it does not replace the full ' +
          'top-level configuration',
        topLevelReconfigure:
          'keep recordable document and selection changes in a separate ' +
          'transaction before reconfiguration',
      },
    });
    for (const command of Object.values(migrationContract.installCommands)) {
      expect(migrationGuide).toContain(command);
      expect(migrationPage).toContain(command);
    }
    for (const surface of Object.values(migrationContract.retainedSurface)) {
      for (const entry of surface) {
        const publicName = entry.split('(')[0];
        expect(migrationGuide).toContain(publicName);
        expect(migrationPage).toContain(publicName);
      }
    }
    for (const mappings of Object.values(migrationContract.editorMappings)) {
      for (const mapping of mappings) {
        expect(migrationGuideText).toContain(
            normalizeRenderedText(mapping.cm5),
        );
        expect(migrationPageText).toContain(
            normalizeRenderedText(mapping.cm5),
        );
        if (!mapping.cm5.startsWith('cm.set')) {
          expect(migrationGuideText).toContain(
              normalizeRenderedText(mapping.cm6),
          );
          expect(migrationPageText).toContain(
              normalizeRenderedText(mapping.cm6),
          );
        }
      }
    }
    for (const correction of migrationContract.correctedRuntimeBehavior) {
      for (const requiredTerm of correction.requiredTerms) {
        expect(migrationGuideText).toContain(
            normalizeRenderedText(requiredTerm),
        );
        expect(migrationPageText).toContain(
            normalizeRenderedText(requiredTerm),
        );
      }
    }
    expect(
        migrationContract.correctedRuntimeBehavior.find(
            ({id}) => id === 'ungrouped-interval-uses-end-timestamp',
        ),
    ).toMatchObject({
      wireShape: {t: '[start, end]', l: 'absent'},
      logicalTime: 'end',
      affectedReaders: [
        'published codemirror-record v0.3.1 through v1.1.7',
      ],
      fixedReaders: [
        'codemirror-record v1.1.8',
        'codemirror-record v2.0.0',
      ],
      writerOutput: 'scalar end timestamp for every new ungrouped record',
      payloadTransform: 'forbidden',
    });
    for (const section of migrationContract.sections) {
      expect(migrationGuide).toContain(
          `<a id="${section.markdownAnchor}"></a>`,
      );
      expect(migrationPage).toContain(`id="${section.htmlId}"`);
      expect(migrationPage).toContain(
          `<span>${section.number}</span>`,
      );
    }
  });

  test('publishes an executable CM5 selection conversion contract', () => {
    const mapping =
      'Convert each anchor/head to offsets with EditorSelection.range, then ' +
      'call EditorSelection.create(selectionRanges, primaryIndex)';
    const setSelectionsMapping =
      'Normalize touching/overlapping input according to application CM5 ' +
      'semantics, convert each anchor/head with EditorSelection.range, then ' +
      'call EditorSelection.create(selectionRanges, primaryIndex)';

    expect(migrationContract.selectionConversion).toEqual({
      mapping,
      inputNormalization:
        'recipe accepts an already-normalized cm.listSelections() snapshot; ' +
        'raw touching or overlapping setSelections input requires explicit ' +
        'CM5/application normalization first',
      inputRange: {
        anchor:
          'CM5 {line, ch}; ch may be null or omitted for line end',
        head:
          'CM5 {line, ch}; defaults to anchor; ch may be null or omitted ' +
          'for line end',
      },
      positionConverter: 'cm5PositionToOffset(view.state.doc, position)',
      positionClipping: {
        lineBeforeDocument: 'offset 0',
        lineAfterDocument: 'doc.length',
        character: 'clamp to 0 through targetLine.length',
      },
      rangeFactory: 'EditorSelection.range(anchorOffset, headOffset)',
      selectionFactory:
        'EditorSelection.create(selectionRanges, primaryIndex)',
      primaryIndex: {
        explicit: 'preserve the CM5 primary argument',
        omitted:
          'Math.min(selectionRanges.length - 1, previousPrimaryIndex)',
        cm5Default:
          'preserve the previous primary index, clamped to the new last index',
        snapshot:
          "match cm5.getCursor('anchor') and cm5.getCursor('head') against " +
          'cm5.listSelections(), then pass that index explicitly',
      },
      emptyRanges: 'no-op, matching CM5 setSelections([])',
      requiredExtension: 'EditorState.allowMultipleSelections.of(true)',
      directionInvariant:
        'preserve anchor/head order; never substitute from/to',
    });
    expect(migrationContract.editorMappings.selections.slice(-3)).toEqual([
      {
        cm5: 'cm.setCursor(pos)',
        cm6: 'Convert pos with cm5PositionToOffset, then dispatch the ' +
          'numeric anchor offset',
      },
      {
        cm5: 'cm.setSelection(anchor, head)',
        cm6: 'Convert anchor and head with cm5PositionToOffset, then ' +
          'dispatch both numeric offsets',
      },
      {
        cm5: 'cm.setSelections(ranges, primary)',
        cm6: setSelectionsMapping,
      },
    ]);

    for (const copy of [
      migrationGuideText,
      migrationPageText,
      normalizeRenderedText(migrationResearch),
    ]) {
      expect(copy).toContain(normalizeRenderedText(mapping));
      expect(copy).toContain('editorselection.range');
      expect(copy).toContain(
          'editorselection.create(selectionranges, primaryindex)',
      );
      expect(copy).toContain('editorstate.allowmultipleselections.of(true)');
      expect(copy).toContain('selectionranges.length - 1');
      expect(copy).toContain('previousprimaryindex');
      expect(copy).toContain('empty');
      expect(copy).toContain('already-normalized');
      expect(copy).toContain('selectionsmaytouch');
    }
    for (const copy of [migrationGuide, migrationPage, migrationResearch]) {
      expect(copy).not.toContain('EditorSelection.create(ranges)');
      expect(copy).not.toContain('{selection: {anchor: pos}}');
      expect(copy).not.toContain(
          'if (selectionRanges.length === 0) return;',
      );
      expect(copy).toContain('recorder.listen()');
      expect(copy).toContain('view.setState(newState)');
      expect(normalizeRenderedText(copy)).toContain(
          'not a transaction',
      );
      expect(normalizeRenderedText(copy)).toContain(
          'published v0.3.1 through v1.1.7',
      );
    }
    expect(normalizeRenderedText(readme)).toContain(
        'published v0.3.1 through v1.1.7',
    );
    expect(migrationGuide).toContain('selectionRanges.length > 0');
    expect(migrationResearch).toContain('selectionRanges.length > 0');
    expect(migrationPage).toContain('selectionRanges.length &gt; 0');
  });

  test('the documented selection recipe preserves direction and primary', () => {
    const docText = 'abcd\nefgh\nijkl\nmnop';
    const conversionState = EditorState.create({doc: docText});
    const cm5Ranges = [
      {
        anchor: {line: 1, ch: 3},
        head: {line: 0, ch: 1},
      },
      {
        anchor: {line: 3, ch: 2},
        head: {line: 2, ch: 1},
      },
    ];
    const cm5PositionToOffset = (doc, {line, ch}) => {
      if (line < 0) return 0;
      if (line >= doc.lines) return doc.length;
      const targetLine = doc.line(line + 1);
      const clippedCh = ch == null ? targetLine.length :
        Math.max(0, Math.min(targetLine.length, ch));
      return targetLine.from + clippedCh;
    };
    const migrateCm5Selections = (
        ranges,
        cm5PrimaryIndex,
        previousPrimaryIndex,
    ) => {
      const selectionRanges = ranges.map(({anchor, head = anchor}) =>
        EditorSelection.range(
            cm5PositionToOffset(conversionState.doc, anchor),
            cm5PositionToOffset(conversionState.doc, head),
        ));
      if (selectionRanges.length === 0) return undefined;
      const primaryIndex = cm5PrimaryIndex ?? Math.min(
          selectionRanges.length - 1,
          previousPrimaryIndex,
      );
      return EditorSelection.create(selectionRanges, primaryIndex);
    };
    const previousPrimaryIndex = conversionState.selection.mainIndex;
    const migratedSelection = migrateCm5Selections(
        cm5Ranges,
        undefined,
        previousPrimaryIndex,
    );

    expect(migratedSelection.toJSON()).toEqual({
      ranges: [
        {anchor: 8, head: 1},
        {anchor: 17, head: 11},
      ],
      main: 0,
    });

    const selectionRanges = migratedSelection.ranges;
    const clampedPrimaryIndex = Math.min(selectionRanges.length - 1, 99);
    expect(clampedPrimaryIndex).toBe(1);
    expect(
        EditorSelection.create(selectionRanges, clampedPrimaryIndex).mainIndex,
    ).toBe(1);

    expect(migrateCm5Selections([], undefined, previousPrimaryIndex))
        .toBeUndefined();

    expect(cm5PositionToOffset(conversionState.doc, {line: -1, ch: 99}))
        .toBe(0);
    expect(cm5PositionToOffset(conversionState.doc, {line: 1, ch: -4}))
        .toBe(5);
    expect(cm5PositionToOffset(conversionState.doc, {line: 1, ch: 99}))
        .toBe(9);
    expect(cm5PositionToOffset(conversionState.doc, {line: 99, ch: 0}))
        .toBe(19);
    expect(cm5PositionToOffset(conversionState.doc, {line: 2}))
        .toBe(14);

    const multipleSelectionState = EditorState.create({
      doc: docText,
      extensions: [EditorState.allowMultipleSelections.of(true)],
    });
    const updatedMultipleSelectionState = multipleSelectionState.update({
      selection: migratedSelection,
    }).state;

    expect(updatedMultipleSelectionState.selection.eq(migratedSelection))
        .toBe(true);
    expect(updatedMultipleSelectionState.selection.toJSON()).toEqual(
        migratedSelection.toJSON(),
    );

    const defaultState = EditorState.create({doc: docText});
    const updatedDefaultState = defaultState.update({
      selection: migratedSelection,
    }).state;

    expect(updatedDefaultState.selection.eq(migratedSelection)).toBe(false);
    expect(updatedDefaultState.selection.toJSON()).toEqual({
      ranges: [{anchor: 8, head: 1}],
      main: 0,
    });
  });

  test('the published selection recipes parse as ES modules', () => {
    const markdownSnippets = [
      codeFenceAfter(migrationGuide, '<a id="selections"></a>'),
      codeFenceAfter(
          migrationResearch,
          'Convert each anchor/head to offsets with `EditorSelection.range`',
      ),
    ];
    const htmlSnippet = htmlCodeBlockAfter(
        migrationPage,
        'id="selections"',
    );
    const linter = new Linter();

    for (const source of [...markdownSnippets, htmlSnippet]) {
      expect(linter.verify(source, {
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
        rules: {},
      })).toEqual([]);
    }
  });

  test('maps CM5 and CM6 to explicit package majors', () => {
    expect(homepage).toContain('id="versions"');
    expect(homepage).toContain(
        'npm install codemirror-record@^2 @codemirror/state@^6 @codemirror/view@^6',
    );
    expect(homepage).toContain(
        'npm install codemirror-record@^1 codemirror@^5',
    );
    expect(homepage).toContain('Two package majors. One recording contract.');
    expect(homepage).toContain('CM5 recorder / player');
    expect(homepage).toContain('CM6 recorder / player');
    expect(homepage).toContain('extras in both directions');
    expect(homepage).toContain('Stable default');
    expect(homepage).toContain('<dd>latest · cm6</dd>');
    expect(homepage).toContain('<dd>cm5</dd>');
    expect(homepage).toContain('tree/v1#api');
    expect(homepage).toContain('href="./migration/"');
    expect(homepage).toContain('Every published v1.x release');
    expect(homepage).not.toMatch(/preview|planned beta|pending publication/i);
    expect(homepage).not.toContain('codemirror-record@next');
    expect(homepageStyles).toContain(
        'grid-template-columns: minmax(0, 1fr);',
    );
    expect(homepageStyles).toMatch(
        /\.version-command \{[^}]*white-space: normal;/s,
    );
    expect(homepage).not.toContain('CodeMirror 6 uses a different API and is not supported');

    expect(readme).toContain('npm install codemirror-record@^2');
    expect(readme).toContain('./docs/MIGRATING.md');
    expect(readme).toContain('/tree/v1#api');
    expect(readme).toMatch(/every published v1\.x\s+release/);
    expect(readme).not.toMatch(/first v2 beta|planned preview/i);

    expect(compressionDecision).toContain(
        'accepted for the stable CodeMirror 6 v2.0.0 release',
    );
    for (const stableReleaseCopy of [
      homepage,
      demo,
      readme,
      migrationGuide,
      migrationPage,
      migrationResearch,
      compressionDecision,
    ]) {
      expect(stableReleaseCopy).not.toMatch(
          /\b(?:beta|preview|candidate)\b/i,
      );
    }
  });

  test('keeps an explicit Home link visible in the CM6 demo contract', () => {
    expect(demo).toContain('<a class="nav-home" href="../">Home</a>');
    expect(demo).toContain('<a href="../migration/">Migration</a>');
    expect(demo).toContain('CodeMirror 6 · v2 stable');
    expect(demo).not.toMatch(/v2 preview|v2 beta/i);
    expect(demo).toContain('<div id="editor-record"></div>');
    expect(demo).toContain('<div id="editor-play"></div>');
    expect(demo).not.toContain('cdnjs.cloudflare.com/ajax/libs/codemirror/5');
    expect(demoStyles).toContain(
        '.demo-page .site-header nav a:not(.nav-home):not(:last-child)',
    );
  });

  test('freezes main before publishing and verifies it after promotion', () => {
    const stableLaunch = releasePolicy.slice(
        releasePolicy.indexOf('## Stable 2.0.0 launch'),
        releasePolicy.indexOf('## Compatibility release gate'),
    );
    const publishV2 = 'npm_public publish "$V2_TARBALL" --tag cm6';
    const promoteLatest =
      'npm_public dist-tag add "$PACKAGE_NAME@$V2_VERSION" latest';
    const freezeMain = 'git push origin "HEAD:refs/heads/$V2_BRANCH"';
    const verifyMain =
      'MAIN_COMMIT=$(git ls-remote origin refs/heads/main | cut -f1)';

    expect(stableLaunch.indexOf(freezeMain)).toBeGreaterThan(-1);
    expect(stableLaunch.indexOf(publishV2)).toBeGreaterThan(-1);
    expect(stableLaunch.indexOf(promoteLatest)).toBeGreaterThan(-1);
    expect(stableLaunch.indexOf(verifyMain)).toBeGreaterThan(-1);
    expect(stableLaunch.indexOf(freezeMain)).toBeLessThan(
        stableLaunch.indexOf(publishV2),
    );
    expect(stableLaunch.indexOf(publishV2)).toBeLessThan(
        stableLaunch.indexOf(promoteLatest),
    );
    expect(stableLaunch.indexOf(promoteLatest)).toBeLessThan(
        stableLaunch.indexOf(verifyMain),
    );
    expect(stableLaunch).toContain('cmp "$V2_TARBALL" "$V2_REGISTRY_TARBALL"');
    expect(stableLaunch).toContain('V2_PACKAGE_SPEC="$PACKAGE_NAME@$V2_VERSION"');
    expect(releasePolicy).toContain(
        'There is no abbreviated maintenance-release recipe.',
    );
    expect(releasePolicy).toContain(
        'do not reuse them by changing only a version variable',
    );
    expect(releasePolicy).toContain(
        'review a version-specific runbook before each later release',
    );
    expect(releasePolicy).toContain(
        'Move every affected dist-tag back to',
    );
  });
});

function normalizeRenderedText(value) {
  return value
      .replace(/[`*_]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .trim()
      .toLowerCase();
}

function codeFenceAfter(value, marker) {
  const markerIndex = value.indexOf(marker);
  const fenceMarker = '```js\n';
  const fenceStart = value.indexOf(fenceMarker, markerIndex);
  const codeStart = fenceStart + fenceMarker.length;
  const codeEnd = value.indexOf('\n```', codeStart);
  return value.slice(codeStart, codeEnd);
}

function htmlCodeBlockAfter(value, marker) {
  const markerIndex = value.indexOf(marker);
  const codeMarker = '<pre><code>';
  const codeStart = value.indexOf(codeMarker, markerIndex) + codeMarker.length;
  const codeEnd = value.indexOf('</code></pre>', codeStart);
  return value.slice(codeStart, codeEnd)
      .replaceAll('&gt;', '>')
      .replaceAll('&lt;', '<')
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'");
}
