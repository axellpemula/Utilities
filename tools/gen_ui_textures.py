#!/usr/bin/env python3
"""Textures for the Utils Vein Miner settings window (`RP/ui/uvm_settings.json`).

The window is drawn from a handful of small nine-slice images that are
generated here, so the whole look of the panel is defined in one file and can be
re-rendered after a palette or layout change.

    python3 tools/gen_ui_textures.py                     # (re)write the textures
    python3 tools/gen_ui_textures.py --preview FILE.png  # + a mock-up of the window
    python3 tools/gen_ui_textures.py --gallery DIR       # one mock-up per page

No third party modules: the PNGs are written with a small built-in encoder and
the preview uses a 5x7 bitmap font defined below, so `python3` is all you need.

Layout reference (keep in sync with `ui/uvm_settings.json`):

    title_bar   30px   textures/ui/utilities_vein_miner/title
    body        fill   textures/ui/utilities_vein_miner/panel
    row         24px   textures/ui/utilities_vein_miner/row{,_hover,_pressed}
"""
import json
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Utils Vein Miner RP" / "textures" / "ui" / "utilities_vein_miner"

# "Copper slate" palette: cold slate panels, warm hammered copper accents.
INK = (0x08, 0x0B, 0x10)
SLATE_DEEP = (0x16, 0x1E, 0x28)
SLATE = (0x1B, 0x25, 0x30)
SLATE_HI = (0x24, 0x31, 0x3F)
EDGE = (0x2E, 0x3C, 0x4C)
COPPER = (0xE0, 0x8A, 0x3E)
COPPER_PALE = (0xF7, 0xC8, 0x8A)
COPPER_DEEP = (0x8A, 0x4E, 0x1C)
WOOD = (0x8A, 0x5F, 0x3A)
WOOD_DEEP = (0x5A, 0x3B, 0x22)
TEXT = (0xE6, 0xEC, 0xF3)
DIM = (0x76, 0x89, 0x9C)

GLYPH_WIDTH = 5
GLYPH_HEIGHT = 7

