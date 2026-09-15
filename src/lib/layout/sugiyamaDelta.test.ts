import { describe, expect, it } from 'vitest';
import { adjacentSwapDelta } from '@/lib/layout/sugiyama';
import type { GraphEdge, GraphNode } from '@/types/graph';

describe('Sugiyama adjacent-swap crossing delta', () => {
  it('matches a full inversion recount for swaps in every layer', () => {
    const layers = [['a', 'b', 'c'], ['u', 'v', 'w'], ['x', 'y', 'z']];
    const nodes = layers.flatMap((layer, layerIndex) => layer.map((id, order) =>
      ({ id, layer: layerIndex, order, x: 0, y: 0 })));
    const nodeMap = new Map<string, GraphNode>(nodes.map((node) => [node.id, node]));
    const edges: GraphEdge[] = [
      { source: 'a', target: 'v' }, { source: 'a', target: 'w' },
      { source: 'b', target: 'u' }, { source: 'b', target: 'v' },
      { source: 'c', target: 'u' }, { source: 'c', target: 'w' },
      { source: 'u', target: 'z' }, { source: 'u', target: 'y' },
      { source: 'v', target: 'x' }, { source: 'v', target: 'y' },
      { source: 'w', target: 'x' }, { source: 'w', target: 'z' },
      { source: 'a', target: 'z' }, // Unproperized long edges are ignored by both stages.
    ];
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();
    edges.forEach((edge) => {
      incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
      outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    });
    const fullCount = () => {
      let count = 0;
      for (let layer = 0; layer < 2; layer += 1) {
        const gapEdges = edges.filter((edge) =>
          nodeMap.get(edge.source)?.layer === layer && nodeMap.get(edge.target)?.layer === layer + 1);
        for (let i = 0; i < gapEdges.length; i += 1) {
          for (let j = i + 1; j < gapEdges.length; j += 1) {
            const a = gapEdges[i];
            const b = gapEdges[j];
            const sourceDifference = nodeMap.get(a.source)!.order - nodeMap.get(b.source)!.order;
            const targetDifference = nodeMap.get(a.target)!.order - nodeMap.get(b.target)!.order;
            if (sourceDifference * targetDifference < 0) count += 1;
          }
        }
      }
      return count;
    };
    layers.forEach((layer) => {
      for (let index = 0; index < layer.length - 1; index += 1) {
        const left = nodeMap.get(layer[index])!;
        const right = nodeMap.get(layer[index + 1])!;
        const before = fullCount();
        const delta = adjacentSwapDelta(left.id, right.id, nodeMap, incoming, outgoing);
        [left.order, right.order] = [right.order, left.order];
        expect(fullCount() - before).toBe(delta);
        [left.order, right.order] = [right.order, left.order];
      }
    });
  });
});
