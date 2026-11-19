/**
 * Shared 2D Canvas HUD & Subtitle Compositor (/home/antigravity/shorts-engine/hud/hudCompositor.js)
 * Implements the workspace Clean Frame + Boxless YouTube Subtitle Standard:
 *  - Zero top UI headers, progress bars, or hook pill clutter
 *  - Zero bottom subtitle box, border, waveform, or speaker card container
 *  - Centered floating 800-weight outlined YouTube subtitles (#FFFFFF + #38BDF8 active highlight)
 *  - Dedicated offscreen subCanvas compositing to prevent fade stroke-bleed
 *  - Clause-aware splitting (<= 7 words / <= 44 chars, .no-gap em-dash) + balanced 1–2 line wrapping
 */

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

const CLAUSE_BREAK_WORDS = new Set([
  'for',
  'until',
  'into',
  'through',
  'without',
  'while',
  'when',
  'because',
  'before',
  'after',
  'where',
  'which',
  'that',
  'collapses',
]);

export function createHudCompositor(timeline, manifest = null, canvas = null, options = {}) {
  const width = timeline?.resolution?.width || 1080;
  const height = timeline?.resolution?.height || 1920;
  const duration = Number(timeline?.duration || 30.0);
  const sfxEvents = Array.isArray(timeline?.sfxEvents) ? timeline.sfxEvents : [];
  const accentColor = options.accentColor || '#38BDF8';
  const accentGlow = options.accentGlow || 'rgba(56, 189, 248, 0.50)';
  const centerAnchorY = options.subtitleY ?? 1650;

  if (!canvas && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
  }
  if (canvas) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;

  const rawLines = Array.isArray(manifest?.lines) && manifest.lines.length > 0
    ? manifest.lines
    : (timeline?.dialogue || []).map((d) => ({
        ...d,
        words: buildFallbackWords(d.text, d.start, d.end),
      }));

  function buildFallbackWords(text, start, end) {
    const raw = String(text || '').trim().split(/\s+/).filter(Boolean);
    const words = [];
    for (const tok of raw) {
      if (tok.includes('—') && !tok.endsWith('—')) {
        const parts = tok.split('—');
        parts.forEach((pt, idx) => {
          if (idx < parts.length - 1) words.push(pt + '—');
          else if (pt) words.push(pt);
        });
      } else {
        words.push(tok);
      }
    }
    const dur = Math.max(0.05, end - start);
    const step = dur / Math.max(1, words.length);
    return words.map((w, i) => ({
      word: w,
      start: start + i * step,
      end: start + (i + 1) * step,
    }));
  }

  function joinWordsCharLen(slice) {
    let s = '';
    for (let i = 0; i < slice.length; i++) {
      const w = slice[i].word || '';
      if (i > 0 && !(slice[i - 1].word || '').endsWith('—')) s += ' ';
      s += w;
    }
    return s.length;
  }

  function splitLineIntoCards(line) {
    const words = Array.isArray(line.words) && line.words.length > 0
      ? line.words
      : buildFallbackWords(line.text, line.start, line.end);

    if (words.length <= 7 && joinWordsCharLen(words) <= 44) {
      return [
        {
          id: `${line.id || 'line'}_0`,
          speaker: line.speaker,
          beatId: line.beatId,
          start: words[0]?.start ?? line.start,
          end: words[words.length - 1]?.end ?? line.end,
          words,
        },
      ];
    }

    const cards = [];
    let idx = 0;
    while (idx < words.length) {
      const remaining = words.length - idx;
      if (remaining <= 7 && joinWordsCharLen(words.slice(idx)) <= 44) {
        cards.push(words.slice(idx));
        break;
      }

      let bestSplit = Math.min(words.length, idx + 5);
      let bestScore = -1e9;
      const minK = Math.min(words.length, idx + 2);
      const maxK = Math.min(words.length, idx + 7);

      for (let k = minK; k <= maxK; k++) {
        const chunk = words.slice(idx, k);
        const charLen = joinWordsCharLen(chunk);
        const remCount = words.length - k;

        if (charLen > 45 && k > idx + 2) continue;
        if ((words[k - 1]?.word || '').endsWith('—')) continue;
        if (remCount === 1) continue;

        let score = 0;
        const prevWord = words[k - 1]?.word || '';
        const nextWordLower = (words[k]?.word || '').toLowerCase().replace(/[^a-z]/g, '');

        if (/[,.;:!?]$/.test(prevWord)) score += 60;
        if (CLAUSE_BREAK_WORDS.has(nextWordLower)) score += 45;
        if (k - idx >= 4 && k - idx <= 6) score += 16;
        if (remCount >= 3 && remCount <= 7 && joinWordsCharLen(words.slice(k)) <= 44) {
          score += 24;
        }
        score -= Math.abs(charLen - 33) * 0.7;

        if (score > bestScore) {
          bestScore = score;
          bestSplit = k;
        }
      }

      cards.push(words.slice(idx, bestSplit));
      idx = bestSplit;
    }

    return cards.map((chunk, cIdx) => ({
      id: `${line.id || 'line'}_${cIdx}`,
      speaker: line.speaker,
      beatId: line.beatId,
      start: chunk[0]?.start ?? line.start,
      end: chunk[chunk.length - 1]?.end ?? line.end,
      words: chunk,
    }));
  }

  const subtitlePages = rawLines.flatMap((line) => splitLineIntoCards(line));

  function getActiveSubtitlePage(t) {
    for (let i = 0; i < subtitlePages.length; i++) {
      const p = subtitlePages[i];
      const nextStart = i + 1 < subtitlePages.length ? subtitlePages[i + 1].start : duration + 1.0;
      const winStart = p.start - 0.06;
      const winEnd = Math.min(nextStart - 0.04, p.end + 0.24);
      if (t >= winStart && t <= winEnd) {
        return p;
      }
    }
    return null;
  }

  function getFlashAlpha(t) {
    let alpha = 0;
    for (let i = 0; i < sfxEvents.length; i++) {
      const ev = sfxEvents[i];
      const dt = t - ev.time;
      if (dt >= 0 && dt < 0.28) {
        let strength = 0;
        if (ev.type === 'camera_flash') strength = 0.72;
        else if (ev.type === 'sonic_boom' || ev.type === 'pile_slam') strength = 0.34;
        else if (ev.type === 'vine_boom' || ev.type === 'quake_rumble') strength = 0.24;
        if (strength > 0) {
          alpha = Math.max(alpha, strength * Math.exp(-dt * 12.5));
        }
      }
    }
    return clamp01(alpha);
  }

  function measureSlicePx(c, slice, spacePx) {
    let w = 0;
    for (let i = 0; i < slice.length; i++) {
      if (i > 0 && !(slice[i - 1].word || '').endsWith('—')) w += spacePx;
      w += c.measureText(slice[i].word).width;
    }
    return w;
  }

  function annotateNoSpace(slice) {
    return slice.map((w, i) => ({
      ...w,
      noSpaceBefore: i > 0 && (slice[i - 1].word || '').endsWith('—'),
    }));
  }

  function wrapSubtitleLines(c, words, maxWidthPx) {
    const sizes = [42, 40, 38, 36];
    for (const fontSize of sizes) {
      c.font = `800 ${fontSize}px "DejaVu Sans", sans-serif`;
      const spacePx = c.measureText(' ').width * 1.08;
      const singlePx = measureSlicePx(c, words, spacePx);
      if (singlePx <= maxWidthPx) {
        return { fontSize, lines: [annotateNoSpace(words)] };
      }

      // Symmetrically balanced 2-line split avoiding 1-word orphan tails
      let bestK = -1;
      let bestCost = 1e9;
      for (let k = 1; k < words.length; k++) {
        if ((words[k - 1].word || '').endsWith('—')) continue;
        const left = words.slice(0, k);
        const right = words.slice(k);
        if (words.length >= 4 && (left.length < 2 || right.length < 2)) continue;

        const w1 = measureSlicePx(c, left, spacePx);
        const w2 = measureSlicePx(c, right, spacePx);
        if (w1 > maxWidthPx || w2 > maxWidthPx) continue;

        let cost = Math.abs(w1 - w2);
        const lastLeftLower = (left[left.length - 1].word || '').toLowerCase();
        const firstRightLower = (right[0].word || '').toLowerCase().replace(/[^a-z]/g, '');
        if (/^(a|an|the|is|are|of|in|at|to|for)$/.test(lastLeftLower)) cost += 90;
        if (CLAUSE_BREAK_WORDS.has(firstRightLower) || /[,.;:!?]$/.test(left[left.length - 1].word || '')) {
          cost -= 110;
        }
        if (cost < bestCost) {
          bestCost = cost;
          bestK = k;
        }
      }

      if (bestK > 0) {
        return {
          fontSize,
          lines: [annotateNoSpace(words.slice(0, bestK)), annotateNoSpace(words.slice(bestK))],
        };
      }
    }

    c.font = '800 36px "DejaVu Sans", sans-serif';
    const mid = Math.max(1, Math.ceil(words.length / 2));
    return {
      fontSize: 36,
      lines: [annotateNoSpace(words.slice(0, mid)), annotateNoSpace(words.slice(mid))].filter((l) => l.length > 0),
    };
  }

  let vigCanvas = null;
  let subCanvas = null;
  let subCtx = null;
  const SUB_CANVAS_H = 260;
  const SUB_CANVAS_TOP = centerAnchorY - Math.round(SUB_CANVAS_H * 0.5);

  if (typeof document !== 'undefined') {
    vigCanvas = document.createElement('canvas');
    vigCanvas.width = width;
    vigCanvas.height = height;
    const vctx = vigCanvas.getContext('2d');
    const vig = vctx.createRadialGradient(width * 0.5, height * 0.45, height * 0.30, width * 0.5, height * 0.5, height * 0.74);
    vig.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.74, 'rgba(4, 11, 22, 0.10)');
    vig.addColorStop(1.0, 'rgba(2, 7, 16, 0.38)');
    vctx.fillStyle = vig;
    vctx.fillRect(0, 0, width, height);

    subCanvas = document.createElement('canvas');
    subCanvas.width = width;
    subCanvas.height = SUB_CANVAS_H;
    subCtx = subCanvas.getContext('2d', { alpha: true });
  }

  function drawYoutubeSubtitles(t, page) {
    if (!page || !page.words || page.words.length === 0) return;

    const fadeIn = clamp01((t - (page.start - 0.06)) / 0.08);
    const fadeOut = t > page.end + 0.06 ? clamp01(1.0 - (t - (page.end + 0.06)) / 0.12) : 1.0;
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0.02) return;

    const targetCtx = subCtx || ctx;
    const localOffsetY = subCtx ? SUB_CANVAS_TOP : 0;
    if (subCtx) {
      subCtx.clearRect(0, 0, width, SUB_CANVAS_H);
    }

    const { fontSize, lines } = wrapSubtitleLines(targetCtx, page.words, 900);
    if (lines.length === 0) return;

    const lineH = fontSize * 1.32;
    const anchorLocalY = centerAnchorY - localOffsetY;
    const startY = lines.length === 1 ? anchorLocalY : anchorLocalY - lineH * 0.45;

    targetCtx.save();
    targetCtx.globalAlpha = subCtx ? 1.0 : alpha;
    targetCtx.font = `800 ${fontSize}px "DejaVu Sans", sans-serif`;
    const spacePx = targetCtx.measureText(' ').width * 1.08;
    targetCtx.textAlign = 'left';
    targetCtx.textBaseline = 'middle';
    targetCtx.lineJoin = 'round';
    targetCtx.miterLimit = 2;

    for (let li = 0; li < lines.length; li++) {
      const lineWords = lines[li];
      const y = startY + li * lineH;

      let totalLineW = 0;
      const wordWidths = [];
      for (let wi = 0; wi < lineWords.length; wi++) {
        const wp = targetCtx.measureText(lineWords[wi].word).width;
        wordWidths.push(wp);
        if (wi > 0 && !lineWords[wi].noSpaceBefore) totalLineW += spacePx;
        totalLineW += wp;
      }

      // Pass 1: Crisp dark outline + subtle soft drop shadow (zero box container)
      let x = (width - totalLineW) * 0.5;
      for (let wi = 0; wi < lineWords.length; wi++) {
        const w = lineWords[wi];
        if (wi > 0 && !w.noSpaceBefore) x += spacePx;

        targetCtx.save();
        targetCtx.shadowColor = 'rgba(2, 6, 16, 0.90)';
        targetCtx.shadowBlur = 14;
        targetCtx.shadowOffsetY = 3;
        targetCtx.lineWidth = 10;
        targetCtx.strokeStyle = 'rgba(3, 8, 18, 0.98)';
        targetCtx.strokeText(w.word, x, y);
        targetCtx.restore();

        x += wordWidths[wi];
      }

      // Pass 2: Pure white fill with subtle sky-cyan emphasis on active spoken word
      x = (width - totalLineW) * 0.5;
      for (let wi = 0; wi < lineWords.length; wi++) {
        const w = lineWords[wi];
        if (wi > 0 && !w.noSpaceBefore) x += spacePx;

        const isActive = t >= w.start - 0.03 && t <= w.end + 0.04;
        targetCtx.save();
        if (isActive) {
          targetCtx.shadowColor = accentGlow;
          targetCtx.shadowBlur = 10;
          targetCtx.fillStyle = accentColor;
        } else {
          targetCtx.fillStyle = '#FFFFFF';
        }
        targetCtx.fillText(w.word, x, y);
        targetCtx.restore();

        x += wordWidths[wi];
      }
    }

    targetCtx.restore();

    if (subCanvas) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(subCanvas, 0, SUB_CANVAS_TOP);
      ctx.restore();
    }
  }

  function draw(t, hudState = {}) {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    if (vigCanvas) {
      ctx.drawImage(vigCanvas, 0, 0);
    }

    const flash = Math.max(getFlashAlpha(t), hudState.flashAlpha || 0);
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255, 250, 232, ${flash.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }

    if (typeof options.drawOverlay === 'function') {
      options.drawOverlay(ctx, t, hudState);
    }

    drawYoutubeSubtitles(t, getActiveSubtitlePage(t));
  }

  return {
    canvas,
    draw,
    render: draw,
    update: draw,
    getActiveSubtitlePage,
    subtitlePages,
  };
}

export function createFrameCompositor(webglCanvas, hudCanvas, width = 1080, height = 1920) {
  const compCanvas = document.createElement('canvas');
  compCanvas.width = width;
  compCanvas.height = height;
  const ctx = compCanvas.getContext('2d', { alpha: false });

  function composite() {
    ctx.drawImage(webglCanvas, 0, 0, width, height);
    if (hudCanvas) {
      ctx.drawImage(hudCanvas, 0, 0, width, height);
    }
    return compCanvas;
  }

  return { canvas: compCanvas, composite };
}
