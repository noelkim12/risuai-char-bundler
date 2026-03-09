import { describe, it, expect } from 'vitest';

describe('packages/core smoke test', () => {
  it('types can be imported', async () => {
    const types = await import('../src/types/index');
    expect(types).toBeDefined();
  });
});
