# Brat API

Brat text/image/video generator + memegen-compatible meme API with a live web dashboard.

Generate brat-style images, typing-effect videos, canvas animations, and classic memes — all from a single self-hosted API server.

---

## Features

- **Brat Image** (`/generate`) — Static brat text image (6 themes: white, green, black, red, strike, blue)
- **Brat Video** (`/bratvid`) — Per-word typing animation video (MP4/GIF)
- **Realtime Typing** (`/bratvid-realtime`) — Human-like typing simulation with random per-character delays
- **Canvas** (`/canvas`) — Canvas-based typing effect with emoji support and multiple fonts
- **Meme Custom** (`/meme`) — Overlay top/bottom text on any image/video URL; supports custom animated backgrounds (gif/webp/mp4) and multi-image overlays
- **Meme Templates** (`/meme/:id/:text1/:text2/...`) — 200+ memegen-compatible templates with accurate font/color/positioning from config.yml; animated templates (gif/webp/mp4 output) and overlay slots
- **Meme Fonts** (`/meme/fonts`) — List all available fonts
- **Meme Templates List** (`/meme/templates`) — Full JSON metadata for all templates (`animated`, `overlay` count, `lines`, etc.)
- **Web Dashboard** (`/dashboard`) — Interactive live playground for all endpoints

---

## Requirements

| Dependency | Required for | Min Version |
|---|---|---|
| Node.js | All endpoints | 18+ |
| Playwright (Chromium) | `/generate`, `/bratvid`, `/bratvid-realtime` | 1.49+ |
| ffmpeg | `/bratvid`, `/bratvid-realtime`, `/canvas` | any |
| `@napi-rs/canvas` | `/meme`, `/canvas` | bundled via npm |

Image-only endpoints (`/generate`, `/meme`) work without ffmpeg.

---

## Installation

### Linux / macOS

```bash
git clone https://github.com/findme-19/brat-api.git
cd brat-api
chmod +x setup.sh
./setup.sh
```

Or manually:

```bash
git clone https://github.com/findme-19/brat-api.git
cd brat-api
npm install
npx playwright install chromium
# Linux only: install system deps for chromium
sudo npx playwright install-deps chromium
# ffmpeg (for video endpoints)
sudo apt-get install -y ffmpeg   # Debian/Ubuntu
brew install ffmpeg               # macOS
```

### Windows

```cmd
git clone https://github.com/findme-19/brat-api.git
cd brat-api
setup.bat
```

Or manually:

```cmd
git clone https://github.com/findme-19/brat-api.git
cd brat-api
npm install
npx playwright install chromium
```

For ffmpeg on Windows: download from https://ffmpeg.org/download.html and add to PATH.

---

## Running

### Development / Direct

```bash
npm start
# or
node app.js
```

Server starts on `http://localhost:3000`.

### With PM2 (production, Linux)

```bash
npm run pm2:start
npm run pm2:restart
npm run pm2:stop
npm run pm2:logs
```

### With custom port

```bash
PORT=8080 npm start
```

### Vercel (serverless)

> **Note:** Vercel is serverless — Playwright (Chromium) and ffmpeg are **not available** in the default Vercel runtime. Only `/meme`, `/meme/templates`, `/meme/fonts`, and `/meme/:id/*` endpoints (which use `@napi-rs/canvas`, not Playwright) will work on Vercel. For full functionality (brat images/videos), use Linux/Windows/VPS deployment.

```bash
npm install -g vercel
vercel
```

The `vercel.json` is pre-configured. Set the `PORT` env var if needed (Vercel sets this automatically).

---

## API Endpoints

### Brat Image

```
GET /generate?text=hello&theme=white&width=924&height=1418
```

| Param | Default | Description |
|---|---|---|
| `text` | `brat` | Text to render |
| `theme` | `white` | white, green, black, red, strike, blue |
| `background` | — | Custom background color (hex, e.g. `#ff00ff`) |
| `color` | — | Custom text color |
| `width` | `924` | Image width (500-2048) |
| `height` | `1418` | Image height (400-2048) |

### Brat Video

```
GET /bratvid?text=hello%20world&format=mp4&fps=25&duration=1&loop=0
```

### Realtime Typing

```
GET /bratvid-realtime?text=typing%20sim&charDelayMin=40&charDelayMax=60&spaceDelay=200&format=mp4
```

### Canvas

```
GET /canvas?text=canvas%20effect&theme=white&font=arialnarrow&format=mp4&frameDuration=0.35
```

### Meme Custom (your own image)

```http
GET /meme?image=https://example.com/photo.jpg&top=TOP%20TEXT&bottom=BOTTOM%20TEXT&font=default&format=jpg
```

