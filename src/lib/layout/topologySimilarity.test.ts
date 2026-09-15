import { describe, expect, it } from 'vitest';
import { buildWeightedAdjacency, nodeTopologySimilarity, weightedJaccard } from '@/lib/layout/topologySimilarity';
import type { GraphEdge, GraphNode } from '@/types/graph';

const node = (id: string, layer: number): GraphNode => ({ id, layer, order: 0, x: 0, y: 0 });

describe('semantic-span weighted block topology', () => {
  it('weights both ends of a long edge by the number of crossed layers', () => {
    const nodes = [node('source', 1), node('near', 2), node('far', 4)];
    const edges: GraphEdge[] = [
      { source: 'source', target: 'near' },
      { source: 'source', target: 'far' },
    ];
    const { incoming, outgoing } = buildWeightedAdjacency(nodes, edges);
    expect(outgoing.get('source')?.get('near')).toBe(1);
    expect(outgoing.get('source')?.get('far')).toBe(3);
    expect(incoming.get('far')?.get('source')).toBe(3);
  });

  it('makes a differing long-range neighbor more significant than a differing short-range neighbor', () => {
    const nodes = [node('parent', 0), node('base', 1), node('short', 1), node('long', 1),
      node('common', 2), node('nearA', 2), node('nearB', 2), node('far', 4)];
    const edges: GraphEdge[] = [
      ...['base', 'short', 'long'].map((target) => ({ source: 'parent', target })),
      ...['base', 'short', 'long'].map((source) => ({ source, target: 'common' })),
      { source: 'base', target: 'nearA' },
      { source: 'short', target: 'nearB' },
      { source: 'long', target: 'far' },
    ];
    const { incoming, outgoing } = buildWeightedAdjacency(nodes, edges);
    const shortDifference = nodeTopologySimilarity('base', 'short', incoming, outgoing);
    const longDifference = nodeTopologySimilarity('base', 'long', incoming, outgoing);
    expect(shortDifference).toBeCloseTo(0.7);
    expect(longDifference).toBeCloseTo(0.6);
    expect(longDifference).toBeLessThan(shortDifference);
  });

  it('increases long-edge dissimilarity as the span exponent rises', () => {
    const nodes = [node('parent', 0), node('ordinary', 1), node('bridge', 1),
      node('shared', 2), node('far', 4)];
    const edges: GraphEdge[] = [
      { source: 'parent', target: 'ordinary' }, { source: 'parent', target: 'bridge' },
      { source: 'ordinary', target: 'shared' }, { source: 'bridge', target: 'shared' },
      { source: 'bridge', target: 'far' },
    ];
    const scores = [1, 2, 3].map((exponent) => {
      const { incoming, outgoing } = buildWeightedAdjacency(nodes, edges, undefined, exponent);
      expect(outgoing.get('bridge')?.get('far')).toBe(3 ** exponent);
      return nodeTopologySimilarity('ordinary', 'bridge', incoming, outgoing);
    });
    expect(scores[1]).toBeLessThan(scores[0]);
    expect(scores[2]).toBeLessThan(scores[1]);
  });

  it('retains ordinary Jaccard behavior when every edge spans one layer', () => {
    expect(weightedJaccard(new Map([['a', 1], ['b', 1]]),
      new Map([['a', 1], ['c', 1]]))).toBeCloseTo(1 / 3);
    expect(weightedJaccard(new Map(), new Map())).toBe(1);
  });
});
