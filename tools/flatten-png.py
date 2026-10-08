"""Strip the alpha channel from PNGs (App Store icons must be opaque RGB).
Usage: python3 tools/flatten-png.py file.png [...]"""
import sys
from PIL import Image
for f in sys.argv[1:]:
    im = Image.open(f)
    if im.mode != 'RGB':
        bg = Image.new('RGB', im.size, (10, 14, 22))
        bg.paste(im, mask=im.split()[-1] if im.mode in ('RGBA', 'LA') else None)
        bg.save(f, optimize=True)
    print(f, Image.open(f).mode, Image.open(f).size)
