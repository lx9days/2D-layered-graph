import type { PositionedLayout } from '@/types/graph';
import type { LayoutDelta } from '@/lib/layout/computeMetrics';

interface MetricsPanelProps {
  traditional: PositionedLayout;
  unoptimized: PositionedLayout;
  compact: PositionedLayout;
  delta: LayoutDelta;
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function MetricCard({
  title,
  layout,
}: {
  title: string;
  layout: PositionedLayout;
}) {
  const isTraditional = layout.mode === 'traditional';

  return (
    <div className="metric-card">
      <div className="metric-card__header">
        <h3>{title}</h3>
        <span>{isTraditional ? 'Baseline' : 'Multi-Row'}</span>
      </div>
      <dl>
        <div>
          <dt>宽度</dt>
          <dd>{Math.round(layout.metrics.width)}</dd>
        </div>
        <div>
          <dt>高度</dt>
          <dd>{Math.round(layout.metrics.height)}</dd>
        </div>
        <div>
          <dt>交叉数</dt>
          <dd>{layout.metrics.crossings}</dd>
        </div>
        {layout.metrics.blockInversions !== undefined && <div>
          <dt>块级反序</dt>
          <dd>{layout.metrics.blockInversions}</dd>
        </div>}
        {layout.metrics.totalEdgeLength !== undefined && <div>
          <dt>绘制边总长度</dt>
          <dd>{Math.round(layout.metrics.totalEdgeLength)}</dd>
        </div>}
        {layout.metrics.backtracking !== undefined && <div>
          <dt>逆向代价</dt>
          <dd>{layout.metrics.backtracking.toFixed(2)}</dd>
        </div>}
      </dl>
    </div>
  );
}

export default function MetricsPanel({ traditional, unoptimized, compact, delta }: MetricsPanelProps) {
  return (
    <section className="metrics-grid">
      <MetricCard title="无优化 Multi-Row" layout={unoptimized} />
      <MetricCard title="有优化 Multi-Row" layout={compact} />
      <MetricCard title="Sugiyama Baseline" layout={traditional} />
      <div className="metric-card metric-card--delta">
        <div className="metric-card__header">
          <h3>优化收益</h3>
          <span>无优化 → 有优化</span>
        </div>
        <dl>
          <div>
            <dt>宽度变化</dt>
            <dd>{formatPercent(delta.widthReduction)}</dd>
          </div>
          <div>
            <dt>交叉变化</dt>
            <dd>{formatPercent(delta.crossingChange)}</dd>
          </div>
          <div>
            <dt>观察结论</dt>
            <dd className="metric-card__insight">
              {delta.widthReduction > 0 && delta.crossingChange <= 0
                ? '当前优化同时缩小了宽度并控制了交叉。'
                : delta.widthReduction > 0
                  ? '当前优化优先回收了宽度，但仍需观察交叉代价。'
                  : '当前优化尚未带来明显的几何收益。'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
