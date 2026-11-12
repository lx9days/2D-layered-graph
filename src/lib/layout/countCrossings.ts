import type { EdgeRoute, EdgeRoutePoint, GraphNode, PositionedLayout } from '@/types/graph';

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

function pointsEqual(left: EdgeRoutePoint, right: EdgeRoutePoint) {
  return left.x === right.x && left.y === right.y;
}

function buildFallbackRoutes(layout: PositionedLayout) {
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  return layout.edges.flatMap((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target) {
      return [];
    }

    return [{
      source: edge.source,
      target: edge.target,
      points: [
        { x: source.x, y: source.y, layer: source.layer, nodeId: source.id },
        { x: target.x, y: target.y, layer: target.layer, nodeId: target.id },
      ],
    }] satisfies EdgeRoute[];
  });
}

function getRoutes(layout: PositionedLayout) {
  return layout.edgeRoutes ?? buildFallbackRoutes(layout);
}

function routeLength(points: EdgeRoutePoint[]) {
  let length = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    length += Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].y - points[index].y,
    );
  }

  return length;
}

function getNodeBacktracking(node: GraphNode, boxesByLayer: Map<number, PositionedLayout['boxes'][number]>) {
  const box = boxesByLayer.get(node.logicalLayer ?? node.layer);

  if (!box || box.height <= 0) {
    return 0;
  }

  return (node.y - box.y) / box.height;
}

export function countCrossings(layout: PositionedLayout) {
  const routes = getRoutes(layout);
  let crossings = 0;

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const first = routes[routeIndex];

    for (let otherIndex = routeIndex + 1; otherIndex < routes.length; otherIndex += 1) {
      const second = routes[otherIndex];

      if (sharedEndpoint(first.source, first.target, second.source, second.target)) {
        continue;
      }

      let counted = false;

      for (let firstSegment = 0; firstSegment < first.points.length - 1 && !counted; firstSegment += 1) {
        const firstStart = first.points[firstSegment];
        const firstEnd = first.points[firstSegment + 1];

        for (let secondSegment = 0; secondSegment < second.points.length - 1; secondSegment += 1) {
          const secondStart = second.points[secondSegment];
          const secondEnd = second.points[secondSegment + 1];

          if (
            pointsEqual(firstStart, secondStart) ||
            pointsEqual(firstStart, secondEnd) ||
            pointsEqual(firstEnd, secondStart) ||
            pointsEqual(firstEnd, secondEnd)
          ) {
            continue;
          }

          if (
            isProperIntersection(
              { x: firstStart.x, y: firstStart.y },
              { x: firstEnd.x, y: firstEnd.y },
              { x: secondStart.x, y: secondStart.y },
              { x: secondEnd.x, y: secondEnd.y },
            )
          ) {
            crossings += 1;
            counted = true;
            break;
          }
        }
      }
    }
  }

  return crossings;
}

export function totalEdgeLength(layout: PositionedLayout) {
  return getRoutes(layout).reduce((sum, route) => sum + routeLength(route.points), 0);
}

export function countBacktracking(layout: PositionedLayout) {
  const boxesByLayer = new Map(layout.boxes.map((box) => [box.layer, box]));
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

  return (layout.originalEdges ?? layout.edges).reduce((sum, edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target) {
      return sum;
    }

    const sourceOffset = getNodeBacktracking(source, boxesByLayer);
    const targetOffset = getNodeBacktracking(target, boxesByLayer);
    return sum + Math.max(0, sourceOffset - targetOffset);
  }, 0);
}
