import { escapeCsvField } from '../csv';

describe('escapeCsvField', () => {
  it('returns an empty string for null, undefined, or empty input', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
    expect(escapeCsvField('')).toBe('');
  });

  it('passes through a plain value unchanged', () => {
    expect(escapeCsvField('Emme')).toBe('Emme');
    expect(escapeCsvField('emme@example.com')).toBe('emme@example.com');
  });

  it('quotes values containing commas, quotes, or newlines', () => {
    expect(escapeCsvField('Doe, John')).toBe('"Doe, John"');
    expect(escapeCsvField('a"b')).toBe('"a""b"');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralizes spreadsheet formula injection by prefixing a single quote', () => {
    expect(escapeCsvField('=cmd|calc')).toBe("'=cmd|calc");
    expect(escapeCsvField('+1234')).toBe("'+1234");
    expect(escapeCsvField('-2+3')).toBe("'-2+3");
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('neutralizes and quotes a field that is both a formula and structurally unsafe', () => {
    // Leading '=' must be neutralized AND the comma must force quoting.
    expect(escapeCsvField('=HYPERLINK("evil"),x')).toBe('"\'=HYPERLINK(""evil""),x"');
  });

  it('coerces non-string values to strings', () => {
    expect(escapeCsvField(42 as unknown as string)).toBe('42');
  });
});
