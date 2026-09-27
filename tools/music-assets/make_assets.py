"""Builds the site's background music from the file kept beside this script.

Source: source-ambient-piano.mp3 - "Ambient Piano" by AtlasAudio, downloaded from
https://pixabay.com/music/ambient-ambient-piano-580084/ (free for use under the Pixabay Content License:
https://pixabay.com/service/license-summary/ - no attribution required, personal and commercial use both allowed).
Untouched original: MP3, 44.1 kHz stereo, 256 kb/s, 3:04.

Writes public/media/background-music.mp3: the same audio re-encoded at 128 kb/s (about half the size; a guest cannot
tell the difference on a phone speaker for a quiet piano-and-pad piece like this one, and it is downloaded once and
then simply loops, so the smaller file matters more than it would for a one-off sound). The track already has a
short natural quiet moment at both its very start and its very end, so it loops without an audible click.

Usage (needs imageio-ffmpeg, already a dependency of the other asset scripts' Python environment):
  python make_assets.py
"""
import os
import subprocess

from imageio_ffmpeg import get_ffmpeg_exe

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media'))
SRC = os.path.join(HERE, 'source-ambient-piano.mp3')
DST = os.path.join(OUT, 'background-music.mp3')

subprocess.run([get_ffmpeg_exe(), '-y', '-i', SRC, '-ac', '2', '-ar', '44100', '-b:a', '128k', '-codec:a', 'libmp3lame', DST], check=True)
print(f'background-music.mp3  {os.path.getsize(DST) // 1024} kB')
