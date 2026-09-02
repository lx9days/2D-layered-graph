import type { DemoPreset, GraphConfig, GraphEdge, GraphNode, LayeredGraph, PresetKey } from '@/types/graph';

const DEFAULT_LAYER_GAP = 1;

function createSeededRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function sampleUniqueIndices(count: number, pickCount: number, random: () => number) {
  const set = new Set<number>();

  while (set.size < pickCount) {
    set.add(Math.floor(random() * count));
  }

  return Array.from(set);
}

function resolveLayerSizes(config: GraphConfig) {
  if (config.customLayerSizes?.length) {
    return config.customLayerSizes.slice();
  }

  return Array.from({ length: config.layerCount }, () => config.nodesPerLayer);
}

export function generateGraph(config: GraphConfig): LayeredGraph {
  const random = createSeededRandom(config.seed);
  const layerSizes = resolveLayerSizes(config);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const layers: string[][] = [];

  layerSizes.forEach((size, layerIndex) => {
    const layerNodes: string[] = [];

    for (let i = 0; i < size; i += 1) {
      const id = `L${layerIndex + 1}-N${i + 1}`;
      layerNodes.push(id);
      nodes.push({
        id,
        layer: layerIndex,
        order: i,
        x: 0,
        y: layerIndex * DEFAULT_LAYER_GAP,
      });
    }

    layers.push(layerNodes);
  });

  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    const sourceLayer = layers[layerIndex];
    const targetLayer = layers[layerIndex + 1];
    const usedPairs = new Set<string>();
    const fanoutBase = Math.max(1, Math.round(1 + config.edgeDensity * Math.sqrt(targetLayer.length) * 2.35));

    sourceLayer.forEach((sourceId, sourceIndex) => {
      const maxTargets = Math.min(targetLayer.length, fanoutBase + (sourceIndex % 3 === 0 ? 1 : 0));
      const picks = sampleUniqueIndices(targetLayer.length, maxTargets, random);

      picks.forEach((targetIndex) => {
        const pairKey = `${sourceId}->${targetLayer[targetIndex]}`;

        if (!usedPairs.has(pairKey)) {
          usedPairs.add(pairKey);
          edges.push({
            source: sourceId,
            target: targetLayer[targetIndex],
          });
        }
      });
    });

    targetLayer.forEach((targetId) => {
      const hasIncoming = edges.some((edge) => edge.target === targetId && edge.source.startsWith(`L${layerIndex + 1}-`));

      if (!hasIncoming) {
        const fallbackSource = sourceLayer[Math.floor(random() * sourceLayer.length)];
        const pairKey = `${fallbackSource}->${targetId}`;

        if (!usedPairs.has(pairKey)) {
          usedPairs.add(pairKey);
          edges.push({
            source: fallbackSource,
            target: targetId,
          });
        }
      }
    });
  }

  return {
    nodes,
    edges,
    layers,
  };
}

export const presets: Record<PresetKey, DemoPreset> = {
  small: {
    key: 'small',
    label: 'Small',
    description: '4 层，轻量节点与较低密度，便于观察交叉模式。',
    graph: {
      layerCount: 4,
      nodesPerLayer: 12,
      edgeDensity: 0.18,
      seed: 7,
    },
    rowsPerLayer: 2,
  },
  medium: {
    key: 'medium',
    label: 'Medium',
    description: '4 层，均衡规模，适合作为默认研究视图。',
    graph: {
      layerCount: 4,
      nodesPerLayer: 30,
      edgeDensity: 0.32,
      seed: 11,
    },
    rowsPerLayer: 3,
  },
  'wide-layer': {
    key: 'wide-layer',
    label: 'Wide Layer',
    description: '中间层显著变宽，用于模拟研究动机场景。',
    graph: {
      layerCount: 4,
      nodesPerLayer: 30,
      customLayerSizes: [15, 80, 25, 15],
      edgeDensity: 0.3,
      seed: 19,
    },
    rowsPerLayer: 4,
  },
  'very-wide-layer': {
    key: 'very-wide-layer',
    label: 'Very Wide Layer',
    description: '极宽第二层，便于观察压缩收益与交叉变化。',
    graph: {
      layerCount: 4,
      nodesPerLayer: 40,
      customLayerSizes: [20, 140, 32, 20],
      edgeDensity: 0.28,
      seed: 23,
    },
    rowsPerLayer: 6,
  },
};

export function getLayerSummary(config: GraphConfig) {
  return resolveLayerSizes(config).join(' / ');
}
