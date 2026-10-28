# Sinh web/src/test/fixtures/exif6.jpg: ảnh lưu 64x32 (nửa trái đỏ) + EXIF Orientation=6 → hiển thị dọc 32x64.
# Chạy: python3 web/scripts/make-exif6-fixture.py web/src/test/fixtures/exif6.jpg (cần Pillow)
import sys
from PIL import Image
img = Image.new('RGB', (64, 32), (255, 255, 255))
for x in range(32):
    for y in range(32):
        img.putpixel((x, y), (220, 30, 30))
exif = Image.Exif()
exif[0x0112] = 6
img.save(sys.argv[1], 'JPEG', quality=85, exif=exif.tobytes())
