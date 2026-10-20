#!/usr/bin/env python3
"""Generate the app icons.

The mark is a four-point sparkle - the same ✦ the Extract tab uses - in white
on black, matching the app's palette. Drawn as a superellipse star so the sides
stay smoothly concave, rendered oversized and downsampled for clean edges.

    python3 scripts/make-icons.py
"""
import math
import pathlib

from PIL import Image, ImageDraw

APP = pathlib.Path(__file__).resolve().parent.parent / "app"

BG = (0, 0, 0)
FG = (255, 255, 255)

SS = 8          # supersampling factor
POINTINESS = 3.6  # higher = thinner points; 3.0 is a true astroid
FILL = 0.78     # fraction of the canvas the sparkle spans


def sparkle(size: int) -> Image.Image:
    """A white four-point sparkle on an opaque black square."""
    big = size * SS
    img = Image.new("RGB", (big, big), BG)
    draw = ImageDraw.Draw(img)

    c = big / 2
    r = big * FILL / 2

    pts = []
    for i in range(720):
        t = 2 * math.pi * i / 720
        cos_t, sin_t = math.cos(t), math.sin(t)
        # Signed power keeps the curve's sign while bowing the sides inward.
        x = r * math.copysign(abs(cos_t) ** POINTINESS, cos_t)
        y = r * math.copysign(abs(sin_t) ** POINTINESS, sin_t)
        pts.append((c + x, c + y))

    draw.polygon(pts, fill=FG)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    # Next.js file conventions: these filenames become the icon <link> tags.
    sparkle(180).save(APP / "apple-icon.png")       # iOS home screen
    sparkle(512).save(APP / "icon.png")             # favicon / manifest
    # Next's image pipeline requires the .ico's embedded PNG to be RGBA.
    ico = sparkle(64).convert("RGBA")
    ico.save(APP / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote apple-icon.png, icon.png, favicon.ico to", APP)


if __name__ == "__main__":
    main()
