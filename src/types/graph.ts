export type OrderingStrategy = 'original' | 'barycenter';
export type TraversalStrategy = 'row-major' | 'serpentine' | 'hilbert';
export type LayoutMode = 'traditional' | 'compact' | 'multi-row-compact';
export type PresetKey = 'small' | 'medium' | 'wide-layer' | 'very-wide-layer';
export type PresetSelection = PresetKey | 'custom';

export interface GraphNode {
  id: string;
  layer: number;
  order: number;
  x: number;
  y: number;
  initialX?: number;
  initialY?: number;
  isVirtual?: boolean;
  logicalLayer?: number;
  geometricRow?: number;
  geometricColumn?: number;
  blockId?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface LayeredGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layers: string[][];
}

export interface GraphConfig {
  layerCount: number;
  nodesPerLayer: number;
  customLayerSizes?: number[];
  edgeDensity: number;
  seed: number;
}

export interface LayoutBox {
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface BlockBox {
  id: string;
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
}

export interface LayoutMetrics {
  width: number;
  height: number;
  crossings: number;
  blockInversions?: number;
  totalEdgeLength?: number;
  edgeDetour?: number;
  backtracking?: number;
}

export interface EdgeRoutePoint {
  x: number;
  y: number;
  layer: number;
  nodeId?: string;
}

export interface EdgeRoute {
  source: string;
  target: string;
  points: EdgeRoutePoint[];
}

export interface OptimizationTrace {
  iteration: number;
  moveType: 'row-move' | 'swap' | 'reorder';
  deltaCost: number;
  widthBefore: number;
  widthAfter: number;
  crossingsBefore: number;
  crossingsAfter: number;
  edgeLengthBefore: number;
  edgeLengthAfter: number;
  backtrackingBefore: number;
  backtrackingAfter: number;
}

export interface PositionedLayout {
  mode: LayoutMode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layers: string[][];
  boxes: LayoutBox[];
  blockBoxes?: BlockBox[];
  metrics: LayoutMetrics;
  originalEdges?: GraphEdge[];
  edgeRoutes?: EdgeRoute[];
  optimizationTrace?: OptimizationTrace[];
}

export interface TradeoffPoint {
  rows: number;
  width: number;
  crossings: number;
  height: number;
  totalEdgeLength?: number;
}

export interface DemoPreset {
  key: PresetKey;
  label: string;
  description: string;
  graph: GraphConfig;
  rowsPerLayer: number;
}
