"""Contact sheets (thumbnails of every page) for whole-book visual scanning.
usage: python contact.py <pdf> <outdir> [cols rows dpi]"""
import sys, os, pymupdf
pdf, outdir = sys.argv[1], sys.argv[2]
cols, rows, dpi = (int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (4, 3, 30)
os.makedirs(outdir, exist_ok=True)
d = pymupdf.open(pdf)
per = cols * rows
for s in range(0, len(d), per):
    pix0 = d[s].get_pixmap(dpi=dpi)
    w, h = pix0.width, pix0.height
    gap = 6
    sheet = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, cols * (w + gap) + gap, rows * (h + gap + 12) + gap), False)
    sheet.clear_with(205)
    for k in range(per):
        if s + k >= len(d): break
        pix = d[s + k].get_pixmap(dpi=dpi, alpha=False)
        x = gap + (k % cols) * (w + gap); y = gap + (k // cols) * (h + gap + 12) + 12
        pix.set_origin(x, y)
        sheet.copy(pix, pymupdf.IRect(x, y, x + pix.width, y + pix.height))
    out = os.path.join(outdir, f'sheet_{s + 1:03d}-{min(s + per, len(d)):03d}.png')
    sheet.save(out)
print('sheets written to', outdir)
