import { DataValidationError } from "./errors";
import {
  getQrLikePlacementOrder,
  inspectQrLikeData,
  isQrLikeTimingCell,
  QR_LIKE_DEFAULT_WIDTH,
  QR_LIKE_HEADER_LENGTH,
  QR_LIKE_HEIGHT,
  QR_LIKE_MAGIC_BITS,
  qrLikeDataFromDisplayBits,
} from "./qrLike";
import type { QrLikeData } from "./types";

type Point = { x: number; y: number };
type MarkerName = "red" | "blue" | "green" | "orange";

type MarkerCandidate = {
  name: MarkerName;
  center: Point;
  area: number;
  width: number;
  height: number;
  meanScore: number;
  supportPoints: Point[];
};

type MarkerSet = Record<MarkerName, MarkerCandidate>;

type GeometryCandidate = {
  markers: MarkerSet;
  score: number;
};

type SampledMatrix = {
  luminances: number[];
  homography: number[];
};

type DecodedCandidate = {
  data: QrLikeData;
  score: number;
};

export type QrLikeMarkerName = MarkerName;

export type QrLikeMarkerDetection = Record<MarkerName, boolean>;

const MARKER_NAMES = ["red", "blue", "green", "orange"] as const;
const LOGICAL_MARKER_CENTERS: Record<MarkerName, Point> = {
  red: { x: 1.5, y: 1.5 },
  blue: { x: 23.5, y: 1.5 },
  green: { x: 23.5, y: 23.5 },
  orange: { x: 1.5, y: 23.5 },
};
const LOGICAL_OUTER_CORNERS: Record<MarkerName, Point> = {
  red: { x: 0, y: 0 },
  blue: { x: QR_LIKE_DEFAULT_WIDTH, y: 0 },
  green: { x: QR_LIKE_DEFAULT_WIDTH, y: QR_LIKE_HEIGHT },
  orange: { x: 0, y: QR_LIKE_HEIGHT },
};
const EXPECTED_HUES: Record<MarkerName, number> = {
  red: 0,
  orange: 25,
  green: 142,
  blue: 221,
};
const HUE_TOLERANCE: Record<MarkerName, number> = {
  red: 42,
  orange: 42,
  green: 68,
  blue: 62,
};
const PLACEMENT_ORDER = getQrLikePlacementOrder();
const SUPPORT_DIRECTION_COUNT = 24;
const SUPPORT_DIRECTIONS = Array.from({ length: SUPPORT_DIRECTION_COUNT }, (_, index) => {
  const angle = index / SUPPORT_DIRECTION_COUNT * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});
const CELL_SAMPLE_OFFSETS = [-0.23, 0, 0.23] as const;

function angularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
}

