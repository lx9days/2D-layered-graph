import { extent, scaleLinear, ticks } from 'd3';
import type { TradeoffPoint } from '@/types/graph';

interface TradeoffPlotProps {
  points: TradeoffPoint[];
  activeRows: number;
  onSelectRows: (rows: number) => void;
}

const WIDTH = 360;
const HEIGHT = 260;
const MARGIN = { top: 20, right: 20, bottom: 44, left: 52 };

export default function TradeoffPlot({ points, activeRows, onSelectRows }: TradeoffPlotProps) {
  const widthExtent = extent(points, (point) => point.width) as [number, number];
  const crossingExtent = extent(points, (point) => point.crossings) as [number, number];
  const xScale = scaleLinear()
    .domain([Math.min(widthExtent[0] ?? 0, 0), (widthExtent[1] ?? 1) * 1.05])
    .range([MARGIN.left, WIDTH - MARGIN.right]);
  const yScale = scaleLinear()
    .domain([Math.min(crossingExtent[0] ?? 0, 0), (crossingExtent[1] ?? 1) * 1.08])
    .range([HEIGHT - MARGIN.bottom, MARGIN.top]);

  const xTicks = ticks(xScale.domain()[0], xScale.domain()[1], 4);
  const yTicks = ticks(yScale.domain()[0], yScale.domain()[1], 4);

  return (
    <section className="plot-card">
      <div className="plot-card__header">
        <div>
          <h3>宽度 - 交叉数权衡</h3>
          <p>点击点位可以切换右侧紧凑布局的最大块内行数；实际行数按层规模调整。</p>
        </div>
        <div className="plot-card__legend">Rows = {activeRows}</div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="plot-card__svg" role="img" aria-label="宽度与交叉数散点图">
        <line x1={MARGIN.left} y1={HEIGHT - MARGIN.bottom} x2={WIDTH - MARGIN.right} y2={HEIGHT - MARGIN.bottom} className="plot-axis" />
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={HEIGHT - MARGIN.bottom} className="plot-axis" />

        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line x1={xScale(tick)} y1={HEIGHT - MARGIN.bottom} x2={xScale(tick)} y2={HEIGHT - MARGIN.bottom + 6} className="plot-tick" />
            <text x={xScale(tick)} y={HEIGHT - 16} textAnchor="middle" className="plot-label">
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={MARGIN.left - 6} y1={yScale(tick)} x2={MARGIN.left} y2={yScale(tick)} className="plot-tick" />
            <line x1={MARGIN.left} y1={yScale(tick)} x2={WIDTH - MARGIN.right} y2={yScale(tick)} className="plot-grid" />
            <text x={MARGIN.left - 10} y={yScale(tick) + 4} textAnchor="end" className="plot-label">
              {Math.round(tick)}
            </text>
          </g>
        ))}

        <text x={(WIDTH + MARGIN.left - MARGIN.right) / 2} y={HEIGHT - 4} textAnchor="middle" className="plot-axis-title">
          Layout Width
        </text>
        <text
          x={14}
          y={(HEIGHT - MARGIN.bottom + MARGIN.top) / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${(HEIGHT - MARGIN.bottom + MARGIN.top) / 2})`}
          className="plot-axis-title"
        >
          Crossings
        </text>

        {points.map((point) => {
          const isActive = point.rows === activeRows;

          return (
            <g key={point.rows}>
              <circle
                cx={xScale(point.width)}
                cy={yScale(point.crossings)}
                r={isActive ? 8 : 6}
                className={`plot-point${isActive ? ' plot-point--active' : ''}`}
                onClick={() => onSelectRows(point.rows)}
              />
              <text
                x={xScale(point.width) + 10}
                y={yScale(point.crossings) - 8}
                className={`plot-point-label${isActive ? ' plot-point-label--active' : ''}`}
              >
                rows={point.rows}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
