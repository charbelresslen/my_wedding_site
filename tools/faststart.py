"""Moves the 'moov' box (the index of an MP4: where every frame is) in front of the 'mdat' box (the frames themselves),
so a browser can start playing as soon as the first bytes arrive instead of having to fetch the end of the file first.
Nothing is re-encoded: the picture and the sound are byte for byte the same, only the order of the boxes changes (the
chunk offsets inside the index are shifted to follow). It is what `ffmpeg -c copy -movflags +faststart` does, without
needing ffmpeg.

Some in-app browsers (Telegram, Max) and slow or filtered connections do not ask for the end of a file in a separate
request, and for a file whose index is at the end the video then never starts. Run it on every new envelope.mp4:

  python tools/faststart.py public/media/envelope.mp4        (rewrites the file in place; does nothing if already fast)
"""
import struct
import sys

CONTAINERS = {b'moov', b'trak', b'mdia', b'minf', b'stbl', b'edts', b'dinf'}


def boxes(data, start, end):
    pos = start
    while pos + 8 <= end:
        size, kind = struct.unpack('>I4s', data[pos:pos + 8])
        header = 8
        if size == 1:
            size = struct.unpack('>Q', data[pos + 8:pos + 16])[0]
            header = 16
        elif size == 0:
            size = end - pos
        yield kind, pos, header, size
        pos += size


def shift_offsets(moov, delta):
    """Adds delta to every chunk offset (stco / co64) in a moov box, in place."""
    moov = bytearray(moov)

    def walk(start, end):
        for kind, pos, header, size in boxes(moov, start, end):
            if kind in CONTAINERS:
                walk(pos + header, pos + size)
            elif kind == b'stco':
                count = struct.unpack('>I', moov[pos + header + 4:pos + header + 8])[0]
                for i in range(count):
                    at = pos + header + 8 + 4 * i
                    moov[at:at + 4] = struct.pack('>I', struct.unpack('>I', moov[at:at + 4])[0] + delta)
            elif kind == b'co64':
                count = struct.unpack('>I', moov[pos + header + 4:pos + header + 8])[0]
                for i in range(count):
                    at = pos + header + 8 + 8 * i
                    moov[at:at + 8] = struct.pack('>Q', struct.unpack('>Q', moov[at:at + 8])[0] + delta)

    walk(0, len(moov))
    return bytes(moov)


def faststart(path):
    data = open(path, 'rb').read()
    top = list(boxes(data, 0, len(data)))
    order = [kind for kind, *_ in top]
    if b'moov' not in order or b'mdat' not in order:
        sys.exit('not an MP4 with moov and mdat')
    if order.index(b'moov') < order.index(b'mdat'):
        print('already fast: moov comes first')
        return
    moov_at = next(p for k, p, h, s in top if k == b'moov')
    moov_size = next(s for k, p, h, s in top if k == b'moov')
    moov = data[moov_at:moov_at + moov_size]
    # moov goes right after ftyp (and any boxes that already precede the frames), so every frame moves by its size
    out = bytearray()
    placed = False
    for kind, pos, header, size in top:
        if kind == b'moov':
            continue
        if kind == b'mdat' and not placed:
            out += shift_offsets(moov, moov_size)
            placed = True
        out += data[pos:pos + size]
    assert len(out) == len(data)
    open(path, 'wb').write(out)
    print(f'moved moov ({moov_size} bytes) in front of mdat; {len(out)} bytes')


if __name__ == '__main__':
    faststart(sys.argv[1])