# A 5x7 bitmap font, only for the preview image.
FONT = {
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "C": [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "G": [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    "J": ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
    ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
    ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
    "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
    "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
    "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
    ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
    "%": ["##..#", "##.#.", "..#..", ".#...", "#..##", "...##", "....."],
    "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
    "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
    ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
    "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
}


def rgba(colour, alpha=255):
    return (colour[0], colour[1], colour[2], alpha)


class Canvas:
    """A tiny RGBA raster with the few operations the textures need."""

    def __init__(self, width, height, fill=(0, 0, 0, 0)):
        self.width = width
        self.height = height
        self.pixels = [[fill for _ in range(width)] for _ in range(height)]

    def inside(self, x, y):
        return 0 <= x < self.width and 0 <= y < self.height

    def put(self, x, y, colour):
        """Source-over blend of `colour` on the pixel at `x, y`."""
        if not self.inside(x, y) or colour is None:
            return
        src = colour if len(colour) == 4 else rgba(colour)
        alpha = src[3]
        if alpha == 0:
            return
        if alpha == 255:
            self.pixels[y][x] = src
            return
        dst = self.pixels[y][x]
        sa, da = alpha / 255, dst[3] / 255
        out_alpha = sa + da * (1 - sa)
        if out_alpha == 0:
            self.pixels[y][x] = (0, 0, 0, 0)
            return
        blended = tuple(
            round((s * sa + d * da * (1 - sa)) / out_alpha) for s, d in ((src[0], dst[0]), (src[1], dst[1]), (src[2], dst[2]))
        )
        self.pixels[y][x] = (*blended, round(out_alpha * 255))

    def fill(self, colour):
        for y in range(self.height):
            for x in range(self.width):
                self.put(x, y, colour)

    def rect(self, x0, y0, x1, y1, colour):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                self.put(x, y, colour)

    def outline(self, x0, y0, x1, y1, colour):
        for x in range(x0, x1 + 1):
            self.put(x, y0, colour)
            self.put(x, y1, colour)
        for y in range(y0, y1 + 1):
            self.put(x0, y, colour)
            self.put(x1, y, colour)

    def line(self, x0, y0, x1, y1, colour):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        error = dx + dy
        while True:
            self.put(x0, y0, colour)
            if x0 == x1 and y0 == y1:
                return
            doubled = 2 * error
            if doubled >= dy:
                error += dy
                x0 += sx
            if doubled <= dx:
                error += dx
                y0 += sy

    def ellipse(self, cx, cy, rx, ry, colour):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / max(rx, 0.5)) ** 2 + ((y - cy) / max(ry, 0.5)) ** 2 <= 1:
                    self.put(x, y, colour)

    def text(self, x, y, message, colour):
        """Draws `message` with the 5x7 font, one pixel per dot."""
        cursor = x
        for character in message.upper():
            glyph = FONT.get(character, FONT["?"])
            for row, line in enumerate(glyph):
                for column, dot in enumerate(line):
                    if dot == "#":
                        self.put(cursor + column, y + row, colour)
            cursor += GLYPH_WIDTH + 1

    def scaled(self, factor):
        out = Canvas(self.width * factor, self.height * factor)
        for y in range(out.height):
            for x in range(out.width):
                out.pixels[y][x] = self.pixels[y // factor][x // factor]
        return out

    def blit(self, other, x, y):
        for sy in range(other.height):
            for sx in range(other.width):
                self.put(x + sx, y + sy, other.pixels[sy][sx])

    def to_png(self, path):
        raw = bytearray()
        for row in self.pixels:
            raw.append(0)  # filter: none
            for pixel in row:
                raw.extend(pixel)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(
            b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", struct.pack(">IIBBBBB", self.width, self.height, 8, 6, 0, 0, 0))
            + _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + _chunk(b"IEND", b"")
        )


def _chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def from_rows(rows, colours):
    """Builds an image from an ASCII map: `.` transparent, other keys from `colours`."""
    canvas = Canvas(len(rows[0]), len(rows))
    for y, line in enumerate(rows):
        for x, character in enumerate(line):
            colour = colours.get(character)
            if colour is not None:
                canvas.put(x, y, colour)
    return canvas


def framed(size, face, border, inner=None, alpha=255):
    """`size` square: `face` fill, one pixel `border`, optional one pixel `inner`."""
    canvas = Canvas(size, size)
    canvas.fill(rgba(face, alpha))
    canvas.outline(0, 0, size - 1, size - 1, rgba(border, 252))
    if inner is not None:
        canvas.outline(1, 1, size - 2, size - 2, rgba(inner, alpha))
    return canvas


# ----------------------------------------------------------------- textures --

def panel():
    canvas = framed(16, SLATE_DEEP, INK, EDGE, 246)
    for x, y in ((2, 2), (13, 2), (2, 13), (13, 13)):
        canvas.rect(x, y, x, y, rgba(COPPER_DEEP, 220))
        canvas.put(x, y, rgba(COPPER, 230))
    return canvas


def title():
    canvas = framed(16, SLATE, INK, None, 252)
    canvas.rect(1, 13, 14, 13, rgba(COPPER_DEEP, 240))
    canvas.rect(1, 14, 14, 14, rgba(COPPER, 240))
    canvas.put(1, 12, rgba(COPPER_PALE, 120))
    return canvas


def row_face(face, border, alpha=238):
    return framed(12, face, border, None, alpha)


def card():
    canvas = framed(12, (0, 0, 0), EDGE, None, 76)
    return canvas


def rule():
    canvas = Canvas(2, 1)
    canvas.put(0, 0, rgba(COPPER, 190))
    canvas.put(1, 0, rgba(COPPER, 190))
    return canvas


def scroll_handle():
    canvas = Canvas(3, 6)
    canvas.rect(0, 0, 2, 5, rgba(COPPER_DEEP, 235))
    canvas.rect(1, 1, 1, 4, rgba(COPPER, 235))
    return canvas


def scroll_track():
    canvas = Canvas(3, 6)
    canvas.rect(0, 0, 2, 5, rgba(INK, 130))
    return canvas


PICKAXE = [
    "................",
    "....########....",
    "..##ppccccpp##..",
    ".#cc##....##cc#.",
    ".#c#........#c#.",
    "..#..........#..",
    "......#ww#......",
    "......#ww#......",
    "......#ww#......",
    "......#ww#......",
    "......#ww#......",
    "......#ww#......",
    "......#ww#......",
    "......####......",
    "................",
    "................",
]


def pickaxe():
    return from_rows(
        PICKAXE,
        {
            "#": rgba(INK, 235),
            "p": rgba(COPPER_PALE, 255),
            "c": rgba(COPPER, 255),
            "w": rgba(WOOD, 255),
        },
    )


CHEVRON = [
    "##....",
    ".##...",
    "..##..",
    "...##.",
    "....##",
    "....##",
    "...##.",
    "..##..",
    ".##...",
    "##....",
]

CLOSE = [
    "................",
    "................",
    "..##........##..",
    "..###......###..",
    "...###....###...",
    "....###..###....",
    ".....######.....",
    "......####......",
    "......####......",
    ".....######.....",
    "....###..###....",
    "...###....###...",
    "..###......###..",
    "..##........##..",
    "................",
    "................",
]


def chevron():
    return from_rows(CHEVRON, {"#": rgba(COPPER, 235)})


def close_icon():
    return from_rows(CLOSE, {"#": rgba(TEXT, 235)})


def toggle(on):
    """20x11 pill; the knob is on the right when the setting is on."""
    canvas = Canvas(20, 11)
    face = COPPER if on else SLATE_HI
    border = COPPER_DEEP if on else EDGE
    knob = COPPER_PALE if on else DIM
    canvas.ellipse(9.5, 5, 9.5, 5, rgba(border, 245))
    canvas.ellipse(9.5, 5, 8.4, 4.0, rgba(face, 245))
    knob_x = 14.5 if on else 5.5
    canvas.ellipse(knob_x, 5, 3.2, 3.2, rgba(knob, 255))
    if on:
        canvas.put(int(knob_x) - 1, 4, rgba((255, 255, 255), 200))
    return canvas


def textures():
    """name -> (canvas, nine-slice [l, t, r, b] or None)."""
    return {
        "panel": (panel(), [5, 5, 5, 5]),
        "title": (title(), [4, 4, 4, 4]),
        "row": (row_face(SLATE, EDGE), [4, 4, 4, 4]),
        "row_hover": (row_face(SLATE_HI, COPPER_PALE, 250), [4, 4, 4, 4]),
        "row_pressed": (row_face(INK, COPPER_DEEP, 248), [4, 4, 4, 4]),
        "card": (card(), [4, 4, 4, 4]),
        "rule": (rule(), None),
        "scroll_handle": (scroll_handle(), [1, 2, 1, 1]),
        "scroll_track": (scroll_track(), [1, 2, 1, 1]),
        "pickaxe": (pickaxe(), None),
        "chevron": (chevron(), None),
        "close": (close_icon(), None),
        "toggle_on": (toggle(True), None),
        "toggle_off": (toggle(False), None),
    }


def write():
    OUT.mkdir(parents=True, exist_ok=True)
    made = textures()
    for name, (canvas, slice_) in made.items():
        canvas.to_png(OUT / f"{name}.png")
        descriptor = OUT / f"{name}.json"
        if slice_:
            descriptor.write_text(
                json.dumps({"nineslice_size": slice_, "base_size": [canvas.width, canvas.height]}, indent=2) + "\n"
            )
        elif descriptor.exists():
            descriptor.unlink()
        print(f"{name}.png {canvas.width}x{canvas.height}")
    return made


# ----------------------------------------------------------------- preview ---

def stretch(canvas, slice_, width, height):
    """Resizes a nine-slice image the way the game does."""
    left, top, right, bottom = slice_
    out = Canvas(width, height)
    columns = [
        (0, left, 0, left),
        (left, canvas.width - right, left, width - right),
        (canvas.width - right, canvas.width, width - right, width),
    ]
    rows = [
        (0, top, 0, top),
        (top, canvas.height - bottom, top, height - bottom),
        (canvas.height - bottom, canvas.height, height - bottom, height),
    ]
    for sx0, sx1, dx0, dx1 in columns:
        for sy0, sy1, dy0, dy1 in rows:
            if dx1 <= dx0 or dy1 <= dy0:
                continue
            for y in range(dy0, dy1):
                for x in range(dx0, dx1):
                    px = sx0 + min(sx1 - sx0 - 1, int((x - dx0) * (sx1 - sx0) / (dx1 - dx0)))
                    py = sy0 + min(sy1 - sy0 - 1, int((y - dy0) * (sy1 - sy0) / (dy1 - dy0)))
                    out.pixels[y][x] = canvas.pixels[py][px]
    return out


class MockPage:
    """A mock-up of one panel page, drawn with the shipped textures."""

    def __init__(self, made, width=320, height=226):
        self.made = made
        self.width, self.height = width, height
        self.scene = Canvas(width + 48, height + 48, rgba((0x3F, 0x53, 0x3F), 255))
        for y in range(self.scene.height):
            for x in range(self.scene.width):
                if (x // 8 + y // 8) % 2 == 0:
                    self.scene.put(x, y, rgba((0x45, 0x5A, 0x45), 255))
        self.offset_x = self.offset_y = 24
        self.left = 7
        self.row_width = width - 28
        self.y = 41

        self.put("title", 0, 0, width - 26, 30)
        self.put("row", width - 24, 3, 24, 24)
        self.scene.blit(made["close"][0], self.offset_x + width - 20, self.offset_y + 7)
        self.scene.blit(made["pickaxe"][0], self.offset_x + 7, self.offset_y + 7)
        self.scene.text(self.offset_x + 30, self.offset_y + 11, "VEIN MINER", rgba(COPPER_PALE))
        self.put("panel", 0, 34, width, height - 34)
        self.put("scroll_track", width - 13, 41, 4, height - 50)
        self.put("scroll_handle", width - 13, 41, 4, 52)

    def put(self, name, x, y, w, h):
        canvas, slice_ = self.made[name]
        # A slice of [0,0,0,0] stretches the whole image, which is what the
        # game does with the flat images (the rule) as well.
        self.scene.blit(stretch(canvas, slice_ or [0, 0, 0, 0], w, h), self.offset_x + x, self.offset_y + y)

    def header(self, label):
        self.scene.text(self.offset_x + self.left + 6, self.offset_y + self.y + 8, label, rgba(COPPER))
        self.put("rule", self.left + 4, self.y + 20, self.row_width - 8, 1)
        self.y += 22

    def divider(self):
        self.put("rule", self.left + 7, self.y + 4, self.row_width - 14, 1)
        self.y += 9

    def row(self, label, value, kind):
        self.put("row", self.left, self.y + 1, self.row_width, 24)
        self.scene.text(self.offset_x + self.left + 9, self.offset_y + self.y + 9, label, rgba(TEXT))
        if value:
            value_width = (len(value) + 1) * (GLYPH_WIDTH + 1)
            value_x = self.offset_x + self.left + self.row_width - 34 - value_width
            self.scene.text(value_x, self.offset_y + self.y + 9, value, rgba(COPPER_PALE))
        if kind in ("on", "off"):
            self.scene.blit(self.made["toggle_on" if kind == "on" else "toggle_off"][0],
                            self.offset_x + self.left + self.row_width - 28, self.offset_y + self.y + 7)
        else:
            self.scene.blit(self.made["chevron"][0],
                            self.offset_x + self.left + self.row_width - 15, self.offset_y + self.y + 8)
        self.y += 27

    def finish(self, path):
        self.scene.scaled(3).to_png(path)
        print(f"preview -> {path}")


def draw_main(page):
    page.header("MINING")
    page.row("FUNCTION", "ALL", "nav")
    page.row("TURN OFF AFTER", "NEVER", "nav")
    page.row("MAX SIZE", "64", "nav")
    page.row("ACTIVATION", "SNEAK", "nav")
    page.divider()
    page.header("APPEARANCE")
    page.row("SHOW EDGE", "ON", "on")
    page.row("SHOW EDGE WHEN SNEAKING", "ON", "on")
    page.row("EDGES ACCURACY", "OFF", "off")
    page.row("THICKNESS OF EDGES", "3", "nav")
    page.divider()
    page.header("ADVANCED")
    page.row("THIS TOOL", "ALL", "nav")
    page.row("NEVER MINE", "0", "nav")
    page.row("MORE SETTINGS", "", "nav")
    page.row("DELETE BLOCKS", "2", "nav")
    page.divider()
    page.row("DONE", "", "")


def draw_activation(page):
    page.header("ACTIVATION")
    page.row("REQUIRE SNEAKING", "ON", "on")
    page.row("ONLY MARKED TOOLS", "OFF", "off")
    page.row("MARK HELD TOOL", "MARKED", "")
    page.divider()
    page.row("BACK", "", "")


def draw_tool(page):
    page.header("THIS TOOL")
    page.row("USE TOOL PROFILES", "ON", "on")
    page.scene.text(page.offset_x + page.left + 9, page.offset_y + page.y + 3,
                    "FUNCTION: 3X3 TUNNEL", rgba((0x9A, 0x9A, 0x9A)))
    page.y += 12
    page.scene.text(page.offset_x + page.left + 9, page.offset_y + page.y + 3,
                    "MAX SIZE: 128", rgba((0x9A, 0x9A, 0x9A)))
    page.y += 14
    page.row("SAVE MY SETTINGS TO THIS TOOL", "", "")
    page.row("CLEAR THIS TOOL'S PROFILE", "", "")
    page.divider()
    page.row("BACK", "", "")


def draw_never_mine(page):
    page.header("NEVER MINE")
    page.scene.text(page.offset_x + page.left + 9, page.offset_y + page.y + 3,
                    "BLOCKS LEFT UNTOUCHED, EVEN INSIDE A VEIN.", rgba((0x9A, 0x9A, 0x9A)))
    page.y += 14
    page.row("STONE BRICKS", "", "on")
    page.row("MOSSY STONE BRICKS", "", "on")
    page.row("DEEPSLATE BRICKS", "", "off")
    page.row("POLISHED DEEPSLATE", "", "off")
    page.row("BRICKS", "", "on")
    page.row("QUARTZ BRICKS", "", "off")
    page.divider()
    page.row("BACK", "", "")


PAGES = {
    "panel-main.png": draw_main,
    "panel-activation.png": draw_activation,
    "panel-tool.png": draw_tool,
    "panel-never-mine.png": draw_never_mine
}


def preview(made, path):
    """Mock-up of the main page, close to what the game draws."""
    page = MockPage(made)
    draw_main(page)
    page.finish(path)


def gallery(made, directory):
    for name, draw in PAGES.items():
        page = MockPage(made)
        draw(page)
        page.finish(directory / name)


if __name__ == "__main__":
    made = write()
    if "--preview" in sys.argv:
        target = Path(sys.argv[sys.argv.index("--preview") + 1])
        if not target.is_absolute():
            target = ROOT / target
        preview(made, target)
    if "--gallery" in sys.argv:
        directory = Path(sys.argv[sys.argv.index("--gallery") + 1])
        if not directory.is_absolute():
            directory = ROOT / directory
        directory.mkdir(parents=True, exist_ok=True)
        gallery(made, directory)
