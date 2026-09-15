import { expect, it } from 'vitest';
import { generateGraph, presets } from '@/lib/graph/generateGraph';
import { layoutBlockCompact } from '@/lib/layout/blockCompact';

it('centers each ordered Medium block chain inside its layer region', () => {
  const graph = generateGraph(presets.medium.graph);
  const profile: Record<string, number> = {};
  const layout = layoutBlockCompact(graph, presets.medium.rowsPerLayer, 'serpentine', 'barycenter', profile);
  expect(layout.metrics.blockInversions).toBe(profile.refinedBlockInversions);
  expect(profile.refinedBlockInversions).toBeLessThanOrEqual(
    Math.min(profile.initialBlockInversions, profile.barycentricBlockInversions));
  for (const box of layout.boxes) {
    const blocks = (layout.blockBoxes ?? []).filter((block) => block.layer === box.layer);
    const left = Math.min(...blocks.map((block) => block.x));
    const right = Math.max(...blocks.map((block) => block.x + block.width));
    const leftMargin = left - box.x;
    const rightMargin = box.x + box.width - right;
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(0.001);
    for (let index = 1; index < blocks.length; index += 1) {
      expect(blocks[index].x).toBeGreaterThanOrEqual(blocks[index - 1].x + blocks[index - 1].width);
    }
    blocks.forEach((block) => block.nodeIds.forEach((id) => {
      const node = layout.nodes.find((candidate) => candidate.id === id)!;
      expect(node.x).toBeGreaterThanOrEqual(block.x);
      expect(node.x).toBeLessThanOrEqual(block.x + block.width);
    }));
  }
});

it('spreads unused width between blocks without changing their order or layer boxes', () => {
  const graph = generateGraph(presets.medium.graph);
  const compact = layoutBlockCompact(graph, 6, 'serpentine', 'barycenter', undefined, 0);
  const partial = layoutBlockCompact(graph, 6, 'serpentine', 'barycenter', undefined, 0.7);
  const full = layoutBlockCompact(graph, 6, 'serpentine', 'barycenter', undefined, 1);
  expect(compact.metrics.totalEdgeLength).toBeLessThan(partial.metrics.totalEdgeLength!);
  expect(partial.metrics.totalEdgeLength).toBeLessThan(full.metrics.totalEdgeLength!);
  expect(full.boxes.map((box) => box.width)).toEqual(compact.boxes.map((box) => box.width));
  const span = (layout: typeof compact, layer: number) => {
    const blocks = (layout.blockBoxes ?? []).filter((block) => block.layer === layer);
    return Math.max(...blocks.map((block) => block.x + block.width)) -
      Math.min(...blocks.map((block) => block.x));
  };
  for (let layer = 0; layer < graph.layers.length; layer += 1) {
    expect(full.blockBoxes?.filter((block) => block.layer === layer).map((block) =>
      [block.id, block.nodeIds])).toEqual(compact.blockBoxes?.filter((block) => block.layer === layer)
      .map((block) => [block.id, block.nodeIds]));
    expect(partial.blockBoxes?.filter((block) => block.layer === layer).map((block) =>
      [block.id, block.nodeIds])).toEqual(compact.blockBoxes?.filter((block) => block.layer === layer)
      .map((block) => [block.id, block.nodeIds]));
    expect(span(partial, layer)).toBeGreaterThanOrEqual(span(compact, layer));
    expect(span(full, layer)).toBeGreaterThanOrEqual(span(partial, layer));
    const blocks = (full.blockBoxes ?? []).filter((block) => block.layer === layer);
    for (let index = 1; index < blocks.length; index += 1) {
      expect(blocks[index].x).toBeGreaterThanOrEqual(blocks[index - 1].x + blocks[index - 1].width + 18);
    }
  }
});