function markerScore(name: MarkerName, r: number, g: number, b: number): number {
  const maximum = Math.max(r, g, b) / 255;
  const minimum = Math.min(r, g, b) / 255;
  const delta = maximum - minimum;
  const saturation = maximum === 0 ? 0 : delta / maximum;
  if (maximum < 0.16 || saturation < 0.2 || delta < 0.055) return 0;

  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  let hue = 0;
  if (delta > 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  const hueScore = 1 - angularDistance(hue, EXPECTED_HUES[name]) / HUE_TOLERANCE[name];
  if (hueScore <= 0) return 0;

  let dominance = 0;
  if (name === "red") dominance = red - Math.max(green, blue) * 0.72;
  if (name === "orange") dominance = Math.min(red - blue * 0.72, green - blue * 0.55);
  if (name === "green") dominance = green - Math.max(red, blue) * 0.72;
  if (name === "blue") dominance = blue - Math.max(red, green) * 0.72;
  if (dominance <= 0.015) return 0;

  const saturationScore = Math.min(1, (saturation - 0.16) / 0.54);
  const brightnessScore = Math.min(1, maximum / 0.55);
  return hueScore * (0.35 + saturationScore * 0.65) * (0.45 + brightnessScore * 0.55);
}

function sourcePoint(x: number, y: number, stride: number, image: ImageData): Point {
  return {
    x: Math.min(image.width - 1, x * stride + stride / 2),
    y: Math.min(image.height - 1, y * stride + stride / 2),
  };
}

function findMarkerCandidates(
  image: ImageData,
  name: MarkerName,
  stride: number,
): MarkerCandidate[] {
  const sampledWidth = Math.ceil(image.width / stride);
  const sampledHeight = Math.ceil(image.height / stride);
  const pixelCount = sampledWidth * sampledHeight;
  const scores = new Uint8Array(pixelCount);
  const visited = new Uint8Array(pixelCount);

  for (let y = 0; y < sampledHeight; y += 1) {
    const sourceY = Math.min(image.height - 1, y * stride + Math.floor(stride / 2));
    for (let x = 0; x < sampledWidth; x += 1) {
      const sourceX = Math.min(image.width - 1, x * stride + Math.floor(stride / 2));
      const offset = (sourceY * image.width + sourceX) * 4;
      const score = markerScore(name, image.data[offset], image.data[offset + 1], image.data[offset + 2]);
      if (score >= 0.16) scores[y * sampledWidth + x] = Math.round(score * 255);
    }
  }

  const minimumPixels = Math.max(6, Math.floor(pixelCount * 0.000018));
  const candidates: MarkerCandidate[] = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || scores[start] === 0) continue;
    const queue = [start];
    visited[start] = 1;
    let count = 0;
    let scoreTotal = 0;
    let weightedX = 0;
    let weightedY = 0;
    let minimumX = sampledWidth;
    let minimumY = sampledHeight;
    let maximumX = 0;
    let maximumY = 0;
    const supportValues = Array<number>(SUPPORT_DIRECTION_COUNT).fill(Number.NEGATIVE_INFINITY);
    const supportPoints = Array<Point>(SUPPORT_DIRECTION_COUNT).fill({ x: 0, y: 0 });

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % sampledWidth;
      const y = Math.floor(index / sampledWidth);
      const weight = scores[index] / 255;
      count += 1;
      scoreTotal += weight;
      weightedX += x * weight;
      weightedY += y * weight;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);

      const point = sourcePoint(x, y, stride, image);
      SUPPORT_DIRECTIONS.forEach((direction, directionIndex) => {
        const projection = point.x * direction.x + point.y * direction.y;
        if (projection > supportValues[directionIndex]) {
          supportValues[directionIndex] = projection;
          supportPoints[directionIndex] = point;
        }
      });

      // Joining pixels within two sampled pixels closes anti-aliased cell seams
      // without merging the four markers, which are separated by many modules.
      for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          if (offsetX * offsetX + offsetY * offsetY > 4) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= sampledWidth || nextY < 0 || nextY >= sampledHeight) continue;
          const next = nextY * sampledWidth + nextX;
          if (visited[next] || scores[next] === 0) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
    }

    if (count < minimumPixels || scoreTotal === 0) continue;
    const componentWidth = (maximumX - minimumX + 1) * stride;
    const componentHeight = (maximumY - minimumY + 1) * stride;
    const aspectRatio = Math.max(componentWidth, componentHeight) / Math.max(stride, Math.min(componentWidth, componentHeight));
    const fillRatio = count / ((maximumX - minimumX + 1) * (maximumY - minimumY + 1));
    if (componentWidth < stride * 2 || componentHeight < stride * 2 || aspectRatio > 6.5 || fillRatio < 0.1) continue;

    candidates.push({
      name,
      center: sourcePoint(weightedX / scoreTotal, weightedY / scoreTotal, stride, image),
      area: count * stride * stride,
      width: componentWidth,
      height: componentHeight,
      meanScore: scoreTotal / count,
      supportPoints,
    });
  }

  return candidates
    .sort((left, right) => {
      const leftRank = left.meanScore * Math.sqrt(left.area);
      const rightRank = right.meanScore * Math.sqrt(right.area);
      return rightRank - leftRank;
    })
    .slice(0, 7);
}

function signedPolygonArea(points: Point[]): number {
  return points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - point.y * next.x;
  }, 0) / 2;
}

