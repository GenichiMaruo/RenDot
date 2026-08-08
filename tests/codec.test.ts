import { describe, expect, it } from "vitest";

import {
  buildQrLikeHeader,
  buildQrLikeData,
  calculateEvenParity,
  COLOR_MODES,
  decodeEntry,
  decodeLength,
  decodeQrLikeData,
  decodeRunLength,
  encodeColor,
  encodeEntry,
  encodeLength,
  encodeRunLength,
  flattenGrid,
  flipBit,
  flipQrLikeBit,
  getQrLikeCellInfo,
  getQrLikePlacementOrder,
  inspectEncodedEntry,
  inspectQrLikeData,
  parseQrLikeHeader,
  qrLikeDataFromDisplayBits,
  QR_LIKE_DEFAULT_WIDTH,
  QR_LIKE_HEADER_LENGTH,
  QR_LIKE_HEIGHT,
  restorePixelGrid,
  restoreQrLikeArtwork,
  scanQrLikeImage,
  SAMPLE_PATTERNS,
} from "../src/lib";
import type { ColorId, PixelGrid, QrLikeData } from "../src/lib";

function alternatingPixels(): ColorId[] {
  return Array.from({ length: 64 }, (_, index) => (index % 8) as ColorId);
}

const placementOrder = getQrLikePlacementOrder();
const headerCell = (headerIndex: number) => placementOrder[headerIndex];
const payloadCell = (payloadIndex: number) =>
  placementOrder[QR_LIKE_HEADER_LENGTH + payloadIndex];

function invertMatrix3(matrix: readonly number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    (e * i - f * h) / determinant,
    (c * h - b * i) / determinant,
    (b * f - c * e) / determinant,
    (f * g - d * i) / determinant,
    (a * i - c * g) / determinant,
    (c * d - a * f) / determinant,
    (d * h - e * g) / determinant,
    (b * g - a * h) / determinant,
    (a * e - b * d) / determinant,
  ];
}

function transformPoint(matrix: readonly number[], x: number, y: number) {
  const divisor = matrix[6] * x + matrix[7] * y + matrix[8];
  return {
    x: (matrix[0] * x + matrix[1] * y + matrix[2]) / divisor,
    y: (matrix[3] * x + matrix[4] * y + matrix[5]) / divisor,
  };
}

function renderTransformedQr(
  data: QrLikeData,
  matrix: readonly number[],
  brightness = 1,
  markerSeams = false,
): ImageData {
  const width = 280;
  const height = 280;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const inverse = invertMatrix3(matrix);
  const markerColors = {
    red: [239, 68, 68],
    blue: [37, 99, 235],
    green: [34, 197, 94],
    orange: [249, 115, 22],
  } as const;

  for (let imageY = 0; imageY < height; imageY += 1) {
    for (let imageX = 0; imageX < width; imageX += 1) {
      const logical = transformPoint(inverse, imageX + 0.5, imageY + 0.5);
      let rgb: readonly [number, number, number] = [220, 224, 232];
      if (logical.x >= 0 && logical.x < 25 && logical.y >= 0 && logical.y < 25) {
        const column = Math.floor(logical.x);
        const row = Math.floor(logical.y);
        const marker =
          column < 3 && row < 3
            ? "red"
            : column >= 22 && row < 3
              ? "blue"
              : column >= 22 && row >= 22
                ? "green"
                : column < 3 && row >= 22
                  ? "orange"
                  : null;
        const fractionX = logical.x - column;
        const fractionY = logical.y - row;
        const isMarkerSeam = markerSeams && marker && (
          fractionX < 0.12 || fractionX > 0.88 || fractionY < 0.12 || fractionY > 0.88
        );
        rgb = marker
          ? isMarkerSeam ? [125, 132, 145] : markerColors[marker]
          : data.displayBits[row * 25 + column] === "1"
            ? [8, 10, 14]
            : [246, 248, 252];
      }
      const offset = (imageY * width + imageX) * 4;
      pixels.set(rgb.map((channel) => Math.round(channel * brightness)).concat(255), offset);
    }
  }
  return { data: pixels, width, height, colorSpace: "srgb" } as ImageData;
}

