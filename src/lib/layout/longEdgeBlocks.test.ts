import { expect, it } from 'vitest';
import { generateGraph, presets } from '@/lib/graph/generateGraph';
import { layoutBlockCompact } from '@/lib/layout/blockCompact';

it('separates long-edge endpoints into smaller, dedicated blocks on Medium', () => {
  const graph = generateGraph(presets.medium.graph);
  const layerById = new Map(graph.nodes.map((node) => [node.id, node.layer]));
  const longEdgeNodes = new Set(graph.edges.filter((edge) => {
    return (layerById.get(edge.target) ?? 0) - (layerById.get(edge.source) ?? 0) > 1;
  }).flatMap((edge) => [edge.source, edge.target]));
  const describe = (exponent: number) => {
    const layout = layoutBlockCompact(graph, 6, 'serpentine', 'barycenter', undefined, 0.7, exponent);
    const blocks = layout.blockBoxes ?? [];
    return {
      mixed: blocks.filter((block) => block.nodeIds.some((id) => longEdgeNodes.has(id))
        && block.nodeIds.some((id) => !longEdgeNodes.has(id))).length,
      dedicated: blocks.filter((block) => block.nodeIds.every((id) => longEdgeNodes.has(id))).length,
      smallDedicated: blocks.filter((block) => block.nodeIds.length <= 2
        && block.nodeIds.every((id) => longEdgeNodes.has(id))).length,
    };
  };
  const linear = describe(1);
  const square = describe(2);
  const cube = describe(3);
  expect(square.mixed).toBeLessThan(linear.mixed);
  expect(square.smallDedicated).toBeGreaterThan(0);
  expect(cube.mixed).toBeLessThan(square.mixed);
  expect(cube.smallDedicated).toBeGreaterThan(square.smallDedicated);
});
