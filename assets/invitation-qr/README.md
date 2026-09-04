# Invitation RSVP QR Code

QR code for the wedding invitations. Resolves to the RSVP page:

**`https://walters-pierce-wedding.com/rsvp`**

## Files

| File | Use |
|------|-----|
| `rsvp-qr-branded.svg` | **Give this to the print designer.** Vector — scales to any size with zero blur. |
| `rsvp-qr-branded.png` | 1800×1800 raster preview / fallback if a flat image is required. |
| `rsvp-qr-plain.png` | Plain high-contrast black-on-white version (maximum compatibility safety net). |

## Design

- **Modules:** forest green `#00330a`, softly rounded corners
- **Finder eyes (corners):** solid green squares — kept sharp on purpose (scanners lock onto these; rounding them breaks reliability)
- **Background:** cream `#FFFDF7`
- **Center monogram:** "P" in Didot serif, green, inside a gold `#D4AF37` ring
- **Error correction:** level H (30%) — the monogram never compromises the scan

## Print guidance

- **Minimum printed size: 1 inch × 1 inch (2.5 cm).** Bigger is safer; 1.25–1.5 in is ideal on an invitation.
- Keep the cream quiet-zone (the empty margin) around it — do **not** crop tight or place text/graphics inside that margin.
- Maintain strong contrast: print the green on a light/cream stock. Avoid printing it on a dark or patterned background.
- **Test-scan the actual printed proof** with both an iPhone and an Android camera before the full run.

## Verification

Both the SVG and PNG were decode-tested with OpenCV's QR detector and read correctly
as the URL above at every size from 1800px down to 180px.

## Regenerating

If the domain ever changes, the source scripts used to build these are simple Python
(segno + Pillow). Ask Claude to regenerate with the new URL — and re-run the decode test.
