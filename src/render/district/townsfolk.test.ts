import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({}));
const { directionIndex } = await import('./townsfolk.ts');

describe('directionIndex', () => {
  it('maps grid moves to screen directions (0 = towards the viewer, clockwise)', () => {
    expect(directionIndex(1, 1)).toBe(0); // straight down the screen
    expect(directionIndex(0, 1)).toBe(1); // down-left
    expect(directionIndex(-1, 1)).toBe(2); // left
    expect(directionIndex(-1, 0)).toBe(3); // up-left
    expect(directionIndex(-1, -1)).toBe(4); // up
    expect(directionIndex(0, -1)).toBe(5); // up-right
    expect(directionIndex(1, -1)).toBe(6); // right
    expect(directionIndex(1, 0)).toBe(7); // down-right
  });
});
