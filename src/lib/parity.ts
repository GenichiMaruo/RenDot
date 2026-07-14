import {
  assertBinaryString,
  decodeColor,
  decodeLength,
  encodeColor,
  encodeLength,
} from "./binary";
import { DataValidationError } from "./errors";
import { validateRunLengthEntry } from "./runLength";
import type {
  EncodedEntryInspection,
  EncodedRunLengthEntry,
  ParityBlock,
  ParityBlockKey,
  RunLengthEntry,
} from "./types";

export const ENCODED_ENTRY_BIT_COUNT = 8;
export const DATA_BIT_INDICES = [0, 1, 2, 4, 5, 6] as const;

export type DecodeEntryOptions = {
  validateParity?: boolean;
};

export function calculateEvenParity(bits: string): 0 | 1 {
  assertBinaryString(bits);
  const ones = [...bits].filter((bit) => bit === "1").length;
  return ones % 2 === 0 ? 0 : 1;
}

export function validateEvenParity(bits: string, parity: number): boolean {
  assertBinaryString(bits);
  if (parity !== 0 && parity !== 1) {
    throw new DataValidationError(
      "INVALID_PARITY",
      "A parity bit must be zero or one.",
      { parity },
    );
  }
  return calculateEvenParity(bits) === parity;
}

function makeParityBlock(dataBits: string, parityBit?: number): ParityBlock {
  assertBinaryString(dataBits, 3);
  const bit = parityBit ?? calculateEvenParity(dataBits);
  if (bit !== 0 && bit !== 1) {
    throw new DataValidationError("INVALID_PARITY", "Invalid parity bit.", {
      parityBit,
    });
  }
  return {
    dataBits,
    parityBit: bit,
    isValid: validateEvenParity(dataBits, bit),
  };
}

export function encodeEntry(entry: RunLengthEntry): EncodedRunLengthEntry {
  validateRunLengthEntry(entry);
  const lengthBits = encodeLength(entry.length);
  const colorBits = encodeColor(entry.color);
  const length = makeParityBlock(lengthBits);
  const color = makeParityBlock(colorBits);
  const bits = [
    length.dataBits,
    length.parityBit,
    color.dataBits,
    color.parityBit,
  ].join("");

  return { length, color, bits };
}

export function parseEncodedEntry(bits: string): EncodedRunLengthEntry {
  if (typeof bits !== "string" || bits.length !== ENCODED_ENTRY_BIT_COUNT) {
    throw new DataValidationError(
      "INVALID_ENTRY_LENGTH",
      `An encoded run must contain ${ENCODED_ENTRY_BIT_COUNT} bits.`,
      { actualLength: typeof bits === "string" ? bits.length : null },
    );
  }
  assertBinaryString(bits, ENCODED_ENTRY_BIT_COUNT);

  const length = makeParityBlock(bits.slice(0, 3), Number(bits[3]));
  const color = makeParityBlock(bits.slice(4, 7), Number(bits[7]));
  return { length, color, bits };
}

export function inspectEncodedEntry(bits: string): EncodedEntryInspection {
  const entry = parseEncodedEntry(bits);
  const invalidBlocks = (Object.keys(entry) as Array<keyof EncodedRunLengthEntry>)
    .filter(
      (key): key is ParityBlockKey =>
        key !== "bits" && !entry[key].isValid,
    );
  return {
    entry,
    isValid: invalidBlocks.length === 0,
    invalidBlocks,
  };
}

export function decodeEntry(
  bits: string,
  options: DecodeEntryOptions = {},
): RunLengthEntry {
  const inspection = inspectEncodedEntry(bits);
  if (options.validateParity !== false && !inspection.isValid) {
    throw new DataValidationError(
      "INVALID_PARITY",
      `Parity failed in: ${inspection.invalidBlocks.join(", ")}.`,
      { invalidBlocks: inspection.invalidBlocks },
    );
  }

  const { length, color } = inspection.entry;
  return {
    length: decodeLength(length.dataBits),
    color: decodeColor(color.dataBits),
  };
}

export function flipBit(bits: string, index: number): string {
  assertBinaryString(bits);
  if (!Number.isInteger(index) || index < 0 || index >= bits.length) {
    throw new DataValidationError("VALUE_OUT_OF_RANGE", "Bit index is out of range.", {
      index,
      length: bits.length,
    });
  }
  const replacement = bits[index] === "0" ? "1" : "0";
  return bits.slice(0, index) + replacement + bits.slice(index + 1);
}

export function flipRandomDataBit(
  bits: string,
  random: () => number = Math.random,
): { bits: string; bitIndex: number } {
  assertBinaryString(bits, ENCODED_ENTRY_BIT_COUNT);
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new DataValidationError(
      "VALUE_OUT_OF_RANGE",
      "Random source must return a number from 0 up to, but not including, 1.",
      { value },
    );
  }
  const bitIndex = DATA_BIT_INDICES[Math.floor(value * DATA_BIT_INDICES.length)];
  return { bits: flipBit(bits, bitIndex), bitIndex };
}
