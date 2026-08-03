require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { execSync, execFileSync } = require('child_process');
const bratCanvasHandler = require('./bratCanvas.js');
const memeHandler = require('./memeGen.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan('common'));
app.use(cors());

const SITE_DIR = path.join(__dirname, 'site');
const HTML_FILE = path.join(SITE_DIR, 'html', 'index.html');
const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_TTL_MS = 30 * 60 * 1000;

if (!fs.existsSync(HTML_FILE)) {
  console.error(`Missing ${HTML_FILE}. Copy scrape result into site/ first.`);
  process.exit(1);
}

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function stableStringify(obj) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const sortedKeys = Object.keys(obj).sort();
    const out = {};
    for (const k of sortedKeys) out[k] = obj[k];
    return JSON.stringify(out);
  }
  return JSON.stringify(obj);
}

function cacheKeyFor(endpoint, query) {
  const payload = { endpoint, query };
  const hash = crypto.createHash('md5').update(stableStringify(payload)).digest('hex');
  return path.join(CACHE_DIR, `${hash}.bin`);
}

function readCacheIfFresh(cachePath) {
  try {
    const stat = fs.statSync(cachePath);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    return fs.readFileSync(cachePath);
  } catch (e) {
    return null;
  }
}

function pruneExpiredCache() {
  try {
    const now = Date.now();
    for (const file of fs.readdirSync(CACHE_DIR)) {
      const p = path.join(CACHE_DIR, file);
      try {
        const stat = fs.statSync(p);
        if (now - stat.mtimeMs > CACHE_TTL_MS) fs.unlinkSync(p);
      } catch (e) {}
    }
  } catch (e) {}
}

function writeCache(cachePath, buffer) {
  pruneExpiredCache();
  fs.writeFileSync(cachePath, buffer);
}

