import { describe, expect, it } from 'vitest';
import { generateGraph } from '@/lib/graph/generateGraph';
import { getLayerRowBudget, layoutBlockCompact } from '@/lib/layout/blockCompact';

describe('cardinality-aware semantic layer height', () => {
  it('uses original layer cardinality to choose the maximum rows inside its blocks', () => {
    expect([8, 42, 8].map((size) => getLayerRowBudget(size, 42, 4))).toEqual([1, 4, 1]);
    expect(getLayerRowBudget(42, 42, 1)).toBe(1);
    expect(getLayerRowBudget(0, 42, 4)).toBe(1);
  });

  it('makes a wide layer and its blocks taller while preserving separate regions', () => {
    const graph = generateGraph({ layerCount: 3, nodesPerLayer: 10,
      customLayerSizes: [8, 42, 8], edgeDensity: 0.2, seed: 11 });
    const layout = layoutBlockCompact(graph, 4, 'row-major', 'barycenter');
    const blocks = (layer: number) => (layout.blockBoxes ?? []).filter((block) => block.layer === layer);
    const maximumBlockHeight = (layer: number) => Math.max(...blocks(layer).map((block) => block.height));

    expect(maximumBlockHeight(1)).toBeGreaterThan(maximumBlockHeight(0));
    expect(maximumBlockHeight(1)).toBeGreaterThan(maximumBlockHeight(2));
    expect(layout.boxes[1].height).toBeGreaterThan(layout.boxes[0].height);
    expect(layout.boxes[1].height).toBeGreaterThan(layout.boxes[2].height);
    layout.boxes.forEach((box, layer) => {
      if (layer > 0) expect(box.y).toBeGreaterThan(layout.boxes[layer - 1].y + layout.boxes[layer - 1].height);
      blocks(layer).forEach((block) => block.nodeIds.forEach((id) => {
        const node = layout.nodes.find((entry) => entry.id === id)!;
        expect(node.layer).toBe(layer);
        expect(node.y).toBeGreaterThanOrEqual(block.y);
        expect(node.y).toBeLessThanOrEqual(block.y + block.height);
        expect(node.y).toBeGreaterThanOrEqual(box.y);
        expect(node.y).toBeLessThanOrEqual(box.y + box.height);
      }));
    });
  });
});
