import { DataValidationError } from "./errors";
import type { ColorId, ColorMode, ColorModeCode } from "./types";

export type ColorDefinition = {
  id: ColorId;
  name: string;
  hex: string;
  foreground: "#111827" | "#ffffff";
};

export type ColorModeDefinition = {
  id: ColorMode;
  code: ColorModeCode;
  bits: "00" | "01" | "10" | "11";
  name: string;
  description: string;
  colors: readonly ColorDefinition[];
};

export const DEFAULT_COLOR_MODE: ColorMode = "colorful";

const COLORFUL_COLORS = [
  { id: 0, name: "白", hex: "#ffffff", foreground: "#111827" },
  { id: 1, name: "黒", hex: "#111827", foreground: "#ffffff" },
  { id: 2, name: "赤", hex: "#dc2626", foreground: "#ffffff" },
  { id: 3, name: "青", hex: "#2563eb", foreground: "#ffffff" },
  { id: 4, name: "黄", hex: "#facc15", foreground: "#111827" },
  { id: 5, name: "緑", hex: "#15803d", foreground: "#ffffff" },
  { id: 6, name: "紫", hex: "#9333ea", foreground: "#ffffff" },
  { id: 7, name: "オレンジ", hex: "#f97316", foreground: "#111827" },
] as const satisfies readonly ColorDefinition[];

const GRAYSCALE_COLORS = [
  { id: 0, name: "白", hex: "#ffffff", foreground: "#111827" },
  { id: 1, name: "灰色 1", hex: "#dedede", foreground: "#111827" },
  { id: 2, name: "灰色 2", hex: "#bdbdbd", foreground: "#111827" },
  { id: 3, name: "灰色 3", hex: "#9c9c9c", foreground: "#111827" },
  { id: 4, name: "灰色 4", hex: "#737373", foreground: "#ffffff" },
  { id: 5, name: "灰色 5", hex: "#525252", foreground: "#ffffff" },
  { id: 6, name: "灰色 6", hex: "#292929", foreground: "#ffffff" },
  { id: 7, name: "黒", hex: "#000000", foreground: "#ffffff" },
] as const satisfies readonly ColorDefinition[];

const OCEAN_COLORS = [
  { id: 0, name: "真珠", hex: "#ecfeff", foreground: "#111827" },
  { id: 1, name: "水面", hex: "#cffafe", foreground: "#111827" },
  { id: 2, name: "浅瀬", hex: "#a5f3fc", foreground: "#111827" },
  { id: 3, name: "水色", hex: "#67e8f9", foreground: "#111827" },
  { id: 4, name: "ターコイズ", hex: "#22d3ee", foreground: "#111827" },
  { id: 5, name: "青緑", hex: "#0891b2", foreground: "#111827" },
  { id: 6, name: "深海ブルー", hex: "#0369a1", foreground: "#ffffff" },
  { id: 7, name: "深海", hex: "#082f49", foreground: "#ffffff" },
] as const satisfies readonly ColorDefinition[];

const SUNSET_COLORS = [
  { id: 0, name: "クリーム", hex: "#fff7ed", foreground: "#111827" },
  { id: 1, name: "薄桃", hex: "#ffedd5", foreground: "#111827" },
  { id: 2, name: "桃", hex: "#fed7aa", foreground: "#111827" },
  { id: 3, name: "杏", hex: "#fdba74", foreground: "#111827" },
  { id: 4, name: "オレンジ", hex: "#fb923c", foreground: "#111827" },
  { id: 5, name: "夕焼け", hex: "#f43f5e", foreground: "#111827" },
  { id: 6, name: "茜", hex: "#9f1239", foreground: "#ffffff" },
  { id: 7, name: "夜空", hex: "#3b0764", foreground: "#ffffff" },
] as const satisfies readonly ColorDefinition[];

/** The code assignments are part of the persisted QR-like wire format. */
export const COLOR_MODES = [
  {
    id: "colorful",
    code: 0,
    bits: "00",
    name: "カラフル",
    description: "これまでと同じ基本の8色",
    colors: COLORFUL_COLORS,
  },
  {
    id: "grayscale",
    code: 1,
    bits: "01",
    name: "モノクロ",
    description: "白から黒までの8段階",
    colors: GRAYSCALE_COLORS,
  },
  {
    id: "ocean",
    code: 2,
    bits: "10",
    name: "オーシャン",
    description: "明るい水色から深い青へ",
    colors: OCEAN_COLORS,
  },
  {
    id: "sunset",
    code: 3,
    bits: "11",
    name: "サンセット",
    description: "クリーム色から夜空へ",
    colors: SUNSET_COLORS,
  },
] as const satisfies readonly ColorModeDefinition[];

/** Legacy alias: existing callers and the RenDot logo keep the original palette. */
export const COLORS = COLORFUL_COLORS;

export function isColorMode(value: unknown): value is ColorMode {
  return COLOR_MODES.some((mode) => mode.id === value);
}

export function getColorModeDefinition(mode: ColorMode): ColorModeDefinition {
  const definition = COLOR_MODES.find((candidate) => candidate.id === mode);
  if (!definition) {
    throw new DataValidationError("INVALID_COLOR", `Unknown color mode: ${String(mode)}.`, {
      mode,
    });
  }
  return definition;
}

export function getColorModeFromCode(code: ColorModeCode): ColorMode {
  const mode = COLOR_MODES.find((definition) => definition.code === code)?.id;
  if (!mode) {
    throw new DataValidationError("INVALID_HEADER", `Unknown color mode code: ${String(code)}.`, {
      code,
    });
  }
  return mode;
}

export function getColors(mode: ColorMode = DEFAULT_COLOR_MODE): readonly ColorDefinition[] {
  return getColorModeDefinition(mode).colors;
}

export function isColorId(value: unknown): value is ColorId {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 7;
}

export function assertColorId(value: unknown): asserts value is ColorId {
  if (!isColorId(value)) {
    throw new DataValidationError(
      "INVALID_COLOR",
      `Color id must be an integer from 0 through 7; received ${String(value)}.`,
      { value },
    );
  }
}

export function getColor(
  value: ColorId,
  mode: ColorMode = DEFAULT_COLOR_MODE,
): ColorDefinition {
  return getColors(mode)[value];
}
