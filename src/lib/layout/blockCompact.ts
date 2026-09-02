import type {
  BlockBox,
  GraphEdge,
  GraphNode,
  LayeredGraph,
  LayoutBox,
  PositionedLayout,
  TraversalStrategy,
} from '@/types/graph';
import { countCrossings } from '@/lib/layout/countCrossings';

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

interface BlockSpec {
  id: string;
  layer: number;
  nodeIds: string[];
  originalIndex: number;
  score: number;
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
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

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

function getTraversalPosition(index: number, columns: number, traversal: TraversalStrategy) {
  const row = Math.floor(index / columns);
  const rawColumn = index % columns;
  const column =
    traversal === 'serpentine' && row % 2 === 1
      ? Math.max(0, columns - 1 - rawColumn)
      : rawColumn;

  return { row, column };
}

function jaccard(left: string[], right: string[]) {
  if (left.length === 0 && right.length === 0) {
    return 1;
  }

  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  let intersection = 0;

  left.forEach((item) => {
    if (rightSet.has(item)) {
      intersection += 1;
    }
  });

  const union = new Set([...left, ...right]).size;

  return union > 0 ? intersection / union : 0;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getNeighborCenter(neighbors: string[], orderMap: Map<string, number>) {
  const positions = neighbors
    .map((neighbor) => orderMap.get(neighbor))
    .filter((value): value is number => value !== undefined);

  return average(positions);
}

function getNodeSimilarity(
  leftId: string,
  rightId: string,
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>,
  previousOrderMap: Map<string, number> | undefined,
  nextOrderMap: Map<string, number> | undefined,
) {
  const leftIncoming = incoming.get(leftId) ?? [];
  const rightIncoming = incoming.get(rightId) ?? [];
  const leftOutgoing = outgoing.get(leftId) ?? [];
  const rightOutgoing = outgoing.get(rightId) ?? [];

  const setScores: number[] = [];

  if (leftIncoming.length > 0 || rightIncoming.length > 0) {
    setScores.push(jaccard(leftIncoming, rightIncoming));
  }

  if (leftOutgoing.length > 0 || rightOutgoing.length > 0) {
    setScores.push(jaccard(leftOutgoing, rightOutgoing));
  }

  const centerScores: number[] = [];

  if (previousOrderMap && previousOrderMap.size > 0) {
    const leftCenter = getNeighborCenter(leftIncoming, previousOrderMap);
    const rightCenter = getNeighborCenter(rightIncoming, previousOrderMap);

    if (leftCenter !== null && rightCenter !== null) {
      const normalized = 1 - Math.abs(leftCenter - rightCenter) / Math.max(1, previousOrderMap.size);
      centerScores.push(clamp(normalized, 0, 1));
    }
  }

  if (nextOrderMap && nextOrderMap.size > 0) {
    const leftCenter = getNeighborCenter(leftOutgoing, nextOrderMap);
    const rightCenter = getNeighborCenter(rightOutgoing, nextOrderMap);

    if (leftCenter !== null && rightCenter !== null) {
      const normalized = 1 - Math.abs(leftCenter - rightCenter) / Math.max(1, nextOrderMap.size);
      centerScores.push(clamp(normalized, 0, 1));
    }
  }

  const setScore = average(setScores) ?? 0.5;
  const centerScore = average(centerScores) ?? setScore;

  return 0.7 * setScore + 0.3 * centerScore;
}

function getBlockScore(
  block: string[],
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>,
  previousOrderMap: Map<string, number> | undefined,
  nextOrderMap: Map<string, number> | undefined,
) {
  const centers: number[] = [];

  if (previousOrderMap && previousOrderMap.size > 0) {
    const previousCenters = block
      .map((nodeId) => getNeighborCenter(incoming.get(nodeId) ?? [], previousOrderMap))
      .filter((value): value is number => value !== null);

    const previousScore = average(previousCenters);

    if (previousScore !== null) {
      centers.push(previousScore);
    }
  }

  if (nextOrderMap && nextOrderMap.size > 0) {
    const nextCenters = block
      .map((nodeId) => getNeighborCenter(outgoing.get(nodeId) ?? [], nextOrderMap))
      .filter((value): value is number => value !== null);

    const nextScore = average(nextCenters);

    if (nextScore !== null) {
      centers.push(nextScore);
    }
  }

  return average(centers);
}

function partitionLayer(
  layer: string[],
  layerIndex: number,
  rowsPerLayer: number,
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>,
  previousOrderMap: Map<string, number> | undefined,
  nextOrderMap: Map<string, number> | undefined,
) {
  if (layer.length === 0) {
    return [];
  }

  const minBlockSize = layer.length >= 8 ? 2 : 1;
  const maxBlockSize = Math.max(4, Math.round(Math.sqrt(layer.length) * 2.25));
  const breakThreshold = clamp(0.5 - rowsPerLayer * 0.02, 0.3, 0.5);
  const segments: string[][] = [];
  let current: string[] = [layer[0]];

  for (let index = 0; index < layer.length - 1; index += 1) {
    const similarity = getNodeSimilarity(
      layer[index],
      layer[index + 1],
      incoming,
      outgoing,
      previousOrderMap,
      nextOrderMap,
    );

    const shouldBreak =
      current.length >= maxBlockSize ||
      (similarity < breakThreshold && current.length >= minBlockSize);

    if (shouldBreak) {
      segments.push(current);
      current = [layer[index + 1]];
    } else {
      current.push(layer[index + 1]);
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  if (segments.length > 1) {
    const last = segments[segments.length - 1];

    if (last.length < minBlockSize) {
      segments[segments.length - 2].push(...last);
      segments.pop();
    }
  }

  return segments.map((nodeIds, originalIndex) => ({
    id: `block-${layerIndex}-${originalIndex}`,
    layer: layerIndex,
    nodeIds,
    originalIndex,
    score:
      getBlockScore(nodeIds, incoming, outgoing, previousOrderMap, nextOrderMap) ?? originalIndex,
  }));
}

function reorderBlocks(blocks: BlockSpec[]) {
  return blocks
    .slice()
    .sort((left, right) => {
      const scoreDelta = left.score - right.score;

      if (Math.abs(scoreDelta) > 1e-6) {
        return scoreDelta;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map((block, index) => ({ ...block, originalIndex: index }));
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

function finalizeLayout(
  graph: LayeredGraph,
  nodes: GraphNode[],
  boxes: LayoutBox[],
  blockBoxes: BlockBox[],
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
    },
  };

  layout.metrics.crossings = countCrossings(layout);

  return layout;
}

export function layoutBlockCompact(
  graph: LayeredGraph,
  rowsPerLayer: number,
  traversal: TraversalStrategy,
): PositionedLayout {
  const nodes = cloneNodes(graph.nodes);
  const nodeMap = buildNodeMap(nodes);
  const { incoming, outgoing } = buildAdjacency(graph.edges);
  const orderMaps = graph.layers.map(
    (layer) => new Map(layer.map((nodeId, index) => [nodeId, index])),
  );
  const layerBlockSpecs = graph.layers.map((layer, layerIndex) => {
    const partitioned = partitionLayer(
      layer,
      layerIndex,
      rowsPerLayer,
      incoming,
      outgoing,
      orderMaps[layerIndex - 1],
      orderMaps[layerIndex + 1],
    );
    const reordered = reorderBlocks(partitioned as BlockSpec[]);

    return reordered.map((block) => ({
      ...block,
      ...getBlockDimensions(block.nodeIds.length, rowsPerLayer),
    }));
  });

  const layerWidths: number[] = [];
  const layerHeights: number[] = [];
  const positionedByLayer: PositionedBlockSpec[][] = [];

  layerBlockSpecs.forEach((blocks) => {
    const positionedBlocks = blocks.map((block, index) => ({
      ...block,
      column: index,
      x: 0,
      y: 0,
    }));
    const layerWidth =
      LAYER_SIDE_PADDING * 2 +
      positionedBlocks.reduce((sum, block, index) => sum + block.width + (index > 0 ? BLOCK_GAP_X : 0), 0);
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
  const blockBoxes: BlockBox[] = [];

  boxes.forEach((box, layerIndex) => {
    const blocks = positionedByLayer[layerIndex].sort((left, right) => left.column - right.column);
    const layerContentHeight = blocks.reduce((height, block) => Math.max(height, block.height), 0);
    let cursorX = box.x + LAYER_SIDE_PADDING;

    blocks.forEach((block) => {
      block.x = cursorX;
      block.y = box.y + LAYER_TOP_PADDING + 22 + (layerContentHeight - block.height) / 2;
      cursorX += block.width + BLOCK_GAP_X;

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
        node.x = block.x + BLOCK_PADDING_X + column * NODE_GAP_X + NODE_RADIUS;
        node.y = block.y + BLOCK_PADDING_Y + row * NODE_GAP_Y + NODE_RADIUS;
        node.initialX = node.x;
        node.initialY = node.y;
      });
    });
  });

  return finalizeLayout(graph, nodes, boxes, blockBoxes);
}