let browser;
const launchBrowser = async () => {
  browser = await chromium.launch({ headless: true });
};
app.get('/', async (req, res) => {
  res.status(200).json({
    author: 'local-brat-scrape',
    repository: { github: 'https://github.com/zennn08/brat-api/' },
    endpoints: {
      '/': 'API documentation (this)',
      '/generate': 'Generate brat image from #textOverlay screenshot',
      '/bratvid': 'Generate brat video from multiple texts',
      '/canvas': 'Generate brat video from text using canvas + emoji support'
    },
    canvasParams: {
      text: 'Full sentence for canvas typing effect, e.g. text=hei balik ke jakarta yuk',
      theme: 'white|black|green (default: white)',
      blur: '0-3 (default: 0)',
      format: 'mp4|gif (default: mp4)',
      frameDuration: 'seconds per typing frame (default: 0.35)',
      holdDuration: 'seconds to hold final frame (default: 1.2)',
      maxWordPerLayer: 'words added per layer (default: 1)',
      maxWordBeforeReset: '0=no reset, or comma-separated schedule via array parsing if added later',
      fastProgress: 'true|false - use Promise.all for rendering (default: false)',
      font: 'font key: arialnarrow|times|compacta|druk (default: arialnarrow)'
    },
    canvasExample: '/canvas?text=hei%20balik%20ke%20jakarta%20yuk&theme=white&format=mp4&frameDuration=1&holdDuration=1',
    generateParams: {
      text: 'String - text to display',
      theme: 'String - white|green|black|red|strike|blue (default: white)',
      background: 'String - optional background color, e.g. #ff00ff',
      color: 'String - optional text color, e.g. #ffffff',
      width: 'Number - optional viewport width, min 500 max 2048 (default: 924)',
      height: 'Number - optional viewport height, min 400 max 2048 (default: 1418)'
    },
    endpoints: {
      '/': 'API documentation (this)',
      '/generate': 'Generate brat image from #textOverlay screenshot',
      '/bratvid-realtime': 'Generate brat video from realtime typing simulation on #textOverlay',
      '/bratvid': 'Generate brat video from multiple texts',
      '/meme': 'Generate meme from image URL + top/bottom caption overlay',
      '/meme/:id/:top?/:bottom?': 'Generate meme from local template (id from /meme/templates)',
      '/meme/templates': 'List available local meme templates',
      '/canvas': 'Generate brat video from text using canvas + emoji support'
    },
    memeParams: {
      image: 'String - image/video URL (http/https) to use as base; auto-detects gif/webp/mp4 animation vs static jpg/png',
      top: 'String - top caption (optional)',
      bottom: 'String - bottom caption (optional)',
      style: 'String - overlay image URL(s), comma-separated for multiple overlays (optional)',
      layout: 'String - default|top (top draws top text in a dedicated white panel)',
      fontsize: 'Number - optional caption font size in px (default: auto from width)',
      font: 'String - caption font: default|impact|noto|comic|tahoma|tiny|micro (default: default)',
      format: 'String - output format: jpg|png|gif|webp|mp4 (default: jpg; animated only when input is animated or style used)'
    },
    memeTemplateExample: '/meme/drake/engineer/powerpoint',
    memeTemplateParams: {
      id: 'String - template id (from /meme/templates)',
      ':text1..:textN': 'Path segments, memegen-encoded (_=space, ~q=?, ~_=underscore); up to template lines',
      style: 'Query - overlay image URL(s), comma-separated. Fills template overlay slots (N slots = N overlay(s) shown in template list)',
      font: 'Query - font key (default: thick)',
      layout: 'Query - default|top',
      format: 'Query - output format: jpg|png|gif|webp|mp4 (static templates ignore animated formats)'
    },
    memeExample: '/meme?image=https://api.memegen.link/images/afraid.jpg&top=brat%20api&bottom=replica%20meme%20generator&font=impact&format=jpg',
    bratvidRealtimeParams: {
      text: 'String - text to simulate typing character-by-character',
      theme: 'String - white|green|black|red|strike|blue (default: white)',
      background: 'String - optional background color, e.g. #ff00ff',
      color: 'String - optional text color, e.g. #ffffff',
      width: 'Number - optional viewport width, min 500 max 2048 (default: 924)',
      height: 'Number - optional viewport height, min 400 max 2048 (default: 1418)',
      charDelayMin: 'Number - min random delay per char in ms (default: 180)',
      charDelayMax: 'Number - max random delay per char in ms (default: 220)',
      spaceDelay: 'Number - fixed delay after space in ms (default: 400)',
      chunkMax: 'Number - max chars typed per chunk, e.g. 3 produces 1-3 char chunks (default: 3)',
      format: 'String - output format: mp4|gif (default: mp4)',
      loop: 'Number - repeat count, 0 disables loop (default: 0)'
    },
    bratvidRealtimeExample: '/bratvid-realtime?text=aku%20sayang%20kamu&theme=white&format=gif',
    bratvidParams: {
      text: 'String - typing mode: progressive per word',
      texts: 'String - comma-separated full frames, e.g. haha,huh,u,hehe',
      theme: 'String - white|green|black|red|strike|blue (default: white)',
      background: 'String - optional background color, e.g. #ff00ff',
      color: 'String - optional text color, e.g. #ffffff',
      width: 'Number - optional viewport width, min 500 max 2048 (default: 924)',
      height: 'Number - optional viewport height, min 400 max 2048 (default: 1418)',
      fps: 'Number - output fps, min 1 max 60 (default: auto from duration)',
      duration: 'Number - seconds per typing frame (default: 1)',
      loop: 'Number - repeat count, 0 disables loop (default: 0)',
      format: 'String - output format: mp4|gif (default: mp4)'
    },
    examples: [
      '/generate?text=brat&theme=white',
      '/bratvid?texts=haha,huh,u,hehe&theme=white&fps=1',
      '/bratvid?text=hei%20balik%20ke%20jakarta%20yuk&theme=white&fps=1&duration=1',
      '/bratvid?text=hei%20balik%20ke%20jakarta%20yuk&theme=white&fps=1&duration=1&format=gif',
      '/bratvid-realtime?text=aku%20sayang%20kamu&theme=white&format=gif',
      '/canvas?text=hei%20balik%20ke%20jakarta%20yuk&theme=white&format=mp4&frameDuration=1&holdDuration=1'
    ],
    cache: {
      enabled: true,
      ttlMinutes: 30,
      notes: 'Responses for /generate, /bratvid, and /canvas are cached by request params. Identical requests within TTL return X-Cache: HIT.'
    },
    runtime: {
      os: os.type(),
      platform: os.platform(),
      architecture: os.arch(),
      cpuCount: os.cpus().length,
      uptime: `${os.uptime()} seconds`,
      memoryUsage: `${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)} MB used of ${Math.round(os.totalmem() / 1024 / 1024)} MB`
    }
  });
});

