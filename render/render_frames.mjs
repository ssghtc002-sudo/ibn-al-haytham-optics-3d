/**
 * Ibn al-Haytham Render Runner (/home/antigravity/ssghtc002-sudo/ibn-al-haytham-optics-3d/render/render_frames.mjs)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFastRender } from './fastRenderer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const qaMode = args.has('--qa-only');
const batchArg = [...args].find((a) => a.startsWith('--batch-size='));
const framesArg = [...args].find((a) => a.startsWith('--frames='));
const latencyArg = [...args].find((a) => a.startsWith('--latency='));
const batchSize = batchArg ? Number(batchArg.split('=')[1]) : 450;
const maxFrames = framesArg ? Number(framesArg.split('=')[1]) : null;
const latencyMode = latencyArg ? latencyArg.split('=')[1] : 'realtime';

await runFastRender({
  projectRoot: PROJECT_ROOT,
  mp4Filename: 'ibn_al_haytham_optics_short.mp4',
  qaMode,
  workers: 1,
  batchSize,
  maxFrames,
  latencyMode,
  qaTimes: [0.8, 3.6, 5.6, 8.2, 11.4, 14.4, 16.4, 19.0, 22.8, 28.0],
});
