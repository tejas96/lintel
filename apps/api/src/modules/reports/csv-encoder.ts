/** A cell: text from records, a number computed by Lintel, or empty. */
export type CsvCell = string | number | null;

/** Byte order mark, so spreadsheet apps read the file as UTF-8 (₹, names with accents). */
export const UTF8_BOM = '﻿';

/** Spreadsheets treat a cell starting with one of these as a formula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

/**
 * One CSV field. Text that could start a formula is prefixed with a single
 * quote so spreadsheets show it as text; text with commas, quotes, line
 * breaks or edge spaces is quoted (RFC 4180). Finite numbers come from
 * Lintel's own calculations and are written as plain numbers.
 */
export function escapeCsvCell(cell: CsvCell): string {
  if (cell === null) return '';
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : '';
  const text = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A whole file: BOM, header row, data rows, CRLF line endings. */
export function encodeCsv(
  header: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}
