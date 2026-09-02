import { useMemo } from 'react';
import ControlPanel from '@/components/ControlPanel';
import GraphView from '@/components/GraphView';
import MetricsPanel from '@/components/MetricsPanel';
import TradeoffPlot from '@/components/TradeoffPlot';
import { generateGraph, getLayerSummary } from '@/lib/graph/generateGraph';
import { buildLayouts, computeDelta } from '@/lib/layout/computeMetrics';
import { useDemoStore } from '@/store/useDemoStore';

export default function Home() {
  const {
    activePreset,
    graphConfig,
    rowsPerLayer,
    ordering,
    traversal,
    hoveredNodeId,
    applyPreset,
    updateGraphConfig,
    updateRowsPerLayer,
    updateOrdering,
    updateTraversal,
    setHoveredNodeId,
  } = useDemoStore();

  const graph = useMemo(() => generateGraph(graphConfig), [graphConfig]);
  const layoutBundle = useMemo(
    () => buildLayouts(graph, ordering, traversal, rowsPerLayer),
    [graph, ordering, traversal, rowsPerLayer],
  );
  const delta = useMemo(
    () => computeDelta(layoutBundle.traditional, layoutBundle.compact),
    [layoutBundle.compact, layoutBundle.traditional],
  );
  const layerSummary = useMemo(() => getLayerSummary(graphConfig), [graphConfig]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <span className="hero__eyebrow">Compact 2D Layer Demo</span>
          <h1>分层图从 1D 直线到 2D 区域的交互式对比原型</h1>
          <p>
            使用同一份随机图同时渲染传统分层布局和紧凑二维层布局，实时观察宽度压缩与边交叉变化。
          </p>
        </div>
        <div className="hero__stats">
          <div>
            <span>Nodes</span>
            <strong>{graph.nodes.length}</strong>
          </div>
          <div>
            <span>Edges</span>
            <strong>{graph.edges.length}</strong>
          </div>
          <div>
            <span>Layers</span>
            <strong>{graph.layers.length}</strong>
          </div>
        </div>
      </section>

      <div className="workspace">
        <ControlPanel
          activePreset={activePreset}
          graphConfig={graphConfig}
          rowsPerLayer={rowsPerLayer}
          ordering={ordering}
          traversal={traversal}
          layerSummary={layerSummary}
          onApplyPreset={applyPreset}
          onUpdateGraphConfig={updateGraphConfig}
          onUpdateRows={updateRowsPerLayer}
          onUpdateOrdering={updateOrdering}
          onUpdateTraversal={updateTraversal}
        />

        <section className="content">
          <div className="graphs-grid">
            <GraphView
              title="传统分层布局"
              subtitle="使用 Sugiyama 流水线作为传统层次布局基线。"
              layout={layoutBundle.traditional}
              hoveredNodeId={hoveredNodeId}
              onHoverNode={setHoveredNodeId}
            />
            <GraphView
              title="紧凑二维层布局"
              subtitle="区块沿层主轴做 1D 排列，块内再做二维压缩。"
              layout={layoutBundle.compact}
              hoveredNodeId={hoveredNodeId}
              onHoverNode={setHoveredNodeId}
            />
          </div>

          <MetricsPanel traditional={layoutBundle.traditional} compact={layoutBundle.compact} delta={delta} />

          <TradeoffPlot
            points={layoutBundle.tradeoffPoints}
            activeRows={rowsPerLayer}
            onSelectRows={updateRowsPerLayer}
          />
        </section>
      </div>
    </main>
  );
}
