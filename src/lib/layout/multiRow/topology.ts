import type { GraphEdge } from '@/types/graph';
import {
  buildWeightedAdjacency,
  nodeTopologySimilarity,
  type WeightedNeighborIndex,
} from '@/lib/layout/topologySimilarity';

export type NeighborIndex = Map<string, string[]>;
export type SimilarityMatrix = Map<string, Map<string, number>>;

export function buildAdjacency(edges: GraphEdge[]) {
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

export function getSimilarity(matrix: SimilarityMatrix, leftId: string, rightId: string) {
  if (leftId === rightId) {
    return 1;
  }

  return matrix.get(leftId)?.get(rightId) ?? 0;
}

export function buildSimilarityMatrix(
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

export { buildWeightedAdjacency };
