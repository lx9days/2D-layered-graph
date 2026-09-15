import type {
  BlockBox,
  GraphEdge,
  GraphNode,
  LayeredGraph,
  LayoutBox,
  OrderingStrategy,
  PositionedLayout,
  TraversalStrategy,
} from '@/types/graph';
import { countCrossings, totalEdgeLength } from '@/lib/layout/countCrossings';
import { buildWeightedAdjacency, nodeTopologySimilarity, type WeightedNeighborIndex } from '@/lib/layout/topologySimilarity';
import { countBlockInversions, refineBlockOrderByCrossings } from '@/lib/layout/blockCrossingOrder';

const OUTER_PADDING = 64;
const LAYER_TOP_PADDING = 28;
const LAYER_SIDE_PADDING = 28;
const LAYER_GAP_Y = 112;
const NODE_GAP_X = 18;
const NODE_GAP_Y = 18;
const NODE_RADIUS = 5;
const BLOCK_GAP_X = 18;
const BLOCK_PADDING_X = 12;
const BLOCK_PADDING_Y = 12;

interface BaseBlockSpec {
  id: string;
  layer: number;
  nodeIds: string[];
  originalIndex: number;
}

interface BlockSpec extends BaseBlockSpec {
  internalRows: number;
  columns: number;
  width: number;
  height: number;
}

interface PositionedBlockSpec extends BlockSpec {
  column: number;
  x: number;
  y: number;
}

type NeighborIndex = Map<string, string[]>;
type BlockNeighborMap = Map<string, Map<string, number>>;
type SimilarityMatrix = Map<string, Map<string, number>>;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cloneNodes(nodes: GraphNode[]) {
  return nodes.map((node) => ({ ...node }));
}

function buildNodeMap(nodes: GraphNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function buildAdjacency(edges: GraphEdge[]) {
  const incoming: NeighborIndex = new Map();
  const outgoing: NeighborIndex = new Map();

  edges.forEach((edge) => {
    const nextOutgoing = outgoing.get(edge.source) ?? [];
    nextOutgoing.push(edge.target);
    outgoing.set(edge.source, nextOutgoing);

    const nextIncoming = incoming.get(edge.target) ?? [];
    nextIncoming.push(edge.source);
    incoming.set(edge.target, nextIncoming);
  });

  return { incoming, outgoing };
}

function setSimilarity(
  matrix: SimilarityMatrix,
  leftId: string,
  rightId: string,
  value: number,
) {
  const leftMap = matrix.get(leftId) ?? new Map<string, number>();
  leftMap.set(rightId, value);
  matrix.set(leftId, leftMap);

  const rightMap = matrix.get(rightId) ?? new Map<string, number>();
  rightMap.set(leftId, value);
  matrix.set(rightId, rightMap);
}

function getSimilarity(
  matrix: SimilarityMatrix,
  leftId: string,
  rightId: string,
) {
  if (leftId === rightId) {
    return 1;
  }

  return matrix.get(leftId)?.get(rightId) ?? 0;
}

function buildSimilarityMatrix(
  layer: string[],
  incoming: WeightedNeighborIndex,
  outgoing: WeightedNeighborIndex,
) {
  const matrix: SimilarityMatrix = new Map();

  layer.forEach((nodeId) => {
    setSimilarity(matrix, nodeId, nodeId, 1);
  });

  for (let leftIndex = 0; leftIndex < layer.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < layer.length; rightIndex += 1) {
      const similarity = nodeTopologySimilarity(
        layer[leftIndex],
        layer[rightIndex],
        incoming,
        outgoing,
      );
      setSimilarity(matrix, layer[leftIndex], layer[rightIndex], similarity);
    }
  }

  return matrix;
}

