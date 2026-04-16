/* ═══════════════════════════════════════════════════════════
   Spray Grain / Smoky Mist Background
   Blue-white gradient fog with grainy street-art texture
   Dreamy, misty, cool — like spray paint on a wall
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const canvas = document.getElementById('matrixCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    renderBackground();
  }

  function renderBackground() {
    ctx.clearRect(0, 0, W, H);

    // Base deep cobalt fill
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, W, H);

    // Large soft radial fog blobs — like spray paint clouds
    const blobs = [
      { x: W * 0.15, y: H * 0.2,  r: W * 0.45, color: [16, 40, 80],  alpha: 0.5 },
      { x: W * 0.75, y: H * 0.7,  r: W * 0.5,  color: [20, 50, 100], alpha: 0.4 },
      { x: W * 0.5,  y: H * 0.4,  r: W * 0.35, color: [30, 60, 120], alpha: 0.35 },
      { x: W * 0.85, y: H * 0.15, r: W * 0.3,  color: [40, 80, 150], alpha: 0.2 },
      { x: W * 0.25, y: H * 0.8,  r: W * 0.4,  color: [25, 55, 110], alpha: 0.3 },
      // White/light mist accents
      { x: W * 0.4,  y: H * 0.25, r: W * 0.25, color: [120, 160, 220], alpha: 0.06 },
      { x: W * 0.7,  y: H * 0.5,  r: W * 0.2,  color: [140, 180, 240], alpha: 0.05 },
      { x: W * 0.2,  y: H * 0.55, r: W * 0.22, color: [100, 150, 210], alpha: 0.05 },
    ];

    for (const b of blobs) {
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      grad.addColorStop(0, `rgba(${b.color.join(',')}, ${b.alpha})`);
      grad.addColorStop(0.5, `rgba(${b.color.join(',')}, ${b.alpha * 0.4})`);
      grad.addColorStop(1, `rgba(${b.color.join(',')}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Spray dithering particles — grainy texture
    addSprayGrain(18000);
  }

  function addSprayGrain(count) {
    const imageData = ctx.getImageData(0, 0, W, H);
    const data = imageData.data;

    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * W);
      const y = Math.floor(Math.random() * H);
      const idx = (y * W + x) * 4;

      // Randomly brighten or darken pixels — creates grain
      const shift = (Math.random() - 0.5) * 30;
      data[idx]     = Math.max(0, Math.min(255, data[idx] + shift));       // R
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + shift));   // G
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + shift * 1.2)); // B (more blue)
    }

    ctx.putImageData(imageData, 0, 0);

    // Overlay spray dots — scattered bright particles like aerosol splatter
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 1.5 + 0.3;
      const alpha = Math.random() * 0.08 + 0.02;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160, 200, 255, ${alpha})`;
      ctx.fill();
    }
  }

  // Slow-moving mist particles for life
  const particles = [];
  const PARTICLE_COUNT = 40;

  function initParticles() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 80 + 40,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1,
        alpha: Math.random() * 0.025 + 0.008,
        hue: Math.random() * 30 + 210, // 210-240 range (blue spectrum)
      });
    }
  }

  function animateParticles() {
    // Redraw static background
    renderBackground();

    // Draw floating mist orbs
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around
      if (p.x < -p.r) p.x = W + p.r;
      if (p.x > W + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = H + p.r;
      if (p.y > H + p.r) p.y = -p.r;

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      const lightness = 40 + Math.random() * 20;
      grad.addColorStop(0, `hsla(${p.hue}, 50%, ${lightness}%, ${p.alpha})`);
      grad.addColorStop(1, `hsla(${p.hue}, 50%, ${lightness}%, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }

    requestAnimationFrame(animateParticles);
  }

  resize();
  initParticles();
  animateParticles();

  window.addEventListener('resize', () => {
    resize();
  });
})();
