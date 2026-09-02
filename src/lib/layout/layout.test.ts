import { describe, expect, it } from 'vitest';
import { generateGraph } from '@/lib/graph/generateGraph';
import { buildLayouts } from '@/lib/layout/computeMetrics';
import { countCrossings } from '@/lib/layout/countCrossings';
import { layoutSugiyama } from '@/lib/layout/sugiyama';
import type { PositionedLayout } from '@/types/graph';

describe('layout pipeline', () => {
  it('generates deterministic graphs for the same seed', () => {
    const config = {
      layerCount: 4,
      nodesPerLayer: 10,
      edgeDensity: 0.22,
      seed: 99,
    };
    const first = generateGraph(config);
    const second = generateGraph(config);

    expect(first.layers).toEqual(second.layers);
    expect(first.edges).toEqual(second.edges);
  });

  it('counts straight-line crossings between consecutive layers', () => {
    const layout: PositionedLayout = {
      mode: 'traditional',
      nodes: [
        { id: 'a', layer: 0, order: 0, x: 0, y: 0 },
        { id: 'b', layer: 0, order: 1, x: 10, y: 0 },
        { id: 'c', layer: 1, order: 0, x: 10, y: 10 },
        { id: 'd', layer: 1, order: 1, x: 0, y: 10 },
      ],
      edges: [
        { source: 'a', target: 'c' },
        { source: 'b', target: 'd' },
      ],
      layers: [['a', 'b'], ['c', 'd']],
      boxes: [],
      metrics: { width: 10, height: 10, crossings: 0 },
    };

    expect(countCrossings(layout)).toBe(1);
  });

  it('reduces width when rows per layer increase', () => {
    const graph = generateGraph({
      layerCount: 4,
      nodesPerLayer: 26,
      edgeDensity: 0.28,
      seed: 21,
    });
    const rows1 = buildLayouts(graph, 'original', 'row-major', 1);
    const rows4 = buildLayouts(graph, 'original', 'row-major', 4);

    expect(rows4.compact.metrics.width).toBeLessThan(rows1.compact.metrics.width);
    expect(rows4.compact.metrics.height).toBeGreaterThan(rows1.compact.metrics.height);
  });

  it('creates visible block regions for compact layout', () => {
    const graph = generateGraph({
      layerCount: 4,
      nodesPerLayer: 24,
      edgeDensity: 0.24,
      seed: 17,
    });
    const layout = buildLayouts(graph, 'barycenter', 'serpentine', 3).compact;

    expect(layout.blockBoxes && layout.blockBoxes.length > 0).toBe(true);
    expect(layout.blockBoxes?.some((block) => block.nodeIds.length > 1)).toBe(true);
  });

  it('keeps blocks on a 1D layer axis while packing nodes inside blocks', () => {
    const graph = generateGraph({
      layerCount: 4,
      nodesPerLayer: 28,
      edgeDensity: 0.22,
      seed: 31,
    });
    const layout = buildLayouts(graph, 'barycenter', 'serpentine', 4).compact;
    const boxesByLayer = new Map(layout.boxes.map((box) => [box.layer, box]));

    layout.blockBoxes?.forEach((block) => {
      const layerBox = boxesByLayer.get(block.layer);
      expect(layerBox).toBeDefined();

      if (!layerBox) {
        return;
      }

      const centerY = block.y + block.height / 2;
      const expectedCenterY = layerBox.y + 28 + 22 + Math.max(...(layout.blockBoxes ?? [])
        .filter((candidate) => candidate.layer === block.layer)
        .map((candidate) => candidate.height), 0) / 2;

      expect(Math.abs(centerY - expectedCenterY)).toBeLessThan(0.001);
    });
  });

  it('inserts dummy nodes for long edges in sugiyama layout', () => {
    const layout = layoutSugiyama({
      nodes: [
        { id: 'a', layer: 0, order: 0, x: 0, y: 0 },
        { id: 'b', layer: 0, order: 1, x: 0, y: 0 },
        { id: 'c', layer: 0, order: 2, x: 0, y: 0 },
      ],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
        { source: 'b', target: 'c' },
      ],
      layers: [['a'], ['b'], ['c']],
    });

    expect(layout.nodes.some((node) => node.isVirtual)).toBe(true);
    expect(layout.edges.every((edge) => {
      const source = layout.nodes.find((node) => node.id === edge.source);
      const target = layout.nodes.find((node) => node.id === edge.target);
      return (target?.layer ?? 0) - (source?.layer ?? 0) === 1;
    })).toBe(true);
  });

  it('keeps edges flowing downward in sugiyama layout', () => {
    const graph = generateGraph({
      layerCount: 4,
      nodesPerLayer: 12,
      edgeDensity: 0.2,
      seed: 5,
    });
    const layout = layoutSugiyama(graph);

    expect(layout.edges.every((edge) => {
      const source = layout.nodes.find((node) => node.id === edge.source);
      const target = layout.nodes.find((node) => node.id === edge.target);
      return (target?.y ?? 0) > (source?.y ?? 0);
    })).toBe(true);
  });
});
