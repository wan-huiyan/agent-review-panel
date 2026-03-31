// capture-gif.cjs — CommonJS (must be .cjs for ESM projects)
// Captures docs/sketch-flow-animated.svg at 4fps for 62s → docs/sketch-flow.gif
// Requires: npm install puppeteer, ffmpeg in PATH
// Usage: node docs/capture-gif.cjs

const puppeteer = require('puppeteer');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const WIDTH = 960;
const HEIGHT = 540;
const FPS = 4;
const DURATION = 62; // seconds
const TOTAL_FRAMES = FPS * DURATION; // 248
const INTERVAL_MS = 1000 / FPS; // 250ms

const SVG_URL = 'http://localhost:3847/sketch-flow-animated.svg';
const OUTPUT_GIF = path.resolve(__dirname, 'sketch-flow.gif');
const FRAMES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sketch-frames-'));

async function captureFrames() {
  console.log(`Launching browser, capturing ${TOTAL_FRAMES} frames at ${FPS}fps...`);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });
  await page.goto(SVG_URL, { waitUntil: 'networkidle0' });

  // Wait for page load / animation init
  await new Promise(r => setTimeout(r, 500));

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const framePath = path.join(FRAMES_DIR, `frame${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath });
    if (i % 20 === 0) process.stdout.write(`\r  Frame ${i + 1}/${TOTAL_FRAMES}...`);
    if (i < TOTAL_FRAMES - 1) {
      await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
  }
  console.log(`\nDone capturing. Closing browser.`);
  await browser.close();
}

function buildGif() {
  console.log('Building palette...');
  const paletteFile = path.join(FRAMES_DIR, 'palette.png');
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${FRAMES_DIR}/frame%04d.png" -vf "palettegen=max_colors=128:stats_mode=full" "${paletteFile}"`,
    { stdio: 'inherit' }
  );
  console.log('Encoding GIF with bayer dithering...');
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${FRAMES_DIR}/frame%04d.png" -i "${paletteFile}" -lavfi "paletteuse=dither=bayer:bayer_scale=5" "${OUTPUT_GIF}"`,
    { stdio: 'inherit' }
  );
}

function cleanup() {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
}

(async () => {
  try {
    await captureFrames();
    buildGif();
    cleanup();
    const size = (fs.statSync(OUTPUT_GIF).size / 1024).toFixed(0);
    console.log(`\nDone! ${OUTPUT_GIF} (${size} KB)`);
  } catch (err) {
    console.error('Error:', err.message);
    cleanup();
    process.exit(1);
  }
})();
