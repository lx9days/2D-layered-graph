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
