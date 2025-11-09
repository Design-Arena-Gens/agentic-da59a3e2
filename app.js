(() => {
  const $ = (sel) => document.querySelector(sel);
  const titleInput = $('#titleInput');
  const nameInput = $('#nameInput');
  const themeSelect = $('#themeSelect');
  const moodSelect = $('#moodSelect');
  const durationInput = $('#durationInput');
  const resSelect = $('#resSelect');
  const fpsSelect = $('#fpsSelect');
  const previewBtn = $('#previewBtn');
  const recordBtn = $('#recordBtn');
  const stopBtn = $('#stopBtn');
  const overlay = $('#overlayMsg');
  const videoEl = $('#videoPreview');
  const dlLink = $('#downloadLink');
  const metaInfo = $('#metaInfo');

  const canvas = $('#scene');
  const ctx = canvas.getContext('2d');

  // State
  let animReq = 0;
  let isAnimating = false;
  let startTime = 0;
  let sceneTime = 0;
  let fps = 30;
  let program = null; // current scene program
  let seed = Math.floor(Math.random() * 1e9);

  function parseRes(value) {
    const [w, h] = value.split('x').map(Number);
    return { w, h };
  }

  function resizeCanvas() {
    const { w, h } = parseRes(resSelect.value);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seededRandomFactory(s) {
    let x = s >>> 0;
    return function rand() {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return (x >>> 0) / 4294967295;
    }
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function themePalette(theme, mood) {
    // Return colors for sky, horizon, accent
    switch(theme) {
      case 'action':
        return { sky:'#0b0f1a', grad1:'#0f2a5a', grad2:'#2b115e', ground:'#0a0b14', accent:'#ff8c3a' };
      case 'romance':
        return { sky:'#120d1a', grad1:'#3a0f3e', grad2:'#6d1f5a', ground:'#160a1b', accent:'#ff6fa8' };
      case 'scifi':
        return { sky:'#04080f', grad1:'#0e2240', grad2:'#0f3c5a', ground:'#05070e', accent:'#39d98a' };
      default:
        return { sky:'#060912', grad1:'#152048', grad2:'#2a0f5a', ground:'#0a0d18', accent:'#7a88ff' };
    }
  }

  function makeSceneProgram() {
    const rand = seededRandomFactory(seed);
    const theme = themeSelect.value;
    const mood = moodSelect.value;
    const pal = themePalette(theme, mood);

    // Particles for starfield / dust
    const numStars = 160;
    const stars = new Array(numStars).fill(0).map(() => ({
      x: rand(), y: rand(), z: rand(), s: lerp(0.5, 1.8, rand())
    }));

    // Floating clouds layers
    const clouds = new Array(6).fill(0).map((_, i) => ({
      y: lerp(60, 260, rand()), speed: lerp(10, 40, rand()), offset: rand()*1000, alpha: lerp(.08,.22, rand()), scale: lerp(0.6, 2.0, rand()),
    }));

    // Character palette
    const hairColors = ['#27212b','#4f2a2f','#1d2a4f','#2f3a6d','#0f0f0f'];
    const hair = hairColors[Math.floor(rand()*hairColors.length)];
    const outfit = pal.accent;

    // Dialogue lines (Hindi)
    const name = nameInput.value.trim() || '????';
    const title = titleInput.value.trim() || '???? ?????';
    const lines = [
      `??? ${name} ???...`,
      `${title} ?? ?????? ???? ?? ???? ???`,
      theme === 'action' ? '??? ????, ??? ???? ? ?? ??? ???? ?????'
        : theme === 'romance' ? '???? ???, ???? ??????? ? ?? ????? ?????'
        : theme === 'scifi' ? '??? ?????? ??, ????? ????? ?? ? ?? ??? ????? ????'
        : '???? ?? ?????? ? ??? ????? ?????? ???',
    ];

    let blinkTimer = 0, blinkState = 0;

    function drawBackground(t) {
      const { width: W, height: H } = canvas;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, pal.grad1);
      g.addColorStop(1, pal.grad2);
      ctx.fillStyle = g;
      ctx.fillRect(0,0,W,H);

      // Stars
      for (const s of stars) {
        const x = (s.x + t * 0.003 * (0.2 + s.z)) % 1;
        const y = s.y;
        const px = x * W;
        const py = y * (H*0.6);
        const alpha = 0.6 + 0.4 * Math.sin((t*0.004 + s.x*10 + s.y*7));
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px, py, s.s, s.s);
        ctx.globalAlpha = 1;
      }

      // Clouds
      clouds.forEach((c, idx) => {
        const y = c.y + Math.sin((t*0.0007 + idx*0.3)) * 10;
        const x = ( (t*0.02*c.speed + c.offset) % (W+400) ) - 200;
        ctx.globalAlpha = c.alpha;
        ctx.fillStyle = '#ffffff';
        drawCloud(x, y, 120*c.scale);
        drawCloud(x+260, y+30, 90*c.scale);
        ctx.globalAlpha = 1;
      });

      // Horizon ground
      ctx.fillStyle = pal.ground;
      ctx.fillRect(0, H*0.7, W, H*0.3);

      // Light sweep
      ctx.globalCompositeOperation = 'screen';
      const sweepX = (Math.sin(t*0.001) * 0.5 + 0.5) * W;
      const lg = ctx.createLinearGradient(sweepX-120, 0, sweepX+120, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0,0,W,H);
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawCloud(cx, cy, r) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i/6) * Math.PI * 2;
        const x = cx + Math.cos(a) * r * (i%2? .7:1);
        const y = cy + Math.sin(a) * r * (i%2? .7:1);
        ctx.arc(x, y, r*0.6, 0, Math.PI*2);
      }
      ctx.fill();
    }

    function drawCharacter(t) {
      const { width: W, height: H } = canvas;
      const baseX = W*0.5, baseY = H*0.72;
      const bob = Math.sin(t*0.003) * 8;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(baseX, baseY+6, 110, 18, 0, 0, Math.PI*2); ctx.fill();

      // Body
      ctx.fillStyle = '#141a2c';
      roundRect(baseX-60, baseY-160+bob, 120, 160, 24, true);

      // Collar / accent
      ctx.strokeStyle = outfit; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(baseX-30, baseY-120+bob); ctx.lineTo(baseX, baseY-90+bob); ctx.lineTo(baseX+30, baseY-120+bob); ctx.stroke();

      // Head
      ctx.fillStyle = '#ffd9c2';
      roundRect(baseX-55, baseY-260+bob, 110, 120, 30, true);

      // Hair
      ctx.fillStyle = hair;
      roundRect(baseX-60, baseY-280+bob, 120, 60, 28, true);
      ctx.beginPath();
      ctx.moveTo(baseX-60, baseY-240+bob);
      ctx.bezierCurveTo(baseX-30, baseY-220+bob, baseX-10, baseY-210+bob, baseX-10, baseY-200+bob);
      ctx.lineTo(baseX-10, baseY-170+bob);
      ctx.bezierCurveTo(baseX-30, baseY-200+bob, baseX-40, baseY-210+bob, baseX-60, baseY-220+bob);
      ctx.closePath(); ctx.fill();

      // Eyes
      blinkTimer += 1;
      if (blinkTimer > 180 + Math.random()*120) { blinkState = 1; blinkTimer = 0; }
      const eyeH = blinkState > 0 ? 2 : 10;
      if (blinkState > 0) blinkState = Math.max(0, blinkState - 0.2);
      ctx.fillStyle = '#111';
      roundRect(baseX-26, baseY-220+bob, 18, eyeH, 5, true);
      roundRect(baseX+8, baseY-220+bob, 18, eyeH, 5, true);
      ctx.fillStyle = outfit;
      ctx.fillRect(baseX-18, baseY-214+bob, 4, eyeH);
      ctx.fillRect(baseX+16, baseY-214+bob, 4, eyeH);

      // Mouth (talking)
      const talk = 0.5 + 0.5 * Math.sin(t*0.02);
      ctx.fillStyle = '#b2544e';
      roundRect(baseX-8, baseY-190+bob, 16, 6 + talk*6, 4, true);

      // Outline
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
      roundRect(baseX-60, baseY-160+bob, 120, 160, 24, false);
      roundRect(baseX-55, baseY-260+bob, 110, 120, 30, false);

      // Speech bubble
      drawBubble(t, baseX-200, baseY-290+bob, 280, 80, 16);
    }

    function drawBubble(t, x, y, w, h, r) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(x, y, w, h, r, true);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
      roundRect(x, y, w, h, r, false);

      // Tail
      ctx.beginPath();
      ctx.moveTo(x+w-30, y+h);
      ctx.lineTo(x+w-50, y+h+16);
      ctx.lineTo(x+w-70, y+h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();

      // Text typing
      ctx.save();
      ctx.beginPath(); roundRect(x+8, y+8, w-16, h-16, r-6, false); ctx.clip();
      ctx.fillStyle = '#e6ebff';
      ctx.font = '600 18px Poppins, Noto Sans Devanagari, sans-serif';
      const total = lines.length;
      const per = 3.5; // seconds per line
      const idx = Math.floor((sceneTime/1000) / per) % total;
      const progress = ((sceneTime/1000) % per) / per;
      const visibleChars = Math.floor(lines[idx].length * easeInOut(clamp(progress, 0, 1)));
      const text = lines[idx].slice(0, visibleChars);
      drawWrappedText(text, x+18, y+28, w-36, 24);
      ctx.restore();
    }

    function drawWrappedText(text, x, y, maxWidth, lineHeight) {
      const words = text.split(' ');
      let line = '';
      let yy = y;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line, x, yy);
          line = words[n] + ' ';
          yy += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, yy);
    }

    function roundRect(x, y, w, h, r, fill = true) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      if (fill) ctx.fill(); else ctx.stroke();
    }

    function render(t) {
      drawBackground(t);
      drawCharacter(t);
    }

    return { render, pal };
  }

  function startAnimation() {
    if (isAnimating) return;
    fps = Number(fpsSelect.value);
    isAnimating = true;
    startTime = performance.now();
    sceneTime = 0;
    overlay.textContent = '????? ?? ??? ??...';
    overlay.style.opacity = '0';

    program = makeSceneProgram();

    const frameMs = 1000 / fps;
    let last = startTime;

    function loop(now) {
      if (!isAnimating) return;
      const dt = now - last;
      if (dt >= frameMs - 1) {
        sceneTime = now - startTime;
        ctx.clearRect(0,0,canvas.width, canvas.height);
        program.render(now);
        last = now;
      }
      animReq = requestAnimationFrame(loop);
    }
    animReq = requestAnimationFrame(loop);
  }

  function stopAnimation() {
    isAnimating = false;
    cancelAnimationFrame(animReq);
    overlay.style.opacity = '1';
  }

  async function recordVideo() {
    const durationSec = clamp(Number(durationInput.value) || 15, 5, 60);
    fps = Number(fpsSelect.value);

    // Ensure size
    resizeCanvas();
    startAnimation();

    // Prepare audio
    const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
    const dest = ac.createMediaStreamDestination();

    // Music program
    const bpm = 90;
    const beat = 60 / bpm; // seconds per beat
    const total = durationSec;

    const master = ac.createGain(); master.gain.value = 0.4; master.connect(dest);

    const reverb = ac.createConvolver();
    // Tiny impulse
    const impulseLen = 0.5;
    const impulse = ac.createBuffer(2, ac.sampleRate * impulseLen, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const buf = impulse.getChannelData(ch);
      for (let i = 0; i < buf.length; i++) { buf[i] = (Math.random()*2-1) * Math.pow(1 - i/buf.length, 3); }
    }
    reverb.buffer = impulse;
    const revGain = ac.createGain(); revGain.gain.value = 0.18;
    revGain.connect(master);
    reverb.connect(revGain);

    const dry = ac.createGain(); dry.gain.value = 0.82; dry.connect(master);

    function note(freq, time, len = beat*0.95, type='triangle', vel=0.6) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      const env = g.gain; env.value = 0.0001;
      o.connect(g);
      g.connect(dry); g.connect(reverb);
      o.start(time);
      env.setValueAtTime(0.0001, time);
      env.linearRampToValueAtTime(vel, time + 0.01);
      env.exponentialRampToValueAtTime(0.0001, time + len);
      o.stop(time + len + 0.05);
    }

    // Scale A minor
    const A4 = 440; const semitone = Math.pow(2, 1/12);
    const scale = [0,2,3,5,7,8,10,12].map(n => A4 * Math.pow(semitone, n-9)); // around A3-A5

    // Bass + lead pattern
    const startAt = ac.currentTime + 0.05;
    let t = 0;
    while (t < total) {
      const barStart = startAt + t;
      const rootIdx = [0,5,3,7][Math.floor((t/ (beat*4)) % 4)] || 0;
      const root = scale[rootIdx % scale.length];

      // Bass
      for (let i=0;i<4;i++) note(root/2, barStart + i*beat, beat*0.95, 'sawtooth', 0.35);

      // Lead arpeggio
      const arp = [root, scale[(rootIdx+3)%scale.length], scale[(rootIdx+5)%scale.length], scale[(rootIdx+7)%scale.length]];
      for (let i=0;i<8;i++) note(arp[i%arp.length]*2, barStart + i*(beat/2), beat*0.4, 'triangle', 0.25 + (i%2)*0.1);

      t += beat*4;
    }

    // Combine streams
    const videoStream = canvas.captureStream(fps);
    const mixedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const rec = new MediaRecorder(mixedStream, { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 160_000 });
    const chunks = [];

    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      videoEl.src = url;
      dlLink.href = url;
      dlLink.download = sanitizeFileName((titleInput.value || 'anime-video') + '.webm');
      metaInfo.textContent = `????: ${(blob.size/1024/1024).toFixed(2)} MB, ???? ~ ${durationSec}s, ${fps} FPS`;
      stopBtn.disabled = true;
      recordBtn.disabled = false;
      previewBtn.disabled = false;
      overlay.textContent = '?????????? ???? ???';
      overlay.style.opacity = '1';
      // Close audio after a bit
      setTimeout(() => ac.close().catch(()=>{}), 500);
    };

    // UI state
    recordBtn.disabled = true; previewBtn.disabled = true; stopBtn.disabled = false;
    overlay.textContent = '?????????? ?? ??? ??...'; overlay.style.opacity = '0';

    try { await ac.resume(); } catch {}
    rec.start(250);

    const stopTimeout = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, (durationSec*1000) + 300);
    stopBtn.onclick = () => {
      clearTimeout(stopTimeout);
      if (rec.state !== 'inactive') rec.stop();
      stopAnimation();
      stopBtn.disabled = true;
      recordBtn.disabled = false;
      previewBtn.disabled = false;
    };
  }

  function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9\-_.\u0900-\u097F ]/g, '').replace(/\s+/g, '_');
  }

  // Wire UI
  previewBtn.addEventListener('click', () => {
    resizeCanvas();
    startAnimation();
  });
  recordBtn.addEventListener('click', () => {
    recordVideo();
  });

  window.addEventListener('resize', () => {
    // Keep CSS sizing, only internal pixel ratio matters; do nothing heavy here
  });

  // Initial
  resizeCanvas();
  overlay.textContent = '?????...';
})();
