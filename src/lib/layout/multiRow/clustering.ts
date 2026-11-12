import type { LayeredGraph } from '@/types/graph';
import { buildWeightedAdjacency, nodeTopologySimilarity, weightedJaccard } from '@/lib/layout/topologySimilarity';
import type { MultiRowBlock } from './types';

export type BlockSimilarity = 'neighbors' | 'layer-profile' | 'role' | 'legacy';

/** Features are independent of geometric positions and the row budget. */
export function createNodeSimilarity(graph: LayeredGraph, criterion: Exclude<BlockSimilarity, 'legacy'>, spanExponent: number) {
  const { incoming, outgoing } = buildWeightedAdjacency(graph.nodes, graph.edges, graph.layers, spanExponent);
  const ranks = new Map(graph.layers.flatMap((layer, rank) => layer.map(id => [id, rank] as const)));
  const profiles = new Map<string, { incoming: Map<string, number>; outgoing: Map<string, number> }>();
  const roles = new Map<string, number[]>();
  const degrees = new Map(graph.nodes.map(node => [node.id, { incoming: 0, outgoing: 0, long: 0 }]));
  for (const edge of graph.edges) {
    const source = degrees.get(edge.source), target = degrees.get(edge.target);
    if (source) source.outgoing++;
    if (target) target.incoming++;
    if (Math.abs((ranks.get(edge.target) ?? 0) - (ranks.get(edge.source) ?? 0)) > 1) {
      if (source) source.long++;
      if (target && target !== source) target.long++;
    }
  }
  for (const node of graph.nodes) {
    const ins = incoming.get(node.id) ?? new Map<string, number>();
    const outs = outgoing.get(node.id) ?? new Map<string, number>();
    const profile = (neighbors: Map<string, number>) => {
      const result = new Map<string, number>();
      let total = 0;
      neighbors.forEach((weight, id) => {
        const rank = ranks.get(id);
        if (rank === undefined) return;
        const key = String(rank);
        result.set(key, (result.get(key) ?? 0) + weight);
        total += weight;
      });
      result.forEach((weight, key) => result.set(key, weight / total));
      return result;
    };
    profiles.set(node.id, { incoming: profile(ins), outgoing: profile(outs) });
    // Role uses edge counts, deliberately separate from span-weighted profiles.
    const { incoming: inDegree, outgoing: outDegree, long: longDegree } = degrees.get(node.id)!;
    const degree = inDegree + outDegree;
    roles.set(node.id, [inDegree, outDegree, inDegree / Math.max(1, degree), longDegree / Math.max(1, degree)]);
  }
  return (left: string, right: string) => {
    if (criterion === 'neighbors') return nodeTopologySimilarity(left, right, incoming, outgoing);
    if (criterion === 'layer-profile') {
      const a = profiles.get(left)!, b = profiles.get(right)!;
      return 0.5 * weightedJaccard(a.incoming, b.incoming) + 0.5 * weightedJaccard(a.outgoing, b.outgoing);
    }
    const a = roles.get(left)!, b = roles.get(right)!;
    const countSimilarity = (i: number) => 1 - Math.abs(a[i] - b[i]) / Math.max(1, a[i], b[i]);
    return 0.25 * (countSimilarity(0) + countSimilarity(1) + 1 - Math.abs(a[2] - b[2]) + 1 - Math.abs(a[3] - b[3]));
  };
}

/** Deterministic average-link agglomeration; membership need not be contiguous. */
export function clusterLayer(layer: string[], rank: number, similarity: (a: string, b: string) => number, threshold = 0.65): MultiRowBlock[] {
  const maxSize = Math.max(4, Math.round(Math.sqrt(layer.length) * 2.25));
  const clusters = layer.map(id => [id]);
  const scores = new Map<string, Map<string, number>>();
  for (const a of layer) scores.set(a, new Map(layer.map(b => [b, a === b ? 1 : similarity(a, b)])));
  while (clusters.length > 1) {
    let bestScore = -Infinity, bestLeft = -1, bestRight = -1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (clusters[i].length + clusters[j].length > maxSize) continue;
        let sum = 0;
        for (const a of clusters[i]) for (const b of clusters[j]) sum += scores.get(a)!.get(b)!;
        const score = sum / (clusters[i].length * clusters[j].length);
        if (score >= threshold && score > bestScore) {
          bestScore = score; bestLeft = i; bestRight = j;
        }
      }
    }
    if (bestLeft < 0) break;
    clusters[bestLeft].push(...clusters[bestRight]);
    clusters.splice(bestRight, 1);
  }
  const original = new Map(layer.map((id, index) => [id, index]));
  return clusters.map((members, index) => {
    const nodeIds = members.sort((a, b) => original.get(a)! - original.get(b)!);
    return { id: `multi-row-block-${rank}-${index}`, layer: rank, nodeIds, originalIndex: index,
      rowCount: 1, rows: [nodeIds.slice()], column: index, x: 0, y: 0, width: 0, height: 0 };
  });
}
