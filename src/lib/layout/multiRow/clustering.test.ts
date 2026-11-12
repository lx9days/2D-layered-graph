import { describe, expect, it } from 'vitest';
import { clusterLayer, createNodeSimilarity } from './clustering';
import { layoutMultiRowCompact } from '../multiRowCompact';
import { buildLayouts } from '../computeMetrics';
import type { LayeredGraph } from '@/types/graph';

function graph(layers: string[][], links: [string, string][]): LayeredGraph {
  return { layers, nodes: layers.flatMap((layer, rank) => layer.map((id, order) => ({ id, layer: rank, order, x: 0, y: 0 }))),
    edges: links.map(([source, target]) => ({ source, target })) };
}

describe('layer clustering', () => {
  it('groups noncontiguous nodes by shared neighbors', () => {
    const g = graph([['p', 'q'], ['a', 'b', 'c', 'd']], [['p', 'a'], ['q', 'b'], ['p', 'c'], ['q', 'd']]);
    const blocks = clusterLayer(g.layers[1], 1, createNodeSimilarity(g, 'neighbors', 2), 0.9);
    expect(blocks.map(b => b.nodeIds)).toEqual([['a', 'c'], ['b', 'd']]);
  });

  it('distinguishes identity of neighbors from their layer distribution', () => {
    const g = graph([['p', 'q'], ['a', 'b'], ['x']], [['p', 'a'], ['q', 'b']]);
    expect(createNodeSimilarity(g, 'neighbors', 2)('a', 'b')).toBeCloseTo(0.55);
    expect(createNodeSimilarity(g, 'layer-profile', 2)('a', 'b')).toBe(1);
    expect(clusterLayer(g.layers[1], 1, createNodeSimilarity(g, 'layer-profile', 2), 0.9)).toHaveLength(1);
    expect(clusterLayer(g.layers[1], 1, createNodeSimilarity(g, 'neighbors', 2), 0.9)).toHaveLength(2);
  });

  it('distinguishes receivers and distributors with the same total degree', () => {
    const g = graph([['p', 'q'], ['a', 'b'], ['x', 'y']], [['p', 'a'], ['q', 'a'], ['b', 'x'], ['b', 'y']]);
    expect(createNodeSimilarity(g, 'role', 2)('a', 'b')).toBeCloseTo(0.25);
  });

  it('uses average linkage rather than single-link chaining', () => {
    const score = (a: string, b: string) => a === b ? 1 : (a === 'a' && b === 'c') || (a === 'c' && b === 'a') ? 0 : 0.9;
    expect(clusterLayer(['a', 'b', 'c'], 0, score, 0.7).map(b => b.nodeIds)).toEqual([['a', 'b'], ['c']]);
  });

  it('handles empty layers, deterministic ties, and bounded cluster sizes', () => {
    expect(clusterLayer([], 0, () => 1)).toEqual([]);
    const ids = Array.from({ length: 30 }, (_, i) => String(i));
    const first = clusterLayer(ids, 0, () => 1);
    expect(first).toEqual(clusterLayer(ids, 0, () => 1));
    expect(first.flatMap(b => b.nodeIds).sort()).toEqual(ids.slice().sort());
    expect(first.every(b => b.nodeIds.length <= Math.round(Math.sqrt(30) * 2.25))).toBe(true);
  });

  it('keeps cluster membership independent of the row budget and preserves semantic layers', () => {
    const g = graph([['p', 'q'], ['a', 'b', 'c', 'd']], [['p', 'a'], ['q', 'b'], ['p', 'c'], ['q', 'd']]);
    const input = JSON.stringify(g);
    const run = (rows: number) => layoutMultiRowCompact(g, rows, { clusteringThreshold: 0.9, enableRowOptimization: false });
    expect(run(1).blockBoxes?.map(b => b.nodeIds)).toEqual(run(3).blockBoxes?.map(b => b.nodeIds));
    expect(run(3).nodes.every(n => g.layers[n.layer].includes(n.id))).toBe(true);
    expect(JSON.stringify(g)).toBe(input);
  });

  it('uses the selected criterion for both comparison views', () => {
    const g = graph([['p', 'q'], ['a', 'b']], [['p', 'a'], ['q', 'b']]);
    const bundle = buildLayouts(g, 'barycenter', 'serpentine', 2, 0, 0.7, 2,
      { blockSimilarity: 'layer-profile', clusteringThreshold: 0.9 });
    for (const layout of [bundle.unoptimizedCompact, bundle.compact]) {
      expect(layout.blockBoxes?.filter(b => b.layer === 1)).toHaveLength(1);
      expect(Number.isFinite(layout.metrics.totalEdgeLength)).toBe(true);
    }
  });
});
