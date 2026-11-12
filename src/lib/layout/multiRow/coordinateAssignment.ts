import type { BlockNeighborMap } from '@/lib/layout/blockCrossingOrder';
import type { MultiRowBlock } from '@/lib/layout/multiRow/types';
import type { BlockBox, EdgeRoute, EdgeRoutePoint, GraphNode, LayeredGraph, LayoutBox } from '@/types/graph';

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

function getBlockCenter(block: MultiRowBlock) {
  return block.x + block.width / 2;
}

function getWeightedNeighborCenter(
  neighbors: Map<string, number> | undefined,
  positions: Map<string, MultiRowBlock>,
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

function assignBlockDimensions(block: MultiRowBlock) {
  const maxColumns = Math.max(...block.rows.map((row) => row.length), 1);
  const width = BLOCK_PADDING_X * 2 + Math.max(0, maxColumns - 1) * NODE_GAP_X + NODE_RADIUS * 2;
  const height = BLOCK_PADDING_Y * 2 + Math.max(0, block.rows.length - 1) * NODE_GAP_Y + NODE_RADIUS * 2;

  return {
    ...block,
    rowCount: block.rows.length,
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

function assignInitialBlockPositions(box: LayoutBox, blocks: MultiRowBlock[], contentWidth: number, contentHeight: number) {
  const occupiedWidth = blocks.reduce((sum, block, index) => sum + block.width + (index > 0 ? BLOCK_GAP_X : 0), 0);
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
  blocks: MultiRowBlock[],
  contentWidth: number,
  contentHeight: number,
  positions: Map<string, MultiRowBlock>,
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

  const occupiedLeft = lefts[0];
  let occupiedRight = lefts[lefts.length - 1] + orderedBlocks[orderedBlocks.length - 1].width;

  if (lefts.length > 1) {
    const unusedWidth = Math.max(0, contentWidth - (occupiedRight - occupiedLeft));
    const spreadStep = unusedWidth * Math.max(0, Math.min(1, blockSpread)) / (lefts.length - 1);

    for (let index = 0; index < lefts.length; index += 1) {
      lefts[index] += index * spreadStep;
    }

    occupiedRight += (lefts.length - 1) * spreadStep;
  }

  const centerShift = (leftLimit + rightLimit - occupiedLeft - occupiedRight) / 2;

  orderedBlocks.forEach((block, index) => {
    block.x = lefts[index] + centerShift;
    block.y = baseY + (contentHeight - block.height) / 2;
    positions.set(block.id, block);
  });
}

function cloneNodes(nodes: GraphNode[]) {
  return nodes.map((node) => ({ ...node }));
}

function buildRoutes(graph: LayeredGraph, nodes: GraphNode[], boxes: LayoutBox[]): EdgeRoute[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const boxByLayer = new Map(boxes.map((box) => [box.layer, box]));

  return graph.edges.flatMap((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target) {
      return [];
    }

    const points: EdgeRoutePoint[] = [{ x: source.x, y: source.y, layer: source.layer, nodeId: source.id }];
    const span = target.layer - source.layer;

    for (let layerIndex = source.layer + 1; layerIndex < target.layer; layerIndex += 1) {
      const box = boxByLayer.get(layerIndex);
      const ratio = (layerIndex - source.layer) / Math.max(1, span);
      points.push({
        x: source.x + (target.x - source.x) * ratio,
        y: box ? box.y + box.height / 2 : source.y + (target.y - source.y) * ratio,
        layer: layerIndex,
      });
    }

    points.push({ x: target.x, y: target.y, layer: target.layer, nodeId: target.id });
    return [{ source: edge.source, target: edge.target, points }];
  });
}

export function assignMultiRowCoordinates(
  graph: LayeredGraph,
  baseNodes: GraphNode[],
  layeredBlocks: MultiRowBlock[][],
  previousNeighbors: BlockNeighborMap,
  nextNeighbors: BlockNeighborMap,
  blockSpread: number,
) {
  const nodes = cloneNodes(baseNodes);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const dimensionedLayers = layeredBlocks.map((blocks) => blocks.map(assignBlockDimensions));
  const contentWidths = dimensionedLayers.map((blocks) =>
    blocks.reduce((sum, block, index) => sum + block.width + (index > 0 ? BLOCK_GAP_X : 0), 0));
  const globalContentWidth = Math.max(...contentWidths, 0);
  const layerWidths: number[] = [];
  const layerHeights: number[] = [];

  dimensionedLayers.forEach((blocks) => {
    const maximumHeight = blocks.reduce((height, block) => Math.max(height, block.height), 0);
    layerWidths.push(LAYER_SIDE_PADDING * 2 + globalContentWidth);
    layerHeights.push(LAYER_TOP_PADDING + 22 + maximumHeight + 18);
  });

  const boxes = buildLayerBoxes(layerWidths, layerHeights);
  const positions = new Map<string, MultiRowBlock>();

  boxes.forEach((box, layerIndex) => {
    const blocks = dimensionedLayers[layerIndex];
    const contentHeight = blocks.reduce((height, block) => Math.max(height, block.height), 0);
    assignInitialBlockPositions(box, blocks, globalContentWidth, contentHeight);
    blocks.forEach((block) => positions.set(block.id, block));
  });

  for (let sweep = 0; sweep < 4; sweep += 1) {
    const layerIndices =
      sweep % 2 === 0
        ? Array.from({ length: dimensionedLayers.length }, (_, index) => index)
        : Array.from({ length: dimensionedLayers.length }, (_, index) => dimensionedLayers.length - index - 1);

    layerIndices.forEach((layerIndex) => {
      const blocks = dimensionedLayers[layerIndex];
      const contentHeight = blocks.reduce((height, block) => Math.max(height, block.height), 0);

      assignLayerBlockPositions(
        boxes[layerIndex],
        blocks,
        globalContentWidth,
        contentHeight,
        positions,
        previousNeighbors,
        nextNeighbors,
        blockSpread,
      );
    });
  }

  const blockBoxes: BlockBox[] = [];

  dimensionedLayers.forEach((blocks, layerIndex) => {
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
          nodeIds: block.rows.flat(),
        });

        block.rows.forEach((row, rowIndex) => {
          row.forEach((nodeId, columnIndex) => {
            const node = nodeMap.get(nodeId);

            if (!node) {
              return;
            }

            node.layer = layerIndex;
            node.logicalLayer = layerIndex;
            node.geometricRow = rowIndex;
            node.geometricColumn = columnIndex;
            node.blockId = block.id;
            node.order = layerIndex * 10000 + block.column * 100 + rowIndex * 32 + columnIndex;
            node.x = block.x + BLOCK_PADDING_X + columnIndex * NODE_GAP_X + NODE_RADIUS;
            node.y = block.y + BLOCK_PADDING_Y + rowIndex * NODE_GAP_Y + NODE_RADIUS;
            node.initialX = node.x;
            node.initialY = node.y;
          });
        });
      });
  });

  return {
    nodes,
    boxes,
    blockBoxes,
    edgeRoutes: buildRoutes(graph, nodes, boxes),
    layers: dimensionedLayers,
  };
}
