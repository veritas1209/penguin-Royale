from pathlib import Path
import re

root = Path(__file__).resolve().parent
controller = (root / 'training-controller.js').read_text(encoding='utf8')
pattern = re.compile(r'barrier\("([^"]+)",\s*(-?[\d.]+),\s*(-?[\d.]+),\s*([\d.]+),\s*([\d.]+)([^)]*)\)')
barriers = []
for match in pattern.finditer(controller):
    name, x, z, width, depth, tail = match.groups()
    kind = 'container' if '"container"' in tail else 'sandbag' if '"sandbag"' in tail else 'crate' if '"crate"' in tail else 'wall'
    barriers.append((name, float(x), float(z), float(width), float(depth), kind))
assert len(barriers) >= 20, 'Training map obstacle layout changed; update map generator'

colors = {'wall': '#c4d2be', 'container': '#779892', 'sandbag': '#d3c9a5', 'crate': '#b59269'}
parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-41 -41 82 82" role="img" aria-label="창고 훈련장 배치도">',
         '<rect x="-41" y="-41" width="82" height="82" fill="#19393c"/>',
         '<rect x="-34" y="-31" width="68" height="62" rx="4" fill="#36514e" stroke="#91a998" stroke-width=".55"/>']
for p in range(-32, 33, 8):
    parts.append(f'<path d="M {p} -31 V 31 M -34 {p} H 34" stroke="#9bb1a2" stroke-opacity=".12" stroke-width=".25"/>')
parts += ['<path d="M -30 -27 H 30 M -30 27 H 30" stroke="#c3d5b9" stroke-opacity=".55" stroke-width=".4"/>',
          '<rect x="-11" y="-10" width="22" height="20" fill="#203b3b" stroke="#809d91" stroke-width=".4"/>']
for name, x, z, width, depth, kind in barriers:
    color = colors[kind]
    parts.append(f'<rect x="{x-width/2:g}" y="{z-depth/2:g}" width="{width:g}" height="{depth:g}" rx=".18" fill="{color}" stroke="#183d3b" stroke-width=".22"/>')
for x, z in ((0, 16), (0, -21), (-22, 0), (19, -3), (-22, 15), (22, 15)):
    parts.append(f'<circle cx="{x}" cy="{z}" r=".8" fill="#e6bd73" stroke="#1c3b3c" stroke-width=".3"/>')
parts += ['<circle cx="-6" cy="18" r="1.1" fill="#a8d7d0" stroke="#1c3b3c" stroke-width=".3"/>',
          '<path d="M 0 14 L -1.2 17 L 1.2 17 Z" fill="#f7dc9d"/>',
          '<text x="36" y="-34" fill="#eed99d" font-family="sans-serif" font-size="3.1" font-weight="700" text-anchor="end">N ↑</text>',
          '<text x="0" y="37" fill="#e5e7cd" font-family="sans-serif" font-size="2.7" font-weight="700" letter-spacing=".4" text-anchor="middle">WAREHOUSE TRAINING</text>',
          '</svg>']
destination = root.parent / 'dist' / 'assets' / 'training-map.svg'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(''.join(parts), encoding='utf8')
print('built training map with', len(barriers), 'obstacles')
