# Table Photo Gallery QR Code

QR code for table cards and around-the-room signage. Resolves to the guest photo gallery:

**`https://walters-pierce-wedding.com/photos`**

## Files

| File | Use |
|------|-----|
| `photos-qr-branded.png` | 900×900 raster. **Give this to the print designer / use for table cards.** |
| `photos-qr-plain.png` | Plain high-contrast black-on-white version (maximum compatibility safety net). |

There is no SVG in this set (unlike the invitation QR) — only the two PNGs above.

## Design

- **Modules:** forest green `#00330a`
- **Background:** cream `#FFFDF7`
- **Center monogram:** "P" in Didot serif, green, inside a gold `#D4AF37` ring
- **Error correction:** level H (30%) — the monogram never compromises the scan

## Print guidance

- **Minimum printed size: 1 inch × 1 inch (2.5 cm).** Bigger is safer for a table card viewed from a normal seated distance.
- Keep the cream quiet-zone (the empty margin) around it — do **not** crop tight or place text/graphics inside that margin.
- Maintain strong contrast: print the green on a light/cream stock. Avoid printing it on a dark or patterned background.
- **Test-scan the actual printed proof** with both an iPhone and an Android camera before the full run.

## Verification

Generated with segno + Pillow. Decode-tested with OpenCV's QR detector (`cv2.QRCodeDetector`)
against both `photos-qr-branded.png` and `photos-qr-plain.png` at their generated 900×900
resolution — both decoded correctly to the URL above.

## Regenerating

If the domain ever changes, re-run `scripts/generate-photos-qr.py` (needs: `pip install segno pillow`)
with the new URL, then re-run the decode test.
