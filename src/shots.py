"""Rasterise selected PDF pages to PNG for visual inspection.
usage: python shots.py <pdf> <outdir> <dpi> <page> [<page> ...]   (1-based pages; 'find:TEXT' picks the first page containing TEXT)"""
import sys, os, pymupdf
pdf, outdir, dpi = sys.argv[1], sys.argv[2], int(sys.argv[3])
os.makedirs(outdir, exist_ok=True)
d = pymupdf.open(pdf)
for a in sys.argv[4:]:
    if a.startswith('find:'):
        t = a[5:]; pno = next((i for i in range(len(d)) if t in d[i].get_text()), None)
        if pno is None: print('not found', t); continue
    else:
        pno = int(a) - 1
    clip = None
    pix = d[pno].get_pixmap(dpi=dpi, clip=clip)
    out = os.path.join(outdir, f'p{pno + 1:03d}.png')
    pix.save(out); print(out)
