/**
 * Hardware-Accelerated GIS Spline Smoothing & Organic Coastline Engine
 * Converts discrete jagged GIS polygonal coordinates into smooth, continuous
 * C2-continuous cubic spline/Bezier contours for authentic earth rendering.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface CubicBezierSegment {
  p0: Point2D;
  cp1: Point2D;
  cp2: Point2D;
  p1: Point2D;
}

/**
 * Catmull-Rom to Cubic Bezier Spline Converter
 * Converts an array of raw GIS control points into smooth cubic Bezier segments.
 *
 * @param points Raw polygonal vertex sequence
 * @param tension Curve tension factor [0.0 = sharp, 0.5 = natural Catmull-Rom, 1.0 = relaxed]
 * @param isClosed Whether the polygon forms a closed landmass boundary
 */
export function PointsToCubicSpline(
  points: Point2D[],
  tension: number = 0.5,
  isClosed: boolean = true
): CubicBezierSegment[] {
  if (points.length < 3) return [];

  const segments: CubicBezierSegment[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    if (!isClosed && i === n - 1) break;

    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    // Compute Catmull-Rom tangent vectors scaled by tension
    const cp1: Point2D = {
      x: p1.x + ((p2.x - p0.x) / 6.0) * tension,
      y: p1.y + ((p2.y - p0.y) / 6.0) * tension
    };

    const cp2: Point2D = {
      x: p2.x - ((p3.x - p1.x) / 6.0) * tension,
      y: p2.y - ((p3.y - p1.y) / 6.0) * tension
    };

    segments.push({
      p0: p1,
      cp1,
      cp2,
      p1: p2
    });
  }

  return segments;
}

/**
 * Chaikin Subdivision Smoothing Filter
 * Recursively refines vertex lines by trimming corners at 25% and 75% intervals.
 */
export function ChaikinSmooth(points: Point2D[], iterations: number = 2, isClosed: boolean = true): Point2D[] {
  if (points.length < 3) return points;

  let current = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const refined: Point2D[] = [];
    const len = current.length;

    for (let i = 0; i < len; i++) {
      if (!isClosed && i === len - 1) {
        refined.push(current[i]);
        break;
      }

      const pA = current[i];
      const pB = current[(i + 1) % len];

      // Point Q (25% along line)
      const q: Point2D = {
        x: 0.75 * pA.x + 0.25 * pB.x,
        y: 0.75 * pA.y + 0.25 * pB.y
      };

      // Point R (75% along line)
      const r: Point2D = {
        x: 0.25 * pA.x + 0.75 * pB.x,
        y: 0.25 * pA.y + 0.75 * pB.y
      };

      refined.push(q);
      refined.push(r);
    }

    current = refined;
  }

  return current;
}

/**
 * Serializes cubic spline segments into standard anti-aliased SVG path commands
 */
export function SplineToSvgPath(segments: CubicBezierSegment[], isClosed: boolean = true): string {
  if (segments.length === 0) return '';

  let d = `M ${segments[0].p0.x.toFixed(1)},${segments[0].p0.y.toFixed(1)}`;

  for (const seg of segments) {
    d += ` C ${seg.cp1.x.toFixed(1)},${seg.cp1.y.toFixed(1)} ${seg.cp2.x.toFixed(1)},${seg.cp2.y.toFixed(1)} ${seg.p1.x.toFixed(1)},${seg.p1.y.toFixed(1)}`;
  }

  if (isClosed) {
    d += ' Z';
  }

  return d;
}

/**
 * Complete Organic Coastline Generator Pipeline:
 * [Raw GIS Points] -> [Chaikin Subdivision] -> [Catmull-Rom Cubic Spline] -> [Anti-Aliased SVG Path]
 */
export function GenerateOrganicCoastlinePath(
  rawPoints: Point2D[],
  isClosed: boolean = true,
  subdivisionIterations: number = 2,
  splineTension: number = 0.6
): string {
  const smoothedPoints = ChaikinSmooth(rawPoints, subdivisionIterations, isClosed);
  const bezierSegments = PointsToCubicSpline(smoothedPoints, splineTension, isClosed);
  return SplineToSvgPath(bezierSegments, isClosed);
}
