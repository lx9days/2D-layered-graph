import { DEFAULT_CLUSTERING_THRESHOLDS } from '@/lib/layout/multiRow/clustering';
import type { BlockSimilarity } from '@/lib/layout/multiRow/clustering';
import { create } from 'zustand';
import { presets } from '@/lib/graph/generateGraph';
import type { GraphConfig, OrderingStrategy, PresetKey, PresetSelection, TraversalStrategy } from '@/types/graph';

interface DemoState {
  activePreset: PresetSelection;
  graphConfig: GraphConfig;
  rowsPerLayer: number;
  blockSpread: number;
  spanExponent: number;
  blockSimilarity: BlockSimilarity;
  clusteringThreshold: number;
  clusteringThresholds: Record<BlockSimilarity, number>;

  edgeBundling: boolean;
  ordering: OrderingStrategy;
  traversal: TraversalStrategy;
  widthWeight: number;
  crossingWeight: number;
  edgeDetourWeight: number;
  backtrackingWeight: number;
  enableRowMove: boolean;
  enableNodeSwap: boolean;
  enableAdjacentReorder: boolean;
  hoveredNodeId: string | null;
  applyPreset: (presetKey: PresetKey) => void;
  updateGraphConfig: (patch: Partial<GraphConfig>) => void;
  updateRowsPerLayer: (rows: number) => void;
  updateBlockSpread: (spread: number) => void;
  updateBlockSimilarity: (criterion: BlockSimilarity) => void;
  updateClusteringThreshold: (threshold: number) => void;
  updateSpanExponent: (exponent: number) => void;
  updateEdgeBundling: (enabled: boolean) => void;
  updateOrdering: (ordering: OrderingStrategy) => void;
  updateTraversal: (traversal: TraversalStrategy) => void;
  updateWidthWeight: (weight: number) => void;
  updateCrossingWeight: (weight: number) => void;
  updateEdgeDetourWeight: (weight: number) => void;
  updateBacktrackingWeight: (weight: number) => void;
  updateEnableRowMove: (enabled: boolean) => void;
  updateEnableNodeSwap: (enabled: boolean) => void;
  updateEnableAdjacentReorder: (enabled: boolean) => void;
  setHoveredNodeId: (nodeId: string | null) => void;
}

const initialPreset = presets.medium;

export const useDemoStore = create<DemoState>((set) => ({
  activePreset: initialPreset.key,
  graphConfig: { ...initialPreset.graph },
  rowsPerLayer: initialPreset.rowsPerLayer,
  blockSpread: 0.7,
  spanExponent: 2,
  blockSimilarity: 'neighbors',
  clusteringThreshold: DEFAULT_CLUSTERING_THRESHOLDS.neighbors,
  clusteringThresholds: { ...DEFAULT_CLUSTERING_THRESHOLDS },
  edgeBundling: false,
  ordering: 'barycenter',
  traversal: 'serpentine',
  widthWeight: 1,
  crossingWeight: 1.4,
  edgeDetourWeight: 0.35,
  backtrackingWeight: 0,
  enableRowMove: true,
  enableNodeSwap: true,
  enableAdjacentReorder: true,
  hoveredNodeId: null,
  applyPreset: (presetKey) =>
    set(() => {
      const preset = presets[presetKey];
      return {
        activePreset: presetKey,
        graphConfig: { ...preset.graph, customLayerSizes: preset.graph.customLayerSizes?.slice() },
        rowsPerLayer: preset.rowsPerLayer,
        hoveredNodeId: null,
      };
    }),
  updateGraphConfig: (patch) =>
    set((state) => ({
      activePreset: 'custom',
      graphConfig: {
        ...state.graphConfig,
        ...patch,
        customLayerSizes:
          Object.prototype.hasOwnProperty.call(patch, 'customLayerSizes')
            ? patch.customLayerSizes
            : state.graphConfig.customLayerSizes,
      },
      hoveredNodeId: null,
    })),
  updateRowsPerLayer: (rows) =>
    set(() => ({
      activePreset: 'custom',
      rowsPerLayer: rows,
      hoveredNodeId: null,
    })),
  updateBlockSpread: (spread) =>
    set(() => ({ activePreset: 'custom', blockSpread: spread, hoveredNodeId: null })),
  updateBlockSimilarity: (blockSimilarity) =>
    set((state) => ({ activePreset: 'custom', blockSimilarity, clusteringThreshold: state.clusteringThresholds[blockSimilarity], hoveredNodeId: null })),
  updateClusteringThreshold: (clusteringThreshold) =>
    set((state) => ({ activePreset: 'custom', clusteringThreshold, clusteringThresholds: { ...state.clusteringThresholds, [state.blockSimilarity]: clusteringThreshold }, hoveredNodeId: null })),
  updateSpanExponent: (exponent) =>
    set(() => ({ activePreset: 'custom', spanExponent: exponent, hoveredNodeId: null })),
  updateEdgeBundling: (enabled) =>
    set(() => ({ edgeBundling: enabled, hoveredNodeId: null })),
  updateOrdering: (ordering) =>
    set(() => ({
      activePreset: 'custom',
      ordering,
      hoveredNodeId: null,
    })),
  updateTraversal: (traversal) =>
    set(() => ({
      activePreset: 'custom',
      traversal,
      hoveredNodeId: null,
    })),
  updateWidthWeight: (weight) =>
    set(() => ({ activePreset: 'custom', widthWeight: weight, hoveredNodeId: null })),
  updateCrossingWeight: (weight) =>
    set(() => ({ activePreset: 'custom', crossingWeight: weight, hoveredNodeId: null })),
  updateEdgeDetourWeight: (weight) =>
    set(() => ({ activePreset: 'custom', edgeDetourWeight: weight, hoveredNodeId: null })),
  updateBacktrackingWeight: (weight) =>
    set(() => ({ activePreset: 'custom', backtrackingWeight: weight, hoveredNodeId: null })),
  updateEnableRowMove: (enabled) =>
    set(() => ({ activePreset: 'custom', enableRowMove: enabled, hoveredNodeId: null })),
  updateEnableNodeSwap: (enabled) =>
    set(() => ({ activePreset: 'custom', enableNodeSwap: enabled, hoveredNodeId: null })),
  updateEnableAdjacentReorder: (enabled) =>
    set(() => ({ activePreset: 'custom', enableAdjacentReorder: enabled, hoveredNodeId: null })),
  setHoveredNodeId: (nodeId) =>
    set(() => ({
      hoveredNodeId: nodeId,
    })),
}));
