import { create } from 'zustand';
import { presets } from '@/lib/graph/generateGraph';
import type { GraphConfig, OrderingStrategy, PresetKey, PresetSelection, TraversalStrategy } from '@/types/graph';

interface DemoState {
  activePreset: PresetSelection;
  graphConfig: GraphConfig;
  rowsPerLayer: number;
  ordering: OrderingStrategy;
  traversal: TraversalStrategy;
  hoveredNodeId: string | null;
  applyPreset: (presetKey: PresetKey) => void;
  updateGraphConfig: (patch: Partial<GraphConfig>) => void;
  updateRowsPerLayer: (rows: number) => void;
  updateOrdering: (ordering: OrderingStrategy) => void;
  updateTraversal: (traversal: TraversalStrategy) => void;
  setHoveredNodeId: (nodeId: string | null) => void;
}

const initialPreset = presets.medium;

export const useDemoStore = create<DemoState>((set) => ({
  activePreset: initialPreset.key,
  graphConfig: { ...initialPreset.graph },
  rowsPerLayer: initialPreset.rowsPerLayer,
  ordering: 'barycenter',
  traversal: 'serpentine',
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
  setHoveredNodeId: (nodeId) =>
    set(() => ({
      hoveredNodeId: nodeId,
    })),
}));
