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

  it('generates long edges and uneven degree distribution for richer demos', () => {
    const graph = generateGraph({
      layerCount: 6,
      nodesPerLayer: 48,
      customLayerSizes: [36, 118, 192, 74, 156, 29],
      edgeDensity: 0.19,
      seed: 71,
    });
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
    const degrees = graph.nodes.map((node) =>
      graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length,
    );

    expect(graph.edges.some((edge) => {
      const sourceLayer = nodeMap.get(edge.source)?.layer ?? 0;
      const targetLayer = nodeMap.get(edge.target)?.layer ?? sourceLayer;
      return targetLayer - sourceLayer > 1;
    })).toBe(true);
    expect(Math.max(...graph.layers.map((layer) => layer.length))).toBeGreaterThanOrEqual(180);
    expect(new Set(degrees).size).toBeGreaterThan(4);
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

  it('reduces width when multi-node clusters receive more rows', { timeout: 12000 }, () => {
    const graph = generateGraph({
      layerCount: 2,
      nodesPerLayer: 8,
      edgeDensity: 0.28,
      seed: 21,
    });
    // Identical neighborhoods form actual multi-node clusters. Random graphs
    // can legitimately yield singleton clusters, which cannot shrink by wrapping.
    graph.edges = graph.layers[0].flatMap(source => graph.layers[1].map(target => ({ source, target })));
    const options = { enableRowOptimization: false };
    const rows1 = buildLayouts(graph, 'original', 'row-major', 1, 0, 0.7, 2, options);
    const rows4 = buildLayouts(graph, 'original', 'row-major', 4, 0, 0.7, 2, options);

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

  it('does not pin narrow layers to the left when another layer is much wider', () => {
    const graph = generateGraph({
      layerCount: 3,
      nodesPerLayer: 10,
      customLayerSizes: [8, 42, 8],
      edgeDensity: 0.2,
      seed: 11,
    });
    const layout = buildLayouts(graph, 'barycenter', 'serpentine', 4).compact;
    const firstLayerBox = layout.boxes.find((box) => box.layer === 0);
    const firstLayerBlocks = (layout.blockBoxes ?? []).filter((block) => block.layer === 0);

    expect(firstLayerBox).toBeDefined();
    expect(firstLayerBlocks.length).toBeGreaterThan(0);

    if (!firstLayerBox || firstLayerBlocks.length === 0) {
      return;
    }

    const firstBlockLeft = Math.min(...firstLayerBlocks.map((block) => block.x));
    expect(firstBlockLeft).toBeGreaterThan(firstLayerBox.x + 28);
  });

  it('places nodes with stronger upper-layer attachment higher inside a block', () => {
    const graph = {
      nodes: [
        { id: 'a0', layer: 0, order: 0, x: 0, y: 0 },
        { id: 'a1', layer: 0, order: 1, x: 0, y: 0 },
        { id: 'b0', layer: 1, order: 0, x: 0, y: 0 },
        { id: 'b1', layer: 1, order: 1, x: 0, y: 0 },
        { id: 'c0', layer: 2, order: 0, x: 0, y: 0 },
      ],
      edges: [
        { source: 'a0', target: 'b0' },
        { source: 'a1', target: 'b0' },
        { source: 'a0', target: 'b1' },
        { source: 'b0', target: 'c0' },
        { source: 'b1', target: 'c0' },
      ],
      layers: [['a0', 'a1'], ['b0', 'b1'], ['c0']],
    };
    const layout = buildLayouts(graph, 'original', 'row-major', 2, 0, 0.7, 2, { blockSimilarity: 'neighbors' }).compact;
    const middleBlock = (layout.blockBoxes ?? []).find(
      (block) => block.layer === 1 && block.nodeIds.includes('b0') && block.nodeIds.includes('b1'),
    );
    const b0 = layout.nodes.find((node) => node.id === 'b0');
    const b1 = layout.nodes.find((node) => node.id === 'b1');

    expect(middleBlock).toBeDefined();
    expect(b0).toBeDefined();
    expect(b1).toBeDefined();

    if (!middleBlock || !b0 || !b1) {
      return;
    }

    expect(b0.y).toBeLessThan(b1.y);
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
