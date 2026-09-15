export type OrderingStrategy = 'original' | 'barycenter';
export type TraversalStrategy = 'row-major' | 'serpentine' | 'hilbert';
export type LayoutMode = 'traditional' | 'compact';
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
}

export interface PositionedLayout {
  mode: LayoutMode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layers: string[][];
  boxes: LayoutBox[];
  blockBoxes?: BlockBox[];
  metrics: LayoutMetrics;
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
