import { generateGraph, presets } from '@/lib/graph/generateGraph';
import { useDemoStore } from '@/store/useDemoStore';
import { describe, expect, it } from 'vitest';
import { clusterLayer, createNodeSimilarity, topologySignatures } from './clustering';
import { layoutMultiRowCompact } from '../multiRowCompact';
import { buildLayouts } from '../computeMetrics';
import type { LayeredGraph } from '@/types/graph';

function graph(layers: string[][], links: [string, string][]): LayeredGraph {
  return { layers, nodes: layers.flatMap((layer, rank) => layer.map((id, order) => ({ id, layer: rank, order, x: 0, y: 0 }))),
    edges: links.map(([source, target]) => ({ source, target })) };
}

describe('layer clustering', () => {
  it('detects shared indirect endpoints without confusing unrelated paths or dead ends', () => {
    const g = graph([['u', 'v', 'w'], ['a', 'b', 'c'], ['t', 'z']],
      [['u', 'a'], ['v', 'b'], ['w', 'c'], ['a', 't'], ['b', 't'], ['c', 'z']]);
    const similarity = createNodeSimilarity(g, 'multi-hop', 2);
    expect(similarity('u', 'v')).toBeCloseTo(1 / 3);
    expect(similarity('u', 'w')).toBe(0);
    expect(similarity('u', 'u')).toBe(1);
  });

  it('distinguishes reference groups within the same neighbor layer', () => {
    const g = graph([['u', 'v', 'w'], ['a', 'b', 'c'], ['t', 'z']],
      [['u', 'a'], ['v', 'b'], ['w', 'c'], ['a', 't'], ['b', 't'], ['c', 'z']]);
    // a and b need additional shared inputs to exceed the fixed reference threshold.
    g.edges.push({ source: 'u', target: 'b' }, { source: 'v', target: 'a' });
    const similarity = createNodeSimilarity(g, 'group-profile', 2);
    expect(similarity('u', 'v')).toBe(1);
    expect(similarity('u', 'w')).toBe(0.5);
    expect(createNodeSimilarity(g, 'layer-profile', 2)('u', 'w')).toBe(1);
  });

  it.each(['multi-hop', 'group-profile'] as const)('%s preserves membership across row budgets and comparison views', criterion => {
    const g = graph([['p', 'q'], ['a', 'b', 'c']], [['p', 'a'], ['p', 'b'], ['q', 'c']]);
    const original = JSON.stringify(g);
    const run = (rows: number) => layoutMultiRowCompact(g, rows,
      { blockSimilarity: criterion, clusteringThreshold: 0.65, enableRowOptimization: false });
    expect(run(1).blockBoxes?.map(b => b.nodeIds)).toEqual(run(3).blockBoxes?.map(b => b.nodeIds));
    const bundle = buildLayouts(g, 'barycenter', 'serpentine', 2, 0, 0.7, 2,
      { blockSimilarity: criterion, clusteringThreshold: 0.65 });
    for (const layout of [bundle.unoptimizedCompact, bundle.compact]) {
      expect(layout.blockBoxes?.flatMap(b => b.nodeIds).sort()).toEqual(g.nodes.map(n => n.id).sort());
      expect(layout.nodes.every(n => g.layers[n.layer].includes(n.id))).toBe(true);
      expect(Number.isFinite(layout.metrics.totalEdgeLength)).toBe(true);
    }
    expect(JSON.stringify(g)).toBe(original);
  });
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

describe('strict topology binding', () => {
  it('keeps identical endpoints together even beyond the size cap and after layout', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `n${i}`);
    const g = graph([['p', 'q'], [...ids.slice(0, 15), 'different', ...ids.slice(15)]],
      [...ids.map(id => ['p', id] as [string, string]), ['q', 'different']]);
    const run = (rows: number) => layoutMultiRowCompact(g, rows, { blockSimilarity: 'topology-strict', clusteringThreshold: 0.9 });
    for (const rows of [1, 3]) {
      const blocks = run(rows).blockBoxes!.filter(b => b.layer === 1);
      expect(blocks.find(b => b.nodeIds.includes(ids[0]))!.nodeIds.slice().sort()).toEqual(ids.slice().sort());
      expect(blocks.flatMap(b => b.nodeIds).sort()).toEqual(g.layers[1].slice().sort());
    }
  });
  it('rejects a weak pair even when average similarity passes', () => {
    const score = (a: string, b: string) => a === b ? 1 : [a, b].sort().join('') === 'ac' ? 0.6 : 0.9;
    const ids = ['a', 'b', 'c'];
    expect(clusterLayer(ids, 0, score, 0.7)).toHaveLength(1);
    const blocks = clusterLayer(ids, 0, score, 0.7, new Map(ids.map(id => [id, id])));
    expect(blocks).toHaveLength(2);
    for (const block of blocks) for (const a of block.nodeIds) for (const b of block.nodeIds) expect(score(a, b)).toBeGreaterThanOrEqual(0.7);
  });
  it('uses neighbor identities and weights in signatures, independent of edge order', () => {
    const g = graph([['p', 'q'], ['a', 'b', 'c']], [['p', 'a'], ['p', 'b'], ['q', 'c']]);
    const signatures = topologySignatures(g, 2);
    expect(signatures.get('a')).toBe(signatures.get('b'));
    expect(signatures.get('a')).not.toBe(signatures.get('c'));
    expect(topologySignatures({ ...g, edges: g.edges.slice().reverse() }, 2)).toEqual(signatures);
    expect(clusterLayer([], 1, () => 1, 0.9, signatures)).toEqual([]);
  });
});

 it('calibrates strict Medium clustering without stacking blocks', () => {
   const g = generateGraph(presets.medium.graph);
   const run = (threshold?: number) => layoutMultiRowCompact(g, 6, {
     blockSimilarity: 'topology-strict', clusteringThreshold: threshold, enableRowOptimization: false,
   });
   const old = run(0.65), adjusted = run();
   expect(adjusted.metrics.width).toBeLessThan(old.metrics.width / 3);
   expect(adjusted.metrics.width).toBeLessThan(2000);
   expect(adjusted.blockBoxes!.filter(b => b.layer === 2).length).toBeLessThan(30);
   for (let layer = 0; layer < g.layers.length; layer++) {
     const blocks = adjusted.blockBoxes!.filter(b => b.layer === layer).sort((a,b) => a.x-b.x);
     for (let i=1;i<blocks.length;i++) expect(blocks[i].x).toBeGreaterThanOrEqual(blocks[i-1].x+blocks[i-1].width);
     expect(new Set(blocks.map(b=>b.y+b.height/2)).size).toBe(1);
     expect(blocks.flatMap(b=>b.nodeIds).sort()).toEqual(g.layers[layer].slice().sort());
   }
 });
 it('remembers each strategy threshold separately', () => {
   const saved = useDemoStore.getState();
   try {
     saved.updateBlockSimilarity('topology-strict');
     saved.updateClusteringThreshold(0.08);
     saved.updateBlockSimilarity('neighbors');
     expect(useDemoStore.getState().clusteringThreshold).toBe(0.65);
     saved.updateClusteringThreshold(0.4);
     saved.updateBlockSimilarity('topology-strict');
     expect(useDemoStore.getState().clusteringThreshold).toBe(0.08);
     saved.updateBlockSimilarity('neighbors');
     expect(useDemoStore.getState().clusteringThreshold).toBe(0.4);
   } finally { useDemoStore.setState(saved); }
 });
