import { describe, expect, it } from 'vitest';
import { adjacentBlockSwapDelta, countBlockInversions, refineBlockOrderByCrossings,
  type BlockNeighborMap } from '@/lib/layout/blockCrossingOrder';

const block = (id: string, layer: number) => ({ id, layer });

describe('block-level inversion refinement', () => {
  it('corrects a case where barycenter order has more inversions', () => {
    const sources = Array.from({ length: 11 }, (_, index) => block(`s${index}`, 0));
    const layers = [sources, [block('B', 1), block('A', 1)]];
    const previous: BlockNeighborMap = new Map([
      ['A', new Map([['s0', 4], ['s10', 1]])],
      ['B', new Map([['s1', 2]])],
    ]);
    const next: BlockNeighborMap = new Map([
      ['s0', new Map([['A', 4]])], ['s10', new Map([['A', 1]])],
      ['s1', new Map([['B', 2]])],
    ]);
    // Weighted means: A=2, B=1, so barycenter places B before A.
    expect(countBlockInversions(layers, next)).toBe(8);
    expect(adjacentBlockSwapDelta(layers[1][0], layers[1][1], layers, previous, next)).toBe(-6);
    expect(countBlockInversions([sources, [layers[1][1], layers[1][0]]], next)).toBe(2);
    const refined = refineBlockOrderByCrossings(layers, previous, next);
    expect(countBlockInversions(refined, next)).toBeLessThan(8);
    expect(layers[1].map((entry) => entry.id)).toEqual(['B', 'A']);
  });

  it('counts and optimizes long-edge inversions between their semantic layer pair', () => {
    const layers = [[block('s0', 0), block('s1', 0)], [block('middle', 1)],
      [block('t0', 2), block('t1', 2)]];
    const previous: BlockNeighborMap = new Map([
      ['t0', new Map([['s1', 1]])], ['t1', new Map([['s0', 1]])],
    ]);
    const next: BlockNeighborMap = new Map([
      ['s0', new Map([['t1', 1]])], ['s1', new Map([['t0', 1]])],
    ]);
    expect(countBlockInversions(layers, next)).toBe(1);
    const refined = refineBlockOrderByCrossings(layers, previous, next);
    expect(countBlockInversions(refined, next)).toBe(0);
    expect(refined[1].map((entry) => entry.id)).toEqual(['middle']);
    expect(refined[0].map((entry) => entry.id).sort()).toEqual(['s0', 's1']);
    expect(refined[2].map((entry) => entry.id).sort()).toEqual(['t0', 't1']);
  });

  it('computes exact local deltas for adjacent block swaps', () => {
    const layers = [[block('s0', 0), block('s1', 0)],
      [block('A', 1), block('B', 1), block('C', 1)],
      [block('t0', 2), block('t1', 2)]];
    const next: BlockNeighborMap = new Map([
      ['s0', new Map([['B', 2], ['t1', 1]])],
      ['s1', new Map([['A', 1], ['C', 1], ['t0', 2]])],
      ['A', new Map([['t1', 2]])], ['B', new Map([['t0', 1]])],
      ['C', new Map([['t0', 2]])],
    ]);
    const previous: BlockNeighborMap = new Map();
    next.forEach((targets, source) => targets.forEach((count, target) => {
      const sources = previous.get(target) ?? new Map<string, number>();
      sources.set(source, count);
      previous.set(target, sources);
    }));
    layers.forEach((blocks) => {
      for (let index = 0; index < blocks.length - 1; index += 1) {
        const before = countBlockInversions(layers, next);
        const delta = adjacentBlockSwapDelta(blocks[index], blocks[index + 1], layers, previous, next);
        [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
        expect(countBlockInversions(layers, next) - before).toBe(delta);
        [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
      }
    });
    const before = countBlockInversions(layers, next);
    expect(countBlockInversions(refineBlockOrderByCrossings(layers, previous, next), next))
      .toBeLessThanOrEqual(before);
  });
});
