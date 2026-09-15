import type { BlockBox, GraphEdge, PositionedLayout } from '@/types/graph';

export interface EdgeBundle {
  key: string;
  edges: GraphEdge[];
  sourceBlock: BlockBox;
  targetBlock: BlockBox;
  sourceJunction: { x: number; y: number };
  targetJunction: { x: number; y: number };
}

export interface BundlePlan {
  bundles: EdgeBundle[];
  singleEdges: GraphEdge[];
}

/** Only edges with the same ordered pair of blocks share a trunk. */
export function planEdgeBundles(layout: PositionedLayout): BundlePlan {
  const blocks = layout.blockBoxes ?? [];
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const blockByNode = new Map(blocks.flatMap((block) => block.nodeIds.map((id) => [id, block.id] as const)));
  const grouped = new Map<string, GraphEdge[]>();
  const singleEdges: GraphEdge[] = [];

  layout.edges.forEach((edge) => {
    const sourceBlockId = blockByNode.get(edge.source);
    const targetBlockId = blockByNode.get(edge.target);
    if (!sourceBlockId || !targetBlockId || sourceBlockId === targetBlockId) {
      singleEdges.push(edge);
      return;
    }
    const key = `${sourceBlockId}->${targetBlockId}`;
    const group = grouped.get(key) ?? [];
    group.push(edge);
    grouped.set(key, group);
  });

  const bundles: EdgeBundle[] = [];
  grouped.forEach((edges, key) => {
    if (edges.length < 2) {
      singleEdges.push(edges[0]);
      return;
    }
    const [sourceBlockId, targetBlockId] = key.split('->');
    const sourceBlock = blockById.get(sourceBlockId);
    const targetBlock = blockById.get(targetBlockId);
    if (!sourceBlock || !targetBlock) {
      singleEdges.push(...edges);
      return;
    }
    const sourceBottom = sourceBlock.y + sourceBlock.height;
    const targetTop = targetBlock.y;
    const midpoint = (sourceBottom + targetTop) / 2;
    bundles.push({
      key,
      edges,
      sourceBlock,
      targetBlock,
      sourceJunction: {
        x: sourceBlock.x + sourceBlock.width / 2,
        y: Math.min(sourceBottom + 24, midpoint),
      },
      targetJunction: {
        x: targetBlock.x + targetBlock.width / 2,
        y: Math.max(targetTop - 24, midpoint),
      },
    });
  });

  const singleSet = new Set(singleEdges);
  return { bundles, singleEdges: layout.edges.filter((edge) => singleSet.has(edge)) };
}
