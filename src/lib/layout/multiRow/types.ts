import type { BlockBox, EdgeRoute, GraphEdge, GraphNode, LayeredGraph, LayoutBox, OptimizationTrace } from '@/types/graph';
import type { BlockSimilarity } from './clustering';

export interface MultiRowBlock {
  id: string;
  layer: number;
  nodeIds: string[];
  originalIndex: number;
  rowCount: number;
  rows: string[][];
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MultiRowObjectiveWeights {
  width: number;
  crossings: number;
  edgeDetour: number;
  backtracking: number;
}

export interface LayoutCost {
  total: number;
  width: number;
  crossings: number;
  edgeDetour: number;
  backtracking: number;
}

export interface MultiRowOptions {
  maxRows: number;
  blockSpread: number;
  spanExponent: number;
  blockSimilarity: BlockSimilarity;
  clusteringThreshold: number;
  enableTopologyBlocking: boolean;
  enableRowOptimization: boolean;
  enableRowMove: boolean;
  enableNodeSwap: boolean;
  enableAdjacentReorder: boolean;
  maxIterations: number;
  objectiveWeights: MultiRowObjectiveWeights;
}

export type MoveType = 'row-move' | 'swap' | 'reorder';

export interface RowMoveCandidate {
  type: 'row-move';
  blockId: string;
  nodeId: string;
  fromRow: number;
  toRow: number;
}

export interface SwapCandidate {
  type: 'swap';
  blockId: string;
  upperNodeId: string;
  lowerNodeId: string;
  upperRow: number;
  lowerRow: number;
}

export interface ReorderCandidate {
  type: 'reorder';
  blockId: string;
  row: number;
  leftIndex: number;
  rightIndex: number;
}

export type CandidateMove = RowMoveCandidate | SwapCandidate | ReorderCandidate;

export interface AssignedLayoutGeometry {
  nodes: GraphNode[];
  boxes: LayoutBox[];
  blockBoxes: BlockBox[];
}

export interface EvaluatedCandidate {
  move: CandidateMove;
  cost: LayoutCost;
  layout: PositionedMultiRowLayout;
}

export interface PositionedMultiRowLayout {
  graph: LayeredGraph;
  layers: MultiRowBlock[][];
  nodes: GraphNode[];
  boxes: LayoutBox[];
  blockBoxes: BlockBox[];
  edges: GraphEdge[];
  edgeRoutes: EdgeRoute[];
  optimizationTrace: OptimizationTrace[];
}
