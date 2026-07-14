import { DataValidationError } from "./errors";
import type { ColorId } from "./types";

export type ColorDefinition = {
  id: ColorId;
  name: string;
  hex: string;
  foreground: "#111827" | "#ffffff";
};

export const COLORS = [
  { id: 0, name: "白", hex: "#ffffff", foreground: "#111827" },
  { id: 1, name: "黒", hex: "#111827", foreground: "#ffffff" },
  { id: 2, name: "赤", hex: "#dc2626", foreground: "#ffffff" },
  { id: 3, name: "青", hex: "#2563eb", foreground: "#ffffff" },
  { id: 4, name: "黄", hex: "#facc15", foreground: "#111827" },
  { id: 5, name: "緑", hex: "#15803d", foreground: "#ffffff" },
  { id: 6, name: "紫", hex: "#9333ea", foreground: "#ffffff" },
  { id: 7, name: "オレンジ", hex: "#f97316", foreground: "#111827" },
] as const satisfies readonly ColorDefinition[];

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

export function getColor(value: ColorId): ColorDefinition {
  return COLORS[value];
}
