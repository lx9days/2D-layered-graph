import type { GraphNode, LayeredGraph, PositionedLayout } from '@/types/graph';
import { buildWeightedAdjacency } from '@/lib/layout/multiRow/topology';
import { buildAdjacency, buildSimilarityMatrix } from '@/lib/layout/multiRow/topology';
import { seriateLayer } from '@/lib/layout/multiRow/seriation';
import { partitionLayer } from '@/lib/layout/multiRow/partition';
import { orderBlocks } from '@/lib/layout/multiRow/blockOrdering';
import { assignInitialRows } from '@/lib/layout/multiRow/rowAssignment';
import { optimizeMultiRowLayout } from '@/lib/layout/multiRow/localOptimization';
import { toPositionedLayout } from '@/lib/layout/multiRow/objective';
import { clusterLayer, createNodeSimilarity, type BlockSimilarity } from '@/lib/layout/multiRow/clustering';
import type { MultiRowBlock, MultiRowOptions } from '@/lib/layout/multiRow/types';

function cloneNodes(nodes: GraphNode[]) {
  return nodes.map((node) => ({ ...node }));
}

function getDefaultOptions(maxRows: number, blockSpread: number, spanExponent: number): MultiRowOptions {
  return {
    maxRows,
    blockSpread,
    spanExponent,
    blockSimilarity: 'neighbors',
    clusteringThreshold: 0.65,
    enableTopologyBlocking: true,
    enableRowOptimization: true,
    enableRowMove: true,
    enableNodeSwap: true,
    enableAdjacentReorder: true,
    maxIterations: 3,
    objectiveWeights: {
      width: 1,
      crossings: 1.4,
      edgeDetour: 0.35,
      backtracking: 0.6,
    },
  };
}

function buildInitialBlocks(
  graph: LayeredGraph,
  maxRows: number,
  spanExponent: number,
  enableTopologyBlocking: boolean,
  blockSimilarity: BlockSimilarity,
  clusteringThreshold: number,
) {
  if (enableTopologyBlocking && blockSimilarity !== 'legacy') {
    const similarity = createNodeSimilarity(graph, blockSimilarity, spanExponent);
    const blocksByLayer = graph.layers.map((layer, rank) => clusterLayer(layer, rank, similarity, clusteringThreshold));
    const backboneOrders = blocksByLayer.map(blocks => new Map(blocks.flatMap(block => block.nodeIds).map((id, index) => [id, index])));
    return { blocksByLayer, backboneOrders };
  }
  const weightedAdjacency = buildWeightedAdjacency(graph.nodes, graph.edges, graph.layers, spanExponent);
  const semanticLayers = new Map(graph.layers.flatMap((layer, index) => layer.map((id) => [id, index] as const)));
  const longEdgeNodes = new Set<string>();

  graph.edges.forEach(({ source, target }) => {
    if (Math.abs((semanticLayers.get(target) ?? 0) - (semanticLayers.get(source) ?? 0)) > 1) {
      longEdgeNodes.add(source);
      longEdgeNodes.add(target);
    }
  });

  const originalOrderMaps = graph.layers.map(
    (layer) => new Map(layer.map((nodeId, index) => [nodeId, index])),
  );
  const backboneOrders: Map<string, number>[] = [];
  const blocksByLayer = graph.layers.map((layer, layerIndex) => {
    const sequence = enableTopologyBlocking
      ? seriateLayer(
        layer,
        buildSimilarityMatrix(layer, weightedAdjacency.incoming, weightedAdjacency.outgoing),
        originalOrderMaps[layerIndex],
      )
      : layer.slice();

    backboneOrders[layerIndex] = new Map(sequence.map((nodeId, index) => [nodeId, index]));

    if (!enableTopologyBlocking) {
      return [{
        id: `multi-row-block-${layerIndex}-0`,
        layer: layerIndex,
        nodeIds: sequence.slice(),
        originalIndex: 0,
        rowCount: 1,
        rows: [sequence.slice()],
        column: 0,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      }] satisfies MultiRowBlock[];
    }

    return partitionLayer(
      sequence,
      layerIndex,
      maxRows,
      buildSimilarityMatrix(layer, weightedAdjacency.incoming, weightedAdjacency.outgoing),
      longEdgeNodes,
      spanExponent,
    );
  });

  return { blocksByLayer, backboneOrders };
}

export interface LayoutMultiRowCompactOptions extends Partial<MultiRowOptions> {
  maxRows?: number;
  blockSpread?: number;
  spanExponent?: number;
}

export function layoutMultiRowCompact(
  graph: LayeredGraph,
  maxRows: number,
  options: LayoutMultiRowCompactOptions = {},
): PositionedLayout {
  const mergedOptions: MultiRowOptions = {
    ...getDefaultOptions(maxRows, options.blockSpread ?? 0.7, options.spanExponent ?? 2),
    ...options,
    maxRows,
    blockSpread: options.blockSpread ?? 0.7,
    spanExponent: options.spanExponent ?? 2,
    objectiveWeights: {
      ...getDefaultOptions(maxRows, options.blockSpread ?? 0.7, options.spanExponent ?? 2).objectiveWeights,
      ...options.objectiveWeights,
    },
  };
  const nodes = cloneNodes(graph.nodes);
  const { incoming, outgoing } = buildAdjacency(graph.edges);
  const { blocksByLayer, backboneOrders } = buildInitialBlocks(
    graph,
    mergedOptions.maxRows,
    mergedOptions.spanExponent,
    mergedOptions.enableTopologyBlocking,
    mergedOptions.blockSimilarity,
    mergedOptions.clusteringThreshold,
  );
  const { layers: orderedLayers, previousNeighbors, nextNeighbors, blockInversions } = orderBlocks(blocksByLayer, graph.edges);
  const initializedLayers = orderedLayers.map((blocks) => assignInitialRows(blocks, mergedOptions.maxRows));
  const { layout, cost } = optimizeMultiRowLayout(
    graph,
    nodes,
    initializedLayers,
    mergedOptions,
    incoming,
    outgoing,
    backboneOrders,
    previousNeighbors,
    nextNeighbors,
  );
  const positioned = toPositionedLayout(layout);

  positioned.metrics.crossings = cost.crossings;
  positioned.metrics.totalEdgeLength = cost.edgeDetour;
  positioned.metrics.edgeDetour = cost.edgeDetour;
  positioned.metrics.backtracking = cost.backtracking;
  positioned.metrics.blockInversions = blockInversions;
  positioned.optimizationTrace = layout.optimizationTrace.slice();

  return positioned;
}