app.get('/canvas', bratCanvasHandler);

// static examples + dashboard (public, no auth)
app.use('/examples', express.static(path.join(__dirname, 'public', 'examples')));
// serve site/ so dashboard can load fonts for live preview via @font-face
app.use('/site', express.static(path.join(__dirname, 'site')));
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'site', 'dashboard.html'));
});
app.get('/dash', (req, res) => res.redirect('/dashboard'));
app.get('/meme', memeHandler);
app.get('/generate', async (req, res) => {
  const { text, theme, background, color, width, height } = req.query;

  const cachePath = cacheKeyFor('/generate', { text, theme, background, color, width, height });
  const cached = readCacheIfFresh(cachePath);
  if (cached) {
    res.set('Content-Type', 'image/png');
    res.set('X-Cache', 'HIT');
    return res.end(cached);
  }

  const viewportWidth = Math.min(2048, Math.max(500, Number(width) || 924));
  const viewportHeight = Math.min(2048, Math.max(400, Number(height) || 1418));

  let context = null;
  let page = null;

  try {
    if (!browser) {
      await launchBrowser();
    }

    context = await browser.newContext({
      viewport: {
        width: viewportWidth % 2 === 0 ? viewportWidth : viewportWidth - 1,
        height: viewportHeight % 2 === 0 ? viewportHeight : viewportHeight - 1
      }
    });
    page = await context.newPage();

    const filePath = path.join(__dirname, './site/html/www.bratgenerator.com/index.html');
    await page.goto(`file://${filePath}`);

    const validTheme = theme && ['white', 'green', 'black', 'red', 'strike', 'blue'].includes(theme) ? theme : 'white';

    await page.evaluate((t) => {
      if (typeof setupTheme === 'function') {
        setupTheme(t);
      }
    }, validTheme);

    await page.evaluate((value) => {
      const input = document.querySelector('#textInput');
      if (!input) return;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }, text ? String(text) : '');

    await page.evaluate((data) => {
      if (data.background) {
        if (window.$) {
          $('.node__content.clearfix').css('background-color', data.background);
        } else {
          const el = document.querySelector('.node__content.clearfix');
          if (el) el.style.backgroundColor = data.background;
        }
      }
      if (data.color) {
        if (window.$) {
          $('.textFitted').css('color', data.color);
        } else {
          document.querySelectorAll('.textFitted').forEach(el => el.style.color = data.color);
        }
      }
    }, { background, color });

    await page.waitForTimeout(150);

    const handle = await page.$('#textOverlay');
    if (!handle) {
      res.status(500).json({ error: 'Element #textOverlay not found' });
      return;
    }

    res.set('Content-Type', 'image/png');
    const buffer = await handle.screenshot();
    writeCache(cachePath, buffer);
    res.end(buffer);
  } catch (err) {
    console.error('Generate error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
    }
    if (context) {
      try { await context.close(); } catch (e) {}
    }
  }
});

