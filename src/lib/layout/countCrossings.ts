import type { PositionedLayout } from '@/types/graph';

type Point = { x: number; y: number };

function orientation(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function sharedEndpoint(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return aStart === bStart || aStart === bEnd || aEnd === bStart || aEnd === bEnd;
}

function isProperIntersection(a1: Point, a2: Point, b1: Point, b2: Point) {
  const ab1 = orientation(a1, a2, b1);
  const ab2 = orientation(a1, a2, b2);
  const cd1 = orientation(b1, b2, a1);
  const cd2 = orientation(b1, b2, a2);

  return ab1 * ab2 < 0 && cd1 * cd2 < 0;
}

export function countCrossings(layout: PositionedLayout) {
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  let crossings = 0;

  for (let layerIndex = 0; layerIndex < layout.layers.length - 1; layerIndex += 1) {
    const edges = layout.edges.filter((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      return source?.layer === layerIndex && target?.layer === layerIndex + 1;
    });

    for (let i = 0; i < edges.length; i += 1) {
      const first = edges[i];
      const firstSource = nodeMap.get(first.source);
      const firstTarget = nodeMap.get(first.target);

      if (!firstSource || !firstTarget) {
        continue;
      }

      for (let j = i + 1; j < edges.length; j += 1) {
        const second = edges[j];
        const secondSource = nodeMap.get(second.source);
        const secondTarget = nodeMap.get(second.target);

        if (!secondSource || !secondTarget) {
          continue;
        }

        if (sharedEndpoint(first.source, first.target, second.source, second.target)) {
          continue;
        }

        if (
          isProperIntersection(
            { x: firstSource.x, y: firstSource.y },
            { x: firstTarget.x, y: firstTarget.y },
            { x: secondSource.x, y: secondSource.y },
            { x: secondTarget.x, y: secondTarget.y },
          )
        ) {
          crossings += 1;
        }
      }
    }
  }

  return crossings;
}
