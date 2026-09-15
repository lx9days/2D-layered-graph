import { countCrossings, totalEdgeLength } from '@/lib/layout/countCrossings';
import type { GraphEdge, GraphNode, LayeredGraph, LayoutBox, PositionedLayout } from '@/types/graph';

const OUTER_PADDING = 64;
const LAYER_TOP_PADDING = 28;
const LAYER_SIDE_PADDING = 28;
const LAYER_GAP_Y = 112;
const NODE_GAP_X = 24;
const NODE_RADIUS = 5;
const ROW_CENTER_OFFSET = LAYER_TOP_PADDING + 22 + NODE_RADIUS;
const BOX_HEIGHT = LAYER_TOP_PADDING + 22 + NODE_RADIUS * 2 + 18;
const SWEEP_COUNT = 6;

type InternalNode = GraphNode;
type InternalEdge = GraphEdge;

function cloneNodes(nodes: GraphNode[]): InternalNode[] {
  return nodes.map((node) => ({ ...node }));
}

function buildNodeMap(nodes: InternalNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function buildLayersFromGraph(graph: LayeredGraph, nodeMap: Map<string, InternalNode>) {
  if (graph.layers.length > 0) {
    return graph.layers.map((layer, layerIndex) =>
      layer
        .filter((nodeId) => nodeMap.has(nodeId))
        .map((nodeId, order) => {
          const node = nodeMap.get(nodeId)!;
          node.layer = layerIndex;
          node.order = order;
          return nodeId;
        }),
    );
  }

  const maxLayer = Math.max(...graph.nodes.map((node) => node.layer), 0);
  const layers = Array.from({ length: maxLayer + 1 }, () => [] as string[]);

  graph.nodes.forEach((node) => {
    layers[node.layer].push(node.id);
  });

  layers.forEach((layer, layerIndex) => {
    layer.sort((leftId, rightId) => {
      const left = nodeMap.get(leftId);
      const right = nodeMap.get(rightId);
      return (left?.order ?? 0) - (right?.order ?? 0);
    });

    layer.forEach((nodeId, order) => {
      const node = nodeMap.get(nodeId);

      if (node) {
        node.layer = layerIndex;
        node.order = order;
      }
    });
  });

  return layers;
}

function orientEdgesForward(nodeMap: Map<string, InternalNode>, edges: GraphEdge[]) {
  return edges.map((edge) => {
    const sourceLayer = nodeMap.get(edge.source)?.layer ?? 0;
    const targetLayer = nodeMap.get(edge.target)?.layer ?? 0;

    if (sourceLayer <= targetLayer) {
      return { ...edge };
    }

    return {
      source: edge.target,
      target: edge.source,
    };
  });
}

function insertDummyNodes(
  nodes: InternalNode[],
  layers: string[][],
  edges: InternalEdge[],
  nodeMap: Map<string, InternalNode>,
) {
  const expandedNodes = cloneNodes(nodes);
  const expandedLayers = layers.map((layer) => layer.slice());
  const expandedEdges: InternalEdge[] = [];
  let dummyCounter = 0;

  edges.forEach((edge) => {
    const sourceLayer = nodeMap.get(edge.source)?.layer ?? 0;
    const targetLayer = nodeMap.get(edge.target)?.layer ?? sourceLayer;
    const span = targetLayer - sourceLayer;

    if (span <= 1) {
      expandedEdges.push({ ...edge });
      return;
    }

    let previousId = edge.source;

    for (let layerIndex = sourceLayer + 1; layerIndex < targetLayer; layerIndex += 1) {
      const dummyId = `__dummy_${dummyCounter++}`;
      expandedNodes.push({
        id: dummyId,
        layer: layerIndex,
        order: expandedLayers[layerIndex]?.length ?? 0,
        x: 0,
        y: 0,
        isVirtual: true,
      });

      if (!expandedLayers[layerIndex]) {
        expandedLayers[layerIndex] = [];
      }

      expandedLayers[layerIndex].push(dummyId);
      expandedEdges.push({
        source: previousId,
        target: dummyId,
      });
      previousId = dummyId;
    }

    expandedEdges.push({
      source: previousId,
      target: edge.target,
    });
  });

  return {
    expandedNodes,
    expandedLayers,
    expandedEdges,
  };
}

function buildNeighborIndex(edges: InternalEdge[]) {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  edges.forEach((edge) => {
    const sources = incoming.get(edge.target) ?? [];
    sources.push(edge.source);
    incoming.set(edge.target, sources);

    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  });

  return { incoming, outgoing };
}

function reindexLayers(layers: string[][], nodeMap: Map<string, InternalNode>) {
  layers.forEach((layer, layerIndex) => {
    layer.forEach((nodeId, order) => {
      const node = nodeMap.get(nodeId);

      if (node) {
        node.layer = layerIndex;
        node.order = order;
      }
    });
  });
}

function median(values: number[]) {
  if (values.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function sortLayerByMedian(
  layerIds: string[],
  neighbors: Map<string, string[]>,
  nodeMap: Map<string, InternalNode>,
) {
  return layerIds
    .map((nodeId, order) => {
      const linked = neighbors.get(nodeId) ?? [];
      const linkedOrders = linked
        .map((linkedId) => nodeMap.get(linkedId)?.order)
        .filter((value): value is number => value !== undefined);

      return {
        nodeId,
        median: median(linkedOrders),
        fallback: nodeMap.get(nodeId)?.order ?? order,
      };
    })
    .sort((left, right) => {
      if (left.median === right.median) {
        return left.fallback - right.fallback;
      }

      return left.median - right.median;
    })
    .map((entry) => entry.nodeId);
}

export function adjacentSwapDelta(
  leftId: string,
  rightId: string,
  nodeMap: Map<string, InternalNode>,
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>,
) {
  const layer = nodeMap.get(leftId)?.layer;
  if (layer === undefined) return 0;
  let delta = 0;
  const compare = (leftNeighbors: string[], rightNeighbors: string[], adjacentLayer: number) => {
    for (const leftNeighbor of leftNeighbors) {
      const left = nodeMap.get(leftNeighbor);
      if (left?.layer !== adjacentLayer) continue;
      for (const rightNeighbor of rightNeighbors) {
        const right = nodeMap.get(rightNeighbor);
        if (right?.layer !== adjacentLayer) continue;
        if (left.order < right.order) delta += 1;
        else if (left.order > right.order) delta -= 1;
      }
    }
  };
  // For adjacent nodes, edges to all other nodes keep their relative endpoint order.
  // Only pairs attached to opposite swapped nodes can change their crossing status.
  compare(incoming.get(leftId) ?? [], incoming.get(rightId) ?? [], layer - 1);
  compare(outgoing.get(leftId) ?? [], outgoing.get(rightId) ?? [], layer + 1);
  return delta;
}

function transposeLayer(
  layers: string[][],
  layerIndex: number,
  nodeMap: Map<string, InternalNode>,
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>,
) {
  let improved = true;

  while (improved) {
    improved = false;

    for (let index = 0; index < layers[layerIndex].length - 1; index += 1) {
      const leftId = layers[layerIndex][index];
      const rightId = layers[layerIndex][index + 1];
      if (adjacentSwapDelta(leftId, rightId, nodeMap, incoming, outgoing) < 0) {
        [layers[layerIndex][index], layers[layerIndex][index + 1]] = [rightId, leftId];
        const left = nodeMap.get(leftId);
        const right = nodeMap.get(rightId);
        if (left) left.order = index + 1;
        if (right) right.order = index;
        improved = true;
      }
    }
  }
}

function minimizeCrossings(layers: string[][], nodeMap: Map<string, InternalNode>, edges: InternalEdge[], profile?: Record<string, number>) {
  const { incoming, outgoing } = buildNeighborIndex(edges);

  reindexLayers(layers, nodeMap);

  for (let pass = 0; pass < SWEEP_COUNT; pass += 1) {
    for (let layerIndex = 1; layerIndex < layers.length; layerIndex += 1) {
      layers[layerIndex] = sortLayerByMedian(layers[layerIndex], incoming, nodeMap);
      reindexLayers(layers, nodeMap);
      const transposeStart = performance.now();
      transposeLayer(layers, layerIndex, nodeMap, incoming, outgoing);
      if (profile) profile.transposeMs = (profile.transposeMs ?? 0) + performance.now() - transposeStart;
    }

    for (let layerIndex = layers.length - 2; layerIndex >= 0; layerIndex -= 1) {
      layers[layerIndex] = sortLayerByMedian(layers[layerIndex], outgoing, nodeMap);
      reindexLayers(layers, nodeMap);
      const transposeStart = performance.now();
      transposeLayer(layers, layerIndex, nodeMap, incoming, outgoing);
      if (profile) profile.transposeMs = (profile.transposeMs ?? 0) + performance.now() - transposeStart;
    }
  }

  return layers;
}

function resolveLayerPositions(layerIds: string[], desired: number[], xById: Map<string, number>) {
  const actual = desired.slice();

  for (let index = 1; index < actual.length; index += 1) {
    actual[index] = Math.max(actual[index], actual[index - 1] + NODE_GAP_X);
  }

  const desiredCenter = desired.reduce((sum, value) => sum + value, 0) / Math.max(1, desired.length);
  const actualCenter = actual.reduce((sum, value) => sum + value, 0) / Math.max(1, actual.length);
  const shift = desiredCenter - actualCenter;

  for (let index = 0; index < actual.length; index += 1) {
    actual[index] += shift;
  }

  for (let index = 1; index < actual.length; index += 1) {
    actual[index] = Math.max(actual[index], actual[index - 1] + NODE_GAP_X);
  }

  layerIds.forEach((nodeId, index) => {
    xById.set(nodeId, actual[index]);
  });
}

function assignCoordinates(layers: string[][], nodeMap: Map<string, InternalNode>, edges: InternalEdge[]) {
  const { incoming, outgoing } = buildNeighborIndex(edges);
  const xById = new Map<string, number>();

  layers.forEach((layer) => {
    layer.forEach((nodeId, index) => {
      xById.set(nodeId, index * NODE_GAP_X);
    });
  });

  for (let pass = 0; pass < SWEEP_COUNT; pass += 1) {
    for (let layerIndex = 1; layerIndex < layers.length; layerIndex += 1) {
      const desired = layers[layerIndex].map((nodeId, order) => {
        const linked = (incoming.get(nodeId) ?? [])
          .map((linkedId) => xById.get(linkedId))
          .filter((value): value is number => value !== undefined);

        return linked.length > 0 ? median(linked) : order * NODE_GAP_X;
      });

      resolveLayerPositions(layers[layerIndex], desired, xById);
    }

    for (let layerIndex = layers.length - 2; layerIndex >= 0; layerIndex -= 1) {
      const desired = layers[layerIndex].map((nodeId, order) => {
        const linked = (outgoing.get(nodeId) ?? [])
          .map((linkedId) => xById.get(linkedId))
          .filter((value): value is number => value !== undefined);

        return linked.length > 0 ? median(linked) : order * NODE_GAP_X;
      });

      resolveLayerPositions(layers[layerIndex], desired, xById);
    }
  }

  const layerCenters = layers
    .filter((layer) => layer.length > 0)
    .map((layer) => {
      const values = layer.map((nodeId) => xById.get(nodeId) ?? 0);
      return (Math.min(...values) + Math.max(...values)) / 2;
    });
  const globalCenter =
    layerCenters.reduce((sum, value) => sum + value, 0) / Math.max(1, layerCenters.length);

  layers.forEach((layer, layerIndex) => {
    const values = layer.map((nodeId) => xById.get(nodeId) ?? 0);
    const layerCenter = values.length > 0 ? (Math.min(...values) + Math.max(...values)) / 2 : 0;
    const shift = globalCenter - layerCenter;
    const layerY = OUTER_PADDING + layerIndex * (BOX_HEIGHT + LAYER_GAP_Y) + ROW_CENTER_OFFSET;

    layer.forEach((nodeId) => {
      const node = nodeMap.get(nodeId);

      if (node) {
        node.x = (xById.get(nodeId) ?? 0) + shift;
        node.y = layerY;
        node.initialX = node.x;
        node.initialY = node.y;
      }
    });
  });
}

function buildBoxes(layers: string[][], nodeMap: Map<string, InternalNode>) {
  return layers.map((layer, layerIndex) => {
    const xs = layer.map((nodeId) => nodeMap.get(nodeId)?.x ?? 0);
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    const maxX = xs.length > 0 ? Math.max(...xs) : 0;

    return {
      layer: layerIndex,
      x: minX - NODE_RADIUS - LAYER_SIDE_PADDING,
      y: OUTER_PADDING + layerIndex * (BOX_HEIGHT + LAYER_GAP_Y),
      width: maxX - minX + NODE_RADIUS * 2 + LAYER_SIDE_PADDING * 2,
      height: BOX_HEIGHT,
      label: `L${layerIndex + 1}`,
    } satisfies LayoutBox;
  });
}

function normalizeLayout(nodes: InternalNode[], boxes: LayoutBox[]) {
  const minBoxX = Math.min(...boxes.map((box) => box.x));
  const shiftX = OUTER_PADDING - minBoxX;

  nodes.forEach((node) => {
    node.x += shiftX;
    node.initialX = node.x;
  });

  boxes.forEach((box) => {
    box.x += shiftX;
  });
}

export function layoutSugiyama(graph: LayeredGraph, profile?: Record<string, number>): PositionedLayout {
  let stageStart = performance.now();
  const mark = (stage: string) => {
    if (profile) profile[stage] = performance.now() - stageStart;
    stageStart = performance.now();
  };
  const baseNodes = cloneNodes(graph.nodes);
  const baseNodeMap = buildNodeMap(baseNodes);
  const baseLayers = buildLayersFromGraph(graph, baseNodeMap);
  const forwardEdges = orientEdgesForward(baseNodeMap, graph.edges);
  const { expandedNodes, expandedLayers, expandedEdges } = insertDummyNodes(
    baseNodes,
    baseLayers,
    forwardEdges,
    baseNodeMap,
  );
  const nodeMap = buildNodeMap(expandedNodes);
  mark('properizationMs');

  reindexLayers(expandedLayers, nodeMap);
  minimizeCrossings(expandedLayers, nodeMap, expandedEdges, profile);
  mark('orderingMs');
  assignCoordinates(expandedLayers, nodeMap, expandedEdges);
  mark('coordinatesMs');

  const boxes = buildBoxes(expandedLayers, nodeMap);
  normalizeLayout(expandedNodes, boxes);
  mark('boxesMs');

  const geometry: PositionedLayout = {
    mode: 'traditional',
    nodes: expandedNodes,
    edges: expandedEdges,
    layers: expandedLayers,
    boxes,
    metrics: { width: 0, height: 0, crossings: 0 },
  };
  const crossings = countCrossings(geometry);
  mark('metricMs');
  const width = Math.max(...boxes.map((box) => box.x + box.width), OUTER_PADDING) + OUTER_PADDING;
  const height = Math.max(...boxes.map((box) => box.y + box.height), OUTER_PADDING) + OUTER_PADDING;

  return {
    mode: 'traditional',
    nodes: expandedNodes,
    edges: expandedEdges,
    layers: expandedLayers,
    boxes,
    metrics: {
      width,
      height,
      crossings,
      totalEdgeLength: totalEdgeLength(geometry),
    },
  };
}
