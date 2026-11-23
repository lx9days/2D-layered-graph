import type { MultiRowBlock } from '@/lib/layout/multiRow/types';

export function determineInitialRowCount(block: MultiRowBlock, maxRows: number) {
  return Math.max(1, Math.min(block.nodeIds.length, maxRows));
}

export function splitIntoRows(nodeIds: string[], rowCount: number) {
  const actualRowCount = Math.max(1, Math.min(nodeIds.length, rowCount));
  const rows = Array.from({ length: actualRowCount }, () => [] as string[]);

  nodeIds.forEach((nodeId, index) => {
    rows[Math.floor(index * actualRowCount / Math.max(1, nodeIds.length))].push(nodeId);
  });

  return rows.filter((row) => row.length > 0);
}

export function assignInitialRows(blocks: MultiRowBlock[], maxRows: number) {
  return blocks.map((block) => {
    const rowCount = determineInitialRowCount(block, maxRows);
    return {
      ...block,
      rowCount,
      rows: splitIntoRows(block.nodeIds, rowCount),
    };
  });
}

/** Square-like geometry: equal x/y spacing and padding in coordinateAssignment. */
export function squareRowCount(size: number, maxRows: number) {
  if (size <= 1) return 1;
  const limit = Math.max(1, Math.min(size, Math.floor(maxRows)));
  let bestRows = 1, bestDifference = Infinity;
  for (let rows = 1; rows <= limit; rows++) {
    const columns = Math.ceil(size / rows);
    const difference = Math.abs(columns - rows);
    // On ties prefer the wider arrangement, avoiding narrow vertical blocks.
    if (difference < bestDifference) {
      bestRows = rows;
      bestDifference = difference;
    }
  }
  return bestRows;
}

export function assignSquareLayerRows(blocks: MultiRowBlock[], maxRows: number) {
  const largestSize = blocks.reduce((size, block) => Math.max(size, block.nodeIds.length), 0);
  const layerRows = squareRowCount(largestSize, maxRows);
  return blocks.map(block => {
    const rowCount = squareRowCount(block.nodeIds.length, layerRows);
    return { ...block, rowCount, rows: splitIntoRows(block.nodeIds, rowCount) };
  });
}
