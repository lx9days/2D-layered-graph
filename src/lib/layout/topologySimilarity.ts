import type { GraphEdge, GraphNode } from '@/types/graph';

export type WeightedNeighborIndex = Map<string, Map<string, number>>;

/** A direct edge spanning k semantic rank intervals contributes weight k^exponent. */
export function buildWeightedAdjacency(nodes: GraphNode[], edges: GraphEdge[], layers?: string[][], spanExponent = 1) {
  const layerById = new Map(nodes.map((node) => [node.id, node.layer]));
  layers?.forEach((layer, index) => layer.forEach((id) => layerById.set(id, index)));
  const incoming: WeightedNeighborIndex = new Map();
  const outgoing: WeightedNeighborIndex = new Map();

  for (const edge of edges) {
    const sourceLayer = layerById.get(edge.source);
    const targetLayer = layerById.get(edge.target);
    const span = sourceLayer === undefined || targetLayer === undefined
      ? 1 : Math.max(1, Math.abs(targetLayer - sourceLayer));
    const weight = span ** spanExponent;
    const sourceNeighbors = outgoing.get(edge.source) ?? new Map<string, number>();
    sourceNeighbors.set(edge.target, (sourceNeighbors.get(edge.target) ?? 0) + weight);
    outgoing.set(edge.source, sourceNeighbors);
    const targetNeighbors = incoming.get(edge.target) ?? new Map<string, number>();
    targetNeighbors.set(edge.source, (targetNeighbors.get(edge.source) ?? 0) + weight);
    incoming.set(edge.target, targetNeighbors);
  }

  return { incoming, outgoing };
}

export function weightedJaccard(left: Map<string, number>, right: Map<string, number>) {
  if (left.size === 0 && right.size === 0) return 1;
  const keys = new Set([...left.keys(), ...right.keys()]);
  let intersection = 0;
  let union = 0;
  for (const key of keys) {
    const leftWeight = left.get(key) ?? 0;
    const rightWeight = right.get(key) ?? 0;
    intersection += Math.min(leftWeight, rightWeight);
    union += Math.max(leftWeight, rightWeight);
  }
  return union > 0 ? intersection / union : 1;
}

function weightedDegree(neighbors: Map<string, number>) {
  let degree = 0;
  neighbors.forEach((weight) => { degree += weight; });
  return degree;
}

export function nodeTopologySimilarity(
  leftId: string,
  rightId: string,
  incoming: WeightedNeighborIndex,
  outgoing: WeightedNeighborIndex,
) {
  const leftIncoming = incoming.get(leftId) ?? new Map<string, number>();
  const rightIncoming = incoming.get(rightId) ?? new Map<string, number>();
  const leftOutgoing = outgoing.get(leftId) ?? new Map<string, number>();
  const rightOutgoing = outgoing.get(rightId) ?? new Map<string, number>();
  const incomingScore = weightedJaccard(leftIncoming, rightIncoming);
  const outgoingScore = weightedJaccard(leftOutgoing, rightOutgoing);
  const leftDegree = weightedDegree(leftIncoming) + weightedDegree(leftOutgoing);
  const rightDegree = weightedDegree(rightIncoming) + weightedDegree(rightOutgoing);
  const maxDegree = Math.max(1, leftDegree, rightDegree);
  const degreeScore = 1 - Math.abs(leftDegree - rightDegree) / maxDegree;

  return 0.45 * incomingScore + 0.45 * outgoingScore + 0.1 * degreeScore;
}
