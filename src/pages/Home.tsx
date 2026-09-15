import { useEffect, useMemo, useState } from 'react';
import ControlPanel from '@/components/ControlPanel';
import GraphView from '@/components/GraphView';
import MetricsPanel from '@/components/MetricsPanel';
import TradeoffPlot from '@/components/TradeoffPlot';
import { generateGraph, getLayerSummary } from '@/lib/graph/generateGraph';
import { computeDelta, type LayoutBundle } from '@/lib/layout/computeMetrics';
import { useDemoStore } from '@/store/useDemoStore';
import type { TradeoffPoint } from '@/types/graph';

export default function Home() {
  const {
    activePreset,
    graphConfig,
    rowsPerLayer,
    blockSpread,
    spanExponent,
    edgeBundling,
    ordering,
    traversal,
    hoveredNodeId,
    applyPreset,
    updateGraphConfig,
    updateRowsPerLayer,
    updateBlockSpread,
    updateSpanExponent,
    updateEdgeBundling,
    updateOrdering,
    updateTraversal,
    setHoveredNodeId,
  } = useDemoStore();

  const graph = useMemo(() => generateGraph(graphConfig), [graphConfig]);
  const [layoutBundle, setLayoutBundle] = useState<LayoutBundle | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  useEffect(() => {
    setLayoutBundle(null);
    setLayoutError(null);
    const worker = new Worker(new URL('../lib/layout/layoutWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ ok: boolean; bundle?: LayoutBundle; point?: TradeoffPoint; message?: string }>) => {
      if (event.data.ok && event.data.bundle) setLayoutBundle(event.data.bundle);
      else if (event.data.ok && event.data.point) {
        const point = event.data.point;
        setLayoutBundle((current) => current && ({ ...current,
          tradeoffPoints: [...current.tradeoffPoints.filter((entry) => entry.rows !== point.rows), point]
            .sort((a, b) => a.rows - b.rows),
        }));
      } else setLayoutError(event.data.message ?? '布局计算失败');
    };
    worker.onerror = (event) => setLayoutError(event.message || '布局计算失败');
    worker.postMessage({ graph, ordering, traversal, rowsPerLayer, blockSpread, spanExponent });
    return () => worker.terminate();
  }, [graph, ordering, traversal, rowsPerLayer, blockSpread, spanExponent]);
  const delta = useMemo(
    () => layoutBundle ? computeDelta(layoutBundle.traditional, layoutBundle.compact) : null,
    [layoutBundle],
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
          blockSpread={blockSpread}
          spanExponent={spanExponent}
          edgeBundling={edgeBundling}
          ordering={ordering}
          traversal={traversal}
          layerSummary={layerSummary}
          onApplyPreset={applyPreset}
          onUpdateGraphConfig={updateGraphConfig}
          onUpdateRows={updateRowsPerLayer}
          onUpdateBlockSpread={updateBlockSpread}
          onUpdateSpanExponent={updateSpanExponent}
          onUpdateEdgeBundling={updateEdgeBundling}
          onUpdateOrdering={updateOrdering}
          onUpdateTraversal={updateTraversal}
        />

        <section className="content">
          {layoutError && <div className="panel" role="alert">布局计算失败：{layoutError}</div>}
          {!layoutBundle && !layoutError && <div className="panel" role="status">正在计算布局，请稍候…</div>}
          {layoutBundle && delta && <>
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
              edgeBundling={edgeBundling}
              hoveredNodeId={hoveredNodeId}
              onHoverNode={setHoveredNodeId}
            />
          </div>

          <MetricsPanel traditional={layoutBundle.traditional} compact={layoutBundle.compact} delta={delta} />

          {layoutBundle.tradeoffPoints.length > 0 && <TradeoffPlot
            points={layoutBundle.tradeoffPoints}
            activeRows={rowsPerLayer}
            onSelectRows={updateRowsPerLayer}
          />}
          </>}
        </section>
      </div>
    </main>
  );
}
