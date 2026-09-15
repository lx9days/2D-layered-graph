export type BlockNeighborMap = Map<string, Map<string, number>>;

export interface OrderedBlock {
  id: string;
  layer: number;
}

function orderMaps<T extends OrderedBlock>(layers: T[][]) {
  return layers.map((blocks) => new Map(blocks.map((block, index) => [block.id, index])));
}

function layerMap<T extends OrderedBlock>(layers: T[][]) {
  return new Map(layers.flat().map((block) => [block.id, block.layer]));
}

/** Change in block-edge inversions when two adjacent blocks exchange order. */
export function adjacentBlockSwapDelta<T extends OrderedBlock>(
  left: T,
  right: T,
  layers: T[][],
  previousNeighbors: BlockNeighborMap,
  nextNeighbors: BlockNeighborMap,
) {
  const ranks = layerMap(layers);
  const positions = orderMaps(layers);
  let delta = 0;
  const compare = (leftLinks: Map<string, number>, rightLinks: Map<string, number>) => {
    leftLinks.forEach((leftCount, leftNeighbor) => {
      const leftLayer = ranks.get(leftNeighbor);
      if (leftLayer === undefined || leftLayer === left.layer) return;
      rightLinks.forEach((rightCount, rightNeighbor) => {
        if (ranks.get(rightNeighbor) !== leftLayer) return;
        const leftOrder = positions[leftLayer].get(leftNeighbor);
        const rightOrder = positions[leftLayer].get(rightNeighbor);
        if (leftOrder === undefined || rightOrder === undefined) return;
        if (leftOrder < rightOrder) delta += leftCount * rightCount;
        else if (leftOrder > rightOrder) delta -= leftCount * rightCount;
      });
    });
  };
  compare(previousNeighbors.get(left.id) ?? new Map(), previousNeighbors.get(right.id) ?? new Map());
  compare(nextNeighbors.get(left.id) ?? new Map(), nextNeighbors.get(right.id) ?? new Map());
  return delta;
}

/** Count pairs of block links inverted within each pair of semantic layers. */
export function countBlockInversions<T extends OrderedBlock>(layers: T[][], nextNeighbors: BlockNeighborMap) {
  const ranks = layerMap(layers);
  const positions = orderMaps(layers);
  const groups = new Map<string, Array<{ source: number; target: number; count: number }>>();
  nextNeighbors.forEach((targets, sourceId) => {
    const sourceLayer = ranks.get(sourceId);
    if (sourceLayer === undefined) return;
    targets.forEach((count, targetId) => {
      const targetLayer = ranks.get(targetId);
      if (targetLayer === undefined || targetLayer <= sourceLayer) return;
      const source = positions[sourceLayer].get(sourceId);
      const target = positions[targetLayer].get(targetId);
      if (source === undefined || target === undefined) return;
      const key = `${sourceLayer}:${targetLayer}`;
      const group = groups.get(key) ?? [];
      group.push({ source, target, count });
      groups.set(key, group);
    });
  });
  let inversions = 0;
  groups.forEach((links) => {
    for (let i = 0; i < links.length; i += 1) {
      for (let j = i + 1; j < links.length; j += 1) {
        if ((links[i].source - links[j].source) * (links[i].target - links[j].target) < 0) {
          inversions += links[i].count * links[j].count;
        }
      }
    }
  });
  return inversions;
}

/** Greedy adjacent transposition leaves fixed layers and block membership unchanged. */
export function refineBlockOrderByCrossings<T extends OrderedBlock>(
  layers: T[][],
  previousNeighbors: BlockNeighborMap,
  nextNeighbors: BlockNeighborMap,
  maxPasses = 12,
) {
  const working = layers.map((blocks) => blocks.slice());
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let improved = false;
    const layerIndices = Array.from({ length: working.length }, (_, index) =>
      pass % 2 === 0 ? index : working.length - index - 1);
    for (const layerIndex of layerIndices) {
      const blocks = working[layerIndex];
      for (let index = 0; index < blocks.length - 1; index += 1) {
        if (adjacentBlockSwapDelta(blocks[index], blocks[index + 1], working,
          previousNeighbors, nextNeighbors) < 0) {
          [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return working;
}
