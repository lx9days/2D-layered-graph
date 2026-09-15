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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sampleWeightedIndex(weights: number[], random: () => number, excluded: Set<number>) {
  let total = 0;

  weights.forEach((weight, index) => {
    if (!excluded.has(index)) {
      total += Math.max(0, weight);
    }
  });

  if (total <= 0) {
    const available = weights
      .map((_, index) => index)
      .filter((index) => !excluded.has(index));

    return available.length > 0
      ? available[Math.floor(random() * available.length)]
      : -1;
  }

  let cursor = random() * total;

  for (let index = 0; index < weights.length; index += 1) {
    if (excluded.has(index)) {
      continue;
    }

    cursor -= Math.max(0, weights[index]);

    if (cursor <= 0) {
      return index;
    }
  }

  return weights.findIndex((_, index) => !excluded.has(index));
}

function sampleWeightedUniqueIndices(weights: number[], pickCount: number, random: () => number) {
  const picks: number[] = [];
  const excluded = new Set<number>();
  const targetCount = Math.min(weights.length, Math.max(0, pickCount));

  while (picks.length < targetCount) {
    const next = sampleWeightedIndex(weights, random, excluded);

    if (next < 0) {
      break;
    }

    excluded.add(next);
    picks.push(next);
  }

  return picks;
}

function buildLayerWeights(size: number, random: () => number) {
  const hotspotCenter = random();
  const hotspotWidth = 0.08 + random() * 0.26;
  const waveFrequency = 1.2 + random() * 2.2;
  const hubIndices = sampleUniqueIndices(
    size,
    Math.min(size, Math.max(1, Math.round(size * (0.12 + random() * 0.08)))),
    random,
  );
  const hubSet = new Set(hubIndices);

  return Array.from({ length: size }, (_, index) => {
    const normalized = size <= 1 ? 0.5 : index / (size - 1);
    const hotspot = Math.exp(-((normalized - hotspotCenter) ** 2) / Math.max(0.0025, hotspotWidth ** 2));
    const wave = 0.65 + 0.45 * Math.sin((normalized + random() * 0.1) * Math.PI * waveFrequency);
    const hubBoost = hubSet.has(index) ? 1.8 + random() * 2.8 : 0;
    const leafPenalty = random() < 0.18 ? 0.35 + random() * 0.2 : 1;

    return Math.max(0.12, (0.55 + hotspot + wave + hubBoost) * leafPenalty);
  });
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

  const edgeKeys = new Set<string>();
  const addEdge = (source: string, target: string) => {
    const key = `${source}->${target}`;

    if (edgeKeys.has(key)) {
      return false;
    }

    edgeKeys.add(key);
    edges.push({ source, target });
    return true;
  };

  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    const sourceLayer = layers[layerIndex];
    const targetLayer = layers[layerIndex + 1];
    const fanoutBase = Math.max(1, Math.round(1 + config.edgeDensity * Math.sqrt(targetLayer.length) * 1.7));
    const sourceWeights = buildLayerWeights(sourceLayer.length, random);
    const targetWeights = buildLayerWeights(targetLayer.length, random);
    const layerSkew = random() * 0.7 - 0.35;
    const locality = 0.8 + random() * 2.1;

    sourceLayer.forEach((sourceId, sourceIndex) => {
      const sourceStrength = sourceWeights[sourceIndex] ?? 1;
      const normalizedSource = sourceLayer.length <= 1 ? 0.5 : sourceIndex / (sourceLayer.length - 1);
      const preferredCenter = clamp(
        normalizedSource * (0.65 + random() * 0.7) + layerSkew + (random() - 0.5) * 0.24,
        0,
        1,
      );
      const fanoutCap = Math.min(targetLayer.length, fanoutBase + 3 + Math.round(random() * 2));
      const maxTargets = clamp(
        Math.round(1 + fanoutBase * (0.3 + sourceStrength * 0.34)),
        1,
        fanoutCap,
      );
      const targetPreference = targetWeights.map((baseWeight, targetIndex) => {
        const normalizedTarget = targetLayer.length <= 1 ? 0.5 : targetIndex / (targetLayer.length - 1);
        const distance = Math.abs(normalizedTarget - preferredCenter);
        const localityScore = 0.45 + 0.95 / (1 + distance * locality * 4);
        const bridgeBonus = distance > 0.32 ? 0.14 + random() * 0.18 : 0;

        return baseWeight * localityScore + bridgeBonus;
      });
      const picks = sampleWeightedUniqueIndices(targetPreference, maxTargets, random);

      picks.forEach((targetIndex) => {
        addEdge(sourceId, targetLayer[targetIndex]);
      });
    });

    targetLayer.forEach((targetId) => {
      const hasIncoming = edges.some((edge) => edge.target === targetId && edge.source.startsWith(`L${layerIndex + 1}-`));

      if (!hasIncoming) {
        const fallbackIndex = sampleWeightedIndex(sourceWeights, random, new Set<number>());

        if (fallbackIndex >= 0) {
          addEdge(sourceLayer[fallbackIndex], targetId);
        }
      }
    });
  }

  for (let layerIndex = 0; layerIndex < layers.length - 2; layerIndex += 1) {
    const sourceLayer = layers[layerIndex];
    const maxSpan = Math.min(3, layers.length - layerIndex - 1);

    if (maxSpan < 2) {
      continue;
    }

    const sourceWeights = buildLayerWeights(sourceLayer.length, random);
    const longEdgeBudget = Math.max(1, Math.round(sourceLayer.length * config.edgeDensity * 0.18));

    for (let edgeIndex = 0; edgeIndex < longEdgeBudget; edgeIndex += 1) {
      const span = 2 + Math.floor(random() * (maxSpan - 1));
      const targetLayerIndex = layerIndex + span;
      const targetLayer = layers[targetLayerIndex];
      const targetWeights = buildLayerWeights(targetLayer.length, random);
      const sourceIndex = sampleWeightedIndex(sourceWeights, random, new Set<number>());
      const targetIndex = sampleWeightedIndex(targetWeights, random, new Set<number>());

      if (sourceIndex < 0 || targetIndex < 0) {
        continue;
      }

      addEdge(sourceLayer[sourceIndex], targetLayer[targetIndex]);
    }
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
    description: '6 层，包含接近 200 节点的宽层，并混入跨层边作为默认研究视图。',
    graph: {
      layerCount: 6,
      nodesPerLayer: 48,
      customLayerSizes: [36, 118, 192, 74, 156, 29],
      edgeDensity: 0.19,
      seed: 71,
    },
    rowsPerLayer: 6,
  },
  'wide-layer': {
    key: 'wide-layer',
    label: 'Wide Layer',
    description: '中间层接近 180 节点，用于模拟更极端的宽层场景。',
    graph: {
      layerCount: 5,
      nodesPerLayer: 44,
      customLayerSizes: [28, 176, 63, 149, 24],
      edgeDensity: 0.18,
      seed: 83,
    },
    rowsPerLayer: 6,
  },
  'very-wide-layer': {
    key: 'very-wide-layer',
    label: 'Very Wide Layer',
    description: '极宽第二层接近 200 节点，便于观察压缩收益与交叉变化。',
    graph: {
      layerCount: 5,
      nodesPerLayer: 52,
      customLayerSizes: [34, 196, 58, 168, 26],
      edgeDensity: 0.17,
      seed: 97,
    },
    rowsPerLayer: 7,
  },
};

export function getLayerSummary(config: GraphConfig) {
  return resolveLayerSizes(config).join(' / ');
}
