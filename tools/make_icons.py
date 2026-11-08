"""Genera le icone dell'estensione senza librerie esterne: src/icons/icon-<n>.png e src/icons/icon.svg.

Disegno: quadrato arrotondato verde acqua con due maglie di catena inclinate a 45 gradi,
una bianca e una ambra (il "link" e il "tag").
Ogni pixel è la media di SUPERSAMPLE x SUPERSAMPLE punti, così i bordi sono lisci e trasparenti.

Uso, dalla cartella del progetto:
    python -I tools/make_icons.py                  # scrive le icone in src/icons
    python -I tools/make_icons.py anteprima.png    # scrive anche una pagina di anteprima
"""
import math
import struct
import sys
import zlib
from pathlib import Path

SIZES = (16, 32, 48, 96, 128)
SUPERSAMPLE = 4
VIEW = 128.0  # il disegno è pensato su una tela di 128 x 128

TEAL_TOP = (20, 184, 166)
TEAL_BOTTOM = (15, 118, 110)
WHITE = (255, 255, 255)
AMBER = (251, 191, 36)

CORNER_RADIUS = 28.0
LINK_HALF_LENGTH = 30.0   # mezza lunghezza di una maglia
LINK_HALF_HEIGHT = 15.0   # mezza altezza (e raggio delle estremità arrotondate)
LINK_OFFSET = 19.0        # distanza del centro di ogni maglia dal centro dell'icona
LINK_STROKE = 12.0        # spessore del bordo della maglia
SQRT2 = math.sqrt(2.0)


def rounded_box_distance(x, y, cx, cy, half_w, half_h, radius):
    """Distanza con segno dal bordo di un rettangolo arrotondato (negativa dentro)."""
    qx = abs(x - cx) - (half_w - radius)
    qy = abs(y - cy) - (half_h - radius)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - radius


def lerp_color(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def sample(x, y):
    """Colore (r, g, b) del disegno nel punto (x, y) della tela, oppure None se è trasparente."""
    if rounded_box_distance(x, y, 64, 64, 64, 64, CORNER_RADIUS) > 0:
        return None
    color = lerp_color(TEAL_TOP, TEAL_BOTTOM, y / VIEW)
    # coordinate della catena: ruotate di 45 gradi attorno al centro, verso l'alto a destra
    qx, qy = x - 64, y - 64
    lx = (qx - qy) / SQRT2
    ly = (qx + qy) / SQRT2
    for offset, link_color in ((-LINK_OFFSET, WHITE), (LINK_OFFSET, AMBER)):
        d = rounded_box_distance(lx, ly, offset, 0, LINK_HALF_LENGTH, LINK_HALF_HEIGHT, LINK_HALF_HEIGHT)
        if abs(d) <= LINK_STROKE / 2:
            color = link_color
    return color


def render(size):
    """Restituisce size righe di size pixel RGBA (non premoltiplicati)."""
    scale = VIEW / size
    step = 1.0 / SUPERSAMPLE
    rows = []
    for py in range(size):
        row = []
        for px in range(size):
            covered = 0
            sr = sg = sb = 0.0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    color = sample((px + (sx + 0.5) * step) * scale, (py + (sy + 0.5) * step) * scale)
                    if color is not None:
                        covered += 1
                        sr += color[0]
                        sg += color[1]
                        sb += color[2]
            if covered == 0:
                row.append((0, 0, 0, 0))
            else:
                alpha = round(255 * covered / (SUPERSAMPLE * SUPERSAMPLE))
                row.append((round(sr / covered), round(sg / covered), round(sb / covered), alpha))
        rows.append(row)
    return rows


def png_bytes(rows):
    """Codifica righe di pixel RGBA in un file PNG."""
    height, width = len(rows), len(rows[0])

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(channel for pixel in row for channel in pixel) for row in rows)
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def svg_text():
    """Lo stesso disegno in SVG, per usarlo come sorgente."""
    def link(offset, stroke_color):
        x = 64 + offset - LINK_HALF_LENGTH
        y = 64 - LINK_HALF_HEIGHT
        return (f'    <rect x="{x:g}" y="{y:g}" width="{2 * LINK_HALF_LENGTH:g}" height="{2 * LINK_HALF_HEIGHT:g}" '
                f'rx="{LINK_HALF_HEIGHT:g}" stroke="{stroke_color}"/>')

    top = "#%02x%02x%02x" % TEAL_TOP
    bottom = "#%02x%02x%02x" % TEAL_BOTTOM
    return "\n".join([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">',
        '  <defs>',
        '    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">',
        f'      <stop offset="0" stop-color="{top}"/>',
        f'      <stop offset="1" stop-color="{bottom}"/>',
        '    </linearGradient>',
        '  </defs>',
        f'  <rect width="128" height="128" rx="{CORNER_RADIUS:g}" fill="url(#bg)"/>',
        f'  <g transform="rotate(-45 64 64)" fill="none" stroke-width="{LINK_STROKE:g}">',
        link(-LINK_OFFSET, "#ffffff"),
        link(LINK_OFFSET, "#%02x%02x%02x" % AMBER),
        '  </g>',
        '</svg>',
        '',
    ])


def preview_rows(rendered):
    """Pagina di anteprima: icone su fondo chiaro e scuro, ingrandite (per i dettagli) e a grandezza reale."""
    panels = []
    for background in ((249, 249, 251), (28, 27, 34)):
        zoomed = [(16, 6), (32, 3), (48, 2), (96, 1), (128, 1)]
        real = [16, 32, 48, 96, 128]
        pad = 12
        panel_w = pad + sum(s * z + pad for s, z in zoomed)
        panel_h = pad + 128 + pad + 128 + pad
        canvas = [[background + (255,) for _ in range(panel_w)] for _ in range(panel_h)]

        def paste(icon, left, top, zoom):
            for y, row in enumerate(icon):
                for x, (r, g, b, a) in enumerate(row):
                    for dy in range(zoom):
                        for dx in range(zoom):
                            old = canvas[top + y * zoom + dy][left + x * zoom + dx]
                            k = a / 255.0
                            canvas[top + y * zoom + dy][left + x * zoom + dx] = (
                                round(r * k + old[0] * (1 - k)), round(g * k + old[1] * (1 - k)),
                                round(b * k + old[2] * (1 - k)), 255)

        x = pad
        for size, zoom in zoomed:
            paste(rendered[size], x, pad, zoom)
            x += size * zoom + pad
        x = pad
        for size in real:
            paste(rendered[size], x, pad + 128 + pad, 1)
            x += size + pad
        panels.append(canvas)
    return [panels[0][y] + panels[1][y] for y in range(len(panels[0]))]


def main():
    folder = Path(__file__).resolve().parent.parent / "src" / "icons"
    folder.mkdir(parents=True, exist_ok=True)
    rendered = {size: render(size) for size in SIZES}
    for size, rows in rendered.items():
        (folder / f"icon-{size}.png").write_bytes(png_bytes(rows))
    (folder / "icon.svg").write_text(svg_text(), encoding="utf-8")
    print("icone scritte in", folder)
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_bytes(png_bytes(preview_rows(rendered)))
        print("anteprima scritta in", sys.argv[1])


if __name__ == "__main__":
    main()
