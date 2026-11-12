import { countBlockInversions, refineBlockOrderByCrossings, type BlockNeighborMap } from '@/lib/layout/blockCrossingOrder';
import type { GraphEdge } from '@/types/graph';
import type { MultiRowBlock } from '@/lib/layout/multiRow/types';

function getBlockBarycenter(
  block: MultiRowBlock,
  neighbors: Map<string, number> | undefined,
  adjacentOrderMap: Map<string, number>,
) {
  if (!neighbors || neighbors.size === 0) {
    return block.originalIndex;
  }

  let weightedSum = 0;
  let weight = 0;

  neighbors.forEach((count, neighborId) => {
    const order = adjacentOrderMap.get(neighborId);

    if (order === undefined) {
      return;
    }

    weightedSum += order * count;
    weight += count;
  });

  return weight > 0 ? weightedSum / weight : block.originalIndex;
}

function buildBlockOrderMaps(layers: MultiRowBlock[][]) {
  return layers.map((blocks) => new Map(blocks.map((block, index) => [block.id, index])));
}

export function buildBlockNeighbors(
  edges: GraphEdge[],
  nodeToBlockId: Map<string, string>,
) {
  const previousNeighbors: BlockNeighborMap = new Map();
  const nextNeighbors: BlockNeighborMap = new Map();

  edges.forEach((edge) => {
    const sourceBlockId = nodeToBlockId.get(edge.source);
    const targetBlockId = nodeToBlockId.get(edge.target);

    if (!sourceBlockId || !targetBlockId || sourceBlockId === targetBlockId) {
      return;
    }

    const sourceTargets = nextNeighbors.get(sourceBlockId) ?? new Map<string, number>();
    sourceTargets.set(targetBlockId, (sourceTargets.get(targetBlockId) ?? 0) + 1);
    nextNeighbors.set(sourceBlockId, sourceTargets);

    const targetSources = previousNeighbors.get(targetBlockId) ?? new Map<string, number>();
    targetSources.set(sourceBlockId, (targetSources.get(sourceBlockId) ?? 0) + 1);
    previousNeighbors.set(targetBlockId, targetSources);
  });

  return { previousNeighbors, nextNeighbors };
}

function optimizeBlockOrder(
  layers: MultiRowBlock[][],
  previousNeighbors: BlockNeighborMap,
  nextNeighbors: BlockNeighborMap,
) {
  const workingLayers = layers.map((blocks) => blocks.slice());

  for (let sweep = 0; sweep < 4; sweep += 1) {
    let orderMaps = buildBlockOrderMaps(workingLayers);

    for (let layerIndex = 1; layerIndex < workingLayers.length; layerIndex += 1) {
      const previousOrderMap = orderMaps[layerIndex - 1];

      workingLayers[layerIndex] = workingLayers[layerIndex]
        .slice()
        .sort((left, right) => {
          const leftBarycenter = getBlockBarycenter(left, previousNeighbors.get(left.id), previousOrderMap);
          const rightBarycenter = getBlockBarycenter(right, previousNeighbors.get(right.id), previousOrderMap);

          if (leftBarycenter === rightBarycenter) {
            return left.originalIndex - right.originalIndex;
          }

          return leftBarycenter - rightBarycenter;
        })
        .map((block, index) => ({ ...block, column: index }));
    }

    orderMaps = buildBlockOrderMaps(workingLayers);

    for (let layerIndex = workingLayers.length - 2; layerIndex >= 0; layerIndex -= 1) {
      const nextOrderMap = orderMaps[layerIndex + 1];

      workingLayers[layerIndex] = workingLayers[layerIndex]
        .slice()
        .sort((left, right) => {
          const leftBarycenter = getBlockBarycenter(left, nextNeighbors.get(left.id), nextOrderMap);
          const rightBarycenter = getBlockBarycenter(right, nextNeighbors.get(right.id), nextOrderMap);

          if (leftBarycenter === rightBarycenter) {
            return left.originalIndex - right.originalIndex;
          }

          return leftBarycenter - rightBarycenter;
        })
        .map((block, index) => ({ ...block, column: index }));
    }
  }

  return workingLayers;
}

export function orderBlocks(
  layers: MultiRowBlock[][],
  edges: GraphEdge[],
) {
  const nodeToBlockId = new Map<string, string>();

  layers.forEach((blocks) => {
    blocks.forEach((block) => {
      block.nodeIds.forEach((nodeId) => {
        nodeToBlockId.set(nodeId, block.id);
      });
    });
  });

  const { previousNeighbors, nextNeighbors } = buildBlockNeighbors(edges, nodeToBlockId);
  const barycentricLayers = optimizeBlockOrder(layers, previousNeighbors, nextNeighbors);
  const initialInversions = countBlockInversions(layers, nextNeighbors);
  const barycentricInversions = countBlockInversions(barycentricLayers, nextNeighbors);
  const candidateLayers = barycentricInversions <= initialInversions ? barycentricLayers : layers;
  const refinedLayers = refineBlockOrderByCrossings(candidateLayers, previousNeighbors, nextNeighbors)
    .map((blocks) => blocks.map((block, index) => ({ ...block, column: index })));

  return {
    layers: refinedLayers,
    previousNeighbors,
    nextNeighbors,
    blockInversions: countBlockInversions(refinedLayers, nextNeighbors),
  };
}