function cross(origin: Point, left: Point, right: Point): number {
  return (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function geometryScore(markers: MarkerSet, image: ImageData): number | null {
  const points = MARKER_NAMES.map((name) => markers[name].center);
  const turns = points.map((point, index) => cross(point, points[(index + 1) % 4], points[(index + 2) % 4]));
  if (turns.some((turn) => Math.abs(turn) < 1) || !turns.every((turn) => Math.sign(turn) === Math.sign(turns[0]))) return null;

  const sides = points.map((point, index) => distance(point, points[(index + 1) % 4]));
  const minimumSide = Math.min(...sides);
  const maximumSide = Math.max(...sides);
  if (minimumSide < 24 || maximumSide / minimumSide > 8) return null;

  const polygonArea = Math.abs(signedPolygonArea(points));
  const frameArea = image.width * image.height;
  if (polygonArea < frameArea * 0.0025 || polygonArea > frameArea * 1.05) return null;

  const markerAreas = MARKER_NAMES.map((name) => markers[name].area);
  const minimumMarkerArea = Math.min(...markerAreas);
  const maximumMarkerArea = Math.max(...markerAreas);
  if (maximumMarkerArea / minimumMarkerArea > 14) return null;

  const totalMarkerArea = markerAreas.reduce((total, area) => total + area, 0);
  const expectedAreaRatio = 36 / (22 * 22);
  const areaRatio = totalMarkerArea / polygonArea;
  const areaPenalty = Math.abs(Math.log(Math.max(0.001, areaRatio) / expectedAreaRatio));
  const sizePenalty = Math.log(maximumSide / minimumSide);
  const markerQuality = MARKER_NAMES.reduce((total, name) => total + markers[name].meanScore, 0);
  const coverageBonus = Math.min(2.5, Math.sqrt(polygonArea / frameArea) * 4);
  return markerQuality * 3 + coverageBonus - areaPenalty * 1.4 - sizePenalty * 0.8;
}

function findMarkerGeometries(
  image: ImageData,
): { geometries: GeometryCandidate[]; detected: QrLikeMarkerDetection; stride: number } {
  const stride = Math.max(1, Math.ceil(Math.max(image.width, image.height) / 640));
  const byName = Object.fromEntries(
    MARKER_NAMES.map((name) => [name, findMarkerCandidates(image, name, stride)]),
  ) as Record<MarkerName, MarkerCandidate[]>;
  const detected = Object.fromEntries(
    MARKER_NAMES.map((name) => [name, byName[name].length > 0]),
  ) as QrLikeMarkerDetection;

  if (MARKER_NAMES.some((name) => byName[name].length === 0)) {
    return { geometries: [], detected, stride };
  }

  const geometries: GeometryCandidate[] = [];
  for (const red of byName.red) {
    for (const blue of byName.blue) {
      for (const green of byName.green) {
        for (const orange of byName.orange) {
          const markers = { red, blue, green, orange };
          const centers = MARKER_NAMES.map((name) => markers[name].center);
          let duplicate = false;
          for (let left = 0; left < centers.length; left += 1) {
            for (let right = left + 1; right < centers.length; right += 1) {
              if (distance(centers[left], centers[right]) < 12) duplicate = true;
            }
          }
          if (duplicate) continue;
          const score = geometryScore(markers, image);
          if (score !== null) geometries.push({ markers, score });
        }
      }
    }
  }

  geometries.sort((left, right) => right.score - left.score);
  return { geometries: geometries.slice(0, 24), detected, stride };
}

function solveLinear(matrix: number[][], values: number[]): number[] {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    if (Math.abs(rows[column][column]) < 1e-9) {
      throw new DataValidationError("INVALID_QR_DATA", "Marker geometry is unstable.", { stage: "geometry" });
    }
    const divisor = rows[column][column];
    for (let item = column; item <= size; item += 1) rows[column][item] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let item = column; item <= size; item += 1) rows[row][item] -= factor * rows[column][item];
    }
  }
  return rows.map((row) => row[size]);
}

