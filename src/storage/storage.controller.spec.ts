import { parseRange } from './storage.controller';

describe('parseRange', () => {
  it('reads the single-range forms browsers send', () => {
    expect(parseRange('bytes=0-99')).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=500-')).toEqual({ start: 500, end: undefined });
  });

  it('ignores anything else', () => {
    for (const bad of [
      undefined,
      '',
      'bytes=-500',
      'bytes=0-1,5-9',
      'items=0-1',
      'bytes=a-b',
    ]) {
      expect(parseRange(bad)).toBeUndefined();
    }
  });
});
