import { useMemo } from 'react';
import { planEdgeBundles } from '@/lib/layout/edgeBundles';
import type { PositionedLayout } from '@/types/graph';

interface GraphViewProps {
  title: string;
  subtitle: string;
  layout: PositionedLayout;
  hoveredNodeId: string | null;
  onHoverNode: (nodeId: string | null) => void;
  edgeBundling?: boolean;
}

const palette = ['#7dd3fc', '#34d399', '#fbbf24', '#fb7185', '#c084fc', '#22d3ee'];

export default function GraphView({
  title,
  subtitle,
  layout,
  hoveredNodeId,
  onHoverNode,
  edgeBundling = false,
}: GraphViewProps) {
  const bundlePlan = useMemo(() => edgeBundling && layout.mode === 'compact'
    ? planEdgeBundles(layout) : null, [edgeBundling, layout]);
  const incidentNodeIds = new Set<string>();
  const incidentEdgeKeys = new Set<string>();

  if (hoveredNodeId) {
    layout.edges.forEach((edge) => {
      if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
        incidentEdgeKeys.add(`${edge.source}->${edge.target}`);
        incidentNodeIds.add(edge.source);
        incidentNodeIds.add(edge.target);
      }
    });
  }

  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

  return (
    <section className="graph-card">
      <div className="graph-card__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="graph-card__badge">{layout.mode === 'traditional' ? '1D Layer' : '2D Layer'}</div>
      </div>

      <svg
        className="graph-card__svg"
        viewBox={`0 0 ${layout.metrics.width} ${layout.metrics.height}`}
        role="img"
        aria-label={title}
      >
        <defs>
          <filter id={`${layout.mode}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {layout.boxes.map((box) => (
          <g key={box.label}>
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx={16}
              className={layout.mode === 'traditional' ? 'layer-box layer-box--traditional' : 'layer-box'}
            />
            <text x={box.x + 14} y={box.y + 20} className="layer-label">
              {box.label}
            </text>
          </g>
        ))}

        {layout.blockBoxes?.map((block) => (
          <rect
            key={block.id}
            x={block.x}
            y={block.y}
            width={block.width}
            height={block.height}
            rx={10}
            className="block-box"
          />
        ))}

        {bundlePlan?.bundles.map((bundle) => {
          const { sourceJunction: start, targetJunction: end } = bundle;
          const isIncident = bundle.edges.some((edge) => incidentEdgeKeys.has(`${edge.source}->${edge.target}`));
          const isDimmed = hoveredNodeId ? !isIncident : false;
          const middleY = (start.y + end.y) / 2;
          return (
            <g key={bundle.key}>
              <path
                d={`M ${start.x} ${start.y} C ${start.x} ${middleY} ${end.x} ${middleY} ${end.x} ${end.y}`}
                className={`edge-line edge-line--trunk${isDimmed ? ' edge-line--dimmed' : ''}${isIncident ? ' edge-line--active' : ''}`}
                style={{ strokeWidth: isIncident ? 2.8 : Math.min(3.2, 1.5 + Math.log2(bundle.edges.length) * 0.35) }}
              />
              {[...new Set(bundle.edges.map((edge) => edge.source))].map((sourceId) => {
                const source = nodeMap.get(sourceId);
                if (!source) return null;
                const active = bundle.edges.some((edge) => edge.source === sourceId
                  && incidentEdgeKeys.has(`${edge.source}->${edge.target}`));
                return <path key={`source-${sourceId}`}
                  d={`M ${source.x} ${source.y} C ${source.x} ${(source.y + start.y) / 2} ${start.x} ${(source.y + start.y) / 2} ${start.x} ${start.y}`}
                  className={`edge-line edge-line--branch${hoveredNodeId && !active ? ' edge-line--dimmed' : ''}${active ? ' edge-line--active' : ''}`} />;
              })}
              {[...new Set(bundle.edges.map((edge) => edge.target))].map((targetId) => {
                const target = nodeMap.get(targetId);
                if (!target) return null;
                const active = bundle.edges.some((edge) => edge.target === targetId
                  && incidentEdgeKeys.has(`${edge.source}->${edge.target}`));
                return <path key={`target-${targetId}`}
                  d={`M ${end.x} ${end.y} C ${end.x} ${(end.y + target.y) / 2} ${target.x} ${(end.y + target.y) / 2} ${target.x} ${target.y}`}
                  className={`edge-line edge-line--branch${hoveredNodeId && !active ? ' edge-line--dimmed' : ''}${active ? ' edge-line--active' : ''}`} />;
              })}
            </g>
          );
        })}

        {(bundlePlan?.singleEdges ?? layout.edges).map((edge) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);

          if (!source || !target) {
            return null;
          }

          const edgeKey = `${edge.source}->${edge.target}`;
          const isIncident = incidentEdgeKeys.has(edgeKey);
          const isDimmed = hoveredNodeId ? !isIncident : false;

          return (
            <line
              key={edgeKey}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              className={`edge-line${isDimmed ? ' edge-line--dimmed' : ''}${isIncident ? ' edge-line--active' : ''}`}
              style={{ transition: 'all 320ms ease' }}
            />
          );
        })}

        {layout.nodes.map((node) => {
          const isHovered = hoveredNodeId === node.id;
          const isIncident = incidentNodeIds.has(node.id);
          const isDimmed = hoveredNodeId ? !isHovered && !isIncident : false;

          return (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={node.isVirtual ? 3.2 : isHovered ? 7 : 5.5}
              fill={node.isVirtual ? '#9ca3af' : palette[node.layer % palette.length]}
              className={`node-dot${isDimmed ? ' node-dot--dimmed' : ''}`}
              style={{ transition: 'all 320ms ease' }}
              filter={isHovered ? `url(#${layout.mode}-glow)` : undefined}
              onMouseEnter={node.isVirtual ? undefined : () => onHoverNode(node.id)}
              onMouseLeave={node.isVirtual ? undefined : () => onHoverNode(null)}
            />
          );
        })}
      </svg>
    </section>
  );
}