function paintRectangle(
  image: ImageData,
  left: number,
  top: number,
  width: number,
  height: number,
  color: readonly [number, number, number],
): void {
  for (let y = top; y < Math.min(image.height, top + height); y += 1) {
    for (let x = left; x < Math.min(image.width, left + width); x += 1) {
      const offset = (y * image.width + x) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
    }
  }
}

function addColoredDistractors(image: ImageData): ImageData {
  paintRectangle(image, 2, 88, 17, 62, [239, 68, 68]);
  paintRectangle(image, 240, 4, 36, 30, [37, 99, 235]);
  paintRectangle(image, 245, 105, 30, 44, [34, 197, 94]);
  paintRectangle(image, 1, 242, 27, 34, [249, 115, 22]);
  return image;
}

function addCameraArtifacts(image: ImageData): ImageData {
  const source = new Uint8ClampedArray(image.data);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      const light = 0.56 + x / image.width * 0.48;
      const glareDistance = Math.hypot(x - image.width * 0.67, y - image.height * 0.28);
      const glare = Math.max(0, 26 - glareDistance * 0.32);
      const noise = (x * 17 + y * 31) % 9 - 4;
      const neighbors: Array<[number, number]> = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
      const channels = [0, 1, 2].map((channel) => {
        const blurred = neighbors.reduce((total, [offsetX, offsetY]) => {
          const sampleX = Math.max(0, Math.min(image.width - 1, x + offsetX));
          const sampleY = Math.max(0, Math.min(image.height - 1, y + offsetY));
          return total + source[(sampleY * image.width + sampleX) * 4 + channel];
        }, 0) / neighbors.length;
        const cast = channel === 0 ? 1.05 : channel === 2 ? 0.9 : 1;
        return Math.max(0, Math.min(255, blurred * light * cast + glare + noise));
      });
      image.data[offset] = channels[0];
      image.data[offset + 1] = channels[1];
      image.data[offset + 2] = channels[2];
    }
  }
  return image;
}

