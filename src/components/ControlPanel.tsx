import { presets } from '@/lib/graph/generateGraph';
import type { GraphConfig, OrderingStrategy, PresetSelection, TraversalStrategy } from '@/types/graph';

interface ControlPanelProps {
  activePreset: PresetSelection;
  graphConfig: GraphConfig;
  rowsPerLayer: number;
  ordering: OrderingStrategy;
  traversal: TraversalStrategy;
  layerSummary: string;
  onApplyPreset: (presetKey: keyof typeof presets) => void;
  onUpdateGraphConfig: (patch: Partial<GraphConfig>) => void;
  onUpdateRows: (rows: number) => void;
  onUpdateOrdering: (ordering: OrderingStrategy) => void;
  onUpdateTraversal: (traversal: TraversalStrategy) => void;
}

export default function ControlPanel({
  activePreset,
  graphConfig,
  rowsPerLayer,
  ordering,
  traversal,
  layerSummary,
  onApplyPreset,
  onUpdateGraphConfig,
  onUpdateRows,
  onUpdateOrdering,
  onUpdateTraversal,
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
          <span>每层行数</span>
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

        <div className="panel__note">
          右侧当前使用块化 2D 层：区块先按拓扑相似性形成连续段，并沿层主轴做 1D 排列；Hilbert 仍先用蛇形近似。
        </div>
      </div>
    </aside>
  );
}