function seriateLayer(
  layer: string[],
  similarity: SimilarityMatrix,
  originalOrder: Map<string, number>,
) {
  if (layer.length <= 2) {
    return layer.slice().sort(
      (left, right) => (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0),
    );
  }

  let bestPair: [string, string] = [layer[0], layer[1]];
  let bestPairScore = -1;

  for (let leftIndex = 0; leftIndex < layer.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < layer.length; rightIndex += 1) {
      const candidateScore = getSimilarity(similarity, layer[leftIndex], layer[rightIndex]);

      if (candidateScore > bestPairScore) {
        bestPair = [layer[leftIndex], layer[rightIndex]];
        bestPairScore = candidateScore;
      }
    }
  }

  const orderedPair = bestPair
    .slice()
    .sort((left, right) => (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0)) as [string, string];
  const sequence = orderedPair.slice();
  const remaining = new Set(layer.filter((nodeId) => !sequence.includes(nodeId)));

  while (remaining.size > 0) {
    let bestNode: string | null = null;
    let shouldInsertLeft = false;
    let bestScore = Number.NEGATIVE_INFINITY;

    remaining.forEach((nodeId) => {
      const leftScore = getSimilarity(similarity, nodeId, sequence[0]);
      const rightScore = getSimilarity(similarity, nodeId, sequence[sequence.length - 1]);
      const nodeBestScore = Math.max(leftScore, rightScore);
      const nodeBestSide: 'left' | 'right' = leftScore > rightScore ? 'left' : 'right';

      if (
        nodeBestScore > bestScore ||
        (nodeBestScore === bestScore &&
          (originalOrder.get(nodeId) ?? 0) < (originalOrder.get(bestNode ?? nodeId) ?? 0))
      ) {
        bestNode = nodeId;
        shouldInsertLeft = nodeBestSide === 'left';
        bestScore = nodeBestScore;
      }
    });

    if (!bestNode) {
      break;
    }

    if (shouldInsertLeft) {
      sequence.unshift(bestNode);
    } else {
      sequence.push(bestNode);
    }

    remaining.delete(bestNode);
  }

  return sequence;
}

function getIntervalCost(
  sequence: string[],
  start: number,
  end: number,
  similarity: SimilarityMatrix,
  minBlockSize: number,
  maxBlockSize: number,
  preferredSize: number,
  longEdgeNodes: Set<string>,
  spanExponent: number,
) {
  const size = end - start + 1;

  if (size < minBlockSize || size > maxBlockSize) {
    return Number.POSITIVE_INFINITY;
  }

  let pairCount = 0;
  let pairwiseDissimilarity = 0;
  let mixedPairs = 0;

  for (let leftIndex = start; leftIndex <= end; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex <= end; rightIndex += 1) {
      pairCount += 1;
      pairwiseDissimilarity += 1 - getSimilarity(similarity, sequence[leftIndex], sequence[rightIndex]);
      if (longEdgeNodes.has(sequence[leftIndex]) !== longEdgeNodes.has(sequence[rightIndex])) mixedPairs += 1;
    }
  }

  const cohesionCost = pairCount > 0 ? pairwiseDissimilarity / pairCount : 0.15;
  const sizePenalty = 0.035 * Math.abs(size - preferredSize);

  // A rare long-edge endpoint should not disappear in an averaged, mostly ordinary block.
  const mixedLongEdgePenalty = pairCount > 0 ? 2.5 * spanExponent * mixedPairs / pairCount : 0;
  return cohesionCost + sizePenalty + mixedLongEdgePenalty + 0.06;
}

