import type { LayeredGraph } from '@/types/graph';
import { buildWeightedAdjacency, nodeTopologySimilarity, weightedJaccard } from '@/lib/layout/topologySimilarity';
import type { MultiRowBlock } from './types';

export type BlockSimilarity = 'topology-strict' | 'neighbors' | 'layer-profile' | 'role' | 'multi-hop' | 'group-profile' | 'legacy';

export const DEFAULT_CLUSTERING_THRESHOLDS: Record<BlockSimilarity, number> = {
  'topology-strict': 0.05,
  neighbors: 0.65,
  'layer-profile': 0.65,
  role: 0.65,
  'multi-hop': 0.65,
  'group-profile': 0.65,
  legacy: 0.65, // Unused by continuous partitioning.
};

/** Features are independent of geometric positions and the row budget. */
export function createNodeSimilarity(graph: LayeredGraph, criterion: Exclude<BlockSimilarity, 'legacy'>, spanExponent: number) {
  const { incoming, outgoing } = buildWeightedAdjacency(graph.nodes, graph.edges, graph.layers, spanExponent);
  if (criterion === 'multi-hop' || criterion === 'group-profile') {
    const normalize = (values: Map<string, number>) => {
      const total = [...values.values()].reduce((sum, value) => sum + value, 0);
      return new Map([...values].map(([id, value]) => [id, total ? value / total : 0]));
    };
    const ids = graph.nodes.map(node => node.id);
    if (criterion === 'multi-hop') {
      // Exact-length walks, killed at dead ends; normalize surviving endpoint mass.
      const features = (adjacency: typeof incoming) => {
        const transition = new Map(ids.map(id => [id, normalize(adjacency.get(id) ?? new Map())]));
        let current = new Map(ids.map(id => [id, new Map([[id, 1]])]));
        const hops: typeof current[] = [];
        for (let hop = 0; hop < 3; hop++) {
          const next = new Map(ids.map(id => {
            const endpoints = new Map<string, number>();
            current.get(id)!.forEach((mass, via) => transition.get(via)?.forEach((weight, target) => {
              endpoints.set(target, (endpoints.get(target) ?? 0) + mass * weight);
            }));
            return [id, endpoints] as const;
          }));
          hops.push(new Map([...next].map(([id, values]) => [id, normalize(values)])));
          current = next;
        }
        return hops;
      };
      const ins = features(incoming), outs = features(outgoing);
      return (a: string, b: string) => {
        let score = 0, total = 0;
        for (const side of [ins, outs]) side.forEach((hop, index) => {
          const left = hop.get(a)!, right = hop.get(b)!;
          // Missing paths on both sides provide no positive evidence.
          if (!left.size && !right.size) return;
          const weight = 0.5 ** index;
          score += weight * weightedJaccard(left, right);
          total += weight;
        });
        return total ? score / total : 1;
      };
    }
    // Freeze reference groups before final clustering; no iterative feedback.
    const reference = new Map<string, string>();
    const base = (a: string, b: string) => nodeTopologySimilarity(a, b, incoming, outgoing);
    graph.layers.forEach((layer, rank) => clusterLayer(layer, rank, base, 0.65).forEach(block =>
      block.nodeIds.forEach(id => reference.set(id, block.id))));
    const aggregate = (adjacency: typeof incoming) => new Map(ids.map(id => {
      const values = new Map<string, number>();
      adjacency.get(id)?.forEach((weight, neighbor) => {
        const group = reference.get(neighbor) ?? neighbor;
        values.set(group, (values.get(group) ?? 0) + weight);
      });
      return [id, normalize(values)] as const;
    }));
    const ins = aggregate(incoming), outs = aggregate(outgoing);
    return (a: string, b: string) => 0.5 * weightedJaccard(ins.get(a)!, ins.get(b)!)
      + 0.5 * weightedJaccard(outs.get(a)!, outs.get(b)!);
  }
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
    if ((criterion === 'neighbors' || criterion === 'topology-strict')) return nodeTopologySimilarity(left, right, incoming, outgoing);
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
export function clusterLayer(layer: string[], rank: number, similarity: (a: string, b: string) => number, threshold = 0.65, signatures?: Map<string, string>): MultiRowBlock[] {
  const maxSize = Math.max(4, Math.round(Math.sqrt(layer.length) * 2.25));
  const groups = new Map<string, string[]>();
  for (const id of layer) {
    const key = signatures?.get(id) ?? id;
    const group = groups.get(key) ?? [];
    group.push(id);
    groups.set(key, group);
  }
  const clusters = [...groups.values()];
  const scores = new Map<string, Map<string, number>>();
  for (const a of layer) scores.set(a, new Map(layer.map(b => [b, a === b ? 1 : similarity(a, b)])));
  while (clusters.length > 1) {
    let bestScore = -Infinity, bestLeft = -1, bestRight = -1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (clusters[i].length + clusters[j].length > maxSize) continue;
        let sum = 0, minimum = 1;
        for (const a of clusters[i]) for (const b of clusters[j]) {
          const value = scores.get(a)!.get(b)!;
          sum += value;
          minimum = Math.min(minimum, value);
        }
        if (signatures && minimum < threshold) continue;
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

/** Exact weighted neighbor identities; computed before any geometric ordering. */
export function topologySignatures(graph: LayeredGraph, spanExponent: number) {
  const { incoming, outgoing } = buildWeightedAdjacency(graph.nodes, graph.edges, graph.layers, spanExponent);
  const entries = (index: Map<string, Map<string, number>>, id: string) =>
    [...(index.get(id) ?? new Map<string, number>()).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return new Map(graph.nodes.map(node => [node.id,
    JSON.stringify([entries(incoming, node.id), entries(outgoing, node.id)])]));
}
