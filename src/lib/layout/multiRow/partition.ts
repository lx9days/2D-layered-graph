import type { MultiRowBlock } from '@/lib/layout/multiRow/types';
import type { SimilarityMatrix } from '@/lib/layout/multiRow/topology';
import { getSimilarity } from '@/lib/layout/multiRow/topology';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getIntervalCost(
  sequence: string[],
  start: number,
  end: number,
  similarity: SimilarityMatrix,
  minBlockSize: number,
  maxBlockSize: number,
  preferredSize: number,
  longEdgeNodes: Set<string>,
  spanExponent: number,
) {
  const size = end - start + 1;

  if (size < minBlockSize || size > maxBlockSize) {
    return Number.POSITIVE_INFINITY;
  }

  let pairCount = 0;
  let pairwiseDissimilarity = 0;
  let mixedPairs = 0;

  for (let leftIndex = start; leftIndex <= end; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex <= end; rightIndex += 1) {
      pairCount += 1;
      pairwiseDissimilarity += 1 - getSimilarity(similarity, sequence[leftIndex], sequence[rightIndex]);
      if (longEdgeNodes.has(sequence[leftIndex]) !== longEdgeNodes.has(sequence[rightIndex])) {
        mixedPairs += 1;
      }
    }
  }

  const cohesionCost = pairCount > 0 ? pairwiseDissimilarity / pairCount : 0.15;
  const sizePenalty = 0.035 * Math.abs(size - preferredSize);
  const mixedLongEdgePenalty = pairCount > 0 ? 2.5 * spanExponent * mixedPairs / pairCount : 0;
  return cohesionCost + sizePenalty + mixedLongEdgePenalty + 0.06;
}

export function partitionLayer(
  sequence: string[],
  layerIndex: number,
  maxRows: number,
  similarity: SimilarityMatrix,
  longEdgeNodes: Set<string>,
  spanExponent: number,
) {
  if (sequence.length === 0) {
    return [] as MultiRowBlock[];
  }

  const minBlockSize = sequence.length >= 8 && !sequence.some((id) => longEdgeNodes.has(id)) ? 2 : 1;
  const maxBlockSize = Math.max(minBlockSize, Math.max(4, Math.round(Math.sqrt(sequence.length) * 2.25)));
  const preferredSize = clamp(maxRows + 1, minBlockSize, maxBlockSize);
  const dp = new Array<number>(sequence.length + 1).fill(Number.POSITIVE_INFINITY);
  const previousCut = new Array<number>(sequence.length + 1).fill(-1);

  dp[0] = 0;

  for (let end = 1; end <= sequence.length; end += 1) {
    for (let start = Math.max(0, end - maxBlockSize); start <= end - minBlockSize; start += 1) {
      const intervalCost = getIntervalCost(
        sequence,
        start,
        end - 1,
        similarity,
        minBlockSize,
        maxBlockSize,
        preferredSize,
        longEdgeNodes,
        spanExponent,
      );

      if (!Number.isFinite(intervalCost) || !Number.isFinite(dp[start])) {
        continue;
      }

      const candidate = dp[start] + intervalCost;

      if (candidate < dp[end]) {
        dp[end] = candidate;
        previousCut[end] = start;
      }
    }
  }

  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = sequence.length;

  if (previousCut[cursor] === -1) {
    ranges.push({ start: 0, end: sequence.length - 1 });
  } else {
    while (cursor > 0 && previousCut[cursor] !== -1) {
      ranges.push({ start: previousCut[cursor], end: cursor - 1 });
      cursor = previousCut[cursor];
    }
  }

  return ranges.reverse().map(({ start, end }, index) => ({
    id: `multi-row-block-${layerIndex}-${index}`,
    layer: layerIndex,
    nodeIds: sequence.slice(start, end + 1),
    originalIndex: index,
    rowCount: 1,
    rows: [sequence.slice(start, end + 1)],
    column: index,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }));
}