function partitionLayer(
  sequence: string[],
  layerIndex: number,
  rowsPerLayer: number,
  similarity: SimilarityMatrix,
  longEdgeNodes: Set<string>,
  spanExponent: number,
) {
  if (sequence.length === 0) {
    return [];
  }

  const minBlockSize = sequence.length >= 8 && !sequence.some((id) => longEdgeNodes.has(id)) ? 2 : 1;
  const maxBlockSize = Math.max(minBlockSize, Math.max(4, Math.round(Math.sqrt(sequence.length) * 2.25)));
  const preferredSize = clamp(rowsPerLayer + 1, minBlockSize, maxBlockSize);
  const dp = new Array<number>(sequence.length + 1).fill(Number.POSITIVE_INFINITY);
  const previousCut = new Array<number>(sequence.length + 1).fill(-1);

  dp[0] = 0;

  for (let end = 1; end <= sequence.length; end += 1) {
    for (let start = Math.max(0, end - maxBlockSize); start <= end - minBlockSize; start += 1) {
      const intervalCost = getIntervalCost(
        sequence,
        start,
        end - 1,
        similarity,
        minBlockSize,
        maxBlockSize,
        preferredSize,
        longEdgeNodes,
        spanExponent,
      );

      if (!Number.isFinite(intervalCost) || !Number.isFinite(dp[start])) {
        continue;
      }

      const candidate = dp[start] + intervalCost;

      if (candidate < dp[end]) {
        dp[end] = candidate;
        previousCut[end] = start;
      }
    }
  }

  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = sequence.length;

  if (previousCut[cursor] === -1) {
    ranges.push({ start: 0, end: sequence.length - 1 });
  } else {
    while (cursor > 0 && previousCut[cursor] !== -1) {
      ranges.push({ start: previousCut[cursor], end: cursor - 1 });
      cursor = previousCut[cursor];
    }
  }

  return ranges
    .reverse()
    .map(({ start, end }, index) => ({
      id: `block-${layerIndex}-${index}`,
      layer: layerIndex,
      nodeIds: sequence.slice(start, end + 1),
      originalIndex: index,
    }));
}

function buildBlockNeighbors(
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

  return {
    previousNeighbors,
    nextNeighbors,
  };
}

function getBlockBarycenter(
  block: BaseBlockSpec,
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

function buildBlockOrderMaps(layers: BaseBlockSpec[][]) {
  return layers.map((blocks) => new Map(blocks.map((block, index) => [block.id, index])));
}

function optimizeBlockOrder(
  layers: BaseBlockSpec[][],
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
        });
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
        });
    }
  }

  return workingLayers;
}

function sortNodeIdsByNeighbors(
  nodeIds: string[],
  neighbors: NeighborIndex,
  adjacentOrderMap: Map<string, number>,
) {
  return nodeIds
    .map((nodeId, index) => {
      const linkedIds = neighbors.get(nodeId) ?? [];
      const barycenter =
        linkedIds.length > 0
          ? linkedIds.reduce((sum, linkedId) => sum + (adjacentOrderMap.get(linkedId) ?? index), 0) / linkedIds.length
          : Number.POSITIVE_INFINITY;

      return {
        nodeId,
        barycenter,
        fallback: index,
      };
    })
    .sort((left, right) => {
      if (left.barycenter === right.barycenter) {
        return left.fallback - right.fallback;
      }

      return left.barycenter - right.barycenter;
    })
    .map((entry) => entry.nodeId);
}

function getNeighborCenter(
  neighbors: string[],
  adjacentOrderMap: Map<string, number> | undefined,
) {
  if (!adjacentOrderMap || neighbors.length === 0) {
    return null;
  }

  const positions = neighbors
    .map((neighborId) => adjacentOrderMap.get(neighborId))
    .filter((value): value is number => value !== undefined);

  if (positions.length === 0) {
    return null;
  }

  return positions.reduce((sum, value) => sum + value, 0) / positions.length;
}

function getRowSizes(size: number, rowCount: number) {
  const rows = Math.max(1, Math.min(size, rowCount));
  const columns = Math.ceil(size / rows);
  const rowSizes: number[] = [];
  let remaining = size;

  for (let row = 0; row < rows; row += 1) {
    const rowSize = Math.min(columns, remaining);
    rowSizes.push(rowSize);
    remaining -= rowSize;
  }

  return rowSizes;
}

