export type DataErrorCode =
  | "INVALID_GRID"
  | "INVALID_COLOR"
  | "INVALID_PIXEL_COUNT"
  | "INVALID_RUN_LENGTH"
  | "INVALID_RUN_COUNT"
  | "INVALID_BINARY"
  | "VALUE_OUT_OF_RANGE"
  | "INVALID_ENTRY_LENGTH"
  | "INVALID_PARITY"
  | "INVALID_HEADER_MAGIC"
  | "INVALID_HEADER_CHECKSUM"
  | "INVALID_HEADER"
  | "INVALID_PAYLOAD_LENGTH"
  | "INVALID_QR_DIMENSIONS"
  | "INVALID_QR_DATA";

const DEFAULT_MESSAGES: Record<DataErrorCode, string> = {
  INVALID_GRID: "ドット絵の形を読み取れませんでした。",
  INVALID_COLOR: "使えない色番号が含まれています。",
  INVALID_PIXEL_COUNT: "ドットの数が64マスになっていません。",
  INVALID_RUN_LENGTH: "色が続く個数を読み取れませんでした。",
  INVALID_RUN_COUNT: "圧縮データのまとまり数を読み取れませんでした。",
  INVALID_BINARY: "0と1以外のデータが含まれています。",
  VALUE_OUT_OF_RANGE: "数字が扱える範囲を超えています。",
  INVALID_ENTRY_LENGTH: "圧縮データの長さが8bitではありません。",
  INVALID_PARITY: "データに誤りが見つかりました。",
  INVALID_HEADER_MAGIC: "ヘッダーが壊れているため読み取れません。",
  INVALID_HEADER_CHECKSUM: "ヘッダーが壊れているため読み取れません。",
  INVALID_HEADER: "ヘッダーが壊れているため読み取れません。",
  INVALID_PAYLOAD_LENGTH: "データの長さが合わないため読み取れません。",
  INVALID_QR_DIMENSIONS: "QRライクデータの形を読み取れませんでした。",
  INVALID_QR_DATA: "QRライクデータを読み取れませんでした。",
};

export class DataValidationError extends Error {
  readonly code: DataErrorCode;
  readonly userMessage: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: DataErrorCode,
    technicalMessage?: string,
    details?: Record<string, unknown>,
  ) {
    super(technicalMessage ?? code);
    this.name = "DataValidationError";
    this.code = code;
    this.userMessage = DEFAULT_MESSAGES[code];
    this.details = details;
  }
}

export function toUserMessage(error: unknown): string {
  return error instanceof DataValidationError
    ? error.userMessage
    : "うまく読み取れませんでした。もう一度ためしてください。";
}
