import type {
  LayeredGraph,
  OrderingStrategy,
  PositionedLayout,
  TradeoffPoint,
  TraversalStrategy,
} from '@/types/graph';
import { layoutBlockCompact } from '@/lib/layout/blockCompact';
import { orderNodes } from '@/lib/layout/orderNodes';
import { layoutSugiyama } from '@/lib/layout/sugiyama';

export interface LayoutBundle {
  orderedGraph: LayeredGraph;
  traditional: PositionedLayout;
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
  sampleMaxRows = 8,
  blockSpread = 0.7,
  spanExponent = 2,
): LayoutBundle {
  const orderedGraph = orderNodes(graph, ordering);
  const traditional = layoutSugiyama(graph);
  const compact = layoutBlockCompact(
    graph,
    rowsPerLayer,
    traversal === 'hilbert' ? 'serpentine' : traversal,
    ordering,
    undefined,
    blockSpread,
    spanExponent,
  );
  const tradeoffPoints: TradeoffPoint[] = [];

  for (let rows = 1; rows <= sampleMaxRows; rows += 1) {
    const sample = rows === rowsPerLayer ? compact : layoutBlockCompact(
      graph,
      rows,
      traversal === 'hilbert' ? 'serpentine' : traversal,
      ordering,
      undefined,
      blockSpread,
      spanExponent,
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