function arrangeNodesWithinBlock(
  nodeIds: string[],
  rowCount: number,
  traversal: TraversalStrategy,
  incoming: NeighborIndex,
  outgoing: NeighborIndex,
  previousOrderMap: Map<string, number> | undefined,
  nextOrderMap: Map<string, number> | undefined,
) {
  if (nodeIds.length <= 1 || rowCount <= 1) {
    return nodeIds.slice();
  }

  const rowSizes = getRowSizes(nodeIds.length, rowCount);
  const fallbackOrder = new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
  const descriptors = nodeIds.map((nodeId) => {
    const incomingNeighbors = incoming.get(nodeId) ?? [];
    const outgoingNeighbors = outgoing.get(nodeId) ?? [];
    const incomingDegree = incomingNeighbors.length;
    const outgoingDegree = outgoingNeighbors.length;
    const normalization = Math.max(1, incomingDegree + outgoingDegree);
    const verticalScore = outgoingDegree / normalization - incomingDegree / normalization;
    const incomingCenter = getNeighborCenter(incomingNeighbors, previousOrderMap);
    const outgoingCenter = getNeighborCenter(outgoingNeighbors, nextOrderMap);
    const centers = [incomingCenter, outgoingCenter].filter((value): value is number => value !== null);
    const horizontalScore =
      centers.length > 0
        ? centers.reduce((sum, value) => sum + value, 0) / centers.length
        : fallbackOrder.get(nodeId) ?? 0;

    return {
      nodeId,
      verticalScore,
      horizontalScore,
      fallback: fallbackOrder.get(nodeId) ?? 0,
    };
  });

  const byVertical = descriptors
    .slice()
    .sort((left, right) => {
      if (left.verticalScore === right.verticalScore) {
        return left.fallback - right.fallback;
      }

      return left.verticalScore - right.verticalScore;
    });
  const rows: string[][] = [];
  let cursor = 0;

  rowSizes.forEach((rowSize, rowIndex) => {
    const row = byVertical
      .slice(cursor, cursor + rowSize)
      .sort((left, right) => {
        if (left.horizontalScore === right.horizontalScore) {
          return left.fallback - right.fallback;
        }

        return left.horizontalScore - right.horizontalScore;
      })
      .map((entry) => entry.nodeId);

    rows.push(
      traversal === 'serpentine' && rowIndex % 2 === 1
        ? row.slice().reverse()
        : row,
    );
    cursor += rowSize;
  });

  return rows.flat();
}

function buildNodeOrderMapsFromBlocks(layers: BaseBlockSpec[][]) {
  return layers.map((blocks) => {
    const entries: Array<[string, number]> = [];
    let cursor = 0;

    blocks.forEach((block) => {
      block.nodeIds.forEach((nodeId) => {
        entries.push([nodeId, cursor]);
        cursor += 1;
      });
    });

    return new Map(entries);
  });
}

function refineNodesWithinBlocks(
  layers: BaseBlockSpec[][],
  ordering: OrderingStrategy,
  incoming: NeighborIndex,
  outgoing: NeighborIndex,
) {
  if (ordering !== 'barycenter') {
    return layers;
  }

  const refinedLayers = layers.map((blocks) =>
    blocks.map((block) => ({
      ...block,
      nodeIds: block.nodeIds.slice(),
    })),
  );

  for (let pass = 0; pass < 2; pass += 1) {
    let nodeOrderMaps = buildNodeOrderMapsFromBlocks(refinedLayers);

    for (let layerIndex = 1; layerIndex < refinedLayers.length; layerIndex += 1) {
      const previousOrderMap = nodeOrderMaps[layerIndex - 1];

      refinedLayers[layerIndex] = refinedLayers[layerIndex].map((block) => ({
        ...block,
        nodeIds: sortNodeIdsByNeighbors(block.nodeIds, incoming, previousOrderMap),
      }));
    }

    nodeOrderMaps = buildNodeOrderMapsFromBlocks(refinedLayers);

    for (let layerIndex = refinedLayers.length - 2; layerIndex >= 0; layerIndex -= 1) {
      const nextOrderMap = nodeOrderMaps[layerIndex + 1];

      refinedLayers[layerIndex] = refinedLayers[layerIndex].map((block) => ({
        ...block,
        nodeIds: sortNodeIdsByNeighbors(block.nodeIds, outgoing, nextOrderMap),
      }));
    }
  }

  return refinedLayers;
}

