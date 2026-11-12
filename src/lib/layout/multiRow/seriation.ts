import type { SimilarityMatrix } from '@/lib/layout/multiRow/topology';
import { getSimilarity } from '@/lib/layout/multiRow/topology';

export function seriateLayer(
  layer: string[],
  similarity: SimilarityMatrix,
  originalOrder: Map<string, number>,
) {
  if (layer.length <= 2) {
    return layer.slice().sort(
      (left, right) => (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0),
    );
  }

  let bestPair: [string, string] = [layer[0], layer[1]];
  let bestPairScore = -1;

  for (let leftIndex = 0; leftIndex < layer.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < layer.length; rightIndex += 1) {
      const candidateScore = getSimilarity(similarity, layer[leftIndex], layer[rightIndex]);

      if (candidateScore > bestPairScore) {
        bestPair = [layer[leftIndex], layer[rightIndex]];
        bestPairScore = candidateScore;
      }
    }
  }

  const orderedPair = bestPair
    .slice()
    .sort((left, right) => (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0)) as [string, string];
  const sequence = orderedPair.slice();
  const remaining = new Set(layer.filter((nodeId) => !sequence.includes(nodeId)));

  while (remaining.size > 0) {
    let bestNode: string | null = null;
    let shouldInsertLeft = false;
    let bestScore = Number.NEGATIVE_INFINITY;

    remaining.forEach((nodeId) => {
      const leftScore = getSimilarity(similarity, nodeId, sequence[0]);
      const rightScore = getSimilarity(similarity, nodeId, sequence[sequence.length - 1]);
      const nodeBestScore = Math.max(leftScore, rightScore);
      const nodeBestSide: 'left' | 'right' = leftScore > rightScore ? 'left' : 'right';

      if (
        nodeBestScore > bestScore ||
        (nodeBestScore === bestScore &&
          (originalOrder.get(nodeId) ?? 0) < (originalOrder.get(bestNode ?? nodeId) ?? 0))
      ) {
        bestNode = nodeId;
        shouldInsertLeft = nodeBestSide === 'left';
        bestScore = nodeBestScore;
      }
    });

    if (!bestNode) {
      break;
    }

    if (shouldInsertLeft) {
      sequence.unshift(bestNode);
    } else {
      sequence.push(bestNode);
    }

    remaining.delete(bestNode);
  }

  return sequence;
}
