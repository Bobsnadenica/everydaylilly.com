"""Build the Linux Lambda ZIP outside the repo; no credentials or family media."""
import hashlib
import io
from pathlib import Path
import sys
import urllib.request
import zipfile

URL = 'https://files.pythonhosted.org/packages/a0/2d/43c8522a2038e9d0e7dbdf3a61195ecc31ca576fb1527a528c877e87d973/imageio_ffmpeg-0.6.0-py3-none-manylinux2014_x86_64.whl'
SHA256 = 'c7e46fcec401dd990405049d2e2f475e2b397779df2519b544b8aab515195282'
IMAGE_WHEELS = [
    ('https://files.pythonhosted.org/packages/84/21/a35af28dcc61f37ed850a2d64c65c701321dfbf25085e469d5559360cbbf/pillow-12.3.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl', '78cb2c6865a35ab8ff8b75fd122f6033b92a62c82801110e48ddd6c936a45d91'),
    ('https://files.pythonhosted.org/packages/3a/4d/b7be3eebd23e042b738ee57ed211e5fc0d6fc037b24e0047f99e3a16ba9c/pillow_heif-1.7.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl', '7c4751fcffb55f555a7559cfa6721bdfb30f50f14b7f0cbd2b1cba3b5d5961b7'),
]
output = Path(sys.argv[1])
data = urllib.request.urlopen(URL).read()
assert hashlib.sha256(data).hexdigest() == SHA256, 'FFmpeg wheel checksum mismatch'
with zipfile.ZipFile(io.BytesIO(data)) as wheel, zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as package:
    binary = next(n for n in wheel.namelist() if '/binaries/ffmpeg-linux' in n)
    info = zipfile.ZipInfo('ffmpeg'); info.external_attr = 0o100755 << 16; info.compress_type = zipfile.ZIP_DEFLATED
    package.writestr(info, wheel.read(binary))
    for name in wheel.namelist():
        if 'license' in name.lower() or 'readme' in name.lower():
            package.writestr('licenses/' + name.replace('/', '_'), wheel.read(name))
    package.write(Path(__file__).resolve().parents[1] / 'app/backend/live/prod/lambda/gallery_thumbnails/handler.py', 'handler.py')
    for url, checksum in IMAGE_WHEELS:
        data = urllib.request.urlopen(url).read()
        assert hashlib.sha256(data).hexdigest() == checksum, 'Image decoder wheel checksum mismatch'
        with zipfile.ZipFile(io.BytesIO(data)) as images:
            for name in images.namelist():
                if not name.endswith('/'):
                    package.writestr(name, images.read(name))
print(f'Built {output.name}: {output.stat().st_size} bytes')