function arrangeLayerNodesWithinBlocks(
  layers: BlockSpec[][],
  traversal: TraversalStrategy,
  incoming: NeighborIndex,
  outgoing: NeighborIndex,
  originalOrderMaps: Map<string, number>[],
) {
  const nodeOrderMaps = buildNodeOrderMapsFromBlocks(layers);

  return layers.map((blocks, layerIndex) =>
    blocks.map((block) => ({
      ...block,
      nodeIds: arrangeNodesWithinBlock(
        block.nodeIds,
        block.internalRows,
        traversal,
        incoming,
        outgoing,
        nodeOrderMaps[layerIndex - 1] ?? originalOrderMaps[layerIndex - 1],
        nodeOrderMaps[layerIndex + 1] ?? originalOrderMaps[layerIndex + 1],
      ),
    })),
  );
}

function getBlockDimensions(size: number, rowsPerLayer: number) {
  const internalRows = Math.min(size, Math.max(1, rowsPerLayer));
  const columns = Math.ceil(size / internalRows);
  const width = BLOCK_PADDING_X * 2 + Math.max(0, columns - 1) * NODE_GAP_X + NODE_RADIUS * 2;
  const height = BLOCK_PADDING_Y * 2 + Math.max(0, internalRows - 1) * NODE_GAP_Y + NODE_RADIUS * 2;

  return {
    internalRows,
    columns,
    width,
    height,
  };
}

/** The widest semantic layer receives the slider maximum; shorter layers use fewer rows. */
export function getLayerRowBudget(layerSize: number, maxLayerSize: number, maxRows: number) {
  const limit = Math.max(1, Math.floor(maxRows));
  if (maxLayerSize <= 0) return 1;
  return Math.max(1, Math.min(limit, Math.ceil(limit * layerSize / maxLayerSize)));
}

function buildLayerBoxes(layerWidths: number[], layerHeights: number[]) {
  const boxes: LayoutBox[] = [];
  let cursorY = OUTER_PADDING;

  layerWidths.forEach((width, index) => {
    const height = layerHeights[index];
    boxes.push({
      layer: index,
      x: OUTER_PADDING,
      y: cursorY,
      width,
      height,
      label: `L${index + 1}`,
    });
    cursorY += height + LAYER_GAP_Y;
  });

  return boxes;
}

function getTraversalPosition(index: number, columns: number, traversal: TraversalStrategy) {
  const row = Math.floor(index / columns);
  const rawColumn = index % columns;
  const column =
    traversal === 'serpentine' && row % 2 === 1
      ? Math.max(0, columns - 1 - rawColumn)
      : rawColumn;

  return { row, column };
}

function getBlockCenter(block: PositionedBlockSpec) {
  return block.x + block.width / 2;
}

function getWeightedNeighborCenter(
  neighbors: Map<string, number> | undefined,
  positions: Map<string, PositionedBlockSpec>,
) {
  if (!neighbors || neighbors.size === 0) {
    return null;
  }

  let weightedSum = 0;
  let weight = 0;

  neighbors.forEach((count, neighborId) => {
    const neighbor = positions.get(neighborId);

    if (!neighbor) {
      return;
    }

    weightedSum += getBlockCenter(neighbor) * count;
    weight += count;
  });

  return weight > 0 ? weightedSum / weight : null;
}

