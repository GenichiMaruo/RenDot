export type ColorId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type PixelGrid = ColorId[][];

export type SavedArtwork = {
  id: string;
  grid: PixelGrid;
  savedAt: number;
};

export type RunLengthEntry = {
  length: number;
  color: ColorId;
};

export type BinaryRunLengthEntry = {
  originalLength: number;
  storedLength: number;
  lengthBits: string;
  colorBits: string;
};

export type ParityBlock = {
  dataBits: string;
  parityBit: 0 | 1;
  isValid: boolean;
};

export type EncodedRunLengthEntry = {
  length: ParityBlock;
  color: ParityBlock;
  bits: string;
};

export type QrLikeHeader = {
  magicBits: string;
  runCount: number;
  storedRunCount: number;
  payloadLength: number;
  checksum: number;
  checksumBits: string;
  bits: string;
};

export type QrLikeData = {
  headerBits: string;
  /** Fixed 512-bit transmission field. Header payloadLength marks used bits. */
  payloadBits: string;
  /** Header (40) and fixed payload field (512). */
  fullBits: string;
  width: number;
  height: number;
  /** Fixed 25 x 25 matrix: markers, timing, header and payload. */
  displayBits: string;
};

export type ParityBlockKey = "length" | "color";

export type EncodedEntryInspection = {
  entry: EncodedRunLengthEntry;
  isValid: boolean;
  invalidBlocks: ParityBlockKey[];
};

export type QrLikeMarkerColor = "red" | "blue" | "green" | "orange";

export type QrLikeCellRegion = "header" | "payload" | "dummy" | "timing" | "marker";

export type QrLikeCellInfo = {
  index: number;
  row: number;
  column: number;
  region: QrLikeCellRegion;
  bit: 0 | 1 | null;
  entryIndex?: number;
  entryBitIndex?: number;
  block?: ParityBlockKey;
  bitRole?: "data" | "parity";
  markerColor?: QrLikeMarkerColor;
  /** One-based position in the 552-bit header + payload placement stream. */
  placementNumber?: number;
  /** Zero-based position inside the fixed 512-bit payload field. */
  payloadIndex?: number;
};

export type SamplePattern = {
  id: string;
  name: string;
  description: string;
  compression: "easy" | "medium" | "hard";
  grid: PixelGrid;
};
