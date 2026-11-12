import type {
  LayeredGraph,
  OrderingStrategy,
  PositionedLayout,
  TradeoffPoint,
  TraversalStrategy,
} from '@/types/graph';
import { orderNodes } from '@/lib/layout/orderNodes';
import { layoutMultiRowCompact, type LayoutMultiRowCompactOptions } from '@/lib/layout/multiRowCompact';
import { layoutSugiyama } from '@/lib/layout/sugiyama';

export interface LayoutBundle {
  orderedGraph: LayeredGraph;
  traditional: PositionedLayout;
  unoptimizedCompact: PositionedLayout;
  compact: PositionedLayout;
  tradeoffPoints: TradeoffPoint[];
}

export interface LayoutDelta {
  widthReduction: number;
  crossingChange: number;
}

export function buildLayouts(
  graph: LayeredGraph,
  ordering: OrderingStrategy,
  traversal: TraversalStrategy,
  rowsPerLayer: number,
  sampleMaxRows = 0,
  blockSpread = 0.7,
  spanExponent = 2,
  optimizedOptions: LayoutMultiRowCompactOptions = {},
): LayoutBundle {
  const orderedGraph = orderNodes(graph, ordering);
  const traditional = layoutSugiyama(graph);
  const unoptimizedCompact = layoutMultiRowCompact(graph, rowsPerLayer, {
    blockSpread,
    spanExponent,
    ...optimizedOptions,
    enableRowOptimization: false,
  });
  const compact = layoutMultiRowCompact(graph, rowsPerLayer, {
    blockSpread,
    spanExponent,
    ...optimizedOptions,
  });
  const tradeoffPoints: TradeoffPoint[] = [];

  for (let rows = 1; rows <= sampleMaxRows; rows += 1) {
    const sample = rows === rowsPerLayer ? compact : layoutMultiRowCompact(
      graph,
      rows,
      {
        blockSpread,
        spanExponent,
        ...optimizedOptions,
      },
    );
    tradeoffPoints.push({
      rows,
      width: sample.metrics.width,
      crossings: sample.metrics.crossings,
      height: sample.metrics.height,
      totalEdgeLength: sample.metrics.totalEdgeLength,
    });
  }

  return {
    orderedGraph,
    traditional,
    unoptimizedCompact,
    compact,
    tradeoffPoints,
  };
}

export function computeDelta(traditional: PositionedLayout, compact: PositionedLayout): LayoutDelta {
  const widthReduction =
    traditional.metrics.width > 0
      ? ((traditional.metrics.width - compact.metrics.width) / traditional.metrics.width) * 100
      : 0;
  const crossingChange =
    traditional.metrics.crossings > 0
      ? ((compact.metrics.crossings - traditional.metrics.crossings) / traditional.metrics.crossings) * 100
      : compact.metrics.crossings > 0
        ? 100
        : 0;

  return {
    widthReduction,
    crossingChange,
  };
}
