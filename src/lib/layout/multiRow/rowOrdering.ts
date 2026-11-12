import type { MultiRowBlock } from '@/lib/layout/multiRow/types';
import type { NeighborIndex } from '@/lib/layout/multiRow/topology';

function flattenLayer(blocks: MultiRowBlock[]) {
  return blocks.flatMap((block) => block.rows.flat());
}

function computeVerticalPriority(nodeId: string, incoming: NeighborIndex, outgoing: NeighborIndex) {
  const incomingDegree = (incoming.get(nodeId) ?? []).length;
  const outgoingDegree = (outgoing.get(nodeId) ?? []).length;
  const normalization = Math.max(1, incomingDegree + outgoingDegree);
  return outgoingDegree / normalization - incomingDegree / normalization;
}

function barycenterForNode(
  nodeId: string,
  neighbors: string[],
  previousOrderMap: Map<string, number> | undefined,
  nextOrderMap: Map<string, number> | undefined,
  backboneOrder: Map<string, number>,
) {
  const scores = neighbors
    .map((neighborId) => previousOrderMap?.get(neighborId) ?? nextOrderMap?.get(neighborId))
    .filter((value): value is number => value !== undefined);

  if (scores.length === 0) {
    return backboneOrder.get(nodeId) ?? 0;
  }

  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function redistributeRows(
  nodeIds: string[],
  rowSizes: number[],
  incoming: NeighborIndex,
  outgoing: NeighborIndex,
  previousOrderMap: Map<string, number> | undefined,
  nextOrderMap: Map<string, number> | undefined,
  backboneOrder: Map<string, number>,
) {
  const ranked = nodeIds
    .slice()
    .sort((left, right) => {
      const leftPriority = computeVerticalPriority(left, incoming, outgoing);
      const rightPriority = computeVerticalPriority(right, incoming, outgoing);

      if (leftPriority === rightPriority) {
        const leftNeighbors = [...(incoming.get(left) ?? []), ...(outgoing.get(left) ?? [])];
        const rightNeighbors = [...(incoming.get(right) ?? []), ...(outgoing.get(right) ?? [])];
        const leftBarycenter = barycenterForNode(left, leftNeighbors, previousOrderMap, nextOrderMap, backboneOrder);
        const rightBarycenter = barycenterForNode(right, rightNeighbors, previousOrderMap, nextOrderMap, backboneOrder);

        if (leftBarycenter === rightBarycenter) {
          return (backboneOrder.get(left) ?? 0) - (backboneOrder.get(right) ?? 0);
        }

        return leftBarycenter - rightBarycenter;
      }

      return leftPriority - rightPriority;
    });
  const rows: string[][] = [];
  let cursor = 0;

  rowSizes.forEach((size) => {
    rows.push(ranked.slice(cursor, cursor + size));
    cursor += size;
  });

  return rows.filter((row) => row.length > 0);
}

export function buildLayerOrderMaps(layers: MultiRowBlock[][]) {
  return layers.map((blocks) => new Map(
    flattenLayer(blocks).map((nodeId, index) => [nodeId, index]),
  ));
}

export function reorderBlockRows(
  block: MultiRowBlock,
  incoming: NeighborIndex,
  outgoing: NeighborIndex,
  previousOrderMap: Map<string, number> | undefined,
  nextOrderMap: Map<string, number> | undefined,
  backboneOrder: Map<string, number>,
) {
  const redistributedRows = redistributeRows(
    block.rows.flat(),
    block.rows.map((row) => row.length),
    incoming,
    outgoing,
    previousOrderMap,
    nextOrderMap,
    backboneOrder,
  );
  const rows = redistributedRows.map((row) =>
    row.slice()
      .sort((left, right) => {
        const leftNeighbors = [...(incoming.get(left) ?? []), ...(outgoing.get(left) ?? [])];
        const rightNeighbors = [...(incoming.get(right) ?? []), ...(outgoing.get(right) ?? [])];
        const leftBarycenter = barycenterForNode(left, leftNeighbors, previousOrderMap, nextOrderMap, backboneOrder);
        const rightBarycenter = barycenterForNode(right, rightNeighbors, previousOrderMap, nextOrderMap, backboneOrder);

        if (leftBarycenter === rightBarycenter) {
          return (backboneOrder.get(left) ?? 0) - (backboneOrder.get(right) ?? 0);
        }

        return leftBarycenter - rightBarycenter;
      }),
  );

  return {
    ...block,
    rows,
    nodeIds: rows.flat(),
  };
}

export function reorderAllBlockRows(
  layers: MultiRowBlock[][],
  incoming: NeighborIndex,
  outgoing: NeighborIndex,
  backboneOrders: Map<string, number>[],
) {
  const working = layers.map((blocks) => blocks.map((block) => ({ ...block, rows: block.rows.map((row) => row.slice()) })));

  for (let pass = 0; pass < 2; pass += 1) {
    let orderMaps = buildLayerOrderMaps(working);

    for (let layerIndex = 0; layerIndex < working.length; layerIndex += 1) {
      working[layerIndex] = working[layerIndex].map((block) =>
        reorderBlockRows(
          block,
          incoming,
          outgoing,
          orderMaps[layerIndex - 1],
          orderMaps[layerIndex + 1],
          backboneOrders[layerIndex],
        ));
    }

    orderMaps = buildLayerOrderMaps(working);

    for (let layerIndex = working.length - 1; layerIndex >= 0; layerIndex -= 1) {
      working[layerIndex] = working[layerIndex].map((block) =>
        reorderBlockRows(
          block,
          incoming,
          outgoing,
          orderMaps[layerIndex - 1],
          orderMaps[layerIndex + 1],
          backboneOrders[layerIndex],
        ));
    }
  }

  return working;
}