| Param | Default | Description |
|---|---|---|
| `image` | — | Image or video URL. Auto-detects animated (gif/webp/mp4) vs static (jpg/png) and renders accordingly. |
| `top` | — | Top caption (optional) |
| `bottom` | — | Bottom caption (optional) |
| `style` | — | Overlay image URL(s), comma-separated for multiple overlays (optional) |
| `layout` | `default` | `default` or `top` (draws top text in a dedicated white panel) |
| `font` | `default` | Caption font: default, impact, noto, comic, tahoma, tiny, micro |
| `fontsize` | auto | Caption font size in px |
| `format` | `jpg` | Output format: `jpg`, `png`, `gif`, `webp`, `mp4` (animated formats only when input is animated) |

### Meme Template (memegen-compatible)

```http
GET /meme/drake/left_on_unread/left_on_read
GET /meme/3hd/Pepperoni/Mushroom/Pineapple
GET /meme/pigeon/Engineer/PowerPoint/Is_this_Photoshop~q
GET /meme/bongo/top_text/bottom_text?format=gif&style=https://example.com/overlay.png
```

Path segments are memegen-style encoded: `_` = space, `~q` = `?`, `~_` = literal underscore. Supports up to 8 text segments (depending on template `lines`).

Query params (optional):

| Param | Description |
|---|---|
| `style` | Overlay image URL(s), comma-separated, fills template overlay slots in order |
| `font` | Font key (default: `thick`) |
| `layout` | `default` or `top` |
| `format` | `jpg`, `png`, `gif`, `webp`, `mp4`. Animated templates support all formats; static templates only `jpg`/`png` (animated formats are ignored/fallback to static).

### Meme Fonts

```http
GET /meme/fonts
```

### Meme Templates List

```http
GET /meme/templates
```

Returns JSON with `id`, `name`, `lines`, `source`, `keywords`, `example`, `overlay` (slot count), `animated` (whether the template has an animated gif), and `url` for all 200+ templates.

---

## Web Dashboard

Open `http://localhost:3000/dashboard` (or `/dash`) for an interactive playground.

Features:
- Tab per endpoint with live form inputs
- Font picker dropdown (populated from `/meme/fonts`)
- Template picker: searchable combobox (type to filter), ordered A-Z, shows overlay count
- Dynamic text inputs per template (1-8 fields based on template `lines`)
- Auto-generated overlay input fields for templates with overlay slots
- Template list with search, A-Z order, and example meme thumbnails
- Format dropdown auto-adjusts: animated templates offer gif/webp/mp4, static templates only jpg/png
- Example preview images
- Loading state on Generate button
- CDN icons (Font Awesome), no emoji

---

## Project Structure

```
brat-api/
├── app.js                  # Express server, all routes, Playwright browser lifecycle
├── memeGen.js              # Meme generator (custom + template mode, font registry, canvas rendering)
├── bratCanvas.js           # Canvas-based typing effect with emoji
├── package.json
├── vercel.json             # Vercel serverless config
├── setup.sh                # Linux/macOS setup script
├── setup.bat               # Windows setup script
├── site/
│   ├── html/index.html     # Brat generator HTML (for Playwright screenshot)
│   ├── dashboard.html      # Web dashboard playground
│   ├── fonts/              # 14 fonts (Arial Narrow, TitilliumWeb-Black/SemiBold, Impact, Kalam, etc.)
│   └── meme-templates/     # 200+ templates (flat: {id}.jpg/png + {id}.yml)
├── public/
│   └── examples/           # Pre-generated example outputs for dashboard
├── cache/                  # 30-min filesystem cache (auto-pruned)
└── tmp/                    # Temporary frames and video output
```

---

## Meme Template Font Mapping

Templates use memegen's original font names, mapped to local font files:

| Config `font` | Font File | Family |
|---|---|---|
| `thick` (default) | TitilliumWeb-Black.ttf | `Thick` |
| `thin` | TitilliumWeb-SemiBold.ttf | `ThinMeme` |
| `impact` | Impact.ttf | `ImpactTTF` |
| `comic` / `kalam` | Kalam-Regular.ttf | `KalamRG` |
| `noto` / `sans` | NotoSans-Bold.ttf | `NotoMeme` |
| `tiny` / `segoe` | Segoe UI Bold.ttf | `Tiny` |
| `jp` / `mincho` | HG-Mincho-B.ttc | `HGMincho` |
| `he` / `hebrew` | NotoSansHebrew-Bold.ttf | `HebrewMeme` |

Custom mode (`/meme?image=`) defaults to **Arial Narrow** (`MemeFont`). Override with `?font=<id>`.

---

## Caching

All endpoints use a 30-minute filesystem cache with SHA-256 hash keys. Responses include `X-Cache: HIT` or `X-Cache: MISS` headers. Expired entries are auto-pruned.

---

## License

MIT