app.get('/bratvid', async (req, res) => {
  const {
    text,
    texts,
    theme,
    background,
    color,
    width,
    height,
    cropWidth,
    cropHeight,
    fps,
    duration,
    loop,
    format
  } = req.query;

  const vidCachePathMp4 = cacheKeyFor('/bratvid', { text, texts, theme, background, color, width, height, cropWidth, cropHeight, fps, duration, loop, format: 'mp4' });
  const vidCachePathGif = cacheKeyFor('/bratvid', { text, texts, theme, background, color, width, height, cropWidth, cropHeight, fps, duration, loop, format: 'gif' });
  const vidCachedMp4 = readCacheIfFresh(vidCachePathMp4);
  const vidCachedGif = readCacheIfFresh(vidCachePathGif);
  const useFormat = (format || 'mp4').toLowerCase();
  const cachedVid = useFormat === 'gif' ? vidCachedGif : vidCachedMp4;
  if (cachedVid) {
    if (useFormat === 'gif') {
      res.set('Content-Type', 'image/gif');
      res.set('Content-Disposition', 'inline; filename="bratvid.gif"');
    } else {
      res.set('Content-Type', 'video/mp4');
      res.set('Content-Disposition', 'inline; filename="bratvid.mp4"');
    }
    res.set('X-Cache', 'HIT');
    return res.end(cachedVid);
  }

  let sourceTexts = [];
  if (typeof texts === 'string' && texts.trim()) {
    sourceTexts = texts.split(',').map(t => t.trim()).filter(Boolean);
  } else if (typeof text === 'string' && text.trim()) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    for (let i = 1; i <= words.length; i++) {
      sourceTexts.push(words.slice(0, i).join(' '));
    }
  }

  if (!sourceTexts.length) {
    return res.status(400).json({ error: 'text or texts is required' });
  }

  const frameDuration = Math.max(0.1, Number(duration) || 1);
  const videoFps = Math.min(60, Math.max(1, Number(fps) || Math.round(1 / frameDuration)));
  const loopCount = loop ? Math.max(1, Number(loop)) : 0;

  const viewportWidth = Math.min(2048, Math.max(500, Number(width) || 924));
  const viewportHeight = Math.min(2048, Math.max(400, Number(height) || 1418));
  const clipWidth = cropWidth ? Math.min(2000, Math.max(50, Number(cropWidth))) : 0;
  const clipHeight = cropHeight ? Math.min(2000, Math.max(50, Number(cropHeight))) : 0;

  const evenViewportWidth = viewportWidth % 2 === 0 ? viewportWidth : viewportWidth - 1;
  const evenViewportHeight = viewportHeight % 2 === 0 ? viewportHeight : viewportHeight - 1;
  const frameWidth = (clipWidth || 500) % 2 === 0 ? (clipWidth || 500) : (clipWidth || 500) + 1;
  const frameHeight = (clipHeight || 500) % 2 === 0 ? (clipHeight || 500) : (clipHeight || 500) + 1;

  let context = null;
  let page = null;

  try {
    if (!browser) {
      await launchBrowser();
    }

    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight }
    });
    page = await context.newPage();

    const filePath = path.join(__dirname, './site/html/www.bratgenerator.com/index.html');
    await page.goto(`file://${filePath}`);

    const validTheme = theme && ['white', 'green', 'black', 'red', 'strike', 'blue'].includes(theme) ? theme : 'white';

    const outputDir = path.join(__dirname, 'tmp');
    await fs.promises.mkdir(outputDir, { recursive: true });

    const pngFiles = [];
    for (const txt of sourceTexts) {
      await page.evaluate((t) => {
        if (typeof setupTheme === 'function') setupTheme(t);
      }, validTheme);

      await page.evaluate((value) => {
        const input = document.querySelector('#textInput');
        if (!input) return;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      }, txt);

      if (background || color) {
        await page.evaluate((data) => {
          if (data.background) {
            const el = document.querySelector('.node__content.clearfix');
            if (el) el.style.backgroundColor = data.background;
          }
          if (data.color) {
            document.querySelectorAll('.textFitted').forEach(el => el.style.color = data.color);
          }
        }, { background, color });
      }

      await page.waitForTimeout(150);

      const handle = await page.$('#textOverlay');
      if (!handle) {
        res.status(500).json({ error: 'Element #textOverlay not found' });
        return;
      }
      const frameIndex = pngFiles.length + 1;
      const padded = String(frameIndex).padStart(3, '0');
      const framePath = path.join(outputDir, `frame-${padded}.png`);
      const frameBuffer = await handle.screenshot();
      await fs.promises.writeFile(framePath, frameBuffer);
      pngFiles.push(framePath);
    }

    if (!pngFiles.length) {
      return res.status(500).json({ error: 'No frames generated' });
    }

    const outputPathMp4 = path.join(outputDir, 'bratvid.mp4');
    const outputPathGif = path.join(outputDir, 'bratvid.gif');

    let targetWidth = clipWidth ? clipWidth : 500;
    let targetHeight = clipHeight ? clipHeight : 500;
    if (!clipWidth || !clipHeight) {
      let maxW = 0;
      let maxH = 0;
      for (const p of pngFiles) {
        const buf = fs.readFileSync(p);
        const w = buf.readUInt32BE(16);
        const h = buf.readUInt32BE(20);
        if (w > maxW) maxW = w;
        if (h > maxH) maxH = h;
      }
      if (!clipWidth) targetWidth = maxW;
      if (!clipHeight) targetHeight = maxH;
    }
    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;

    const preprocessed = [];
    for (let i = 0; i < pngFiles.length; i++) {
      const src = pngFiles[i];
      const dst = path.join(outputDir, `frame-${String(i + 1).padStart(3, '0')}.pre.mp4`);
      const cmd = `ffmpeg -y -loop 1 -i ${src} -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=white" -c:v libx264 -pix_fmt yuv420p -shortest -t ${frameDuration} ${dst}`;
      execSync(cmd, { stdio: 'inherit' });
      preprocessed.push(dst);
    }

    const preListPath = path.join(outputDir, 'files-pre.txt');
    const preList = preprocessed.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.promises.writeFile(preListPath, preList);

    const mp4Args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', preListPath,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      outputPathMp4
    ];
    try {
      execFileSync('ffmpeg', mp4Args, { stdio: 'inherit' });
    } catch (err) {
      return res.status(500).json({ error: 'ffmpeg mp4 failed', detail: err.message });
    }

    const gifFilter = 'fps=10,scale=1000:1000:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer';
    const gifArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', preListPath,
      '-vf', gifFilter,
      '-loop', '0',
      outputPathGif
    ];
    try {
      execFileSync('ffmpeg', gifArgs, { stdio: 'inherit' });
    } catch (err) {
      return res.status(500).json({ error: 'ffmpeg gif failed', detail: err.message });
    }

    if (loopCount > 1) {
      const loopedOutput = path.join(outputDir, 'bratvid-looped.mp4');
      try {
        execSync(`ffmpeg -y -stream_loop ${loopCount - 1} -i ${outputPathMp4} -c copy ${loopedOutput}`);
        await fs.promises.rename(loopedOutput, outputPathMp4);
      } catch (e) {
        console.error('loop ffmpeg failed', e.message);
      }
    }

    const useFormat = (format || 'mp4').toLowerCase();
    if (useFormat === 'gif') {
      const gifBuffer = fs.readFileSync(outputPathGif);
      writeCache(cacheKeyFor('/bratvid', { text, texts, theme, background, color, width, height, cropWidth, cropHeight, fps, duration, loop, format: 'gif' }), gifBuffer);
      res.set('Content-Type', 'image/gif');
      res.set('Content-Disposition', 'inline; filename="bratvid.gif"');
      res.set('X-Cache', vidCachedGif ? 'HIT' : 'MISS');
      return res.send(gifBuffer);
    }

    const vidBuffer = fs.readFileSync(outputPathMp4);
    writeCache(vidCachePathMp4, vidBuffer);
    res.set('Content-Type', 'video/mp4');
    res.set('Content-Disposition', 'inline; filename="bratvid.mp4"');
    res.set('X-Cache', vidCachedMp4 ? 'HIT' : 'MISS');
    res.send(vidBuffer);
  } catch (err) {
    console.error('Bratvid error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
    }
    if (context) {
      try { await context.close(); } catch (e) {}
    }
  }
});

