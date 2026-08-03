const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const WebP = require('node-webpmux')
const fs = require('fs')
const { writeFileSync, existsSync, mkdirSync, readFileSync } = fs
const path = require('path')
const crypto = require('crypto')
const https = require('https')
const http = require('http')
const yaml = require('js-yaml')
const FONT_PATH = path.join(__dirname, 'site', 'fonts', 'arial_narrow-webfont.woff')
const FONT_ANTON = path.join(__dirname, 'site', 'fonts', 'anton.woff')
const FONT_NOTO = path.join(__dirname, 'site', 'fonts', 'notosans-bold.woff')
const FONT_KALAM = path.join(__dirname, 'site', 'fonts', 'kalam.woff')
const FONT_IMPACT = path.join(__dirname, 'site', 'fonts', 'Impact.ttf')
const FONT_TITILLIUM = path.join(__dirname, 'site', 'fonts', 'TitilliumWeb-Black.ttf')
const FONT_SEGOE = path.join(__dirname, 'site', 'fonts', 'Segoe UI Bold.ttf')
const FONT_TAHOMA = path.join(__dirname, 'site', 'fonts', 'Tahoma-Bold.ttf')
const FONT_MICROFLF = path.join(__dirname, 'site', 'fonts', 'MicroFLF-Bold.ttf')
const FONT_NOTOHEB = path.join(__dirname, 'site', 'fonts', 'NotoSansHebrew-Bold.ttf')
const FONT_KALAM_RG = path.join(__dirname, 'site', 'fonts', 'Kalam-Regular.ttf')
const FONT_MINCHO = path.join(__dirname, 'site', 'fonts', 'HG-Mincho-B.ttc')
const FONT_TITILLIUM_SEMI = path.join(__dirname, 'site', 'fonts', 'TitilliumWeb-SemiBold.ttf')
const CACHE_DIR = path.join(__dirname, 'cache', 'meme')
const TTL_MS = 30 * 60 * 1000

let fontReady = false
function ensureFont() {
  if (fontReady) return
  if (existsSync(FONT_PATH)) GlobalFonts.registerFromPath(FONT_PATH, 'MemeFont')
  if (existsSync(FONT_ANTON)) GlobalFonts.registerFromPath(FONT_ANTON, 'AntonMeme')
  if (existsSync(FONT_NOTO)) GlobalFonts.registerFromPath(FONT_NOTO, 'NotoMeme')
  if (existsSync(FONT_KALAM_RG)) GlobalFonts.registerFromPath(FONT_KALAM_RG, 'KalamRG')
  if (existsSync(FONT_IMPACT)) GlobalFonts.registerFromPath(FONT_IMPACT, 'ImpactTTF')
  if (existsSync(FONT_TITILLIUM)) GlobalFonts.registerFromPath(FONT_TITILLIUM, 'Thick')
  if (existsSync(FONT_TITILLIUM_SEMI)) GlobalFonts.registerFromPath(FONT_TITILLIUM_SEMI, 'ThinMeme')
  if (existsSync(FONT_SEGOE)) GlobalFonts.registerFromPath(FONT_SEGOE, 'Tiny')
  if (existsSync(FONT_TAHOMA)) GlobalFonts.registerFromPath(FONT_TAHOMA, 'TahomaMeme')
  if (existsSync(FONT_MICROFLF)) GlobalFonts.registerFromPath(FONT_MICROFLF, 'MicroFLF')
  if (existsSync(FONT_NOTOHEB)) GlobalFonts.registerFromPath(FONT_NOTOHEB, 'HebrewMeme')
  if (existsSync(FONT_MINCHO)) GlobalFonts.registerFromPath(FONT_MINCHO, 'HGMincho')
  if (existsSync(FONT_KALAM_RG)) GlobalFonts.registerFromPath(FONT_KALAM_RG, 'KalamRG')
  fontReady = true
}

// map font param -> registered family (falls back to Impact-like Anton)
function resolveFontFamily(fontParam) {
  const f = (fontParam || 'default').toLowerCase()
  // memegen: thick (DEFAULT) = TitilliumWeb-Black; impact = Impact.ttf
  if (f === 'thick') return 'Thick'
  if (f === 'impact') return 'ImpactTTF'
  if (f === 'titillium' || f === 'titilliumweb') return 'Thick'
  if (f === 'noto' || f === 'sans') return 'NotoMeme'
  if (f === 'comic' || f === 'kalam') return 'KalamRG'
  if (f === 'thin' || f === 'titillium-thin' || f === 'titilliumweb-thin') return 'ThinMeme'
  if (f === 'tahoma') return 'TahomaMeme'
  if (f === 'tiny' || f === 'segoe') return 'Tiny'
  if (f === 'micro') return 'MicroFLF'
  if (f === 'he' || f === 'hebrew') return 'HebrewMeme'
  if (f === 'jp' || f === 'mincho') return 'HGMincho'
  if (f === 'anton') return 'AntonMeme'
  return 'MemeFont'
}

