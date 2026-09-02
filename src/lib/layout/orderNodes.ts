import type { GraphEdge, GraphNode, LayeredGraph, OrderingStrategy } from '@/types/graph';

function cloneGraph(graph: LayeredGraph): LayeredGraph {
  return {
    nodes: graph.nodes.map((node) => ({ ...node })),
    edges: graph.edges.map((edge) => ({ ...edge })),
    layers: graph.layers.map((layer) => layer.slice()),
  };
}

function buildNodeMap(nodes: GraphNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function buildNeighborIndex(edges: GraphEdge[]) {
  const up = new Map<string, string[]>();
  const down = new Map<string, string[]>();

  edges.forEach((edge) => {
    const upList = up.get(edge.target) ?? [];
    upList.push(edge.source);
    up.set(edge.target, upList);

    const downList = down.get(edge.source) ?? [];
    downList.push(edge.target);
    down.set(edge.source, downList);
  });

  return { up, down };
}

function reindexLayer(layer: string[], nodeMap: Map<string, GraphNode>) {
  layer.forEach((nodeId, index) => {
    const node = nodeMap.get(nodeId);

    if (node) {
      node.order = index;
    }
  });
}

function sortLayerByNeighbors(
  layerIds: string[],
  neighbors: Map<string, string[]>,
  nodeMap: Map<string, GraphNode>,
) {
  return layerIds
    .map((nodeId, index) => {
      const linkedIds = neighbors.get(nodeId) ?? [];
      const barycenter =
        linkedIds.length > 0
          ? linkedIds.reduce((sum, linkedId) => sum + (nodeMap.get(linkedId)?.order ?? index), 0) / linkedIds.length
          : Number.POSITIVE_INFINITY;

      return {
        nodeId,
        barycenter,
        fallback: nodeMap.get(nodeId)?.order ?? index,
      };
    })
    .sort((a, b) => {
      if (a.barycenter === b.barycenter) {
        return a.fallback - b.fallback;
      }

      return a.barycenter - b.barycenter;
    })
    .map((entry) => entry.nodeId);
}

export function orderNodes(graph: LayeredGraph, strategy: OrderingStrategy): LayeredGraph {
  const ordered = cloneGraph(graph);

  if (strategy === 'original') {
    return ordered;
  }

  const nodeMap = buildNodeMap(ordered.nodes);
  const { up, down } = buildNeighborIndex(ordered.edges);

  ordered.layers.forEach((layer) => reindexLayer(layer, nodeMap));

  for (let pass = 0; pass < 2; pass += 1) {
    for (let layerIndex = 1; layerIndex < ordered.layers.length; layerIndex += 1) {
      ordered.layers[layerIndex] = sortLayerByNeighbors(ordered.layers[layerIndex], up, nodeMap);
      reindexLayer(ordered.layers[layerIndex], nodeMap);
    }

    for (let layerIndex = ordered.layers.length - 2; layerIndex >= 0; layerIndex -= 1) {
      ordered.layers[layerIndex] = sortLayerByNeighbors(ordered.layers[layerIndex], down, nodeMap);
      reindexLayer(ordered.layers[layerIndex], nodeMap);
    }
  }

  return ordered;
}
