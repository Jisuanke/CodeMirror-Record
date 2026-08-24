import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {afterEach, describe, expect, test, vi} from 'vitest';

const demoHtml = readFileSync(
    join(process.cwd(), 'demo/index.html'),
    'utf8',
);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('CodeMirror 6 demo', () => {
  test('rebases a delayed first edit, then loads and replays it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T00:00:00Z'));
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);

    const parsed = new DOMParser().parseFromString(demoHtml, 'text/html');
    document.body.innerHTML = parsed.body.innerHTML;

    await import('../demo/index.js');

    expect(document.querySelectorAll('.cm-editor')).toHaveLength(2);
    expect(editorDocuments()).toEqual([initialCode(), initialCode()]);
    expect(document.querySelector('.nav-home')?.getAttribute('href')).toBe('../');

    const sampleEdit = document.getElementById('sample-edit');
    const capture = document.getElementById('capture-records');
    const load = document.getElementById('load-operations');
    const play = document.getElementById('play');

    vi.advanceTimersByTime(56_000);
    sampleEdit.click();
    expect(capture.disabled).toBe(false);

    capture.click();
    const payload = JSON.parse(
        document.getElementById('payload-output').textContent,
    );
    expect(payload.length).toBeGreaterThan(0);
    expect(payload.every((entry) => {
      const times = Array.isArray(entry.t) ? entry.t : [entry.t];
      return times.every((time) => time < 100);
    })).toBe(true);
    expect(load.disabled).toBe(false);

    load.click();
    expect(play.disabled).toBe(false);
    expect(document.getElementById('playback-time').value)
        .toMatch(/^0:00\.0 \/ 0:00\.[01]$/);

    play.click();
    await vi.runOnlyPendingTimersAsync();

    expect(editorDocuments()[1]).toContain(
        'const player = new CodePlay(replayEditor, {speed: 1});',
    );
    expect(document.getElementById('player-state').textContent).toBe('Complete');
  });
});

function editorDocuments() {
  return [...document.querySelectorAll('.cm-content')].map(
      (content) => [...content.querySelectorAll('.cm-line')]
          .map((line) => line.textContent)
          .join('\n'),
  );
}

function initialCode() {
  return [
    'function greet(name) {',
    "  return 'Hello, ' + name + '!';",
    '}',
    '',
    "greet('developer');",
  ].join('\n');
}
