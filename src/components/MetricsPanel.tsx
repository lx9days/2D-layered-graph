import type { PositionedLayout } from '@/types/graph';
import type { LayoutDelta } from '@/lib/layout/computeMetrics';

interface MetricsPanelProps {
  traditional: PositionedLayout;
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
  return (
    <div className="metric-card">
      <div className="metric-card__header">
        <h3>{title}</h3>
        <span>{layout.mode === 'traditional' ? 'Baseline' : 'Compact'}</span>
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
      </dl>
    </div>
  );
}

export default function MetricsPanel({ traditional, compact, delta }: MetricsPanelProps) {
  return (
    <section className="metrics-grid">
      <MetricCard title="传统布局" layout={traditional} />
      <MetricCard title="紧凑布局" layout={compact} />
      <div className="metric-card metric-card--delta">
        <div className="metric-card__header">
          <h3>关键差异</h3>
          <span>Width ↔ Crossings</span>
        </div>
        <dl>
          <div>
            <dt>宽度压缩</dt>
            <dd>{formatPercent(delta.widthReduction)}</dd>
          </div>
          <div>
            <dt>交叉变化</dt>
            <dd>{formatPercent(delta.crossingChange)}</dd>
          </div>
          <div>
            <dt>观察结论</dt>
            <dd className="metric-card__insight">
              {delta.widthReduction > 0
                ? '二维层已开始明显回收水平空间。'
                : '当前 row count 仍接近传统单行布局。'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
