import type {
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
const NODE_GAP_X = 18;
const NODE_GAP_Y = 18;
const LAYER_GAP_Y = 112;
const NODE_RADIUS = 5;

function cloneNodes(nodes: GraphNode[]) {
  return nodes.map((node) => ({ ...node }));
}

function buildNodeMap(nodes: GraphNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function getBoxWidth(columns: number) {
  return LAYER_SIDE_PADDING * 2 + Math.max(1, columns - 1) * NODE_GAP_X + NODE_RADIUS * 2;
}

function getBoxHeight(rows: number) {
  return LAYER_TOP_PADDING + 22 + Math.max(1, rows - 1) * NODE_GAP_Y + NODE_RADIUS * 2 + 18;
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

function createBoxes(layerWidths: number[], layerHeights: number[]) {
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
  mode: PositionedLayout['mode'],
): PositionedLayout {
  const crossings = countCrossings({ nodes, edges: graph.edges, layers: graph.layers, boxes, metrics: { width: 0, height: 0, crossings: 0 }, mode });
  const width = Math.max(...boxes.map((box) => box.x + box.width), OUTER_PADDING) + OUTER_PADDING;
  const height = Math.max(...boxes.map((box) => box.y + box.height), OUTER_PADDING) + OUTER_PADDING;

  return {
    mode,
    nodes,
    edges: graph.edges.map((edge) => ({ ...edge })),
    layers: graph.layers.map((layer) => layer.slice()),
    boxes,
    metrics: {
      width,
      height,
      crossings,
    },
  };
}

export function layoutTraditional(graph: LayeredGraph): PositionedLayout {
  const nodes = cloneNodes(graph.nodes);
  const nodeMap = buildNodeMap(nodes);
  const layerWidths = graph.layers.map((layer) => getBoxWidth(layer.length));
  const layerHeights = graph.layers.map(() => getBoxHeight(1));
  const boxes = createBoxes(layerWidths, layerHeights);

  graph.layers.forEach((layer, layerIndex) => {
    const box = boxes[layerIndex];

    layer.forEach((nodeId, index) => {
      const node = nodeMap.get(nodeId);

      if (node) {
        node.x = box.x + LAYER_SIDE_PADDING + index * NODE_GAP_X + NODE_RADIUS;
        node.y = box.y + LAYER_TOP_PADDING + 22 + NODE_RADIUS;
        node.initialX = node.x;
        node.initialY = node.y;
      }
    });
  });

  return finalizeLayout(graph, nodes, boxes, 'traditional');
}

export function wrapLayer(
  graph: LayeredGraph,
  rowsPerLayer: number,
  traversal: TraversalStrategy,
): PositionedLayout {
  const nodes = cloneNodes(graph.nodes);
  const nodeMap = buildNodeMap(nodes);
  const rows = Math.max(1, rowsPerLayer);
  const layerWidths = graph.layers.map((layer) => {
    const actualRows = Math.min(rows, Math.max(1, layer.length));
    const columns = Math.ceil(layer.length / actualRows);
    return getBoxWidth(columns);
  });
  const layerHeights = graph.layers.map((layer) => {
    const actualRows = Math.min(rows, Math.max(1, layer.length));
    return getBoxHeight(actualRows);
  });
  const boxes = createBoxes(layerWidths, layerHeights);

  graph.layers.forEach((layer, layerIndex) => {
    const box = boxes[layerIndex];
    const actualRows = Math.min(rows, Math.max(1, layer.length));
    const columns = Math.ceil(layer.length / actualRows);

    layer.forEach((nodeId, index) => {
      const node = nodeMap.get(nodeId);

      if (node) {
        const { row, column } = getTraversalPosition(index, columns, traversal);
        node.x = box.x + LAYER_SIDE_PADDING + column * NODE_GAP_X + NODE_RADIUS;
        node.y = box.y + LAYER_TOP_PADDING + 22 + row * NODE_GAP_Y + NODE_RADIUS;
        node.initialX = node.x;
        node.initialY = node.y;
      }
    });
  });

  return finalizeLayout(graph, nodes, boxes, 'compact');
}