// list available fonts for the custom /meme endpoint (?font=)
app.get('/meme/fonts', (req, res) => {
  try {
    const fonts = (memeHandler.AVAILABLE_FONTS || []).map((f) => ({
      id: f.id,
      family: f.family,
      file: f.file,
      note: f.note,
    }));
    res.json({
      default: 'default (Arial Narrow)',
      count: fonts.length,
      fonts,
      usage: '/meme?image=<url>&top=<text>&bottom=<text>&font=<id>',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/meme/templates', (req, res) => {
  const dir = path.join(__dirname, 'site', 'meme-templates');
  const yaml = require('js-yaml');
  // memegen-style segment encode: space -> _, ? -> ~q, _ -> ~_
  const enc = (s) => String(s || '')
    .replace(/_/g, '~_')
    .replace(/\?/g, '~q')
    .replace(/ /g, '_');
  try {
    const files = fs.readdirSync(dir).filter((f) => /\.(jpg|png|gif)$/i.test(f));
    const seen = new Set();
    const ids = [];
    for (const f of files) {
      const id = f.replace(/\.(jpg|png|gif)$/i, '');
      if (seen.has(id)) continue; // dedupe jpg/png/gif sharing the same id
      seen.add(id);
      ids.push(id);
    }
    ids.sort();
    const templates = ids.map((id) => {
      const yml = path.join(dir, `${id}.yml`);
      const base = { id, name: id, lines: 2 };
      if (fs.existsSync(yml)) {
        try {
          const doc = yaml.load(fs.readFileSync(yml, 'utf-8')) || {};
          base.name = doc.name || id;
          base.source = doc.source || '';
          base.keywords = Array.isArray(doc.keywords) ? doc.keywords.filter((k) => k != null && k !== '-' && k !== '') : [];
          let example = Array.isArray(doc.example) ? doc.example.filter((e) => e !== '') : [];
          base.lines = Array.isArray(doc.text) ? doc.text.length : 2;
          // fallback example: fill missing lines with context-aware text from template name/keywords
          if (example.length < base.lines) {
            const nameWords = String(doc.name || id)
              .replace(/([a-z])([A-Z])/g, '$1 $2') // split CamelCase
              .split(/[\s,]+/).filter(Boolean);
            const ctx = [].concat(nameWords, base.keywords.filter(k => typeof k === 'string'));
            const lowerUsed = new Set(example.map(e => String(e).toLowerCase()));
            for (let i = example.length; i < base.lines; i++) {
              // pick a context word not already used (case-insensitive)
              let picked = null;
              for (const w of ctx) {
                if (w && !lowerUsed.has(String(w).toLowerCase())) { picked = w; break; }
              }
              if (!picked) picked = ctx.length ? ctx[i % ctx.length] : `line ${i + 1}`;
              if (!lowerUsed.has(String(picked).toLowerCase())) lowerUsed.add(String(picked).toLowerCase());
              example.push(picked);
            }
          }
          base.example = example;
          base.overlay = Array.isArray(doc.overlay) ? doc.overlay.length : 0;
          base.animated = fs.existsSync(path.join(dir, `${id}.gif`));
          // build an executable API example URL using the template's example texts
          if (base.example.length) {
            const segs = base.example.map(enc).join('/');
            base.url = `/meme/${id}/${segs}`;
          } else {
            base.url = `/meme/${id}/Top_text/Bottom_text`;
          }
        } catch (e) { /* ignore parse error, return base */ }
      }
      return base;
    });
    res.json({ count: templates.length, templates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/meme/:id/*', (req, res) => {
  const id = req.params.id
  const rest = req.params[0] || ''
  const parts = rest.split('/').filter((p) => p !== '')
  req.params.segments = parts
  const [top, bottom, third] = parts
  req.params.top = top
  req.params.bottom = bottom
  req.params.third = third
  return memeHandler.templateHandler(req, res)
});
app.get('/meme/:id', memeHandler.templateHandler);

app.get('/bratvid-realtime', async (req, res) => {
  const {
    text,
    theme,
    background,
    color,
    width,
    height,
    charDelayMin,
    charDelayMax,
    spaceDelay,
    chunkMax,
    format,
    loop
  } = req.query;

  const cachePath = cacheKeyFor('/bratvid-realtime', { text, theme, background, color, width, height, charDelayMin, charDelayMax, spaceDelay, chunkMax, format, loop });
  const cached = readCacheIfFresh(cachePath);
  if (cached) {
    if ((format || 'mp4').toLowerCase() === 'gif') {
      res.set('Content-Type', 'image/gif');
      res.set('Content-Disposition', 'inline; filename="bratvid-realtime.gif"');
    } else {
      res.set('Content-Type', 'video/mp4');
      res.set('Content-Disposition', 'inline; filename="bratvid-realtime.mp4"');
    }
    res.set('X-Cache', 'HIT');
    return res.end(cached);
  }

  const targetText = typeof text === 'string' ? String(text) : '';
  if (!targetText.trim()) {
    return res.status(400).json({ error: 'text query is required' });
  }

  const viewportWidth = Math.min(2048, Math.max(500, Number(width) || 924));
  const viewportHeight = Math.min(2048, Math.max(400, Number(height) || 1418));
  const validTheme = theme && ['white', 'green', 'black', 'red', 'strike', 'blue'].includes(theme) ? theme : 'white';
  const minDelay = Math.max(0, Number(charDelayMin) || 40);
  const maxDelay = Math.max(minDelay, Number(charDelayMax) || 60);
  const fixedSpaceDelay = Math.max(0, Number(spaceDelay) || 200);
  const chunkSizeMax = Math.max(1, Number(chunkMax) || 3);

  const lengthFactor = Math.max(0.25, 1 - targetText.length / 180);
  const effectiveMin = Math.max(0, Math.round(minDelay * lengthFactor));
  const effectiveMax = Math.max(effectiveMin, Math.round(maxDelay * lengthFactor));
  const loopCount = loop ? Math.max(1, Number(loop)) : 0;

  let context = null;
  let page = null;

  try {
    if (!browser) {
      await launchBrowser();
    }

    context = await browser.newContext({
      viewport: {
        width: viewportWidth % 2 === 0 ? viewportWidth : viewportWidth - 1,
        height: viewportHeight % 2 === 0 ? viewportHeight : viewportHeight - 1
      }
    });
    page = await context.newPage();

    const filePath = path.join(__dirname, './site/html/www.bratgenerator.com/index.html');
    await page.goto(`file://${filePath}`);

    await page.evaluate((t) => {
      if (typeof setupTheme === 'function') setupTheme(t);
    }, validTheme);

    await page.evaluate(() => {
      const input = document.querySelector('#textInput');
      if (!input) return;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    if (background || color) {
      await page.evaluate((data) => {
        if (data.background) {
          const el = document.querySelector('.node__content.clearfix');
          if (el) el.style.backgroundColor = data.background;
        }
        if (data.color) {
          document.querySelectorAll('.textFitted').forEach(el => el.style.color = data.color);
        }
      }, { background, color });
    }

    const outputDir = path.join(__dirname, 'tmp');
    await fs.promises.mkdir(outputDir, { recursive: true });

    const pngFiles = [];
    let built = '';
    const words = targetText.split(' ');
    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const chars = Array.from(word);
      let currentWord = '';
      for (let c = 0; c < chars.length; ) {
        const remain = chars.length - c;
        const size = Math.min(remain, Math.floor(Math.random() * chunkSizeMax) + 1);
        const chunk = chars.slice(c, c + size).join('');
        c += size;
        currentWord += chunk;
        const newText = built + currentWord;
        await page.evaluate((value) => {
          const input = document.querySelector('#textInput');
          if (!input) return;
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, newText);

        const delay = Math.floor(Math.random() * (effectiveMax - effectiveMin + 1)) + effectiveMin;
        await page.waitForTimeout(delay);

        const handle = await page.$('#textOverlay');
        if (!handle) {
          return res.status(500).json({ error: 'Element #textOverlay not found' });
        }

        const framePath = path.join(outputDir, `frame-${String(pngFiles.length + 1).padStart(3, '0')}.png`);
        const buffer = await handle.screenshot();
        await fs.promises.writeFile(framePath, buffer);
        pngFiles.push(framePath);
      }

      built += word;
      if (w < words.length - 1) {
        built += ' ';
        await page.evaluate((value) => {
          const input = document.querySelector('#textInput');
          if (!input) return;
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, built);

        await page.waitForTimeout(fixedSpaceDelay);

        const handle = await page.$('#textOverlay');
        if (!handle) {
          return res.status(500).json({ error: 'Element #textOverlay not found' });
        }

        const framePath = path.join(outputDir, `frame-${String(pngFiles.length + 1).padStart(3, '0')}.png`);
        const buffer = await handle.screenshot();
        await fs.promises.writeFile(framePath, buffer);
        pngFiles.push(framePath);
      }
    }

    if (!pngFiles.length) {
      return res.status(500).json({ error: 'No frames generated' });
    }

    const outputPathMp4 = path.join(outputDir, 'bratvid-realtime.mp4');
    const outputPathGif = path.join(outputDir, 'bratvid-realtime.gif');

    let targetWidth = 500;
    let targetHeight = 500;
    {
      let maxW = 0;
      let maxH = 0;
      for (const p of pngFiles) {
        const buf = fs.readFileSync(p);
        const w = buf.readUInt32BE(16);
        const h = buf.readUInt32BE(20);
        if (w > maxW) maxW = w;
        if (h > maxH) maxH = h;
      }
      targetWidth = maxW;
      targetHeight = maxH;
    }
    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;

    const frameDuration = 0.35;
    const preprocessed = [];
    for (let i = 0; i < pngFiles.length; i++) {
      const src = pngFiles[i];
      const dst = path.join(outputDir, `frame-${String(i + 1).padStart(3, '0')}.pre.mp4`);
      const preArgs = [
        '-y', '-loop', '1', '-i', src,
        '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=white`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        '-t', String(frameDuration),
        dst
      ];
      execFileSync('ffmpeg', preArgs, { stdio: 'inherit' });
      preprocessed.push(dst);
    }

    const preListPath = path.join(outputDir, 'files-realtime-pre.txt');
    const preList = preprocessed.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.promises.writeFile(preListPath, preList);

    const mp4Args = ['-y', '-f', 'concat', '-safe', '0', '-i', preListPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputPathMp4];
    try {
      execFileSync('ffmpeg', mp4Args, { stdio: 'inherit' });
    } catch (err) {
      return res.status(500).json({ error: 'ffmpeg mp4 failed', detail: err.message });
    }

    const gifFilter = 'fps=10,scale=1000:1000:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer';
    const gifArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', preListPath, '-vf', gifFilter, '-loop', '0', outputPathGif];
    try {
      execFileSync('ffmpeg', gifArgs, { stdio: 'inherit' });
    } catch (err) {
      return res.status(500).json({ error: 'ffmpeg gif failed', detail: err.message });
    }

    if (loopCount > 1) {
      const loopedOutput = path.join(outputDir, 'bratvid-realtime-looped.mp4');
      try {
        execFileSync('ffmpeg', ['-y', '-stream_loop', String(loopCount - 1), '-i', outputPathMp4, '-c', 'copy', loopedOutput], { stdio: 'inherit' });
        await fs.promises.rename(loopedOutput, outputPathMp4);
      } catch (e) {
        console.error('loop ffmpeg failed', e.message);
      }
    }

    const useFormat = (format || 'mp4').toLowerCase();
    if (useFormat === 'gif') {
      const gifBuffer = fs.readFileSync(outputPathGif);
      writeCache(cachePath, gifBuffer);
      res.set('Content-Type', 'image/gif');
      res.set('Content-Disposition', 'inline; filename="bratvid-realtime.gif"');
      res.set('X-Cache', cached ? 'HIT' : 'MISS');
      return res.send(gifBuffer);
    }

    const vidBuffer = fs.readFileSync(outputPathMp4);
    writeCache(cachePath, vidBuffer);
    res.set('Content-Type', 'video/mp4');
    res.set('Content-Disposition', 'inline; filename="bratvid-realtime.mp4"');
    res.set('X-Cache', cached ? 'HIT' : 'MISS');
    res.send(vidBuffer);
  } catch (err) {
    console.error('Bratvid realtime error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
    }
    if (context) {
      try { await context.close(); } catch (e) {}
    }
  }
});

const closeBrowser = async () => {
  if (browser) {
    console.log('Closing browser...');
    try { await browser.close(); } catch (e) {}
    browser = null;
    console.log('Browser closed');
  }
};

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  await closeBrowser();
  process.exit(0);
});

process.on('exit', async () => {
  console.log('Process exiting');
  await closeBrowser();
});