// list of available fonts for the custom /meme endpoint (?font=)
const AVAILABLE_FONTS = [
  { id: 'default', family: 'MemeFont', file: 'arial_narrow-webfont.woff', note: 'Arial Narrow (default custom mode)' },
  { id: 'thick', family: 'Thick', file: 'TitilliumWeb-Black.ttf', note: 'Titillium Web Black (memegen default)' },
  { id: 'thin', family: 'ThinMeme', file: 'TitilliumWeb-SemiBold.ttf', note: 'Titillium Web SemiBold (memegen thin)' },
  { id: 'impact', family: 'ImpactTTF', file: 'Impact.ttf', note: 'Impact' },
  { id: 'noto', family: 'NotoMeme', file: 'notosans-bold.woff', note: 'Noto Sans Bold' },
  { id: 'kalam', family: 'KalamRG', file: 'Kalam-Regular.ttf', note: 'Kalam (comic)' },
  { id: 'comic', family: 'KalamRG', file: 'Kalam-Regular.ttf', note: 'alias of kalam' },
  { id: 'segoe', family: 'Tiny', file: 'Segoe UI Bold.ttf', note: 'Segoe UI Bold (tiny)' },
  { id: 'tiny', family: 'Tiny', file: 'Segoe UI Bold.ttf', note: 'alias of segoe' },
  { id: 'tahoma', family: 'TahomaMeme', file: 'Tahoma-Bold.ttf', note: 'Tahoma Bold' },
  { id: 'anton', family: 'AntonMeme', file: 'anton.woff', note: 'Anton (custom)' },
  { id: 'micro', family: 'MicroFLF', file: 'MicroFLF-Bold.ttf', note: 'MicroFLF Bold' },
  { id: 'he', family: 'HebrewMeme', file: 'NotoSansHebrew-Bold.ttf', note: 'Noto Sans Hebrew' },
  { id: 'jp', family: 'HGMincho', file: 'HG-Mincho-B.ttc', note: 'HG Mincho (JP)' },
]

// parse memegen config.yml with js-yaml (accurate)
function parseConfigYaml(text) {
  const doc = yaml.load(text)
  if (!doc || typeof doc !== 'object') return { text: [] }
  const out = { text: [] }
  out.name = typeof doc.name === 'string' ? doc.name : ''
  out.source = typeof doc.source === 'string' ? doc.source : ''
  out.keywords = Array.isArray(doc.keywords) ? doc.keywords.filter((k) => typeof k === 'string') : []
  out.example = Array.isArray(doc.example) ? doc.example.filter((e) => e !== '') : []
  if (Array.isArray(doc.text)) {
    for (const t of doc.text) {
      if (!t || typeof t !== 'object') continue
      out.text.push({
        style: t.style || 'upper',
        color: t.color || 'white',
        font: t.font || 'thick',
        anchor_x: t.anchor_x != null ? Number(t.anchor_x) : 0.0,
        anchor_y: t.anchor_y != null ? Number(t.anchor_y) : 0.0,
        angle: t.angle != null ? Number(t.angle) : 0.0,
        scale_x: t.scale_x != null ? Number(t.scale_x) : 1.0,
        scale_y: t.scale_y != null ? Number(t.scale_y) : 0.2,
        align: (t.align || 'center').toLowerCase(),
        start: t.start != null ? Number(t.start) : 0.0,
        stop: t.stop != null ? Number(t.stop) : 1.0,
      })
    }
  }
  if (Array.isArray(doc.overlay)) out.overlay = doc.overlay
  return out
}

function cacheKey(params) {
  const raw = JSON.stringify(params)
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function cacheRead(key) {
  const p = path.join(CACHE_DIR, `${key}.bin`)
  if (!existsSync(p)) return null
  const meta = path.join(CACHE_DIR, `${key}.meta.json`)
  if (!existsSync(meta)) return null
  try {
    const m = JSON.parse(readFileSync(meta, 'utf-8'))
    if (Date.now() - m.ts > TTL_MS) return null
    return { buffer: readFileSync(p), mime: m.mime }
  } catch (e) {
    return null
  }
}

function cacheWrite(key, buffer, mime) {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(path.join(CACHE_DIR, `${key}.bin`), buffer)
    writeFileSync(path.join(CACHE_DIR, `${key}.meta.json`), JSON.stringify({ ts: Date.now(), mime }))
  } catch (e) {
    // cache best-effort
  }
}

