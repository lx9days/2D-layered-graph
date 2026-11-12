import { generateCandidateMoves } from '@/lib/layout/multiRow/candidateMoves';
import { assignMultiRowCoordinates } from '@/lib/layout/multiRow/coordinateAssignment';
import { evaluateLayoutCost, type ObjectiveNormalization } from '@/lib/layout/multiRow/objective';
import { reorderAllBlockRows } from '@/lib/layout/multiRow/rowOrdering';
import type { NeighborIndex } from '@/lib/layout/multiRow/topology';
import type {
  CandidateMove,
  LayoutCost,
  MultiRowBlock,
  MultiRowOptions,
  PositionedMultiRowLayout,
} from '@/lib/layout/multiRow/types';
import type { BlockNeighborMap } from '@/lib/layout/blockCrossingOrder';
import type { GraphNode, LayeredGraph, OptimizationTrace } from '@/types/graph';

function cloneLayers(layers: MultiRowBlock[][]) {
  return layers.map((blocks) =>
    blocks.map((block) => ({
      ...block,
      rows: block.rows.map((row) => row.slice()),
      nodeIds: block.rows.flat(),
    })));
}

function applyCandidateMove(layers: MultiRowBlock[][], move: CandidateMove) {
  const nextLayers = cloneLayers(layers);

  nextLayers.forEach((blocks) => {
    blocks.forEach((block) => {
      if (block.id !== move.blockId) {
        return;
      }

      if (move.type === 'row-move') {
        const fromRow = block.rows[move.fromRow];
        const toRow = block.rows[move.toRow];
        const fromIndex = fromRow.indexOf(move.nodeId);

        if (fromIndex >= 0) {
          fromRow.splice(fromIndex, 1);
          toRow.push(move.nodeId);
        }
      } else if (move.type === 'swap') {
        const upperRow = block.rows[move.upperRow];
        const lowerRow = block.rows[move.lowerRow];
        const upperIndex = upperRow.indexOf(move.upperNodeId);
        const lowerIndex = lowerRow.indexOf(move.lowerNodeId);

        if (upperIndex >= 0 && lowerIndex >= 0) {
          upperRow[upperIndex] = move.lowerNodeId;
          lowerRow[lowerIndex] = move.upperNodeId;
        }
      } else if (move.type === 'reorder') {
        const row = block.rows[move.row];
        [row[move.leftIndex], row[move.rightIndex]] = [row[move.rightIndex], row[move.leftIndex]];
      }

      block.rows = block.rows.filter((row) => row.length > 0);
      block.rowCount = Math.max(1, block.rows.length);
      block.nodeIds = block.rows.flat();
    });
  });

  return nextLayers;
}

function buildLayout(
  graph: LayeredGraph,
  nodes: GraphNode[],
  layers: MultiRowBlock[][],
  previousNeighbors: BlockNeighborMap,
  nextNeighbors: BlockNeighborMap,
  blockSpread: number,
  trace: OptimizationTrace[],
) {
  const geometry = assignMultiRowCoordinates(
    graph,
    nodes,
    layers,
    previousNeighbors,
    nextNeighbors,
    blockSpread,
  );

  return {
    graph,
    layers: geometry.layers,
    nodes: geometry.nodes,
    boxes: geometry.boxes,
    blockBoxes: geometry.blockBoxes,
    edges: graph.edges,
    edgeRoutes: geometry.edgeRoutes,
    optimizationTrace: trace,
  };
}

function normalizeLayers(
  layers: MultiRowBlock[][],
  incoming: NeighborIndex,
  outgoing: NeighborIndex,
  backboneOrders: Map<string, number>[],
) {
  return reorderAllBlockRows(layers, incoming, outgoing, backboneOrders);
}

export function optimizeMultiRowLayout(
  graph: LayeredGraph,
  nodes: GraphNode[],
  initialLayers: MultiRowBlock[][],
  options: MultiRowOptions,
  incoming: NeighborIndex,
  outgoing: NeighborIndex,
  backboneOrders: Map<string, number>[],
  previousNeighbors: BlockNeighborMap,
  nextNeighbors: BlockNeighborMap,
) {
  const trace: OptimizationTrace[] = [];
  const normalizedInitialLayers = options.enableRowOptimization
    ? normalizeLayers(initialLayers, incoming, outgoing, backboneOrders)
    : initialLayers;
  let currentLayout = buildLayout(
    graph,
    nodes,
    normalizedInitialLayers,
    previousNeighbors,
    nextNeighbors,
    options.blockSpread,
    trace,
  );
  const initialCost = evaluateLayoutCost(currentLayout, options.objectiveWeights, {
    width: 1,
    crossings: 1,
    edgeDetour: 1,
    backtracking: 1,
  });
  const normalization: ObjectiveNormalization = {
    width: initialCost.width,
    crossings: initialCost.crossings,
    edgeDetour: initialCost.edgeDetour,
    backtracking: initialCost.backtracking,
  };
  let currentCost = evaluateLayoutCost(currentLayout, options.objectiveWeights, normalization);

  if (!options.enableRowOptimization || graph.nodes.length > 96) {
    return { layout: currentLayout, cost: currentCost };
  }

  for (let iteration = 0; iteration < options.maxIterations; iteration += 1) {
    let acceptedCandidate: { layout: PositionedMultiRowLayout; cost: LayoutCost; move: CandidateMove } | null = null;

    outer: for (const blocks of currentLayout.layers) {
      for (const block of blocks) {
        const moves = generateCandidateMoves(block, options);

        for (const move of moves) {
          let candidateLayers = applyCandidateMove(currentLayout.layers, move);

          candidateLayers = normalizeLayers(candidateLayers, incoming, outgoing, backboneOrders);
          const candidateLayout = buildLayout(
            graph,
            nodes,
            candidateLayers,
            previousNeighbors,
            nextNeighbors,
            options.blockSpread,
            trace,
          );
          const candidateCost = evaluateLayoutCost(candidateLayout, options.objectiveWeights, normalization);

          if (candidateCost.total < currentCost.total - 1e-6) {
            acceptedCandidate = {
              layout: candidateLayout,
              cost: candidateCost,
              move,
            };
            break outer;
          }
        }
      }
    }

    if (!acceptedCandidate) {
      break;
    }

    trace.push({
      iteration: iteration + 1,
      moveType: acceptedCandidate.move.type,
      deltaCost: acceptedCandidate.cost.total - currentCost.total,
      widthBefore: currentCost.width,
      widthAfter: acceptedCandidate.cost.width,
      crossingsBefore: currentCost.crossings,
      crossingsAfter: acceptedCandidate.cost.crossings,
      edgeLengthBefore: currentCost.edgeDetour,
      edgeLengthAfter: acceptedCandidate.cost.edgeDetour,
      backtrackingBefore: currentCost.backtracking,
      backtrackingAfter: acceptedCandidate.cost.backtracking,
    });
    currentLayout = {
      ...acceptedCandidate.layout,
      optimizationTrace: trace,
    };
    currentCost = acceptedCandidate.cost;
  }

  return { layout: currentLayout, cost: currentCost };
}
