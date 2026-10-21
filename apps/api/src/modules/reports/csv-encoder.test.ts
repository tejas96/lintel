import { describe, expect, it } from 'vitest';
import { encodeCsv, escapeCsvCell, UTF8_BOM } from './csv-encoder';

describe('CSV cells', () => {
  it('leaves plain text and numbers alone', () => {
    expect(escapeCsvCell('Saska Residence')).toBe('Saska Residence');
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(0.875)).toBe('0.875');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(Number.NaN)).toBe('');
  });

  it('defuses text a spreadsheet would run as a formula', () => {
    expect(escapeCsvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(escapeCsvCell('+91 90000 00001')).toBe("'+91 90000 00001");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    expect(escapeCsvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(escapeCsvCell('\tcmd')).toBe("'\tcmd");
    expect(escapeCsvCell('\r=1+1')).toBe(`"'\r=1+1"`);
  });

  it('quotes commas, quotes, line breaks and edge spaces', () => {
    expect(escapeCsvCell('Kiln & Co., Bengaluru')).toBe('"Kiln & Co., Bengaluru"');
    expect(escapeCsvCell('The "Loft"')).toBe('"The ""Loft"""');
    expect(escapeCsvCell('two\nlines')).toBe('"two\nlines"');
    expect(escapeCsvCell(' padded ')).toBe('" padded "');
  });

  it('keeps non-ASCII text as UTF-8', () => {
    expect(escapeCsvCell('₹ 4,20,000 · Zoë')).toBe('"₹ 4,20,000 · Zoë"');
  });
});

describe('CSV files', () => {
  it('starts with a BOM and uses CRLF line endings', () => {
    const file = encodeCsv(
      ['Project', 'On time'],
      [
        ['Saska Residence', 12],
        ['=cmd|calc', null],
      ],
    );
    expect(file.startsWith(UTF8_BOM)).toBe(true);
    expect(file.slice(1)).toBe("Project,On time\r\nSaska Residence,12\r\n'=cmd|calc,\r\n");
  });
});