describe("run-length encoding", () => {
  it("splits 64 white pixels into eight 3-bit runs", () => {
    expect(encodeRunLength(Array<ColorId>(64).fill(0))).toEqual(
      Array.from({ length: 8 }, () => ({ length: 8, color: 0 })),
    );
  });

  it("creates the maximum 64 runs when every neighboring color changes", () => {
    const entries = encodeRunLength(alternatingPixels());
    expect(entries).toHaveLength(64);
    expect(entries.every((entry) => entry.length === 1)).toBe(true);
  });

  it("round-trips an image through compression and expansion", () => {
    const pixels = flattenGrid(SAMPLE_PATTERNS[0].grid);
    expect(decodeRunLength(encodeRunLength(pixels))).toEqual(pixels);
  });

  it("keeps a run going across an 8-pixel row boundary", () => {
    const grid: PixelGrid = [
      [1, 1, 1, 1, 1, 1, 1, 2],
      [2, 2, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ];
    expect(encodeRunLength(flattenGrid(grid)).slice(0, 2)).toEqual([
      { length: 7, color: 1 },
      { length: 3, color: 2 },
    ]);
  });

  it("rejects abnormal data that expands beyond 64 pixels", () => {
    expect(() =>
      decodeRunLength([
        ...Array.from({ length: 8 }, () => ({ length: 8, color: 0 as ColorId })),
        { length: 1, color: 1 },
      ]),
    ).toThrow();
  });
});

describe("fixed-width binary values", () => {
  it("stores a real length of 1 as 001", () => {
    expect(encodeLength(1)).toBe("001");
    expect(decodeLength("001")).toBe(1);
  });

  it("uses 000 for a real length of 8", () => {
    expect(encodeLength(8)).toBe("000");
    expect(decodeLength("000")).toBe(8);
  });

  it("encodes color ids 0 through 7 in three bits", () => {
    expect(
      Array.from({ length: 8 }, (_, color) => encodeColor(color as ColorId)),
    ).toEqual(["000", "001", "010", "011", "100", "101", "110", "111"]);
  });
});

describe("even parity", () => {
  it("calculates even parity for three-bit blocks", () => {
    expect(calculateEvenParity("101")).toBe(0);
    expect(calculateEvenParity("100")).toBe(1);
    expect(calculateEvenParity("111")).toBe(1);
  });

  it("detects a one-bit data error in the correct block", () => {
    const encoded = encodeEntry({ length: 5, color: 3 });
    const corrupted = flipBit(encoded.bits, 5);
    const inspection = inspectEncodedEntry(corrupted);
    expect(inspection.isValid).toBe(false);
    expect(inspection.invalidBlocks).toEqual(["color"]);
    expect(() => decodeEntry(corrupted)).toThrow();
  });
});

describe("QR-like format", () => {
  const sourceGrid = SAMPLE_PATTERNS.find((sample) => sample.id === "fish")!
    .grid;
  const sourceEntries = encodeRunLength(flattenGrid(sourceGrid));

  it("keeps the original header bit-for-bit and reads it as colorful", () => {
    const legacyHeader = "0101001001000100000111000100000010010001";
    const parsed = parseQrLikeHeader(legacyHeader);

    expect(buildQrLikeHeader(8, 64).bits).toBe(legacyHeader);
    expect(parsed).toMatchObject({
      colorMode: "colorful",
      colorModeCode: 0,
      colorModeBits: "00",
      packedPayloadLength: 64,
      payloadLength: 64,
      runCount: 8,
    });
  });

  it.each(COLOR_MODES)("round-trips the $name color mode in two spare header bits", (mode) => {
    const header = buildQrLikeHeader(8, 64, { colorMode: mode.id });
    const parsed = parseQrLikeHeader(header.bits);

    expect(header.packedPayloadLength).toBe(64 | mode.code);
    expect(header.colorModeBits).toBe(mode.bits);
    expect(parsed).toMatchObject({
      colorMode: mode.id,
      colorModeCode: mode.code,
      colorModeBits: mode.bits,
      payloadLength: 64,
      packedPayloadLength: 64 | mode.code,
    });
  });

  it.each(COLOR_MODES)("restores the same grid with the $name palette attached", (mode) => {
    const data = buildQrLikeData(sourceEntries, { colorMode: mode.id });

    expect(restoreQrLikeArtwork(data)).toEqual({
      grid: sourceGrid,
      colorMode: mode.id,
    });
    expect(inspectQrLikeData(qrLikeDataFromDisplayBits(data.displayBits)).header.colorMode)
      .toBe(mode.id);
  });

  it("keeps the color mode at the full 512-bit payload capacity", () => {
    const entries = encodeRunLength(alternatingPixels());
    const data = buildQrLikeData(entries, { colorMode: "sunset" });

    expect(inspectQrLikeData(data).header).toMatchObject({
      colorMode: "sunset",
      packedPayloadLength: 515,
      payloadLength: 512,
      runCount: 64,
    });
    expect(decodeQrLikeData(data)).toEqual(entries);
  });

  it("round-trips run-length entries through QR-like data", () => {
    const data = buildQrLikeData(sourceEntries);
    expect(decodeQrLikeData(data)).toEqual(sourceEntries);
  });

  it("restores the final 8 by 8 image exactly", () => {
    const data = buildQrLikeData(sourceEntries);
    expect(restorePixelGrid(data)).toEqual(sourceGrid);
  });

  it("rejects a header with an invalid magic value", () => {
    const data = buildQrLikeData(sourceEntries);
    const corrupted = flipQrLikeBit(data, headerCell(0));
    expect(() => decodeQrLikeData(corrupted)).toThrow();
  });

  it("detects a changed color-mode bit through the header CRC", () => {
    const data = buildQrLikeData(sourceEntries, { colorMode: "grayscale" });
    expect(() => decodeQrLikeData(flipQrLikeBit(data, headerCell(30)))).toThrow();
  });

  it.each([
    ["magic", 0],
    ["run count", 16],
    ["payload length", 22],
    ["checksum", 32],
  ])("rejects a single-bit change in the %s header field", (_field, index) => {
    const data = buildQrLikeData(sourceEntries);
    expect(() => decodeQrLikeData(flipQrLikeBit(data, headerCell(index)))).toThrow();
  });

  it("maps a payload cell to its run and parity block", () => {
    const data = buildQrLikeData(sourceEntries);
    const index = payloadCell(5);
    expect(getQrLikeCellInfo(data, index)).toMatchObject({
      region: "payload",
      entryIndex: 0,
      entryBitIndex: 5,
      block: "color",
      bitRole: "data",
    });
  });

  it("detects a flipped QR-like payload bit and can undo it", () => {
    const original = buildQrLikeData(sourceEntries);
    const index = payloadCell(4);
    const corrupted = flipQrLikeBit(original, index);
    expect(inspectQrLikeData(corrupted)).toMatchObject({
      isParityValid: false,
      invalidEntryIndices: [0],
      parityIssues: [{ entryIndex: 0, block: "color" }],
    });
    expect(flipQrLikeBit(corrupted, index)).toEqual(original);
  });

  it("reports every damaged run and whether its length or color parity failed", () => {
    const original = buildQrLikeData(sourceEntries);
    const damagedLength = flipQrLikeBit(original, payloadCell(0));
    const damagedLengthAndColor = flipQrLikeBit(damagedLength, payloadCell(2 * 8 + 4));

    expect(inspectQrLikeData(damagedLengthAndColor).parityIssues).toEqual([
      { entryIndex: 0, block: "length" },
      { entryIndex: 2, block: "color" },
    ]);
  });

  it("fills a 25 x 25 matrix with no unused cells", () => {
    const data = buildQrLikeData(Array.from({ length: 8 }, () => ({ length: 8, color: 0 as ColorId })));
    expect(data.fullBits).toHaveLength(QR_LIKE_HEADER_LENGTH + 512);
    expect(data.displayBits).toHaveLength(QR_LIKE_DEFAULT_WIDTH * QR_LIKE_HEIGHT);
    const counts = Array.from({ length: 625 }, (_, index) => getQrLikeCellInfo(data, index).region)
      .reduce<Record<string, number>>((total, region) => ({ ...total, [region]: (total[region] ?? 0) + 1 }), {});
    expect(counts).toEqual({ marker: 36, timing: 37, header: 40, payload: 64, dummy: 448 });
    expect(getQrLikeCellInfo(data, 3 * 25 + 3).region).toBe("timing");
    expect(() => flipQrLikeBit(data, 0)).toThrow();
  });

  it("renders every dummy module as a physical checkerboard", () => {
    const data = buildQrLikeData(Array.from({ length: 8 }, () => ({ length: 8, color: 0 as ColorId })));
    const dummyCells = Array.from({ length: 625 }, (_, index) => getQrLikeCellInfo(data, index))
      .filter((cell) => cell.region === "dummy");
    expect(dummyCells).toHaveLength(448);
    for (const cell of dummyCells) {
      expect(cell.bit).toBe((cell.row + cell.column) % 2 === 0 ? 1 : 0);
      expect(cell.payloadIndex).toBeGreaterThanOrEqual(64);
      expect(cell.placementNumber).toBe((cell.payloadIndex ?? 0) + 41);
    }
  });

  it("lets a dummy cell be flipped without changing parity or the restored image", () => {
    const entries = Array.from({ length: 8 }, () => ({ length: 8, color: 0 as ColorId }));
    const original = buildQrLikeData(entries);
    const dummyIndex = payloadCell(64);
    const originalCell = getQrLikeCellInfo(original, dummyIndex);

    expect(originalCell.region).toBe("dummy");
    const flipped = flipQrLikeBit(original, dummyIndex);
    expect(getQrLikeCellInfo(flipped, dummyIndex)).toMatchObject({
      region: "dummy",
      bit: originalCell.bit === 1 ? 0 : 1,
    });
    expect(flipped.payloadBits[64]).not.toBe(original.payloadBits[64]);
    expect(inspectQrLikeData(flipped)).toMatchObject({
      isParityValid: true,
      decodedPixelCount: 64,
    });
    expect(restorePixelGrid(flipped)).toEqual(
      Array.from({ length: 8 }, () => Array<ColorId>(8).fill(0)),
    );
    expect(flipQrLikeBit(flipped, dummyIndex)).toEqual(original);
  });

  it("force-restores the first 64 pixels and discards length-bit overflow", () => {
    const entries = encodeRunLength(alternatingPixels());
    const original = buildQrLikeData(entries);
    const corrupted = flipQrLikeBit(original, payloadCell(0));
    const inspection = inspectQrLikeData(corrupted);

    expect(inspection).toMatchObject({
      decodedPixelCount: 68,
      parityIssues: [{ entryIndex: 0, block: "length" }],
    });
    expect(() => restorePixelGrid(corrupted, { validateParity: false })).toThrow();

    const restored = restorePixelGrid(corrupted, {
      validateParity: false,
      truncateOverflow: true,
    });
    expect(flattenGrid(restored)).toEqual([
      ...Array<ColorId>(5).fill(0),
      ...alternatingPixels().slice(1, 60),
    ]);
  });

  it("detects and truncates overflow even when two changed length bits pass parity", () => {
    const original = buildQrLikeData(encodeRunLength(alternatingPixels()));
    const firstFlip = flipQrLikeBit(original, payloadCell(0));
    const corrupted = flipQrLikeBit(firstFlip, payloadCell(1));
    const inspection = inspectQrLikeData(corrupted);

    expect(inspection).toMatchObject({
      isParityValid: true,
      parityIssues: [],
      decodedPixelCount: 70,
    });
    expect(() => restorePixelGrid(corrupted)).toThrow();
    expect(
      flattenGrid(restorePixelGrid(corrupted, { truncateOverflow: true })),
    ).toHaveLength(64);
  });

  it("keeps a decoded pixel shortage as an error during forced restoration", () => {
    const entries = Array.from({ length: 8 }, () => ({ length: 8, color: 0 as ColorId }));
    const original = buildQrLikeData(entries);
    const corrupted = flipQrLikeBit(original, payloadCell(0));

    expect(inspectQrLikeData(corrupted).decodedPixelCount).toBe(60);
    expect(() =>
      restorePixelGrid(corrupted, {
        validateParity: false,
        truncateOverflow: true,
      }),
    ).toThrow();
  });

  it("rebuilds data from the fixed sampled matrix", () => {
    const original = buildQrLikeData(sourceEntries);
    expect(qrLikeDataFromDisplayBits(original.displayBits)).toEqual(original);
  });

  it.each([
    ["0 degrees", [8, 0, 30, 0, 8, 30, 0, 0, 1], 1, false],
    ["90 degrees", [0, -8, 230, 8, 0, 30, 0, 0, 1], 1, false],
    ["180 degrees", [-8, 0, 230, 0, -8, 230, 0, 0, 1], 1, false],
    ["270 degrees", [0, 8, 30, -8, 0, 230, 0, 0, 1], 1, false],
    ["37 degrees", [5.9895, -4.5135, 121.55, 4.5135, 5.9895, 8.71, 0, 0, 1], 1, false],
    ["oblique perspective", [8, 1.3, 22, 0.7, 7.5, 24, 0.006, 0.003, 1], 1, false],
    ["dim oblique perspective", [8, 1.3, 22, 0.7, 7.5, 24, 0.006, 0.003, 1], 0.58, false],
    ["outlined marker perspective", [8, 1.3, 22, 0.7, 7.5, 24, 0.006, 0.003, 1], 1, true],
  ] as const)("camera scanner reads %s", (_name, matrix, brightness, markerSeams) => {
    const original = buildQrLikeData(sourceEntries);
    expect(scanQrLikeImage(renderTransformedQr(original, matrix, brightness, markerSeams))).toEqual(original);
  });

  it.each(COLOR_MODES)("camera scanner preserves the $name color mode", (mode) => {
    const original = buildQrLikeData(sourceEntries, { colorMode: mode.id });
    const scanned = scanQrLikeImage(
      renderTransformedQr(original, [8, 0, 30, 0, 8, 30, 0, 0, 1]),
    );

    expect(scanned).toEqual(original);
    expect(inspectQrLikeData(scanned).header.colorMode).toBe(mode.id);
  });

  it("selects the real four corners when larger UI-colored shapes are present", () => {
    const original = buildQrLikeData(sourceEntries);
    const frame = addColoredDistractors(
      renderTransformedQr(original, [8, 0, 30, 0, 8, 30, 0, 0, 1]),
    );
    expect(scanQrLikeImage(frame)).toEqual(original);
  });

  it("reads a smaller perspective symbol through blur, noise, glare and uneven light", () => {
    const original = buildQrLikeData(sourceEntries);
    const frame = addCameraArtifacts(
      renderTransformedQr(original, [4.6, 0.65, 72, 0.35, 4.45, 68, 0.0035, 0.002, 1]),
    );
    expect(scanQrLikeImage(frame)).toEqual(original);
  });

  it("reports all missing marker colors for a blank camera frame", () => {
    const pixels = new Uint8ClampedArray(160 * 120 * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) {
      pixels.set([128, 128, 128, 255], offset);
    }
    const frame = { data: pixels, width: 160, height: 120, colorSpace: "srgb" } as ImageData;
    try {
      scanQrLikeImage(frame);
      throw new Error("Expected the scanner to reject a blank frame.");
    } catch (error) {
      expect(error).toMatchObject({
        code: "INVALID_QR_DATA",
        details: {
          stage: "markers",
          detectedMarkers: [],
          missingMarkers: ["red", "blue", "green", "orange"],
        },
      });
    }
  });
});

describe("color modes", () => {
  it("provides four fixed palettes with every color id exactly once", () => {
    expect(COLOR_MODES.map((mode) => mode.code)).toEqual([0, 1, 2, 3]);
    for (const mode of COLOR_MODES) {
      expect(mode.colors).toHaveLength(8);
      expect(mode.colors.map((color) => color.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(new Set(mode.colors.map((color) => color.hex)).size).toBe(8);
    }
  });

  it("uses a neutral, light-to-dark grayscale ramp", () => {
    const grayscale = COLOR_MODES.find((mode) => mode.id === "grayscale")!;
    const channels = grayscale.colors.map((color) => {
      const red = Number.parseInt(color.hex.slice(1, 3), 16);
      const green = Number.parseInt(color.hex.slice(3, 5), 16);
      const blue = Number.parseInt(color.hex.slice(5, 7), 16);
      expect(red).toBe(green);
      expect(green).toBe(blue);
      return red;
    });

    expect(channels[0]).toBe(255);
    expect(channels[7]).toBe(0);
    expect(channels.every((value, index) => index === 0 || value < channels[index - 1])).toBe(true);
  });
});

describe("sample set", () => {
  it("provides seven valid 8 by 8 samples with easy and hard cases", () => {
    expect(SAMPLE_PATTERNS).toHaveLength(7);
    expect(SAMPLE_PATTERNS.some((sample) => sample.compression === "easy")).toBe(true);
    expect(SAMPLE_PATTERNS.some((sample) => sample.compression === "hard")).toBe(true);
    for (const sample of SAMPLE_PATTERNS) {
      expect(flattenGrid(sample.grid)).toHaveLength(64);
    }
  });
});
