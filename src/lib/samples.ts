import { DataValidationError } from "./errors";
import { cloneGrid, GRID_SIZE, validateGrid } from "./runLength";
import type { ColorId, PixelGrid, SamplePattern } from "./types";

function gridFromRows(rows: readonly string[]): PixelGrid {
  if (rows.length !== GRID_SIZE || rows.some((row) => row.length !== GRID_SIZE)) {
    throw new DataValidationError("INVALID_GRID", "A sample must be 8 by 8.");
  }
  const grid = rows.map((row) =>
    [...row].map((value) => Number(value) as ColorId),
  );
  validateGrid(grid);
  return grid;
}

export const SAMPLE_PATTERNS: readonly SamplePattern[] = [
  {
    id: "heart",
    name: "ハート",
    description: "同じ色がまとまりやすい絵です。",
    compression: "easy",
    grid: gridFromRows([
      "00000000",
      "02200220",
      "22222222",
      "22222222",
      "02222220",
      "00222200",
      "00022000",
      "00000000",
    ]),
  },
  {
    id: "smile",
    name: "笑顔",
    description: "黄色と黒でできた笑顔です。",
    compression: "medium",
    grid: gridFromRows([
      "00444400",
      "04444440",
      "44144144",
      "44444444",
      "41444414",
      "44111144",
      "04444440",
      "00444400",
    ]),
  },
  {
    id: "house",
    name: "家",
    description: "屋根と窓のある小さな家です。",
    compression: "medium",
    grid: gridFromRows([
      "00022000",
      "00222200",
      "02222220",
      "22222222",
      "07777770",
      "07377370",
      "07711770",
      "07711770",
    ]),
  },
  {
    id: "tree",
    name: "木",
    description: "緑の葉とオレンジの幹の木です。",
    compression: "easy",
    grid: gridFromRows([
      "00055000",
      "00555500",
      "05555550",
      "55555555",
      "00555500",
      "00077000",
      "00077000",
      "00777700",
    ]),
  },
  {
    id: "fish",
    name: "魚",
    description: "青い魚が右を向いています。",
    compression: "medium",
    grid: gridFromRows([
      "00000000",
      "00033000",
      "70333300",
      "77333130",
      "77333330",
      "70333300",
      "00033000",
      "00000000",
    ]),
  },
  {
    id: "checkerboard",
    name: "市松模様",
    description: "色が細かく切り替わる、圧縮しにくい模様です。",
    compression: "hard",
    grid: gridFromRows([
      "10101010",
      "01010101",
      "10101010",
      "01010101",
      "10101010",
      "01010101",
      "10101010",
      "01010101",
    ]),
  },
  {
    id: "noise",
    name: "カラーノイズ",
    description: "色がばらばらで、とても圧縮しにくい絵です。",
    compression: "hard",
    grid: gridFromRows([
      "01234567",
      "76543210",
      "13572460",
      "62401357",
      "27046135",
      "51627304",
      "34705261",
      "60271543",
    ]),
  },
] as const;

/** Short alias used by UI components. */
export const SAMPLES = SAMPLE_PATTERNS;

export function getSample(id: string): PixelGrid {
  const sample = SAMPLE_PATTERNS.find((item) => item.id === id);
  if (!sample) {
    throw new DataValidationError("INVALID_GRID", `Unknown sample: ${id}.`, { id });
  }
  return cloneGrid(sample.grid);
}
