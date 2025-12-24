(function () {
  function isWinterMonth() {
    const m = new Date().getMonth() + 1; // 1-12
    return (m === 12 || m === 1 || m === 2);
  }

  window.addEventListener("DOMContentLoaded", function () {
    const hero = document.getElementById("hero");
    const canvas = document.getElementById("snowCanvas");
    if (!hero || !canvas) return;

    // 冬以外は雪を消す
    if (!isWinterMonth()) {
      canvas.style.display = "none";
      return;
    }

    const ctx = canvas.getContext("2d");
    let w = 0, h = 0;
    let flakes = [];
    let rafId = null;

    function resize() {
      const r = hero.getBoundingClientRect();
      w = Math.max(1, Math.floor(r.width));
      h = Math.max(1, Math.floor(r.height));

      // 高DPI対策（くっきり）
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function rand(min, max) { return Math.random() * (max - min) + min; }

    // 大小混在（小多め・中そこそこ・大少し）
    function pickSize() {
      const r = Math.random();
      if (r < 0.70) return rand(1.0, 2.0);   // 小
      if (r < 0.93) return rand(2.0, 3.2);   // 中
      return rand(3.2, 4.6);                 // 大（少しだけ）
    }

    function newFlake(spawnTop = true) {
      const size = pickSize();
      return {
        x: rand(0, w),
        y: spawnTop ? rand(-h, 0) : rand(0, h),
        r: size,

        // 落下速度：小は遅め、大は少し速め（自然）
        vy: (size < 2.1 ? rand(10, 22) : size < 3.3 ? rand(18, 32) : rand(26, 44)) / 60,

        // 横流れ（上品に）
        vx: rand(-8, 8) / 60,

        // ふわっと揺れる（“びくっ”は禁止：sinのみ）
        phase: rand(0, Math.PI * 2),
        sway: rand(0.4, 1.4),

        // 回転は最小限（不快感防止）
        rot: rand(0, Math.PI * 2),
        vrot: rand(-0.01, 0.01),

        alpha: rand(0.35, 0.85)
      };
    }

    function init() {
      resize();
      flakes = [];

      // 密度：hero幅に応じて自動（多すぎない）
      const count = Math.min(120, Math.max(55, Math.floor(w / 12)));
      for (let i = 0; i < count; i++) flakes.push(newFlake(true));
    }

    // “雪の結晶っぽい” 軽量描画：＋ と × ＋ 先端ちょい
    function drawFlake(f) {
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);

      ctx.lineWidth = Math.max(1, f.r / 2.3);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineCap = "round";

      const r = f.r;

      ctx.beginPath();
      // + と ×
      ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
      ctx.moveTo(0, -r); ctx.lineTo(0, r);
      ctx.moveTo(-r*0.75, -r*0.75); ctx.lineTo(r*0.75, r*0.75);
      ctx.moveTo(-r*0.75, r*0.75); ctx.lineTo(r*0.75, -r*0.75);

      // 先端の“トゲ”を少し（大きい粒だけ）
      if (r > 2.2) {
        ctx.moveTo(0, -r); ctx.lineTo(-r*0.25, -r*0.75);
        ctx.moveTo(0, -r); ctx.lineTo(r*0.25, -r*0.75);
        ctx.moveTo(0, r); ctx.lineTo(-r*0.25, r*0.75);
        ctx.moveTo(0, r); ctx.lineTo(r*0.25, r*0.75);
      }

      ctx.stroke();
      ctx.restore();
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);

      for (const f of flakes) {
        f.phase += 0.012;
        f.x += f.vx + Math.sin(f.phase) * (f.sway / 60);
        f.y += f.vy;
        f.rot += f.vrot;

        // 下に落ちたら上から復活
        if (f.y > h + 12) {
          f.y = rand(-30, -6);
          f.x = rand(0, w);
          // サイズや速度も少し変えて“完全ランダム感”
          const nf = newFlake(true);
          f.r = nf.r; f.vy = nf.vy; f.vx = nf.vx; f.sway = nf.sway; f.alpha = nf.alpha;
        }
        if (f.x < -12) f.x = w + 12;
        if (f.x > w + 12) f.x = -12;

        drawFlake(f);
      }

      rafId = requestAnimationFrame(tick);
    }

    init();
    tick();

    // heroサイズが変わったら再生成
    const ro = new ResizeObserver(() => init());
    ro.observe(hero);

    window.addEventListener("beforeunload", () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    });
  });
})();