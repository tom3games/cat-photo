// SNS用サムネ og.png（1200x630）。node og.mjs
// 左: 撮影中の画面（三毛の変顔をファインダーに入れてシャッターを切った瞬間）、右: タイトルと一言
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(r => server.stdout.on('data', d => { const m = String(d).match(/:(\d+)/); if (m) r(m[1]) }))
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 760, height: 630 }, deviceScaleFactor: 1, locale: 'ja-JP' })
await p.addInitScript(() => { try { localStorage.setItem('nc.how', '1'); localStorage.setItem('nc.hint', '1') } catch (e) {} })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ncReady); await p.evaluate(() => document.fonts.ready)
await p.click('#bStart')
const pos = await p.evaluate(() => {
  nc.startGame(3); nc.dbg.pause(true); nc.dbg.step(150)
  nc.place(0, 1.25, 0.15, -0.6); nc.force(0, 'loaf'); nc.place(1, -3.1, 2.1); nc.force(1, 'loaf')
  nc.force(2, 'flehmen'); nc.stepUntil(() => { const m = nc.CATS[2].mom; return m && m.type === 'flehmen' && m.ph === 'peak' && m.k > 0.25 }, 3000)
  for (let i = 0; i < 4; i++) { nc.aimAt(2, 2); nc.S.yaw += 1.6; nc.S.pitch += 0.6; nc.applyCamera(); nc.dbg.step(1) }
  nc.S.left = 23.4; nc.S.films = 3; nc.shoot(); nc.dbg.render()
  document.querySelector('#lcdZoom').textContent = 'x2'; document.querySelector('#bZoom').classList.add('on'); document.querySelector('#count').hidden = true
  return nc.screenOf(2)
})
await p.addStyleTag({ content: '#flash{display:none!important}#snapTxt{animation:none!important;opacity:1!important;transform:translateX(-50%) rotate(-6deg)!important;top:12%!important}#corner,#hud{display:none!important}#thumb{opacity:1!important;animation:none!important}' })
await p.evaluate(([x, y]) => { const d = document.createElement('div'); d.className = 'ono bub'; d.textContent = 'くさっ'; d.style.cssText = `left:${x + 95}px;top:${y - 55}px;animation:none;font-size:22px;padding:6px 14px;transform:translate(-50%,-100%) rotate(6deg)`; document.querySelector('#fxl').appendChild(d) }, pos)
await p.waitForTimeout(300)
const shot = (await p.screenshot()).toString('base64')
// 合成
const q = await b.newPage({ viewport: { width: 1200, height: 630 } })
await q.setContent(`<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Mochiy+Pop+One&family=M+PLUS+Rounded+1c:wght@800;900&display=swap" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;background:#f3e2c4;position:relative;font-family:'M PLUS Rounded 1c',sans-serif}
img{position:absolute;left:-40px;top:0;width:760px;height:630px}
.fade{position:absolute;left:575px;top:0;width:146px;height:630px;background:linear-gradient(90deg,rgba(243,226,196,0),#f3e2c4)}
.r{position:absolute;left:690px;right:30px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:18px;text-align:center}
.mark{width:120px;height:96px}
.l1{font-family:'Mochiy Pop One';font-size:44px;color:#ff8a3d;letter-spacing:.2em;-webkit-text-stroke:8px #fff;paint-order:stroke fill;line-height:1}
.l2{font-family:'Mochiy Pop One';font-size:76px;color:#2b2320;-webkit-text-stroke:10px #fff;paint-order:stroke fill;line-height:1;margin-top:-6px}
.s{font-weight:900;font-size:27px;line-height:1.5;color:#2b2320;background:#fff7ea;border-radius:18px;padding:12px 20px;box-shadow:0 5px 0 rgba(120,80,40,.2)}
.s b{color:#d6334a}
</style></head><body><img src="data:image/png;base64,${shot}"><div class="fade"></div><div class="r">
<svg class="mark" viewBox="0 0 110 88"><path d="M24 30l7-22 15 16h18l15-16 7 22z" fill="#e8953f" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><path d="M33 22l-2-7 6 6zM77 22l2-7-6 6z" fill="#ffc0a8"/><rect x="8" y="26" width="94" height="58" rx="14" fill="#2b2320" stroke="#fff" stroke-width="4"/><rect x="18" y="20" width="18" height="10" rx="3" fill="#2b2320" stroke="#fff" stroke-width="3"/><circle cx="55" cy="55" r="22" fill="#fff7ea"/><circle cx="55" cy="55" r="15" fill="#3b3030"/><circle cx="55" cy="55" r="9" fill="#ff8a3d"/><circle cx="50" cy="50" r="3.5" fill="#fff"/><circle cx="88" cy="38" r="4" fill="#ff8a3d"/></svg>
<div><div class="l1">ねこ</div><div class="l2">カメラマン</div></div>
<div class="s">気まぐれな猫の<br>「一番かわいい瞬間」を撮れ。<br>フィルムは<b>5枚</b>だけ。</div></div></body></html>`)
await q.evaluate(() => document.fonts.ready); await q.waitForTimeout(600)
await q.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
console.log('ok')