function homography(source: Record<MarkerName, Point>, destination: Record<MarkerName, Point>): number[] {
  const matrix: number[][] = [];
  const values: number[] = [];
  for (const name of MARKER_NAMES) {
    const { x, y } = source[name];
    const { x: u, y: v } = destination[name];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  return solveLinear(matrix, values);
}

function project(transform: number[], point: Point): Point {
  const divisor = transform[6] * point.x + transform[7] * point.y + 1;
  return {
    x: (transform[0] * point.x + transform[1] * point.y + transform[2]) / divisor,
    y: (transform[3] * point.x + transform[4] * point.y + transform[5]) / divisor,
  };
}

function bilinearLuminance(image: ImageData, point: Point): number {
  const x = Math.max(0, Math.min(image.width - 1.001, point.x));
  const y = Math.max(0, Math.min(image.height - 1.001, point.y));
  const left = Math.floor(x);
  const top = Math.floor(y);
  const right = Math.min(image.width - 1, left + 1);
  const bottom = Math.min(image.height - 1, top + 1);
  const fractionX = x - left;
  const fractionY = y - top;

  const at = (sampleX: number, sampleY: number) => {
    const offset = (sampleY * image.width + sampleX) * 4;
    return image.data[offset] * 0.2126 + image.data[offset + 1] * 0.7152 + image.data[offset + 2] * 0.0722;
  };
  const upper = at(left, top) * (1 - fractionX) + at(right, top) * fractionX;
  const lower = at(left, bottom) * (1 - fractionX) + at(right, bottom) * fractionX;
  return upper * (1 - fractionY) + lower * fractionY;
}

function sampleMatrix(image: ImageData, transform: number[]): SampledMatrix | null {
  const outsideMargin = Math.max(image.width, image.height) * 0.035;
  const corners = [
    project(transform, { x: 0, y: 0 }),
    project(transform, { x: QR_LIKE_DEFAULT_WIDTH, y: 0 }),
    project(transform, { x: QR_LIKE_DEFAULT_WIDTH, y: QR_LIKE_HEIGHT }),
    project(transform, { x: 0, y: QR_LIKE_HEIGHT }),
  ];
  if (corners.some((point) =>
    !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
    point.x < -outsideMargin || point.x > image.width + outsideMargin ||
    point.y < -outsideMargin || point.y > image.height + outsideMargin
  )) return null;

  const luminances: number[] = [];
  for (let row = 0; row < QR_LIKE_HEIGHT; row += 1) {
    for (let column = 0; column < QR_LIKE_DEFAULT_WIDTH; column += 1) {
      const samples: number[] = [];
      for (const offsetY of CELL_SAMPLE_OFFSETS) {
        for (const offsetX of CELL_SAMPLE_OFFSETS) {
          samples.push(bilinearLuminance(image, project(transform, {
            x: column + 0.5 + offsetX,
            y: row + 0.5 + offsetY,
          })));
        }
      }
      samples.sort((left, right) => left - right);
      luminances.push(samples[Math.floor(samples.length / 2)]);
    }
  }
  return { luminances, homography: transform };
}

function kMeansCenters(values: number[]): { dark: number; light: number } {
  const sorted = [...values].sort((left, right) => left - right);
  let dark = sorted[Math.floor(sorted.length * 0.12)];
  let light = sorted[Math.floor(sorted.length * 0.88)];
  for (let iteration = 0; iteration < 12; iteration += 1) {
    let darkTotal = 0;
    let darkCount = 0;
    let lightTotal = 0;
    let lightCount = 0;
    for (const value of values) {
      if (Math.abs(value - dark) <= Math.abs(value - light)) {
        darkTotal += value;
        darkCount += 1;
      } else {
        lightTotal += value;
        lightCount += 1;
      }
    }
    if (darkCount) dark = darkTotal / darkCount;
    if (lightCount) light = lightTotal / lightCount;
  }
  return dark <= light ? { dark, light } : { dark: light, light: dark };
}

function otsuThreshold(values: number[]): number {
  const histogram = Array<number>(256).fill(0);
  values.forEach((value) => { histogram[Math.max(0, Math.min(255, Math.round(value)))] += 1; });
  const total = values.length;
  const totalIntensity = histogram.reduce((sum, count, intensity) => sum + count * intensity, 0);
  let backgroundCount = 0;
  let backgroundIntensity = 0;
  let bestVariance = -1;
  let bestThreshold = 127;
  for (let threshold = 0; threshold < 255; threshold += 1) {
    backgroundCount += histogram[threshold];
    backgroundIntensity += histogram[threshold] * threshold;
    if (backgroundCount === 0 || backgroundCount === total) continue;
    const foregroundCount = total - backgroundCount;
    const backgroundMean = backgroundIntensity / backgroundCount;
    const foregroundMean = (totalIntensity - backgroundIntensity) / foregroundCount;
    const variance = backgroundCount * foregroundCount * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = threshold;
    }
  }
  return bestThreshold;
}

