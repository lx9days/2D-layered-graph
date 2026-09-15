import { buildLayouts } from '@/lib/layout/computeMetrics';
import { layoutBlockCompact } from '@/lib/layout/blockCompact';
import type { LayeredGraph, OrderingStrategy, TraversalStrategy } from '@/types/graph';

interface LayoutRequest {
  graph: LayeredGraph;
  ordering: OrderingStrategy;
  traversal: TraversalStrategy;
  rowsPerLayer: number;
  blockSpread: number;
  spanExponent: number;
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { graph, ordering, traversal, rowsPerLayer, blockSpread, spanExponent } = event.data;
  try {
    const bundle = buildLayouts(graph, ordering, traversal, rowsPerLayer, 0, blockSpread, spanExponent);
    self.postMessage({ ok: true, bundle });
    for (let rows = 1; rows <= 8; rows += 1) {
      const sample = rows === rowsPerLayer ? bundle.compact : layoutBlockCompact(
        graph, rows, traversal === 'hilbert' ? 'serpentine' : traversal,
        ordering, undefined, blockSpread, spanExponent);
      self.postMessage({ ok: true, point: {
        rows, width: sample.metrics.width, crossings: sample.metrics.crossings,
        height: sample.metrics.height,
        totalEdgeLength: sample.metrics.totalEdgeLength,
      } });
    }
  } catch (error) {
    self.postMessage({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
};
