import { describe, it, expect } from 'vitest';
import { extractList } from '../list-response.js';

describe('extractList', () => {
  it('returns arrays as-is', () => {
    expect(extractList([1, 2])).toEqual([1, 2]);
  });

  it('unwraps { data: [] }', () => {
    expect(extractList({ success: true, data: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
  });

  it('unwraps paginated { data: { items } }', () => {
    expect(
      extractList({ success: true, data: { items: [{ id: 'c1' }], total: 1, page: 1, pageSize: 100, hasMore: false } })
    ).toEqual([{ id: 'c1' }]);
  });

  it('unwraps top-level { items }', () => {
    expect(extractList({ items: [1] })).toEqual([1]);
  });

  it('returns [] for unexpected shapes', () => {
    expect(extractList(undefined)).toEqual([]);
    expect(extractList(null)).toEqual([]);
    expect(extractList({ success: true })).toEqual([]);
    expect(extractList({ data: { foo: 'bar' } })).toEqual([]);
    expect(extractList('nope')).toEqual([]);
  });
});
