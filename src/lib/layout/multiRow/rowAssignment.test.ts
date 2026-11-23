import { expect, it } from 'vitest';
import { squareRowCount, assignSquareLayerRows } from './rowAssignment';
import { clusterLayer } from './clustering';
it('chooses square shapes and wider tie breaks within the row limit', () => {
  expect([1,2,4,6,9,16,25,36].map(n=>squareRowCount(n,6))).toEqual([1,1,2,2,3,4,5,6]);
  expect(squareRowCount(100,6)).toBe(6);
});
it('uses largest block height as ceiling without stretching small blocks', () => {
  const blocks = [25,6,2,1].map((n,i)=>({...clusterLayer(['a'],0,()=>1)[0],id:String(i),nodeIds:Array.from({length:n},(_,j)=>`${i}-${j}`)}));
  const assigned=assignSquareLayerRows(blocks,6);
  expect(assigned.map(b=>b.rowCount)).toEqual([5,2,1,1]);
  assigned.forEach((b,i)=>expect(b.rows.flat()).toEqual(blocks[i].nodeIds));
  expect(assignSquareLayerRows([],6)).toEqual([]);
  expect(assignSquareLayerRows(blocks,1).every(b=>b.rowCount===1)).toBe(true);
});
