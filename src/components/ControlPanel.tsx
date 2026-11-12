import type { BlockSimilarity } from '@/lib/layout/multiRow/clustering';
import { presets } from '@/lib/graph/generateGraph';
import type { GraphConfig, OrderingStrategy, PresetSelection, TraversalStrategy } from '@/types/graph';

interface ControlPanelProps {
  activePreset: PresetSelection;
  graphConfig: GraphConfig;
  rowsPerLayer: number;
  blockSpread: number;
  spanExponent: number;
  blockSimilarity: BlockSimilarity;
  clusteringThreshold: number;

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
  layerSummary: string;
  onApplyPreset: (presetKey: keyof typeof presets) => void;
  onUpdateGraphConfig: (patch: Partial<GraphConfig>) => void;
  onUpdateRows: (rows: number) => void;
  onUpdateBlockSpread: (spread: number) => void;
  onUpdateBlockSimilarity: (criterion: BlockSimilarity) => void;
  onUpdateClusteringThreshold: (threshold: number) => void;
  onUpdateSpanExponent: (exponent: number) => void;
  onUpdateEdgeBundling: (enabled: boolean) => void;
  onUpdateOrdering: (ordering: OrderingStrategy) => void;
  onUpdateTraversal: (traversal: TraversalStrategy) => void;
  onUpdateWidthWeight: (weight: number) => void;
  onUpdateCrossingWeight: (weight: number) => void;
  onUpdateEdgeDetourWeight: (weight: number) => void;
  onUpdateBacktrackingWeight: (weight: number) => void;
  onUpdateEnableRowMove: (enabled: boolean) => void;
  onUpdateEnableNodeSwap: (enabled: boolean) => void;
  onUpdateEnableAdjacentReorder: (enabled: boolean) => void;
}

