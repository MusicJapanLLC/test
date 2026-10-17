"""Deterministic typography card; no generated or externally sourced photographs."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
image = Image.new('RGB', (1200, 630), '#eef2e9')
draw = ImageDraw.Draw(image)
sans = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
serif = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
bold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def text(x, y, value, size, color='#173f41', family=sans):
    draw.text((x, y), value, font=ImageFont.truetype(family, size), fill=color)
draw.rounded_rectangle((62, 55, 144, 137), radius=19, fill='#1f625e')
text(80, 58, 'e.', 65, '#f4f6e9', serif)
text(168, 65, 'MUSIC JAPAN LEARNING', 20, family=bold)
text(168, 102, 'INTERMEDIATE TO ADVANCED', 15, '#617572')
text(60, 185, 'Your next', 81, family=serif)
text(60, 279, 'conversation.', 81, family=serif)
draw.line((63, 414, 1135, 414), fill='#b4c5b7', width=2)
text(65, 451, 'CHUNKS  /  VOCABULARY  /  REAL-LIFE ENGLISH', 22, family=bold)
text(65, 528, 'SAY MORE. KEEP IT REAL.', 20)
text(856, 531, 'music-japan.com', 19)
image.save(root / 'learning/english/og.png', optimize=True)
print('Created English social card, 1200 x 630')
