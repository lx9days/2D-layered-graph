import { describe, expect, it } from 'vitest';
import { planEdgeBundles } from '@/lib/layout/edgeBundles';
import { generateGraph, presets } from '@/lib/graph/generateGraph';
import { layoutBlockCompact } from '@/lib/layout/blockCompact';
import type { PositionedLayout } from '@/types/graph';

describe('edge bundles', () => {
  it('shares a trunk only for edges with the same source and target blocks', () => {
    const layout: PositionedLayout = {
      mode: 'compact',
      nodes: [], layers: [], boxes: [],
      metrics: { width: 300, height: 300, crossings: 0 },
      edges: [
        { source: 'a', target: 'c' }, { source: 'b', target: 'd' },
        { source: 'a', target: 'e' }, { source: 'b', target: 'b' },
      ],
      blockBoxes: [
        { id: 'source', layer: 0, x: 20, y: 20, width: 80, height: 40, nodeIds: ['a', 'b'] },
        { id: 'target', layer: 1, x: 140, y: 180, width: 80, height: 40, nodeIds: ['c', 'd'] },
        { id: 'other', layer: 1, x: 240, y: 180, width: 40, height: 40, nodeIds: ['e'] },
      ],
    };
    const plan = planEdgeBundles(layout);
    expect(plan.bundles).toHaveLength(1);
    expect(plan.bundles[0].edges).toEqual(layout.edges.slice(0, 2));
    expect(plan.bundles[0].sourceJunction).toEqual({ x: 60, y: 84 });
    expect(plan.bundles[0].targetJunction).toEqual({ x: 180, y: 156 });
    expect(plan.singleEdges).toEqual(layout.edges.slice(2));
  });
});

it('bundles a material share of the Medium example edges', () => {
  const graph = generateGraph(presets.medium.graph);
  const layout = layoutBlockCompact(graph, presets.medium.rowsPerLayer, 'serpentine', 'barycenter');
  const plan = planEdgeBundles(layout);
  const bundledEdges = plan.bundles.reduce((sum, bundle) => sum + bundle.edges.length, 0);
  expect(bundledEdges).toBeGreaterThan(layout.edges.length / 4);
  expect(plan.bundles.length).toBeLessThan(bundledEdges / 4);
});