export default function ControlPanel({
  activePreset,
  graphConfig,
  rowsPerLayer,
  blockSpread,
  spanExponent,
  blockSimilarity,
  clusteringThreshold,
  edgeBundling,
  ordering,
  traversal,
  widthWeight,
  crossingWeight,
  edgeDetourWeight,
  backtrackingWeight,
  enableRowMove,
  enableNodeSwap,
  enableAdjacentReorder,
  layerSummary,
  onApplyPreset,
  onUpdateGraphConfig,
  onUpdateRows,
  onUpdateBlockSpread,
  onUpdateSpanExponent,
  onUpdateBlockSimilarity,
  onUpdateClusteringThreshold,
  onUpdateEdgeBundling,
  onUpdateOrdering,
  onUpdateTraversal,
  onUpdateWidthWeight,
  onUpdateCrossingWeight,
  onUpdateEdgeDetourWeight,
  onUpdateBacktrackingWeight,
  onUpdateEnableRowMove,
  onUpdateEnableNodeSwap,
  onUpdateEnableAdjacentReorder,
}: ControlPanelProps) {
  return (
    <aside className="panel">
      <div className="panel__block">
        <div className="panel__title-row">
          <div>
            <h2>参数实验台</h2>
            <p>在同一张图上比较传统 1D 分层和紧凑 2D 分层的行为差异。</p>
          </div>
          <div className="panel__status">{activePreset === 'custom' ? '自定义' : '预设'}</div>
        </div>

        <div className="panel__quick-actions">
          <label className="panel-toggle">
            <span>Row Move</span>
            <input
              type="checkbox"
              checked={enableRowMove}
              onChange={(event) => onUpdateEnableRowMove(event.target.checked)}
            />
          </label>

          <label className="panel-toggle">
            <span>Node Swap</span>
            <input
              type="checkbox"
              checked={enableNodeSwap}
              onChange={(event) => onUpdateEnableNodeSwap(event.target.checked)}
            />
          </label>

          <label className="panel-toggle">
            <span>Adjacent Reorder</span>
            <input
              type="checkbox"
              checked={enableAdjacentReorder}
              onChange={(event) => onUpdateEnableAdjacentReorder(event.target.checked)}
            />
          </label>

          <label className="panel-toggle">
            <span>Edge Bundle</span>
            <input
              type="checkbox"
              checked={edgeBundling}
              onChange={(event) => onUpdateEdgeBundling(event.target.checked)}
            />
          </label>
        </div>

        <div className="preset-grid">
          {Object.values(presets).map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`preset-button${activePreset === preset.key ? ' preset-button--active' : ''}`}
              onClick={() => onApplyPreset(preset.key)}
            >
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel__block">
        <div className="panel__subtitle">图规模</div>
        <label className="field">
          <span>层数</span>
          <input
            type="range"
            min="2"
            max="8"
            value={graphConfig.layerCount}
            onChange={(event) =>
              onUpdateGraphConfig({
                layerCount: Number(event.target.value),
                customLayerSizes: undefined,
              })
            }
          />
          <strong>{graphConfig.layerCount}</strong>
        </label>

        <label className="field">
          <span>每层节点数</span>
          <input
            type="range"
            min="6"
            max="80"
            value={graphConfig.nodesPerLayer}
            onChange={(event) =>
              onUpdateGraphConfig({
                nodesPerLayer: Number(event.target.value),
                customLayerSizes: undefined,
              })
            }
          />
          <strong>{graphConfig.nodesPerLayer}</strong>
        </label>

        <label className="field">
          <span>边密度</span>
          <input
            type="range"
            min="0.08"
            max="0.65"
            step="0.01"
            value={graphConfig.edgeDensity}
            onChange={(event) =>
              onUpdateGraphConfig({
                edgeDensity: Number(event.target.value),
              })
            }
          />
          <strong>{graphConfig.edgeDensity.toFixed(2)}</strong>
        </label>

        <label className="field">
          <span>随机种子</span>
          <input
            type="number"
            value={graphConfig.seed}
            min="1"
            max="9999"
            onChange={(event) =>
              onUpdateGraphConfig({
                seed: Number(event.target.value) || 1,
              })
            }
          />
        </label>

        <div className="field field--static">
          <span>层规模分布</span>
          <strong>{layerSummary}</strong>
        </div>
      </div>

      <div className="panel__block">
        <div className="panel__subtitle">紧凑布局</div>

        <label className="field">
          <span>分块标准</span>
          <select value={blockSimilarity} onChange={(event) => onUpdateBlockSimilarity(event.target.value as BlockSimilarity)}>
            <option value="neighbors">共同邻居聚类</option>
            <option value="layer-profile">连接层分布聚类</option>
            <option value="role">结构角色聚类</option>
            <option value="legacy">原连续区间分块（对照）</option>
          </select>
        </label>
        {blockSimilarity !== 'legacy' && <label className="field">
          <span>聚类合并阈值</span>
          <input type="range" min="0" max="1" step="0.05" value={clusteringThreshold}
            onChange={(event) => onUpdateClusteringThreshold(Number(event.target.value))} />
          <strong>{clusteringThreshold.toFixed(2)}</strong>
        </label>}
        <div className="panel__note">
          {blockSimilarity === 'neighbors' ? '按共同入邻居、出邻居和加权度数聚类。' :
           blockSimilarity === 'layer-profile' ? '按输入、输出连接在各语义层的分布聚类，不要求邻居相同。' :
           blockSimilarity === 'role' ? '按入度、出度、输入占比和长边占比聚类。' : '先按相似性排序，再用动态规划切连续区间。'}
          {blockSimilarity !== 'legacy' && ' 阈值越高，合并越严格，通常形成更多、更小的块。'}
        </div>

        <label className="field">
          <span>最大块内行数</span>
          <input
            type="range"
            min="1"
            max="8"
            value={rowsPerLayer}
            onChange={(event) => onUpdateRows(Number(event.target.value))}
          />
          <strong>{rowsPerLayer}</strong>
        </label>

        <label className="field">
          <span>块间分散</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={blockSpread}
            onChange={(event) => onUpdateBlockSpread(Number(event.target.value))}
          />
          <strong>{Math.round(blockSpread * 100)}%</strong>
        </label>

        <label className="field">
          <span>跨层边权重</span>
          <select value={spanExponent} onChange={(event) => onUpdateSpanExponent(Number(event.target.value))}>
            <option value="1">跨度（线性）</option>
            <option value="2">跨度²（平方）</option>
            <option value="3">跨度³（立方）</option>
          </select>
        </label>

        <label className="field">
          <span>节点排序</span>
          <select value={ordering} onChange={(event) => onUpdateOrdering(event.target.value as OrderingStrategy)}>
            <option value="original">原始 / 随机</option>
            <option value="barycenter">重心排序</option>
          </select>
        </label>

        <label className="field">
          <span>包裹遍历</span>
          <select value={traversal} onChange={(event) => onUpdateTraversal(event.target.value as TraversalStrategy)}>
            <option value="row-major">行优先</option>
            <option value="serpentine">蛇形</option>
            <option value="hilbert">Hilbert 近似占位</option>
          </select>
        </label>
      </div>

      <div className="panel__block">
        <div className="panel__subtitle">优化目标权重</div>

        <label className="field">
          <span>Width</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={widthWeight}
            onChange={(event) => onUpdateWidthWeight(Number(event.target.value))}
          />
          <strong>{widthWeight.toFixed(2)}</strong>
        </label>

        <label className="field">
          <span>Crossings</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={crossingWeight}
            onChange={(event) => onUpdateCrossingWeight(Number(event.target.value))}
          />
          <strong>{crossingWeight.toFixed(2)}</strong>
        </label>

        <label className="field">
          <span>Edge Detour</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={edgeDetourWeight}
            onChange={(event) => onUpdateEdgeDetourWeight(Number(event.target.value))}
          />
          <strong>{edgeDetourWeight.toFixed(2)}</strong>
        </label>

        <label className="field">
          <span>Backtracking</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={backtrackingWeight}
            onChange={(event) => onUpdateBacktrackingWeight(Number(event.target.value))}
          />
          <strong>{backtrackingWeight.toFixed(2)}</strong>
        </label>

        <div className="panel__note">
          左侧视图固定显示无局部优化版本；右侧视图根据这里的权重和 move 开关进行优化。当前 `backtracking` 仍是工程代理指标，建议先把它当作实验参数而不是结论性指标。
        </div>
      </div>
    </aside>
  );
}
