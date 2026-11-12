import type { CandidateMove, MultiRowBlock, MultiRowOptions } from '@/lib/layout/multiRow/types';

export function generateCandidateMoves(block: MultiRowBlock, options: MultiRowOptions) {
  const moves: CandidateMove[] = [];

  if (options.enableRowMove && block.rows.length > 1) {
    block.rows.forEach((row, rowIndex) => {
      row.forEach((nodeId) => {
        if (rowIndex > 0) {
          moves.push({
            type: 'row-move',
            blockId: block.id,
            nodeId,
            fromRow: rowIndex,
            toRow: rowIndex - 1,
          });
        }

        if (rowIndex < block.rows.length - 1) {
          moves.push({
            type: 'row-move',
            blockId: block.id,
            nodeId,
            fromRow: rowIndex,
            toRow: rowIndex + 1,
          });
        }
      });
    });
  }

  if (options.enableNodeSwap && block.rows.length > 1) {
    for (let rowIndex = 0; rowIndex < block.rows.length - 1; rowIndex += 1) {
      const upperRow = block.rows[rowIndex];
      const lowerRow = block.rows[rowIndex + 1];
      const candidateColumns = new Set<number>();

      for (let index = 0; index < Math.max(upperRow.length, lowerRow.length); index += 1) {
        candidateColumns.add(index);
      }

      candidateColumns.forEach((column) => {
        const upperCandidates = [upperRow[column - 1], upperRow[column], upperRow[column + 1]].filter(Boolean);
        const lowerCandidates = [lowerRow[column - 1], lowerRow[column], lowerRow[column + 1]].filter(Boolean);

        upperCandidates.forEach((upperNodeId) => {
          lowerCandidates.forEach((lowerNodeId) => {
            moves.push({
              type: 'swap',
              blockId: block.id,
              upperNodeId,
              lowerNodeId,
              upperRow: rowIndex,
              lowerRow: rowIndex + 1,
            });
          });
        });
      });
    }
  }

  if (options.enableAdjacentReorder) {
    block.rows.forEach((row, rowIndex) => {
      for (let column = 0; column < row.length - 1; column += 1) {
        moves.push({
          type: 'reorder',
          blockId: block.id,
          row: rowIndex,
          leftIndex: column,
          rightIndex: column + 1,
        });
      }
    });
  }

  return moves;
}
