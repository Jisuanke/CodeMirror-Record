import {describe, expect, test} from 'vitest';

import {normalizeInsertedText} from '../src/func/compress/input';

describe('legacy compression invariants', () => {
  test('normalizes inserted text without relying on compressor mutation', () => {
    expect(normalizeInsertedText('already text')).toBe('already text');
    expect(normalizeInsertedText(['first', '第二', '😀'])).toBe(
        'first\n第二\n😀',
    );
  });
});
