import { countBacktracking, countCrossings, totalEdgeLength } from '@/lib/layout/countCrossings';
import type { LayoutCost, MultiRowObjectiveWeights, PositionedMultiRowLayout } from '@/lib/layout/multiRow/types';
import type { PositionedLayout } from '@/types/graph';

export interface ObjectiveNormalization {
  width: number;
  crossings: number;
  edgeDetour: number;
  backtracking: number;
}

export function toPositionedLayout(layout: PositionedMultiRowLayout): PositionedLayout {
  const width = Math.max(...layout.boxes.map((box) => box.x + box.width), 64) + 64;
  const height = Math.max(...layout.boxes.map((box) => box.y + box.height), 64) + 64;

  return {
    mode: 'multi-row-compact',
    nodes: layout.nodes,
    edges: layout.edges.map((edge) => ({ ...edge })),
    originalEdges: layout.graph.edges.map((edge) => ({ ...edge })),
    edgeRoutes: layout.edgeRoutes,
    layers: layout.graph.layers.map((layer) => layer.slice()),
    boxes: layout.boxes,
    blockBoxes: layout.blockBoxes,
    optimizationTrace: layout.optimizationTrace,
    metrics: {
      width,
      height,
      crossings: 0,
      totalEdgeLength: 0,
      edgeDetour: 0,
      backtracking: 0,
    },
  };
}

export function evaluateLayoutCost(
  layout: PositionedMultiRowLayout,
  weights: MultiRowObjectiveWeights,
  normalization: ObjectiveNormalization,
) {
  const positioned = toPositionedLayout(layout);
  const crossings = countCrossings(positioned);
  const edgeDetour = totalEdgeLength(positioned);
  const backtracking = countBacktracking(positioned);
  const width = positioned.metrics.width;
  const total =
    weights.width * width / Math.max(1, normalization.width) +
    weights.crossings * crossings / Math.max(1, normalization.crossings) +
    weights.edgeDetour * edgeDetour / Math.max(1, normalization.edgeDetour) +
    weights.backtracking * backtracking / Math.max(1, normalization.backtracking);

  return {
    total,
    width,
    crossings,
    edgeDetour,
    backtracking,
  } satisfies LayoutCost;
}
