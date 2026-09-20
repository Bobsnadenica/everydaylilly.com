"""Create private, immutable JPEG previews after original gallery uploads."""
import hashlib
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import unquote_plus

import boto3

s3 = boto3.client('s3')
BUCKET = os.environ['GALLERY_BUCKET']
PREFIX = os.environ.get('GALLERY_PREFIX', 'months')
FFMPEG = os.environ.get('FFMPEG_PATH', '/var/task/ffmpeg')
MEDIA = re.compile(r'\.(avif|gif|heic|heif|jpe?g|m4v|mov|mp4|png|webm|webp)$', re.I)
VIDEO = re.compile(r'\.(m4v|mov|mp4|webm)$', re.I)
HEIF = re.compile(r'\.(heic|heif)$', re.I)


def thumbnail_key(key, etag):
    if re.match(r'^(albums/(family|grandma)|covers/family)/month-\d{2}/[^/]+$', key):
        relative = re.sub(r'^albums/', '', key).rsplit('.', 1)[0]
        version = hashlib.sha256(etag.strip('"').encode()).hexdigest()[:12]
        return f'previews/{relative}-{version}.jpg'
    digest = hashlib.sha256((key + '\n' + etag.strip('"')).encode()).hexdigest()
    return f'previews/{PREFIX}/{digest}.jpg'


def put_preview(key, data):
    try:
        s3.put_object(Bucket=BUCKET, Key=key, Body=data, ContentType='image/jpeg',
                      CacheControl='private, max-age=31536000, immutable', IfNoneMatch='*')
    except Exception as error:
        if getattr(error, 'response', {}).get('ResponseMetadata', {}).get('HTTPStatusCode') != 412:
            raise


def generate_heif(key, target, source):
    # Decode on the server once, preserving the untouched original in S3.
    import io
    from PIL import Image, ImageOps, ImageCms
    from pillow_heif import register_heif_opener
    register_heif_opener(thumbnails=False, decode_threads=1)
    if source['ContentLength'] > 80 * 1024 * 1024:
        raise RuntimeError('HEIC exceeds the supported image size')
    with tempfile.TemporaryDirectory() as directory:
        original = Path(directory) / 'original.heic'
        s3.download_file(BUCKET, key, str(original))
        with Image.open(original) as image:
            profile = image.info.get('icc_profile')
            image = ImageOps.exif_transpose(image).convert('RGB')
            if profile:
                image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)),
                                                 ImageCms.createProfile('sRGB'), outputMode='RGB')
            # Fresh pixel buffers exclude camera/location metadata from derivatives.
            clean = Image.new('RGB', image.size)
            clean.paste(image)
            display = io.BytesIO()
            clean.save(display, format='JPEG', quality=92, optimize=True)
            put_preview(target.replace('.jpg', '.display.jpg'), display.getvalue())
            clean.thumbnail((640, 640), Image.Resampling.LANCZOS)
            preview = io.BytesIO()
            clean.save(preview, format='JPEG', quality=82, optimize=True)
            put_preview(target, preview.getvalue())
    return 'created'


def generate(bucket, key):
    allowed = key.startswith(PREFIX + '/') or re.match(r'^(albums/(family|grandma)|covers/family)/month-(0[1-9]|[1-5][0-9]|60)/[^/]+$', key)
    if bucket != BUCKET or not allowed or not MEDIA.search(key):
        return 'ignored'
    source = s3.head_object(Bucket=BUCKET, Key=key)
    if not source['ContentLength']:
        return 'ignored'
    target = thumbnail_key(key, source['ETag'])
    existing = s3.list_objects_v2(Bucket=BUCKET, Prefix=target.removesuffix('.jpg'), MaxKeys=4)
    keys = {item['Key'] for item in existing.get('Contents', [])}
    if target in keys and (not HEIF.search(key) or target.replace('.jpg', '.display.jpg') in keys):
        return 'exists'
    if HEIF.search(key):
        return generate_heif(key, target, source)
    url = s3.generate_presigned_url('get_object', Params={'Bucket': BUCKET, 'Key': key}, ExpiresIn=300)
    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / 'preview.jpg'
        for seek in ([0.25, 0] if VIDEO.search(key) else [0]):
            command = [FFMPEG, '-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1']
            if seek:
                command += ['-ss', str(seek)]
            command += ['-i', url, '-frames:v', '1', '-an', '-vf',
                        'scale=640:640:force_original_aspect_ratio=decrease',
                        '-q:v', '5', '-map_metadata', '-1', '-update', '1', '-y', str(output)]
            # Never log FFmpeg stderr: errors can include the private signed URL.
            try:
                result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=60)
            except subprocess.TimeoutExpired:
                raise RuntimeError('Gallery preview decoding timed out') from None
            if result.returncode == 0 and output.exists() and output.stat().st_size:
                break
        else:
            raise RuntimeError('Unable to decode gallery preview')
        put_preview(target, output.read_bytes())
    return 'created'


def handler(event, context):
    # Direct invocation supports controlled backfills; S3 events handle new uploads.
    records = event.get('Records', [])
    if 'key' in event:
        records = [{'s3': {'bucket': {'name': BUCKET}, 'object': {'key': event['key']}}}]
    counts = {}
    for record in records:
        obj = record.get('s3', {})
        key = obj.get('object', {}).get('key', '')
        if 'key' not in event:
            key = unquote_plus(key)
        result = generate(obj.get('bucket', {}).get('name'), key)
        counts[result] = counts.get(result, 0) + 1
    return counts
