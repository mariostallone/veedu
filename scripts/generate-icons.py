#!/usr/bin/env python3
"""Generates the Veedu app icon, splash, favicon and Android adaptive icon layers.

Usage: python3 scripts/generate-icons.py   (needs Pillow)
The mark is a house with a warm window on the cardamom green (#0E7A5C) of the app palette.
"""
from pathlib import Path
from PIL import Image, ImageDraw

GREEN = (14, 122, 92, 255)
SOFT = (227, 242, 235, 255)
WHITE = (255, 255, 255, 255)
TURMERIC = (233, 178, 62, 255)
OUT = Path(__file__).resolve().parent.parent / "assets" / "images"
SS = 4  # supersampling factor for smooth edges


def house(size, fill=WHITE, window=TURMERIC, door=GREEN):
    """A house mark on a transparent square canvas; the shape fills ~62% of `size`."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = s / 100.0

    def p(x, y):
        return (x * u, y * u)

    # Roof (chevron) and body, centred in a 100x100 box, mark spans x 19..81, y 22..78.
    d.polygon([p(50, 20), p(84, 50), p(78, 56), p(50, 31), p(22, 56), p(16, 50)], fill=fill)
    d.polygon([p(26, 54), p(50, 34), p(74, 54), p(74, 78), p(26, 78)], fill=fill)
    # Door and window.
    d.rounded_rectangle([p(44, 58), p(56, 78)], radius=3 * u, fill=door)
    if window:
        d.ellipse([p(46.5, 43), p(53.5, 50)], fill=window)
    return img.resize((size, size), Image.LANCZOS)


def on_square(size, bg, scale):
    base = Image.new("RGBA", (size, size), bg)
    mark = house(int(size * scale))
    off = (size - mark.width) // 2
    base.alpha_composite(mark, (off, off))
    return base


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # iOS requires an opaque icon.
    on_square(1024, GREEN, 1.05).convert("RGB").save(OUT / "icon.png")
    # Splash: mark only; the background colour comes from the expo-splash-screen plugin.
    house(512).save(OUT / "splash-icon.png")
    on_square(192, GREEN, 1.15).save(OUT / "favicon.png")
    # Android adaptive icon: 108dp canvas, keep the mark inside the central 66% safe zone.
    Image.new("RGBA", (512, 512), GREEN).save(OUT / "android-icon-background.png")
    house(512).save(OUT / "android-icon-foreground.png")
    mono = house(432, fill=(0, 0, 0, 255), window=None, door=(0, 0, 0, 0))
    # Cut the door out of the silhouette for the themed (monochrome) icon.
    d = ImageDraw.Draw(mono)
    u = 432 / 100.0
    mono_alpha = mono.split()[3]
    cut = Image.new("L", mono.size, 0)
    ImageDraw.Draw(cut).rounded_rectangle([44 * u, 58 * u, 56 * u, 78 * u], radius=3 * u, fill=255)
    mono_alpha.paste(0, mask=cut)
    mono.putalpha(mono_alpha)
    mono.save(OUT / "android-icon-monochrome.png")


if __name__ == "__main__":
    main()