function expectedTimingBit(column: number, row: number): "0" | "1" {
  const offset = row === 3 ? column - 3 : row - 3;
  return offset % 2 === 0 ? "1" : "0";
}

function structuralErrors(displayBits: string, data: QrLikeData): {
  timing: number;
  dummy: number;
  parity: number;
} {
  let timing = 0;
  for (let row = 0; row < QR_LIKE_HEIGHT; row += 1) {
    for (let column = 0; column < QR_LIKE_DEFAULT_WIDTH; column += 1) {
      if (!isQrLikeTimingCell(column, row)) continue;
      if (displayBits[row * QR_LIKE_DEFAULT_WIDTH + column] !== expectedTimingBit(column, row)) timing += 1;
    }
  }

  const inspection = inspectQrLikeData(data);
  let dummy = 0;
  for (let payloadIndex = inspection.header.payloadLength; payloadIndex < 512; payloadIndex += 1) {
    const cellIndex = PLACEMENT_ORDER[QR_LIKE_HEADER_LENGTH + payloadIndex];
    const row = Math.floor(cellIndex / QR_LIKE_DEFAULT_WIDTH);
    const column = cellIndex % QR_LIKE_DEFAULT_WIDTH;
    const expected = (row + column) % 2 === 0 ? "1" : "0";
    if (displayBits[cellIndex] !== expected) dummy += 1;
  }
  return { timing, dummy, parity: inspection.invalidEntryIndices.length };
}

function classifyMatrix(sampled: SampledMatrix): DecodedCandidate[] {
  const thresholdValues = sampled.luminances.filter((_, index) => {
    const row = Math.floor(index / QR_LIKE_DEFAULT_WIDTH);
    const column = index % QR_LIKE_DEFAULT_WIDTH;
    return !((column < 3 || column >= 22) && (row < 3 || row >= 22));
  });
  const { dark, light } = kMeansCenters(thresholdValues);
  if (light - dark < 24) return [];

  const midpoint = (dark + light) / 2;
  const range = light - dark;
  const thresholds = [
    midpoint,
    otsuThreshold(thresholdValues),
    dark + range * 0.4,
    dark + range * 0.46,
    dark + range * 0.54,
    dark + range * 0.6,
  ].filter((value, index, all) => all.findIndex((other) => Math.abs(other - value) < 1.5) === index);

  const decoded: DecodedCandidate[] = [];
  for (const threshold of thresholds) {
    const cells = sampled.luminances.map((value) => value < threshold ? "1" : "0");

    // The fixed magic prefix is also a registration pattern. Restoring only
    // these known cells makes the scan tolerant of a small reflection crossing
    // the header while checksum validation still protects all variable fields.
    for (let bitIndex = 0; bitIndex < QR_LIKE_MAGIC_BITS.length; bitIndex += 1) {
      cells[PLACEMENT_ORDER[bitIndex]] = QR_LIKE_MAGIC_BITS[bitIndex] as "0" | "1";
    }
    const displayBits = cells.join("");

    try {
      const data = qrLikeDataFromDisplayBits(displayBits);
      const errors = structuralErrors(displayBits, data);
      const dummyCount = 512 - inspectQrLikeData(data).header.payloadLength;
      if (dummyCount > 40 && errors.dummy > Math.max(18, dummyCount * 0.22)) continue;
      const confidence = thresholdValues.reduce(
        (total, value) => total + Math.min(1, Math.abs(value - threshold) / Math.max(1, range / 2)),
        0,
      ) / thresholdValues.length;
      decoded.push({
        data,
        score: errors.timing * 30 + errors.dummy + errors.parity * 8 - confidence * 4,
      });
    } catch {
      // Other thresholds and geometric candidates are tried below.
    }
  }
  return decoded;
}

