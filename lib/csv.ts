// Characters that make Excel / Google Sheets treat a cell as a formula. A value
// beginning with any of these can execute on open (CSV injection / formula
// injection), so it must be neutralized before being written to a CSV.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escape a single field for safe inclusion in a CSV file.
 *
 * - Neutralizes spreadsheet formula injection by prefixing a leading formula
 *   trigger with a single quote (the standard Excel/Sheets mitigation).
 * - Quotes fields containing commas, double quotes, or newlines, doubling any
 *   internal double quotes per RFC 4180.
 */
export function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';

  let str = String(value);
  if (str.length === 0) return '';

  if (FORMULA_TRIGGERS.includes(str[0])) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}
