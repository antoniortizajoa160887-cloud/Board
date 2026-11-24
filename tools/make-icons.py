#!/usr/bin/env python3
"""Builds the Android launcher icons from the painted icon art.
tools/raw/icon-fg.png  the character on a transparent background. It goes on the navy background
(#0B1030) as the adaptive icon's foreground, and on a navy rounded square / circle for older phones.
Usage: python3 tools/make-icons.py"""
from PIL import Image, ImageDraw

RES = 'android/app/src/main/res'
SIZES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
NAVY = (11, 16, 48, 255)
GOLD = (245, 197, 66, 255)
fg = Image.open('tools/raw/icon-fg.png').convert('RGBA')

# Adaptive foreground: 108 dp canvas, the visible part is the middle 72 dp (inner 66%).
bbox = fg.getbbox() or (0, 0, fg.width, fg.height)
subject = fg.crop(bbox)

for name, px in SIZES.items():
    d = f'{RES}/mipmap-{name}'
    for out, round_ in (('ic_launcher', False), ('ic_launcher_round', True)):
        big = px * 4
        im = Image.new('RGBA', (big, big), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        edge = (0, 0, big - 1, big - 1)
        if round_: dr.ellipse(edge, fill=NAVY, outline=GOLD, width=big // 28)
        else: dr.rounded_rectangle(edge, radius=big // 5, fill=NAVY, outline=GOLD, width=big // 28)
        s = subject.copy()
        s.thumbnail((int(big * 0.8), int(big * 0.8)), Image.LANCZOS)
        layer = Image.new('RGBA', (big, big), (0, 0, 0, 0))
        layer.alpha_composite(s, ((big - s.width) // 2, (big - s.height) // 2 + big // 30))
        clip = Image.new('L', (big, big), 0)
        cd = ImageDraw.Draw(clip)
        inner = (big // 28, big // 28, big - big // 28, big - big // 28)
        if round_: cd.ellipse(inner, fill=255)
        else: cd.rounded_rectangle(inner, radius=big // 5, fill=255)
        layer.putalpha(Image.composite(layer.getchannel('A'), Image.new('L', (big, big), 0), clip))
        im.alpha_composite(layer)
        im.resize((px, px), Image.LANCZOS).save(f'{d}/{out}.png')
    side = round(px * 108 / 48)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    box = round(side * 0.66)
    s = subject.copy()
    s.thumbnail((box, box), Image.LANCZOS)
    canvas.alpha_composite(s, ((side - s.width) // 2, (side - s.height) // 2))
    canvas.save(f'{d}/ic_launcher_foreground.png')
print('icons written')
