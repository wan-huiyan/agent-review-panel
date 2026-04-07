// capture-html-demo.cjs — CommonJS (must be .cjs for ESM projects)
// Captures docs/demo-synthetic-sample.html as an animated GIF showing the
// v2.15 expandable issue cards in action.
//
// Requires:
//   npm install --save-dev puppeteer
//   ffmpeg in PATH (brew install ffmpeg)
//
// Usage:
//   node docs/capture-html-demo.cjs
//
// Output:
//   docs/html-demo.gif (~800KB-1.5MB, ~15-25 seconds, 960px wide)
//
// Notes:
//   - package.json has "type": "module" so this file MUST be .cjs
//     (otherwise `require` fails with "ReferenceError: require is not defined")
//   - Capture at 1280x800, downscale to 960x600 with Lanczos (sharper rendering)
//   - 5 fps is smooth enough for readable UI, reasonable file size
//   - DOM interactions (clicks, scrolls) are scripted between frame batches

const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// --- Settings ---
const WIDTH = 1280;
const HEIGHT = 800;
const FPS = 5;
const INTERVAL_MS = 1000 / FPS;

const HTML_PATH = path.resolve(__dirname, 'demo-synthetic-sample.html');
const OUTPUT_GIF = path.resolve(__dirname, 'html-demo.gif');
const FRAMES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'html-demo-frames-'));

// --- Interaction sequence ---
// Each step has: an optional action (executed once) and a number of frames
// to capture afterwards before moving to the next step.
//
// action types:
//   'wait'     — capture frames without any action (pure settle time)
//   'click'    — page.click(selector), with .catch(() => {}) for tolerance
//   'scrollTo' — scroll element matching selector into view
//   'scrollBy' — scroll by a pixel delta
//   'eval'     — run arbitrary JS in the page (for complex interactions)

const SEQUENCE = [
  // Initial state — let everything settle
  { desc: 'Initial dashboard view',      action: 'wait',     frames: 12 },

  // Open issue A1 (P0 client_secret)
  { desc: 'Scroll to issue A1',          action: 'scrollTo', target: '#issue-A1',        frames: 8 },
  { desc: 'Click A1 to expand card',     action: 'click',    target: '#issue-A1 > summary', frames: 12 },
  { desc: 'Scroll within A1 accordion',  action: 'scrollBy', delta: 250, frames: 12 },

  // Scroll through the Code Evidence and Raised by sections
  { desc: 'Show Code Evidence + Raised by', action: 'scrollBy', delta: 300, frames: 12 },

  // Scroll to show verification trail + debate
  { desc: 'Show Verification + Debate',  action: 'scrollBy', delta: 350, frames: 14 },

  // Scroll to show Judge Ruling + Fix
  { desc: 'Show Judge Ruling + Fix',     action: 'scrollBy', delta: 400, frames: 14 },

  // Collapse A1
  { desc: 'Scroll back to A1 header',    action: 'scrollTo', target: '#issue-A1', frames: 6 },
  { desc: 'Collapse A1',                 action: 'click',    target: '#issue-A1 > summary', frames: 6 },

  // Open B1 (the composition bug — showcase piece)
  { desc: 'Scroll to B1',                action: 'scrollTo', target: '#issue-B1',        frames: 8 },
  { desc: 'Click B1 to expand card',     action: 'click',    target: '#issue-B1 > summary', frames: 12 },
  { desc: 'Scroll within B1 accordion',  action: 'scrollBy', delta: 300, frames: 12 },
  { desc: 'Show B1 cross-references',    action: 'scrollBy', delta: 400, frames: 12 },

  // Collapse B1, click Expand all
  { desc: 'Collapse B1',                 action: 'click',    target: '#issue-B1 > summary', frames: 4 },
  { desc: 'Scroll to top',               action: 'scrollTo', target: 'top',               frames: 8 },
  { desc: 'Click Expand all',            action: 'click',    target: '#expand-all',       frames: 12 },
  { desc: 'Final settle',                action: 'wait',     frames: 10 },
];

async function captureFrames() {
  console.log(`Launching headless Chrome (${WIDTH}x${HEIGHT})...`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  const fileUrl = `file://${HTML_PATH}`;
  console.log(`Loading ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // Wait for Tailwind + Prism.js to fully settle
  await new Promise((r) => setTimeout(r, 1200));

  let frameIdx = 0;
  const totalFrames = SEQUENCE.reduce((sum, s) => sum + s.frames, 0);
  console.log(`Capturing ${totalFrames} frames across ${SEQUENCE.length} steps...`);

  for (const step of SEQUENCE) {
    // Execute the action once before capturing frames for this step
    if (step.action === 'click') {
      await page.click(step.target).catch((err) => {
        console.warn(`  [${step.desc}] click failed: ${err.message}`);
      });
    } else if (step.action === 'scrollTo') {
      if (step.target === 'top') {
        await page.evaluate(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      } else {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, step.target);
      }
    } else if (step.action === 'scrollBy') {
      await page.evaluate((delta) => {
        window.scrollBy({ top: delta, behavior: 'smooth' });
      }, step.delta);
    } else if (step.action === 'eval') {
      await page.evaluate(step.script);
    }
    // 'wait' action: no-op, just capture frames

    // Capture frames for this step
    for (let i = 0; i < step.frames; i++) {
      const framePath = path.join(
        FRAMES_DIR,
        `frame${String(frameIdx).padStart(4, '0')}.png`
      );
      await page.screenshot({ path: framePath });
      frameIdx++;
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
    process.stdout.write(`  [${frameIdx}/${totalFrames}] ${step.desc}\n`);
  }

  console.log(`Captured ${frameIdx} frames. Closing browser.`);
  await browser.close();
  return frameIdx;
}

function buildGif(totalFrames) {
  const paletteFile = path.join(FRAMES_DIR, 'palette.png');

  console.log('Building palette (256 colors, diff mode)...');
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${FRAMES_DIR}/frame%04d.png" ` +
      `-vf "scale=960:-1:flags=lanczos,palettegen=max_colors=256:stats_mode=diff" ` +
      `"${paletteFile}"`,
    { stdio: 'inherit' }
  );

  console.log('Encoding GIF with bayer dithering (downscale to 960px)...');
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${FRAMES_DIR}/frame%04d.png" -i "${paletteFile}" ` +
      `-lavfi "scale=960:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5" ` +
      `"${OUTPUT_GIF}"`,
    { stdio: 'inherit' }
  );

  const sizeKb = (fs.statSync(OUTPUT_GIF).size / 1024).toFixed(0);
  console.log(`\nDone! ${OUTPUT_GIF} (${sizeKb} KB, ${totalFrames} frames)`);

  if (sizeKb > 2000) {
    console.warn(
      `\nWARNING: GIF is larger than 2MB (${sizeKb} KB). ` +
        `Consider running: gifsicle -O3 --lossy=80 ${OUTPUT_GIF} -o ${OUTPUT_GIF}`
    );
  }
}

function cleanup() {
  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  }
}

(async () => {
  try {
    const totalFrames = await captureFrames();
    buildGif(totalFrames);
    cleanup();
  } catch (err) {
    console.error('\nError:', err.message);
    console.error(err.stack);
    cleanup();
    process.exit(1);
  }
})();
