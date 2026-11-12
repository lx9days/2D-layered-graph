import type { BlockSimilarity } from '@/lib/layout/multiRow/clustering';
import { buildLayouts } from '@/lib/layout/computeMetrics';
import { layoutMultiRowCompact } from '@/lib/layout/multiRowCompact';
import type { LayeredGraph, OrderingStrategy, TraversalStrategy } from '@/types/graph';

interface LayoutRequest {
  graph: LayeredGraph;
  ordering: OrderingStrategy;
  traversal: TraversalStrategy;
  rowsPerLayer: number;
  blockSpread: number;
  spanExponent: number;
  blockSimilarity: BlockSimilarity;
  clusteringThreshold: number;

  widthWeight: number;
  crossingWeight: number;
  edgeDetourWeight: number;
  backtrackingWeight: number;
  enableRowMove: boolean;
  enableNodeSwap: boolean;
  enableAdjacentReorder: boolean;
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const {
    graph,
    ordering,
    traversal,
    rowsPerLayer,
    blockSpread,
    spanExponent,
    blockSimilarity,
    clusteringThreshold,
    widthWeight,
    crossingWeight,
    edgeDetourWeight,
    backtrackingWeight,
    enableRowMove,
    enableNodeSwap,
    enableAdjacentReorder,
  } = event.data;
  try {
    const optimizedOptions = {
      blockSpread,
      spanExponent,
      blockSimilarity,
      clusteringThreshold,
      enableRowOptimization: enableRowMove || enableNodeSwap || enableAdjacentReorder,
      enableRowMove,
      enableNodeSwap,
      enableAdjacentReorder,
      objectiveWeights: {
        width: widthWeight,
        crossings: crossingWeight,
        edgeDetour: edgeDetourWeight,
        backtracking: backtrackingWeight,
      },
    } as const;
    const bundle = buildLayouts(
      graph,
      ordering,
      traversal,
      rowsPerLayer,
      0,
      blockSpread,
      spanExponent,
      optimizedOptions,
    );
    self.postMessage({ ok: true, bundle });
    for (let rows = 1; rows <= 8; rows += 1) {
      const sample = rows === rowsPerLayer
        ? bundle.compact
        : layoutMultiRowCompact(graph, rows, optimizedOptions);
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