function supportPoint(candidate: MarkerCandidate, direction: Point): Point {
  return candidate.supportPoints.reduce((best, point) => {
    const projection = point.x * direction.x + point.y * direction.y;
    const bestProjection = best.x * direction.x + best.y * direction.y;
    return projection > bestProjection ? point : best;
  });
}

function transformsForGeometry(geometry: GeometryCandidate, stride: number): number[][] {
  const center = MARKER_NAMES.reduce(
    (total, name) => ({
      x: total.x + geometry.markers[name].center.x / 4,
      y: total.y + geometry.markers[name].center.y / 4,
    }),
    { x: 0, y: 0 },
  );
  const outerPoints = Object.fromEntries(MARKER_NAMES.map((name) => {
    const marker = geometry.markers[name];
    const length = Math.max(1, distance(marker.center, center));
    const direction = {
      x: (marker.center.x - center.x) / length,
      y: (marker.center.y - center.y) / length,
    };
    const point = supportPoint(marker, direction);
    return [name, {
      x: point.x + direction.x * stride * 0.5,
      y: point.y + direction.y * stride * 0.5,
    }];
  })) as Record<MarkerName, Point>;
  const centers = Object.fromEntries(
    MARKER_NAMES.map((name) => [name, geometry.markers[name].center]),
  ) as Record<MarkerName, Point>;

  const transforms: number[][] = [];
  try {
    transforms.push(homography(LOGICAL_OUTER_CORNERS, outerPoints));
  } catch {
    // The marker-center transform can still be stable.
  }
  try {
    transforms.push(homography(LOGICAL_MARKER_CENTERS, centers));
  } catch {
    // This geometry is discarded if both transforms are unstable.
  }
  return transforms;
}

function markerError(
  detected: QrLikeMarkerDetection,
  technicalMessage: string,
  stage: "markers" | "geometry" | "decode",
): DataValidationError {
  const detectedMarkers = MARKER_NAMES.filter((name) => detected[name]);
  const missingMarkers = MARKER_NAMES.filter((name) => !detected[name]);
  return new DataValidationError("INVALID_QR_DATA", technicalMessage, {
    stage,
    detectedMarkers,
    missingMarkers,
    marker: missingMarkers[0],
  });
}

/**
 * Reads the fixed 25 x 25 QR-like symbol from a camera frame.
 *
 * Detection is intentionally independent of screen orientation: it finds
 * several candidates for every color, selects a convex four-marker geometry,
 * rectifies it with a homography, and accepts it only after the timing, header,
 * parity and dummy-cell structures have been scored.
 */
export function scanQrLikeImage(image: ImageData): QrLikeData {
  if (!image || image.width < 80 || image.height < 80 || image.data.length !== image.width * image.height * 4) {
    throw new DataValidationError("INVALID_QR_DATA", "Camera frame is too small.", { stage: "capture" });
  }

  const { geometries, detected, stride } = findMarkerGeometries(image);
  if (MARKER_NAMES.some((name) => !detected[name])) {
    throw markerError(detected, "One or more color markers were not found.", "markers");
  }
  if (geometries.length === 0) {
    throw markerError(detected, "Color markers did not form a valid quadrilateral.", "geometry");
  }

  const decoded: DecodedCandidate[] = [];
  for (const geometry of geometries) {
    for (const transform of transformsForGeometry(geometry, stride)) {
      const sampled = sampleMatrix(image, transform);
      if (sampled) decoded.push(...classifyMatrix(sampled));
    }
  }
  decoded.sort((left, right) => left.score - right.score);
  if (decoded.length === 0) {
    throw markerError(detected, "Markers were found, but the matrix structure did not validate.", "decode");
  }
  return decoded[0].data;
}
