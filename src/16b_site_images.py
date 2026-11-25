"""Images for the website, made from the finished PDFs: the cover of every volume (WebP) and a 1200x630 social card.
Usage: python -I -X utf8 src/16b_site_images.py"""
import os, json, io, pymupdf
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'site', 'img'); os.makedirs(IMG, exist_ok=True)
VOLS = json.load(open(os.path.join(ROOT, 'src', 'volumes.json'), encoding='utf-8'))['volumes']
covers = {}
for v in VOLS:
    pdf = os.path.join(ROOT, 'output', v['output'] + '.pdf')
    if not os.path.exists(pdf): continue
    page = pymupdf.open(pdf)[0]
    pix = page.get_pixmap(dpi=220)  # A4 at 220 dpi, then reduced for the web
    im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
    big = im.resize((1200, 1697), Image.LANCZOS)
    covers[v['id']] = big
    big.resize((600, 849), Image.LANCZOS).save(os.path.join(IMG, f"cover-{v['id']}.webp"), 'WEBP', quality=84, method=6)
    print('cover', v['id'], os.path.getsize(os.path.join(IMG, f"cover-{v['id']}.webp")) // 1024, 'KB')

# social card: the covers fanned out on the same deep-space background, with the title
W, H = 1200, 630
card = Image.new('RGB', (W, H), (4, 6, 15))
bg = Image.new('RGB', (W, H)); d = ImageDraw.Draw(bg)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(4 + 6 * t), int(6 + 8 * t), int(15 + 22 * (1 - abs(t - 0.5) * 2))))
glow = Image.new('L', (W, H), 0); ImageDraw.Draw(glow).ellipse((620, -120, 1320, 640), fill=120)
glow = glow.filter(ImageFilter.GaussianBlur(120))
card = Image.composite(Image.new('RGB', (W, H), (60, 70, 170)), bg, glow)
order = ['vol1', 'vol3', 'vol5', 'vol7', 'vol9']
for k, vid in enumerate(order):
    if vid not in covers: continue
    c = covers[vid].resize((250, 354), Image.LANCZOS)
    ang = (k - 2) * -6
    m = Image.new('L', c.size, 255)
    rc = c.rotate(ang, expand=True, resample=Image.BICUBIC); rm = m.rotate(ang, expand=True, resample=Image.BICUBIC)
    sh = Image.new('L', rc.size, 0); sh.paste(rm, (0, 0)); sh = sh.filter(ImageFilter.GaussianBlur(14))
    x = 610 + k * 105 - rc.size[0] // 2 + 40; y = 150 + abs(k - 2) * 22 - 20
    card.paste(Image.new('RGB', rc.size, (0, 0, 0)), (x + 10, y + 18), sh.point(lambda p: p * 0.7))
    card.paste(rc, (x, y), rm)
fonts = os.path.join(ROOT, 'fonts')
f1 = ImageFont.truetype(os.path.join(fonts, 'SpaceGrotesk-Bold.ttf'), 64)
f2 = ImageFont.truetype(os.path.join(fonts, 'SpaceGrotesk-Medium.ttf'), 22)
f3 = ImageFont.truetype(os.path.join(fonts, 'SourceSans3-Regular.ttf'), 22)
dr = ImageDraw.Draw(card)
dr.text((60, 92), 'UNOFFICIAL PRINT EDITION', font=f2, fill=(255, 196, 222))
dr.text((60, 140), 'React', font=f1, fill=(245, 248, 255))
dr.text((60, 212), 'Documentation', font=f1, fill=(245, 248, 255))
dr.text((60, 284), 'in print.', font=f1, fill=(140, 220, 255))
vols = [v for v in VOLS if not v.get('proof')]
total = sum(len(pymupdf.open(os.path.join(ROOT, 'output', v['output'] + '.pdf'))) for v in vols)
dr.text((60, 392), f'{len(vols)} free A4 PDF volumes · {total:,} pages', font=f3, fill=(200, 212, 235))
dr.text((60, 424), 'Learn + Reference · every example run', font=f3, fill=(200, 212, 235))
dr.text((60, 540), 'sami12344.github.io/React-Docs-PDF', font=f2, fill=(150, 165, 200))
dr.rectangle((60, 520, 300, 522), fill=(120, 200, 255))
card.save(os.path.join(IMG, 'social-card.png'), optimize=True)
print('social card', os.path.getsize(os.path.join(IMG, 'social-card.png')) // 1024, 'KB')