function assignInitialBlockPositions(
  box: LayoutBox,
  blocks: PositionedBlockSpec[],
  contentWidth: number,
  contentHeight: number,
) {
  const occupiedWidth = blocks.reduce(
    (sum, block, index) => sum + block.width + (index > 0 ? BLOCK_GAP_X : 0),
    0,
  );
  const baseX = box.x + LAYER_SIDE_PADDING + Math.max(0, (contentWidth - occupiedWidth) / 2);
  const baseY = box.y + LAYER_TOP_PADDING + 22;
  let cursorX = baseX;

  blocks
    .slice()
    .sort((left, right) => left.column - right.column)
    .forEach((block) => {
      block.x = cursorX;
      block.y = baseY + (contentHeight - block.height) / 2;
      cursorX += block.width + BLOCK_GAP_X;
    });
}

function assignLayerBlockPositions(
  box: LayoutBox,
  blocks: PositionedBlockSpec[],
  contentWidth: number,
  contentHeight: number,
  positions: Map<string, PositionedBlockSpec>,
  previousNeighbors: BlockNeighborMap,
  nextNeighbors: BlockNeighborMap,
  blockSpread: number,
) {
  if (blocks.length === 0) {
    return;
  }

  const orderedBlocks = blocks.slice().sort((left, right) => left.column - right.column);
  const leftLimit = box.x + LAYER_SIDE_PADDING;
  const rightLimit = leftLimit + contentWidth;
  const baseY = box.y + LAYER_TOP_PADDING + 22;
  const desiredLefts = orderedBlocks.map((block) => {
    const previousCenter = getWeightedNeighborCenter(previousNeighbors.get(block.id), positions);
    const nextCenter = getWeightedNeighborCenter(nextNeighbors.get(block.id), positions);
    const targetCenter =
      previousCenter !== null && nextCenter !== null
        ? (previousCenter + nextCenter) / 2
        : previousCenter ?? nextCenter ?? getBlockCenter(block);

    return targetCenter - block.width / 2;
  });
  const lefts = new Array<number>(orderedBlocks.length);

  lefts[0] = Math.max(leftLimit, desiredLefts[0]);

  for (let index = 1; index < orderedBlocks.length; index += 1) {
    lefts[index] = Math.max(
      desiredLefts[index],
      lefts[index - 1] + orderedBlocks[index - 1].width + BLOCK_GAP_X,
    );
  }

  lefts[lefts.length - 1] = Math.min(
    lefts[lefts.length - 1],
    rightLimit - orderedBlocks[orderedBlocks.length - 1].width,
  );

  for (let index = orderedBlocks.length - 2; index >= 0; index -= 1) {
    lefts[index] = Math.min(
      lefts[index],
      lefts[index + 1] - BLOCK_GAP_X - orderedBlocks[index].width,
    );
  }

  if (lefts[0] < leftLimit) {
    const shift = leftLimit - lefts[0];

    for (let index = 0; index < lefts.length; index += 1) {
      lefts[index] += shift;
    }
  }

  // Distribute a chosen share of unused layer width among the ordered block gaps.
  // The existing barycentric gap differences remain; only free space is added.
  const occupiedLeft = lefts[0];
  let occupiedRight = lefts[lefts.length - 1] + orderedBlocks[orderedBlocks.length - 1].width;
  if (lefts.length > 1) {
    const unusedWidth = Math.max(0, contentWidth - (occupiedRight - occupiedLeft));
    const spreadStep = unusedWidth * clamp(blockSpread, 0, 1) / (lefts.length - 1);
    for (let index = 0; index < lefts.length; index += 1) {
      lefts[index] += index * spreadStep;
    }
    occupiedRight += (lefts.length - 1) * spreadStep;
  }
  // Center the resulting occupied span without changing order or spacing.
  const centerShift = (leftLimit + rightLimit - occupiedLeft - occupiedRight) / 2;
  for (let index = 0; index < lefts.length; index += 1) {
    lefts[index] += centerShift;
  }

  orderedBlocks.forEach((block, index) => {
    block.x = lefts[index];
    block.y = baseY + (contentHeight - block.height) / 2;
    positions.set(block.id, block);
  });
}

