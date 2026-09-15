import { expect, it } from 'vitest';
import { generateGraph, presets } from '@/lib/graph/generateGraph';
import { layoutSugiyama } from '@/lib/layout/sugiyama';

it('keeps the high-cardinality Sugiyama baseline responsive', { timeout: 20000 }, () => {
  const graph = generateGraph(presets.medium.graph);
  const timings: Record<string, number> = {};
  const started = performance.now();
  const layout = layoutSugiyama(graph, timings);
  expect(layout.nodes.length).toBeGreaterThanOrEqual(graph.nodes.length);
  expect(timings.transposeMs).toBeLessThan(15000);
  expect(performance.now() - started).toBeLessThan(20000);
});
