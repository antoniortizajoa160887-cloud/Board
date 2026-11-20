#!/usr/bin/env python3
"""Split one recorded take of 15 bingo calls into one file per number.
Usage: split-calls.py raw.mp3 out_dir first_number   (fails unless exactly 15 spoken parts are found)"""
import re, subprocess, sys
raw, out, first = sys.argv[1], sys.argv[2], int(sys.argv[3])
min_gap = sys.argv[4] if len(sys.argv) > 4 else '0.22'
log = subprocess.run(['ffmpeg', '-hide_banner', '-i', raw, '-af', 'silencedetect=noise=-38dB:d=' + min_gap + '', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
dur = float(re.search(r'Duration: (\d+):(\d+):([\d.]+)', log).groups()[2]) + 60 * int(re.search(r'Duration: (\d+):(\d+)', log).group(2))
starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
# speech = gaps between silences
edges = sorted([(s, 's') for s in starts] + [(e, 'e') for e in ends])
parts, cur = [], 0.0 if not edges or edges[0][1] != 'e' else None
for t, k in edges:
    if k == 's' and cur is not None:
        if t - cur > 0.15: parts.append((cur, t))
        cur = None
    elif k == 'e': cur = t
if cur is not None and dur - cur > 0.15: parts.append((cur, dur))
if len(parts) != 15:
    sys.exit(f'{raw}: found {len(parts)} parts, expected 15: {parts}')
import os; os.makedirs(out, exist_ok=True)
for i, (a, b) in enumerate(parts):
    a, b = max(0, a - 0.05), min(dur, b + 0.08)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-c:a', 'libmp3lame', '-q:a', '5', f'{out}/{first + i}.mp3'], check=True)
print(raw, 'ok', [round(b - a, 2) for a, b in parts])