function finalizeLayout(
  graph: LayeredGraph,
  nodes: GraphNode[],
  boxes: LayoutBox[],
  blockBoxes: BlockBox[],
  blockInversions: number,
) {
  const width = Math.max(...boxes.map((box) => box.x + box.width), OUTER_PADDING) + OUTER_PADDING;
  const height = Math.max(...boxes.map((box) => box.y + box.height), OUTER_PADDING) + OUTER_PADDING;
  const layout: PositionedLayout = {
    mode: 'compact',
    nodes,
    edges: graph.edges.map((edge) => ({ ...edge })),
    layers: graph.layers.map((layer) => layer.slice()),
    boxes,
    blockBoxes,
    metrics: {
      width,
      height,
      crossings: 0,
      blockInversions,
    },
  };

  layout.metrics.crossings = countCrossings(layout);
  layout.metrics.totalEdgeLength = totalEdgeLength(layout);

  return layout;
}

export function layoutBlockCompact(
  graph: LayeredGraph,
  rowsPerLayer: number,
  traversal: TraversalStrategy,
  ordering: OrderingStrategy,
  profile?: Record<string, number>,
  blockSpread = 0.7,
  spanExponent = 2,
): PositionedLayout {
  let stageStart = performance.now();
  const mark = (stage: string) => {
    if (profile) profile[stage] = performance.now() - stageStart;
    stageStart = performance.now();
  };
  const nodes = cloneNodes(graph.nodes);
  const nodeMap = buildNodeMap(nodes);
  const { incoming, outgoing } = buildAdjacency(graph.edges);
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
  const sequencedLayers = graph.layers.map((layer, layerIndex) => {
    const similarity = buildSimilarityMatrix(layer, weightedAdjacency.incoming, weightedAdjacency.outgoing);

    return {
      layerIndex,
      sequence: seriateLayer(layer, similarity, originalOrderMaps[layerIndex]),
      similarity,
    };
  });
  mark('topologySeriationMs');
  const initialBlocks = sequencedLayers.map(({ layerIndex, sequence, similarity }) =>
    partitionLayer(sequence, layerIndex, rowsPerLayer, similarity, longEdgeNodes, spanExponent),
  );
  mark('partitionMs');
  const nodeToBlockId = new Map<string, string>();

  initialBlocks.forEach((blocks) => {
    blocks.forEach((block) => {
      block.nodeIds.forEach((nodeId) => {
        nodeToBlockId.set(nodeId, block.id);
      });
    });
  });

  const { previousNeighbors, nextNeighbors } = buildBlockNeighbors(graph.edges, nodeToBlockId);
  const barycentricLayers = optimizeBlockOrder(initialBlocks, previousNeighbors, nextNeighbors);
  const initialInversions = countBlockInversions(initialBlocks, nextNeighbors);
  const barycentricInversions = countBlockInversions(barycentricLayers, nextNeighbors);
  const candidateLayers = barycentricInversions <= initialInversions ? barycentricLayers : initialBlocks;
  const blockOrderedLayers = refineBlockOrderByCrossings(
    candidateLayers, previousNeighbors, nextNeighbors);
  const blockInversions = countBlockInversions(blockOrderedLayers, nextNeighbors);
  if (profile) {
    profile.initialBlockInversions = initialInversions;
    profile.barycentricBlockInversions = barycentricInversions;
    profile.refinedBlockInversions = blockInversions;
  }
  mark('blockOrderingMs');
  const refinedLayers = refineNodesWithinBlocks(blockOrderedLayers, ordering, incoming, outgoing);
  const maxLayerSize = Math.max(...graph.layers.map((layer) => layer.length), 0);
  const dimensionedLayers = refinedLayers.map((blocks, layerIndex) =>
    blocks.map((block) => ({
      ...block,
      ...getBlockDimensions(block.nodeIds.length,
        getLayerRowBudget(graph.layers[layerIndex].length, maxLayerSize, rowsPerLayer)),
    })),
  );
  const arrangedLayers = arrangeLayerNodesWithinBlocks(
    dimensionedLayers,
    traversal,
    incoming,
    outgoing,
    originalOrderMaps,
  );
  mark('intraBlockMs');
  const contentWidths = arrangedLayers.map((blocks) =>
    blocks.reduce((sum, block, index) => sum + block.width + (index > 0 ? BLOCK_GAP_X : 0), 0),
  );
  const globalContentWidth = Math.max(...contentWidths, 0);
  const layerWidths: number[] = [];
  const layerHeights: number[] = [];
  const positionedByLayer: PositionedBlockSpec[][] = [];

  arrangedLayers.forEach((blocks) => {
    const positionedBlocks = blocks.map((block, index) => ({
      ...block,
      column: index,
      x: 0,
      y: 0,
    }));
    const layerWidth = LAYER_SIDE_PADDING * 2 + globalContentWidth;
    const layerHeight =
      LAYER_TOP_PADDING +
      22 +
      positionedBlocks.reduce((height, block) => Math.max(height, block.height), 0) +
      18;

    layerWidths.push(layerWidth);
    layerHeights.push(layerHeight);
    positionedByLayer.push(positionedBlocks);
  });

  const boxes = buildLayerBoxes(layerWidths, layerHeights);
  const positionedMap = new Map<string, PositionedBlockSpec>();

  boxes.forEach((box, layerIndex) => {
    const blocks = positionedByLayer[layerIndex];
    const contentHeight = blocks.reduce((height, block) => Math.max(height, block.height), 0);
    assignInitialBlockPositions(box, blocks, globalContentWidth, contentHeight);
    blocks.forEach((block) => {
      positionedMap.set(block.id, block);
    });
  });

  for (let sweep = 0; sweep < 4; sweep += 1) {
    const layerIndices =
      sweep % 2 === 0
        ? Array.from({ length: graph.layers.length }, (_, index) => index)
        : Array.from({ length: graph.layers.length }, (_, index) => graph.layers.length - 1 - index);

    layerIndices.forEach((layerIndex) => {
      const box = boxes[layerIndex];
      const blocks = positionedByLayer[layerIndex];
      const contentHeight = blocks.reduce((height, block) => Math.max(height, block.height), 0);

      assignLayerBlockPositions(
        box,
        blocks,
        globalContentWidth,
        contentHeight,
        positionedMap,
        previousNeighbors,
        nextNeighbors,
        blockSpread,
      );
    });
  }
  mark('blockCoordinatesMs');

  const blockBoxes: BlockBox[] = [];

  positionedByLayer.forEach((blocks, layerIndex) => {
    blocks
      .slice()
      .sort((left, right) => left.column - right.column)
      .forEach((block) => {
        blockBoxes.push({
          id: block.id,
          layer: block.layer,
          x: block.x,
          y: block.y,
          width: block.width,
          height: block.height,
          nodeIds: block.nodeIds.slice(),
        });

        block.nodeIds.forEach((nodeId, nodeIndex) => {
          const node = nodeMap.get(nodeId);

          if (!node) {
            return;
          }

          const { row, column } = getTraversalPosition(nodeIndex, block.columns, traversal);
          node.order = layerIndex * 10000 + block.column * 100 + nodeIndex;
          node.x = block.x + BLOCK_PADDING_X + column * NODE_GAP_X + NODE_RADIUS;
          node.y = block.y + BLOCK_PADDING_Y + row * NODE_GAP_Y + NODE_RADIUS;
          node.initialX = node.x;
          node.initialY = node.y;
        });
      });
  });
  mark('nodeCoordinatesMs');

  const layout = finalizeLayout(graph, nodes, boxes, blockBoxes, blockInversions);
  mark('metricMs');
  return layout;
}