function downloadImage(urlStr) {
  return new Promise((resolve, reject) => {
    let url
    try {
      url = new URL(urlStr)
    } catch (e) {
      return reject(new Error('Invalid image URL'))
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return reject(new Error('Only http/https image URLs allowed'))
    }
    const proto = url.protocol === 'https:' ? https : http
    const req = proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Image fetch failed: HTTP ${res.statusCode}`))
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.setTimeout(20000, () => req.destroy(new Error('Image download timeout')))
  })
}

function wrapText(ctx, text, maxWidth, maxLines = Infinity) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines - 1) {
        // last allowed line: dump remaining words here
        line = (line + ' ' + words.slice(words.indexOf(w) + 1).join(' ')).trim()
        break
      }
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

// split into 2 lines at the nearest space to the middle (memegen split_2)
function split2(line) {
  const mid = Math.floor(line.length / 2) - 1
  for (let off = 0; off <= Math.floor(line.length / 4); off++) {
    for (const idx of [mid - off, mid + off]) {
      if (line[idx] === ' ') {
        return line.slice(0, idx).trim() + '\n' + line.slice(idx).trim()
      }
    }
  }
  return line
}

// split into 3 lines by word count roughly equal (memegen split_3)
function split3(line) {
  const words = line.split(' ')
  const maxLen = line.length / 3
  const lines = ['', '', '']
  let idx = 0
  for (const w of words) {
    const cur = lines[idx].length
    const next = cur + w.length * 0.7
    if (next > maxLen && idx < 2) idx++
    lines[idx] += w + ' '
  }
  return lines.map((l) => l.trim()).join('\n')
}

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}]/u

function isEmoji(ch) {
  if (ch === '\u{200D}' || ch === '\u{FE0F}') return true
  return EMOJI_RE.test(ch)
}

function splitRuns(str) {
  const runs = []
  let buf = ''
  let cur = isEmoji(str[0] || '')
  for (const ch of str) {
    const e = isEmoji(ch)
    if (e === cur) buf += ch
    else { if (buf) runs.push({ emoji: cur, text: buf }); buf = ch; cur = e }
  }
  if (buf) runs.push({ emoji: cur, text: buf })
  return runs
}

// measure rendered width of a line (text runs use family font, emoji runs use emoji font)
function lineWidth(ctx, lineStr, fsNow, family) {
  const runs = splitRuns(lineStr)
  let w = 0
  for (const r of runs) {
    ctx.font = r.emoji
      ? `bold ${fsNow}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
      : `bold ${fsNow}px ${family}, "Arial Black", Arial, sans-serif`
    w += ctx.measureText(r.text).width
  }
  return w
}

function drawCaption(ctx, text, imgW, imgH, fontSize, position, family, regionY, centered) {
  if (!text) return
  if (regionY == null) regionY = 0
  const top0 = regionY
  const regionH = imgH

  const maxTextW = imgW * 0.92
  const maxCaptionH = Math.round(imgH * 0.45)

  // Auto-shrink (max 2 lines per caption)
  const MAX_LINES = 2
  let fs = fontSize
  let lines = []
  let lineH = 0
  while (fs >= 12) {
    lines = wrapText(ctx, String(text).toUpperCase(), maxTextW, MAX_LINES)
    lineH = Math.round(fs * 1.15)
    const totalH = lines.length * lineH
    const fitsWidth = lines.every((l) => lineWidth(ctx, l, fs, family) <= maxTextW)
    const fitsHeight = totalH <= maxCaptionH
    if (fitsWidth && fitsHeight) break
    fs -= 2
  }

  const fontText = `bold ${fs}px ${family}, "Arial Black", Arial, sans-serif`
  const fontEmoji = `bold ${fs}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.strokeStyle = 'black'
  ctx.lineWidth = Math.max(3, Math.round(fs / 10))

  const margin = Math.round(fs * 0.6)

  // draw a line centered, positioning each run by its own measured width
  function drawLine(lineStr, y) {
    const total = lineWidth(ctx, lineStr, fs, family)
    let x = Math.max(margin, (imgW - total) / 2)
    const runs = splitRuns(lineStr)
    for (const r of runs) {
      if (r.emoji) {
        ctx.font = fontEmoji
        ctx.fillText(r.text, x, y)
      } else {
        ctx.font = fontText
        ctx.strokeText(r.text, x, y)
        ctx.fillStyle = 'white'
        ctx.fillText(r.text, x, y)
      }
      x += ctx.measureText(r.text).width
    }
  }

  // Fixed position: top caption centered (layout:top) or 7% from top (default), bottom caption 7% from bottom.
  const blockH = lines.length ? lines.length * lineH : lineH
  if (position === 'top') {
    const anchorY = centered ? Math.round(top0 + regionH / 2) : Math.round(top0 + regionH * 0.07)
    let y = anchorY - blockH / 2 + lineH / 2
    for (const ln of lines) {
      drawLine(ln, y)
      y += lineH
    }
  } else {
    const anchorY = Math.round(top0 + regionH * 0.93)
    let y = anchorY - blockH / 2 + lineH / 2
    for (const ln of lines) {
      drawLine(ln, y)
      y += lineH
    }
  }
}

// render one caption block from memegen config.
// Faithful to memegen: text is laid out inside a box of size
//   max_text_size = (scale_x*W, scale_y*H)
// centered within that box, then the box is composited at
//   point = (anchor_x*W, anchor_y*H)  (top-left corner)
// Font size is chosen as the largest that fits the box (loop from max_font_size).
function drawFromConfig(ctx, text, imgW, imgH, block, family) {
  if (!text) return
  const anchorX = block.anchor_x != null ? block.anchor_x : 0.5
  const anchorY = block.anchor_y != null ? block.anchor_y : 0.5
  const scaleX = block.scale_x != null ? block.scale_x : 1.0
  const scaleY = block.scale_y != null ? block.scale_y : 0.2
  const align = (block.align || 'center').toLowerCase()
  const angle = block.angle || 0
  const styleUpper = block.style === 'upper'
  const color = (block.color || 'white').toLowerCase()

  let disp = String(text)
  if (styleUpper) disp = disp.toUpperCase()

  // box size
  const maxTextW = Math.max(1, Math.round(scaleX * imgW))
  const maxTextH = Math.max(1, Math.round(scaleY * imgH))
  const maxFont = Math.max(12, Math.round(imgH / (angle ? 4 : 9)))

  const wrapped1 = disp
  const wrapped2 = split2(disp)
  const wrapped3 = split3(disp)

  const fontFor = (fam) => `bold ${fam}px ${family}, "Arial Black", Arial, sans-serif`
  const emojiFontFor = (fam) => `bold ${fam}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`

  function bestFontFor(str) {
    const lns = str.split('\n')
    let fs = maxFont
    for (; fs >= 12; fs -= 1) {
      ctx.font = fontFor(fs)
      const lineW = Math.max(...lns.map((l) => lineWidth(ctx, l, fs, family)))
      const lineH = Math.round(fs * 1.15)
      const totalH = lns.length * lineH
      const maxW = maxTextW - maxTextW / 35
      const maxH = maxTextH - maxTextH / 10
      if (lineW <= maxW && totalH <= maxH) break
    }
    return Math.max(12, fs)
  }

  const f1 = bestFontFor(wrapped1)
  const f2 = bestFontFor(wrapped2)
  const f3 = bestFontFor(wrapped3)
  let linesStr = wrapped1
  if (f2 >= f1) linesStr = wrapped2
  if (f3 >= f2 * 0.9 && f3 > f1) linesStr = wrapped3

  const lines = linesStr.split('\n')
  const fs = bestFontFor(linesStr)
  const lineH = Math.round(fs * 1.15)
  // memegen get_stroke_width = min(3, max(1, font.size/12))
  const strokeW = Math.min(3, Math.max(1, Math.round(fs / 12)))

  // offscreen box
  const box = createCanvas(maxTextW, maxTextH)
  const bctx = box.getContext('2d')
  bctx.lineJoin = 'round'
  bctx.miterLimit = 2
  bctx.textBaseline = 'middle'
  bctx.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center'
  // color: support named/hex (e.g. khaki, #fff) like memegen, not just white/black
  const isWhiteColor = color === 'white'
  const isBlackColor = color === 'black'
  // fill = the configured color (default white); stroke = contrasting edge
  let fillColor = isWhiteColor ? 'white' : (isBlackColor ? 'black' : color)
  if (!isWhiteColor && !isBlackColor && !/^(#|rgb|hsl)/i.test(color) && !/^[a-z]+$/i.test(color)) {
    fillColor = 'white' // unknown token fallback
  }
  // resolve stroke: black text -> white outline; white/named/colored text -> black outline
  // (matches memegen app/models/text.py get_stroke: only 'black' color gets white outline)
  const strokeColor = isBlackColor ? 'white' : 'black'
  bctx.strokeStyle = strokeColor
  bctx.lineWidth = strokeW
  bctx.fillStyle = fillColor

  // center text block vertically in the box
  const blockH = lines.length * lineH
  let y = (maxTextH - blockH) / 2 + lineH / 2
  // horizontal anchor inside box
  const hx = align === 'left' ? 0 : align === 'right' ? maxTextW : maxTextW / 2

  for (const ln of lines) {
    const runs = splitRuns(ln)
    // measure total width for left/right alignment offset (center handled by textAlign)
    let x = hx
    if (align === 'left' || align === 'right') {
      // textAlign already positions from x; for left x=0, right x=maxTextW
    } else {
      x = maxTextW / 2
    }
    // draw runs sequentially (textAlign center would split per-run wrongly, so manual)
    bctx.textAlign = 'left'
    let cx = hx
    if (align === 'center') {
      // compute total width to center manually
      let total = 0
      for (const r of runs) {
        bctx.font = r.emoji ? emojiFontFor(fs) : fontFor(fs)
        total += bctx.measureText(r.text).width
      }
      cx = (maxTextW - total) / 2
    } else if (align === 'right') {
      let total = 0
      for (const r of runs) {
        bctx.font = r.emoji ? emojiFontFor(fs) : fontFor(fs)
        total += bctx.measureText(r.text).width
      }
      cx = maxTextW - total
    }
    for (const r of runs) {
      if (r.emoji) {
        bctx.font = emojiFontFor(fs)
        bctx.fillText(r.text, cx, y)
      } else {
        bctx.font = fontFor(fs)
        // two-pass stroke for a denser, PIL-like outline
        bctx.lineWidth = strokeW
        bctx.strokeStyle = strokeColor
        bctx.strokeText(r.text, cx, y)
        bctx.lineWidth = strokeW + 1
        bctx.strokeText(r.text, cx, y)
        bctx.fillStyle = fillColor
        bctx.fillText(r.text, cx, y)
      }
      bctx.font = r.emoji ? emojiFontFor(fs) : fontFor(fs)
      cx += bctx.measureText(r.text).width
    }
    y += lineH
  }

  // composite box at point (top-left of box = anchor)
  const px = Math.round(anchorX * imgW)
  const py = Math.round(anchorY * imgH)
  ctx.save()
  if (angle) {
    ctx.translate(px + maxTextW / 2, py + maxTextH / 2)
    ctx.rotate((angle * Math.PI) / 180)
    ctx.drawImage(box, -maxTextW / 2, -maxTextH / 2)
  } else {
    ctx.drawImage(box, px, py)
  }
  ctx.restore()
}

function drawOverlay(ctx, bgW, bgH, block, img) {
  if (!img) return
  const cx = block.center_x != null ? block.center_x : 0.5
  const cy = block.center_y != null ? block.center_y : 0.5
  const scale = block.scale != null ? block.scale : 0.25
  const angle = block.angle || 0

  const size = Math.min(bgW * scale, bgH * scale)
  // maintain aspect ratio or make square? Memegen thumbnail() scales down keeping ratio but bounding to size x size.
  let w = size
  let h = size
  const ratio = img.width / img.height
  if (ratio > 1) {
    h = size / ratio
  } else {
    w = size * ratio
  }

  ctx.save()
  // Translate to center of overlay
  const px = Math.round(bgW * cx)
  const py = Math.round(bgH * cy)
  ctx.translate(px, py)
  if (angle) {
    ctx.rotate(angle * Math.PI / 180)
  }
  ctx.drawImage(img, -Math.round(w / 2), -Math.round(h / 2), Math.round(w), Math.round(h))
  ctx.restore()
}

// decode memegen-style path segments: _ = space, __ = _, ~q = ?, etc.
function decodeSegment(seg) {
if (!seg) return ''
return decodeURIComponent(seg)
  .replace(/~q/g, '?')
  .replace(/~a/g, '&')
  .replace(/~p/g, '%')
  .replace(/~h/g, '#')
  .replace(/~s/g, '/')
  .replace(/__/g, '\u0000') // temp placeholder
  .replace(/_/g, ' ')
  .replace(/\u0000/g, '_')
}

const TEMPLATE_DIR = path.join(__dirname, 'site', 'meme-templates')

async function renderMeme(res, imgBuf, top, bottom, fontsize, format, font, layout, overlayBufs, cfg) {
  const useFormat = (format || 'jpg').toLowerCase() === 'png' ? 'png' : 'jpg'
  const mime = useFormat === 'png' ? 'image/png' : 'image/jpeg'
  const ext = useFormat === 'png' ? 'png' : 'jpg'
  const family = resolveFontFamily(font)

  const img = await loadImage(imgBuf)
  const maxDim = 4000
  let w = img.width
  let h = img.height
  if (w > maxDim || h > maxDim) {
    const scale = Math.min(maxDim / w, maxDim / h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  // layout:top -> add white panel (~13% of image height) ABOVE image.
  // Only TOP text goes into the panel (centered vertically, 3-5% margin);
  // BOTTOM text stays on the image.
  const topPanel = layout === 'top' ? Math.round(h * 0.13) : 0
  const canvas = createCanvas(w, h + topPanel)
  const ctx = canvas.getContext('2d')
  if (topPanel) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, topPanel)
    ctx.drawImage(img, 0, topPanel, w, h)
  } else {
    ctx.drawImage(img, 0, 0, w, h)
  }

  // overlay: composite injected images from styleUrls
  if (Array.isArray(overlayBufs) && overlayBufs.length) {
    for (let i = 0; i < overlayBufs.length; i++) {
      const buf = overlayBufs[i]
      if (!buf) continue
      try {
        const ov = await loadImage(buf)
        if (cfg && Array.isArray(cfg.overlay) && cfg.overlay[i]) {
          drawOverlay(ctx, w, h, cfg.overlay[i], ov)
        } else {
          // fallback / custom mode: center overlay at 40% size
          const ow = Math.round(w * 0.4)
          const oh = Math.round(ov.height * (ow / ov.width))
          ctx.drawImage(ov, Math.round((w - ow) / 2), Math.round((h - oh) / 2), ow, oh)
        }
      } catch (e) { console.error('overlay composite failed', e) }
    }
  }

  const fs = fontsize ? Math.max(12, Math.min(400, parseInt(fontsize, 10) || 0)) : Math.max(24, Math.round(w / 12))
  if (topPanel) {
    // TOP text in white panel (regionY=0, regionH=panelH -> centered vertically)
    drawCaption(ctx, top || '', w, topPanel, fs, 'top', family, 0, true)
    // BOTTOM text on the image (regionY=panelH)
    if (bottom) drawCaption(ctx, bottom || '', w, h, fs, 'bottom', family, topPanel, false)
  } else {
    drawCaption(ctx, top || '', w, h, fs, 'top', family, 0, false)
    drawCaption(ctx, bottom || '', w, h, fs, 'bottom', family, 0, false)
  }

  const out = useFormat === 'png'
    ? canvas.toBuffer('image/png')
    : canvas.toBuffer('image/jpeg', { quality: 0.92 })

  res.set('Content-Type', mime)
  res.set('Content-Disposition', `inline; filename="meme.${ext}"`)
  res.set('X-Cache', 'MISS')
  res.end(out)
}

// ---- Animated render: composite text per-frame onto an animated background ----
// Supports: template default.gif (17 animated templates) + custom ?background=URL (gif/webp/mp4)
const { execFileSync } = require('child_process')
const fsMod = require('fs')
const os = require('os')
const pathMod = require('path')

// Detect animated WebP (RIFF .... WEBP with VP8X/ANIM chunks). ffmpeg's webp
// decoder only handles single-frame webp, so animated webp MUST be decoded via
// node-webpmux (webpmux re-implementation) instead of ffmpeg.
function isAnimatedWebp(buf) {
  if (!buf || buf.length < 20) return false
  const riff = buf.slice(0, 4).toString('ascii')
  const webp = buf.slice(8, 12).toString('ascii')
  if (riff !== 'RIFF' || webp !== 'WEBP') return false
  // look for the VP8X chunk at offset 12 (flags byte 0 bit 1 = ANIMATION)
  if (buf.slice(12, 16).toString('ascii') === 'VP8X') {
    return (buf[20] & 0x02) === 0x02
  }
  return false
}

// Decode an animated WebP into cumulative-composed full-size PNG frames.
// Each ANMF chunk can be a partial frame (x/y offset, smaller w/h) with
// blend/dispose semantics, so we reconstruct the full canvas like a webp player.
async function extractWebpFrames(buf, maxFrames = 150) {
  const img = new WebP.Image()
  await img.load(buf)
  const W = img.width, H = img.height
  if (!img.hasAnim || !img.frames || !img.frames.length) {
    // static webp: return single frame
    return [{ buffer: buf, delay: 0, width: W, height: H }]
  }
  // sub-sample if too many frames
  const total = img.frames.length
  const stride = Math.max(1, Math.ceil(total / maxFrames))
  const raws = await img.demux({ buffers: true })
  const bg = createCanvas(W, H)
  const bgc = bg.getContext('2d')
  const out = []
  for (let i = 0; i < total; i++) {
    if ((i % stride) !== 0) continue
    const f = img.frames[i]
    const raw = raws[i]
    if (!raw) continue
    if (!f.blend || i === 0) bgc.clearRect(0, 0, W, H) // blend=false -> replace frame
    const fimg = await loadImage(raw)
    bgc.drawImage(fimg, f.x || 0, f.y || 0, f.width || W, f.height || H)
    out.push({ buffer: bg.toBuffer('image/png'), delay: f.delay || 0, width: W, height: H })
    if (f.dispose) bgc.clearRect(f.x || 0, f.y || 0, f.width || W, f.height || H)
  }
  return out.length ? out : [{ buffer: bg.toBuffer('image/png'), delay: 0, width: W, height: H }]
}

async function renderAnimated({ bgBuf, texts, cfg, font, format = 'gif', maxSeconds = 10, maxBytes = 20 * 1024 * 1024, overlayBufs }) {
  const useFormat = (format || 'gif').toLowerCase()
  const tmpDir = fsMod.mkdtempSync(pathMod.join(os.tmpdir(), 'brat-anim-'))
  try {
    const bgPath = pathMod.join(tmpDir, 'bg_input')
    fsMod.writeFileSync(bgPath, bgBuf)
    // 1) decode bg -> frames (cap duration to maxSeconds)
    const framesDir = pathMod.join(tmpDir, 'frames')
    fsMod.mkdirSync(framesDir, { recursive: true })
    let srcFps = 12
    let frames = []
    if (isAnimatedWebp(bgBuf)) {
      // ffmpeg's webp decoder can't handle animated webp — use node-webpmux
      const decoded = await extractWebpFrames(bgBuf)
      // base fps from average frame delay (webp delay is in ms)
      const delays = decoded.map(f => f.delay).filter(d => d > 0)
      if (delays.length) {
        const avg = delays.reduce((a, b) => a + b, 0) / delays.length
        srcFps = avg > 0 ? Math.round(1000 / avg) : 12
      }
      srcFps = Math.max(1, Math.min(30, srcFps || 12))
      const maxFrames = 150
      if (decoded.length > maxFrames) {
        const stride = Math.ceil(decoded.length / maxFrames)
        for (let i = 0; i < decoded.length; i += stride) {
          const p = pathMod.join(framesDir, 'f' + String(frames.length + 1).padStart(4, '0') + '.png')
          fsMod.writeFileSync(p, decoded[i].buffer)
          frames.push(pathMod.basename(p))
        }
      } else {
        for (let i = 0; i < decoded.length; i++) {
          const p = pathMod.join(framesDir, 'f' + String(i + 1).padStart(4, '0') + '.png')
          fsMod.writeFileSync(p, decoded[i].buffer)
          frames.push(pathMod.basename(p))
        }
      }
    } else {
    const probe = execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration:stream=r_frame_rate,nb_frames',
      '-of', 'json', bgPath
    ], { encoding: 'utf8' })
    const meta = JSON.parse(probe)
    const dur = parseFloat(meta.format && meta.format.duration) || 0
    const useDur = Math.min(dur || 10, maxSeconds)
    // parse source frame rate (e.g. "10/1", "18/1", "30000/1001")
    const streams = meta.streams || []
    if (streams.length && streams[0].r_frame_rate) {
      const [num, den] = streams[0].r_frame_rate.split('/').map(Number)
      if (num && den) srcFps = Math.round(num / den) || 12
    }
    // cap frames: max 150 total (reduce fps if source would exceed)
    const maxFrames = 150
    const rawFrames = Math.round(srcFps * useDur)
    const outFps = rawFrames > maxFrames ? Math.round(srcFps * maxFrames / rawFrames) : srcFps
    srcFps = outFps
    // extract frames at source (capped) fps
    execFileSync('ffmpeg', [
      '-y', '-i', bgPath,
      '-t', String(useDur),
      '-vf', 'fps=' + srcFps,
      pathMod.join(framesDir, 'f%04d.png')
    ], { stdio: 'ignore' })
    frames = fsMod.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort()
    }
    const fpsStr = String(srcFps)
    if (!frames.length) throw new Error('no frames decoded from background')
    // 2) render text onto each frame
    const rendered = []
    const total = frames.length
    for (let fi = 0; fi < frames.length; fi++) {
      const f = frames[fi]
      const percent = total > 1 ? (fi + 1) / total : 1.0
      const fb = fsMod.readFileSync(pathMod.join(framesDir, f))
      const img = await loadImage(fb)
      const w = img.width, h = img.height
      const canvas = createCanvas(w, h)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      // overlay: composite injected images from styleUrls FIRST (text rendered on top, like memegen)
      if (Array.isArray(overlayBufs) && overlayBufs.length && cfg && Array.isArray(cfg.overlay)) {
        for (let i = 0; i < overlayBufs.length; i++) {
          const buf = overlayBufs[i]
          if (!buf) continue
          const block = cfg.overlay[i]
          if (!block) continue
          // check visibility at percent
          const start = block.start != null ? block.start : 0.0
          const stop = block.stop != null ? block.stop : 1.0
          const show = (percent === 1.0) || (start <= percent && percent < stop) || (block.start === 0.0 && block.stop === 1.0)
          if (!show) continue
          try {
            const ov = await loadImage(buf)
            drawOverlay(ctx, w, h, block, ov)
          } catch (e) { console.error('animated template overlay composite failed', e) }
        }
      } else if (Array.isArray(overlayBufs) && overlayBufs.length) {
        // fallback / custom mode: center first overlay on all frames
        try {
          const ov = await loadImage(overlayBufs[0])
          const ow = Math.round(w * 0.4)
          const oh = Math.round(ov.height * (ow / ov.width))
          ctx.drawImage(ov, Math.round((w - ow) / 2), Math.round((h - oh) / 2), ow, oh)
        } catch (e) { console.error('animated custom overlay failed', e) }
      }

      // then text (on top of overlays)
      if (cfg && Array.isArray(cfg.text) && cfg.text.length) {
        cfg.text.forEach((block, i) => {
          const blockFont = (font && font !== 'default') ? font : (block.font || 'thick')
          // memegen: only show text within [start, stop) of animation
          const start = block.start != null ? block.start : 0
          const stop = block.stop != null ? block.stop : 1
          const show = (percent === 1.0) || (start <= percent && percent < stop) || !block.stop
          const txt = show ? (texts[i] || '') : ''
          drawFromConfig(ctx, txt, w, h, block, resolveFontFamily(blockFont))
        })
      } else {
        const fs0 = Math.max(24, Math.round(w / 12))
        drawCaption(ctx, texts[0] || '', w, h, fs0, 'top', resolveFontFamily(font))
        drawCaption(ctx, texts[1] || '', w, h, fs0, 'bottom', resolveFontFamily(font))
      }

      rendered.push(canvas.toBuffer('image/png'))
    }

    // 3) static format fallback (jpg/png): return first frame as static image
    if (useFormat !== 'gif' && useFormat !== 'webp' && useFormat !== 'mp4') {
      const staticFormat = useFormat === 'png' ? 'png' : 'jpg'
      const mime = staticFormat === 'png' ? 'image/png' : 'image/jpeg'
      const img = await loadImage(rendered[0])
      const c = createCanvas(img.width, img.height)
      const cc = c.getContext('2d')
      cc.drawImage(img, 0, 0)
      const buf = staticFormat === 'png' ? c.toBuffer('image/png') : c.toBuffer('image/jpeg', { quality: 0.92 })
      return { buffer: buf, mime, ext: staticFormat }
    }
    // write rendered frames back to disk (overwrite originals) so ffmpeg encodes WITH text
    for (let i = 0; i < rendered.length; i++) {
      fsMod.writeFileSync(pathMod.join(framesDir, frames[i]), rendered[i])
    }
    // 3) encode output (use image-sequence input, not concat demuxer, for reliability)
    const outPath = pathMod.join(tmpDir, 'out.' + (useFormat === 'webp' ? 'webp' : useFormat === 'mp4' ? 'mp4' : 'gif'))
    const inPattern = pathMod.join(framesDir, 'f%04d.png')
    if (useFormat === 'gif') {
      execFileSync('ffmpeg', ['-y', '-framerate', fpsStr, '-i', inPattern, '-vf', 'scale=1000:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', '-loop', '0', outPath], { stdio: 'ignore' })
    } else if (useFormat === 'webp') {
      execFileSync('ffmpeg', ['-y', '-framerate', fpsStr, '-i', inPattern, '-loop', '0', outPath], { stdio: 'ignore' })
    } else { // mp4
      execFileSync('ffmpeg', ['-y', '-framerate', fpsStr, '-i', inPattern, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', outPath], { stdio: 'ignore' })
    }
    const outBuf = fsMod.readFileSync(outPath)
    if (outBuf.length > maxBytes) throw new Error('output exceeds ' + (maxBytes / 1024 / 1024) + 'MB limit')
    const mime = useFormat === 'webp' ? 'image/webp' : useFormat === 'mp4' ? 'video/mp4' : 'image/gif'
    return { buffer: outBuf, mime, ext: useFormat === 'mp4' ? 'mp4' : useFormat === 'webp' ? 'webp' : 'gif' }
  } finally {
    try { fsMod.rmSync(tmpDir, { recursive: true, force: true }) } catch (e) {}
  }
}

function isAnimatedBuffer(buf) {
  if (!buf || buf.length < 12) return false
  const sig3 = buf.slice(0, 3).toString('ascii')
  if (sig3 === 'GIF') return true
  const sigRIFF = buf.slice(0, 4).toString('ascii')
  const sigWEBP = buf.slice(8, 12).toString('ascii')
  if (sigRIFF === 'RIFF' && sigWEBP === 'WEBP') {
    // webp can be animated or static. We'll treat all webp inputs as potentially animated (ffmpeg handles it)
    return true
  }
  const sigFtyp = buf.slice(4, 8).toString('ascii')
  if (sigFtyp === 'ftyp' || buf.readUInt32BE(0) === 0x18 || buf.readUInt32BE(0) === 0x20) {
    return true // MP4/MOV container signatures
  }
  return false
}

module.exports = async function memeHandler(req, res) {
  const { image, top, bottom, fontsize, format, font, layout, style } = req.query

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'image (URL) query parameter is required' })
  }

  const key = cacheKey({ image, top: top || '', bottom: bottom || '', fontsize: fontsize || '', format: format || 'jpg', font: font || '', layout: layout || '', style: style || '' })
  const cached = cacheRead(key)
  if (cached) {
    res.set('Content-Type', cached.mime)
    res.set('Content-Disposition', `inline; filename="meme.${cached.mime.endsWith('png') ? 'png' : 'jpg'}"`)
    res.set('X-Cache', 'HIT')
    return res.end(cached.buffer)
  }

  try {
    ensureFont()
    const imgBuf = await downloadImage(image)

    // parse styleUrls
    const urls = typeof style === 'string' ? style.split(',').map(s => s.trim()).filter(Boolean) : []
    const overlayBufs = []
    if (urls.length) {
      const downloads = urls.map(url => downloadImage(url).catch(e => {
        console.error('styleUrl download failed', url, e.message)
        return null
      }))
      const bufs = await Promise.all(downloads)
      overlayBufs.push(...bufs.filter(Boolean))
    }

    // Auto-detect static vs animated from buffer content
    const isAnimated = isAnimatedBuffer(imgBuf)

    if (isAnimated) {
      const animFmt = (format || 'gif').toLowerCase()
      const outFmt = ['gif', 'webp', 'mp4'].includes(animFmt) ? animFmt : 'gif'
      const texts = [top || '', bottom || '']
      try {
        const r = await renderAnimated({ bgBuf: imgBuf, texts, cfg: null, font, format: outFmt, overlayBufs })
        cacheWrite(key, r.buffer, r.mime)
        res.set('Content-Type', r.mime)
        res.set('Content-Disposition', `inline; filename="meme.${r.ext}"`)
        res.set('X-Cache', 'MISS')
        return res.end(r.buffer)
      } catch (animErr) {
        console.error('Animated render failed, falling back to static:', animErr.message)
      }
    }

    const out = await renderMeme(res, imgBuf, top, bottom, fontsize, format, font, layout, overlayBufs, null)
    // note: renderMeme already ends response; cache handled below
    cacheWrite(key, out, out ? (format === 'png' ? 'image/png' : 'image/jpeg') : '')
  } catch (err) {
    console.error('Meme error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: err.message })
    }
  }
}

module.exports.renderAnimated = renderAnimated
module.exports.AVAILABLE_FONTS = AVAILABLE_FONTS

// template mode: /meme/:id/:top/:bottom (memegen-style)
module.exports.templateHandler = async function templateHandler(req, res) {
  const { id, top, bottom, third } = req.params
  const { fontsize, format, font, style } = req.query
  let tfile = null
  // prefer animated .gif when present (or when output format is animated)
  const wantAnim = (format || '').toLowerCase() === 'gif' || (format || '').toLowerCase() === 'webp' || (format || '').toLowerCase() === 'mp4'
  const extOrder = wantAnim ? ['gif', 'jpg', 'png'] : ['jpg', 'png', 'gif']
  for (const ext of extOrder) {
    const cand = path.join(TEMPLATE_DIR, `${id}.${ext}`)
    if (existsSync(cand)) { tfile = cand; break }
  }
  if (!tfile) {
    return res.status(404).json({ error: `template '${id}' not found` })
  }
  const cfgFile = path.join(TEMPLATE_DIR, `${id}.yml`)
  const cfg = existsSync(cfgFile) ? parseConfigYaml(readFileSync(cfgFile, 'utf-8')) : null
  // parse styleUrls for template overlay
  const styleUrls = typeof style === 'string' ? style.split(',').map(s => s.trim()).filter(Boolean) : []
  let overlayBufs = []
  if (styleUrls.length) {
    overlayBufs = await Promise.all(
      styleUrls.map(url => downloadImage(url).catch(() => null))
    )
  }
  // collect texts early (needed by both animated + static paths)
  const segs = Array.isArray(req.params.segments) ? req.params.segments : []
  const texts = segs.map((s) => decodeSegment(s))
  for (let i = 1; i <= 8; i++) {
    const q = req.query[`t${i}`]
    if (q) texts[i - 1] = q
  }
  // animated: template default.gif OR ?background= animated URL
  const isAnimatedTpl = tfile.endsWith('.gif')
  const bgUrl = req.query.background
  if (isAnimatedTpl || bgUrl) {
    try {
      ensureFont()
      let bgBuf
      if (bgUrl) {
        bgBuf = await downloadImage(bgUrl)
      } else {
        bgBuf = await fs.promises.readFile(tfile)
      }
      const animFmt = (format || 'gif').toLowerCase()
      const r = await renderAnimated({ bgBuf, texts, cfg, font, format: animFmt, overlayBufs })
      res.set('Content-Type', r.mime)
      res.set('Content-Disposition', `inline; filename="meme_${id}.${r.ext}"`)
      res.set('X-Cache', 'MISS')
      return res.end(r.buffer)
    } catch (err) {
      console.error('Animated meme error:', err)
      if (!res.headersSent) res.status(500).json({ error: err.message })
      return
    }
  }
  const tcacheKey = cacheKey({ tpl: id, top: top || '', bottom: bottom || '', third: third || '', fontsize: fontsize || '', format: format || 'jpg', font: font || '' })
  const cached = cacheRead(tcacheKey)
  if (cached) {
    res.set('Content-Type', cached.mime)
    res.set('Content-Disposition', `inline; filename="meme_${id}.${cached.mime.endsWith('png') ? 'png' : 'jpg'}"`)
    res.set('X-Cache', 'HIT')
    return res.end(cached.buffer)
  }
  try {
    ensureFont()
    const imgBuf = await fs.promises.readFile(tfile)
    const family = resolveFontFamily(font)

    const img = await loadImage(imgBuf)
    const maxDim = 4000
    let w = img.width
    let h = img.height
    if (w > maxDim || h > maxDim) {
      const scale = Math.min(maxDim / w, maxDim / h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)

    // overlay: composite injected images from styleUrls
    if (Array.isArray(overlayBufs) && overlayBufs.length) {
      for (let i = 0; i < overlayBufs.length; i++) {
        const buf = overlayBufs[i]
        if (!buf) continue
        try {
          const ov = await loadImage(buf)
          if (cfg && Array.isArray(cfg.overlay) && cfg.overlay[i]) {
            drawOverlay(ctx, w, h, cfg.overlay[i], ov)
          } else {
            // fallback / custom mode: center overlay at 40% size
            const ow = Math.round(w * 0.4)
            const oh = Math.round(ov.height * (ow / ov.width))
            ctx.drawImage(ov, Math.round((w - ow) / 2), Math.round((h - oh) / 2), ow, oh)
          }
        } catch (e) { console.error('template static overlay failed', e) }
      }
    }

    if (cfg && Array.isArray(cfg.text) && cfg.text.length) {
      // render each text block per config
      // font: use config font (block.font) unless user overrides via ?font=
      cfg.text.forEach((block, i) => {
        const blockFont = (font && font !== 'default') ? font : (block.font || 'thick')
        const fam = resolveFontFamily(blockFont)
        drawFromConfig(ctx, texts[i] || '', w, h, block, fam)
      })
    } else {
      // fallback: top/bottom 7%
      const fs = fontsize ? Math.max(12, Math.min(400, parseInt(fontsize, 10) || 0)) : Math.max(24, Math.round(w / 12))
      drawCaption(ctx, texts[0] || '', w, h, fs, 'top', family)
      drawCaption(ctx, texts[1] || '', w, h, fs, 'bottom', family)
    }

    const useFormat = (format || 'jpg').toLowerCase() === 'png' ? 'png' : 'jpg'
    const mime = useFormat === 'png' ? 'image/png' : 'image/jpeg'
    const out = useFormat === 'png' ? canvas.toBuffer('image/png') : canvas.toBuffer('image/jpeg', { quality: 0.92 })
    cacheWrite(tcacheKey, out, mime)
    res.set('Content-Type', mime)
    res.set('Content-Disposition', `inline; filename="meme_${id}.${useFormat}"`)
    res.set('X-Cache', 'MISS')
    res.end(out)
  } catch (err) {
    console.error('Meme template error:', err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}
