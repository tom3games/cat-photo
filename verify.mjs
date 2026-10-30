// 全項目の自動検証。node verify.mjs（shots/ にスクショを出す）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
// 空いているポートを自動で取る（並行して他のゲームも検証するため）
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(r => server.stdout.on('data', d => { const m = String(d).match(/:(\d+)/); if (m) r(m[1]) }))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
// テストは必ず await する（しないと例外が素通りして全部 pass になる）
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
async function open(browser, opts = {}, init = '') {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, acceptDownloads: true, ...opts })
  await ctx.addInitScript(s => { try { localStorage.clear(); if (s) eval(s) } catch (e) {} }, init)
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__ncReady, null, { timeout: 15000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button,main:not([hidden]) canvas,main:not([hidden]) .ph,main:not([hidden]) #frame')) { if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
// 画像の輝度の散らばり（ほぼ単色＝何も写っていない）
const imgVar = (p, expr) => p.evaluate(expr => {
  const c = eval(expr), x = document.createElement('canvas'); x.width = c.width; x.height = c.height; const g = x.getContext('2d'); g.drawImage(c, 0, 0)
  const d = g.getImageData(0, 0, x.width, x.height).data; let s = 0, s2 = 0, n = 0
  for (let i = 0; i < d.length; i += 4 * 17) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, expr)
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [844, 390, 'land'], [667, 375, 'land-se'], [768, 1024, 'tab'], [1440, 900, 'pc']]
// 撮影画面へ（初回は遊び方を通る）。カウントダウンを飛ばして止めた状態にする
async function toPlay(p, seed = 5) {
  await p.click('#bStart'); if (await p.isVisible('#vHow')) await p.click('#bHowGo')
  await p.waitForSelector('#vPlay:not([hidden])')
  await p.evaluate(s => { nc.startGame(s); nc.dbg.pause(true); nc.dbg.step(150) }, seed)
}
// 台本: 猫 i に行動をさせ、ピークの k まで進めて狙い、構えを止めて安定させる
const scene = (p, o) => p.evaluate(o => {
  const { cats, ph = 'peak', k = 0.45, aim, zoom = 2, settle = 5, pan = 0 } = o
  nc.startGame(o.seed || 3); nc.dbg.pause(true); nc.dbg.step(150)
  const others = [0, 1, 2].filter(i => !cats.some(c => c[0] === i))
  others.forEach((i, n) => nc.place(i, n ? 2.9 : -3.1, 2.1))
  for (const [i, act, x, z, arg] of cats) { if (x != null) nc.place(i, x, z); nc.force(i, act, arg) }
  const main = aim ?? cats[0][0]
  const n = nc.stepUntil(() => { const m = nc.CATS[main].mom; return m && m.ph === ph && (ph === 'hold' || m.k >= k - settle / 60 / 0.5) }, 3000)
  for (let i = 0; i < settle; i++) { nc.aimAt(main, zoom); nc.dbg.step(1) }
  if (pan) { for (let i = 0; i < 4; i++) { nc.S.inDX += pan; nc.dbg.step(1) } }
  const m = nc.CATS[main].mom
  const r = nc.shoot()
  return { n, ph: m && m.ph, k: m && +m.k.toFixed(2), score: r && r.score, tags: r && r.tags, type: r && r.type, blur: r && +r.blur.toFixed(2), C: r && r.C, tm: r && r.tm, miracle: r && r.miracle, hd: r && r.hd }
}, o)

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
let p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('タイトルが日本語で出ている（ロケール ja-JP）', async () => { const s = await p.textContent('#tl2'); expect(s === 'カメラマン', s); return s })
await t('タイトルの3D（部屋と猫）が描けている（輝度の散らばり）', async () => { await p.waitForTimeout(300); const v = await p.evaluate(() => { nc.dbg.render(); const c = document.querySelector('#gl'), x = document.createElement('canvas'); x.width = 200; x.height = 200; const g = x.getContext('2d'); g.drawImage(c, 0, 0, 200, 200); const d = g.getImageData(0, 0, 200, 200).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 16) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return Math.round(s2 / n - (s / n) ** 2) }); expect(v > 200, v); return v })
await p.screenshot({ path: ROOT + '/shots/01-title.png' })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', r); return r
})
await t('OGP 一式がある（画像は ?v= 付き・URL は公開先）', async () => {
  const r = await p.evaluate(() => ({ img: document.querySelector('meta[property="og:image"]').content, url: document.querySelector('meta[property="og:url"]').content, all: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].every(k => !!document.querySelector(`meta[property="${k}"]`)) && !!document.querySelector('meta[name="twitter:card"]') }))
  expect(r.all && r.img === 'https://tom3games.github.io/cat-photo/og.png?v=1' && r.url === 'https://tom3games.github.io/cat-photo/', r); return r.img
})
await t('og.png が 1200x630 で置いてある', async () => { const r = await p.evaluate(async () => { const i = new Image(); i.src = '/og.png'; await i.decode(); return [i.naturalWidth, i.naturalHeight] }); expect(r[0] === 1200 && r[1] === 630, r); return r })
await t('英語に切り替わり、もう一度で日本語に戻る', async () => {
  await p.click('#bLang'); const en = [await p.textContent('#tl2'), await p.textContent('#tStart')]
  await p.click('#bLang'); const ja = await p.textContent('#tl2')
  expect(en[0] === 'PHOTOGRAPHER' && en[1] === 'Start Shooting' && ja === 'カメラマン', { en, ja }); return en
})
await t('初回の「撮影スタート」は遊び方を先に出す（PC の言い方）', async () => {
  await p.click('#bStart'); expect(await p.isVisible('#vHow'), 'how not shown'); const s = await p.textContent('#h1'); expect(s.includes('ドラッグ') && s.includes('矢印キー'), s)
  await p.screenshot({ path: ROOT + '/shots/02-how.png' }); return s
})
await t('はじめる → カウントダウン（3,2,1）→ 撮影開始。カウント中は撮れない', async () => {
  await p.click('#bHowGo'); await p.evaluate(() => nc.dbg.pause(true))
  const c0 = await p.textContent('#count'); const r0 = await p.evaluate(() => [nc.S.phase, !!nc.shoot()])
  await p.evaluate(() => nc.dbg.step(150)); const r1 = await p.evaluate(() => [nc.S.phase, nc.S.left, nc.S.films])
  expect(c0 === '3' && r0[0] === 'count' && r0[1] === false && r1[0] === 'play' && r1[2] === 5, { c0, r0, r1 }); return { c0, r1 }
})
await t('時間は固定60Hz: 止めると進まず、step(60) でちょうど1秒進む', async () => {
  const a = await p.evaluate(() => nc.S.left); await p.waitForTimeout(400); const b = await p.evaluate(() => nc.S.left)
  await p.evaluate(() => nc.dbg.step(60)); const c = await p.evaluate(() => nc.S.left)
  expect(a === b && Math.abs((b - c) - 1) < 1e-6, { a, b, c }); return { paused: a === b, stepped: +(b - c).toFixed(4) }
})
await t('ドラッグでファインダーが動く（右へドラッグ＝右を向く、上下も）', async () => {
  await p.evaluate(() => nc.setCam(0, -19, 1))
  const box = await p.evaluate(() => [nc.L.fx + nc.L.fs / 2, nc.L.fy + nc.L.fs / 2])
  await p.mouse.move(box[0], box[1]); await p.mouse.down(); await p.mouse.move(box[0] + 90, box[1] - 60, { steps: 6 }); await p.mouse.up()
  await p.evaluate(() => nc.dbg.step(2)); const r = await p.evaluate(() => [+nc.S.yaw.toFixed(1), +nc.S.pitch.toFixed(1)])
  expect(r[0] > 5 && r[1] > -19 + 3, r); return r
})
await t('矢印キーで構えが動き、Zで2倍ズーム（画角が狭くなる）', async () => {
  const y0 = await p.evaluate(() => nc.S.yaw)
  await p.keyboard.down('ArrowLeft'); await p.evaluate(() => nc.dbg.step(30)); await p.keyboard.up('ArrowLeft')
  const y1 = await p.evaluate(() => nc.S.yaw)
  await p.keyboard.press('z'); await p.evaluate(() => nc.dbg.step(40)); const f = await p.evaluate(() => [nc.S.zoom, +nc.S.fov.toFixed(1), document.querySelector('#bZoom').classList.contains('on')])
  await p.keyboard.press('z'); await p.evaluate(() => nc.dbg.step(40))
  expect(y1 < y0 - 5 && f[0] === 2 && f[1] < 21 && f[2], { y0, y1, f }); return { dyaw: +(y1 - y0).toFixed(1), fov2: f[1] }
})
await p.evaluate(() => { nc.dbg.step(30); nc.dbg.render() })
await p.screenshot({ path: ROOT + '/shots/03-play.png' })
await t('撮影画面: ファインダー・残り時間・フィルム・シャッターが画面内', async () => {
  const r = await p.evaluate(() => { const g = s => document.querySelector(s).getBoundingClientRect(); return { fr: g('#frame'), sh: g('#bShutter'), tm: g('#timer'), fi: g('#films'), H: innerHeight, W: innerWidth } })
  expect(r.fr.width > 300 && r.sh.bottom <= r.H && r.tm.top >= 0 && r.fi.right <= r.W && r.sh.top >= r.fr.bottom, r); return { frame: Math.round(r.fr.width), shutterBottom: Math.round(r.sh.bottom) }
})
await t('シャッター: フィルムが1枚減り、写真（実際の画面の切り抜き）ができる。連打は巻き上げ中で効かない', async () => {
  await p.evaluate(() => nc.aimAt(0, 1)); await p.evaluate(() => nc.dbg.step(6))
  await p.click('#bShutter'); await p.click('#bShutter')
  const r = await p.evaluate(() => [nc.S.films, nc.S.shots.length, nc.S.shots[0].img.width, document.querySelectorAll('#films i.used').length])
  const v = await imgVar(p, 'nc.S.shots[0].img')
  expect(r[0] === 4 && r[1] === 1 && r[2] === 540 && r[3] === 1 && v > 150, { r, v }); return { films: r[0], photoVar: v }
})
await p.waitForTimeout(250); await p.screenshot({ path: ROOT + '/shots/04-shot.png' })
await t('音: シャッター音と巻き上げ音が鳴り、エラーが出ない', async () => { await p.waitForTimeout(200); const r = await p.evaluate(() => ({ played: nc.Snd.played, lvl: nc.Snd.level(), state: nc.Snd.ctx && nc.Snd.ctx.state })); expect(r.played.shutter >= 1 && r.played.wind >= 1 && p.errs.length === 0, { r, e: p.errs }); return r.played })
await t('5枚撮るとフィルム切れ（空押しはカチッ）→ 少しして撮影終了 → 結果へ', async () => {
  for (let i = 0; i < 4; i++) { await p.evaluate(() => nc.dbg.step(50)); await p.keyboard.press('Space') }
  const r0 = await p.evaluate(() => [nc.S.films, nc.S.shots.length]); await p.evaluate(() => nc.dbg.step(50)); await p.keyboard.press('Space')
  const r1 = await p.evaluate(() => [nc.S.shots.length, nc.Snd.played.empty || 0])
  await p.evaluate(() => nc.dbg.step(70)); const ph = await p.evaluate(() => nc.S.phase)
  await p.waitForSelector('#vResult:not([hidden])', { timeout: 4000 })
  expect(r0[0] === 0 && r0[1] === 5 && r1[0] === 5 && r1[1] >= 1 && ph === 'done', { r0, r1, ph }); return { r0, r1 }
})
await t('結果: 判定（合計・ハンコ・一言）は発表まで見せない', async () => {
  await p.waitForTimeout(200)
  const r = await p.evaluate(() => ({ stamp: document.querySelector('#rStamp').classList.contains('on'), tot: document.querySelector('.tot').classList.contains('on'), ed: document.querySelector('#editor').classList.contains('on'), dev: !document.querySelector('#rDev').classList.contains('off'), btn: getComputedStyle(document.querySelector('#rBtns')).visibility }))
  await p.screenshot({ path: ROOT + '/shots/05-developing.png' })
  expect(!r.stamp && !r.tot && !r.ed && r.dev && r.btn === 'hidden', r); return r
})
await t('結果: 写真が1枚ずつ出て、最後に合計・ハンコ・編集長の一言・ボタン', async () => {
  await p.waitForTimeout(3000); const mid = await p.evaluate(() => document.querySelectorAll('#grid .ph.on').length)
  await p.waitForFunction(() => document.querySelector('#rStamp').classList.contains('on'), null, { timeout: 6000 }); await p.waitForTimeout(500)
  const r = await p.evaluate(() => ({ photos: document.querySelectorAll('#grid .ph canvas').length, total: +document.querySelector('#rTotal').textContent, sum: nc.S.shots.reduce((a, s) => a + s.score, 0), stamp: document.querySelector('#rStamp').textContent, ed: document.querySelector('#edTxt').textContent, btn: getComputedStyle(document.querySelector('#rBtns')).visibility }))
  await p.screenshot({ path: ROOT + '/shots/06-result.png' })
  expect(mid >= 1 && mid < 5 && r.photos === 5 && r.total === r.sum && r.stamp && r.ed.length > 5 && r.btn === 'visible', { mid, r }); return { mid, ...r }
})
await t('結果カード画像: 1080x1350、5枚の写真入り（輝度の散らばり）', async () => {
  const r = await p.evaluate(async () => { const c = await nc.makeCard(); window.__card = c; return [c.width, c.height] })
  const v = await imgVar(p, 'window.__card'); expect(r[0] === 1080 && r[1] === 1350 && v > 500, { r, v }); return { size: r, v }
})
await t('画像を保存: PC ではダウンロードになる（PNG）', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('#bSave')])
  const name = dl.suggestedFilename(); const path = await dl.path(); const { statSync } = await import('node:fs'); const size = statSync(path).size
  expect(name === 'cat-photo.png' && size > 100000, { name, size }); return { name, kb: Math.round(size / 1024) }
})
await t('もう一回: すぐ新しい撮影が始まる（フィルム5枚・写真0枚）', async () => {
  await p.click('#bAgain'); const r = await p.evaluate(() => [nc.S.view, nc.S.phase, nc.S.films, nc.S.shots.length, document.querySelectorAll('#films i.used').length])
  expect(r[0] === 'play' && r[1] === 'count' && r[2] === 5 && r[3] === 0 && r[4] === 0, r); return r
})

// ---------- 採点（台本で撮る）
await t('ピークのあくびを、止めて・顔を真ん中で撮ると高い点（40以上・タグなし）', async () => {
  const r = await scene(p, { cats: [[0, 'yawn', 0.4, 0.4, 0]], k: 0.5 }); expect(r.type === 'yawn' && r.score >= 40 && !r.tags.includes('blur') && !r.tags.includes('early'), r); return r
})
await t('同じ台本は同じ点（再現性）', async () => {
  const a = await scene(p, { cats: [[0, 'yawn', 0.4, 0.4, 0]], k: 0.5 }), b = await scene(p, { cats: [[0, 'yawn', 0.4, 0.4, 0]], k: 0.5 }); expect(a.score === b.score && a.score > 0, { a, b }); return a.score
})
await t('前ぶれ（耳ぴく中）に撮ると「早すぎ」で低い', async () => {
  const r = await scene(p, { cats: [[0, 'yawn', 0.4, 0.4, 0]], ph: 'omen', k: 0.5 }); expect(r.tags.includes('early') && r.score < 20, r); return r
})
await t('構えを振りながら撮ると「ブレ」で低い', async () => {
  const good = await scene(p, { cats: [[0, 'yawn', 0.4, 0.4, 0]], k: 0.5 })
  const r = await scene(p, { cats: [[0, 'yawn', 0.4, 0.4, 0]], k: 0.4, pan: 1.2, settle: 3 }); expect(r.tags.includes('blur') && r.score < good.score * 0.5, { r, good: good.score }); return { blur: r.blur, score: r.score, steady: good.score }
})
await t('ブレた写真は実際にぼやけて写る（同じ構図の止めた写真より細部が少ない）', async () => {
  const sharp = async () => { const r = await p.evaluate(() => { const c = nc.S.shots[nc.S.shots.length - 1].img, x = c.getContext('2d'), d = x.getImageData(100, 100, 340, 340).data; let e = 0; for (let y = 1; y < 339; y += 2) for (let xx = 1; xx < 339; xx++) { const i = (y * 340 + xx) * 4; e += Math.abs(d[i] - d[i + 4]) + Math.abs(d[i] - d[i + 340 * 4]) } return e }); return r }
  await scene(p, { cats: [[0, 'yawn', 0.4, 0.4, 0]], k: 0.5 }); const a = await sharp()
  await scene(p, { cats: [[0, 'yawn', 0.4, 0.4, 0]], k: 0.4, pan: 1.2, settle: 3 }); const b = await sharp()
  expect(b < a * 0.8, { a, b }); return { sharp: a, blurred: b }
})
await t('猫のいない所（天井）を撮ると0点・「猫いない」', async () => {
  const r = await p.evaluate(() => { nc.startGame(3); nc.dbg.pause(true); nc.dbg.step(150); nc.setCam(0, 8, 2); nc.dbg.step(5); const s = nc.shoot(); return { score: s.score, tags: s.tags } })
  expect(r.score === 0 && r.tags.includes('none'), r); return r
})
await t('変顔のピークをきれいに撮ると「奇跡の1枚」（点が伸びる）', async () => {
  const r = await scene(p, { cats: [[2, 'flehmen']], k: 0.4, settle: 4 }); expect(r.type === 'flehmen' && r.miracle && r.score >= 70, r); return r
})
await t('2匹が同時にあくび（あくびはうつる）を1枚に収めると「ダブルあくび」の奇跡', async () => {
  const r = await scene(p, { cats: [[0, 'yawn', 0.15, 0.6, 0.9], [2, 'yawn', 0.65, 0.6, 0.9]], k: 0.45, zoom: 1, settle: 4 })
  expect(r.miracle && r.tags.includes('double'), r); return { score: r.score, tags: r.tags }
})
await t('あくびはうつる: 1匹があくびすると、座っている他の猫もつられることがある', async () => {
  const r = await p.evaluate(() => { let hit = 0; for (let s = 1; s <= 20; s++) { nc.startGame(100 + s); nc.dbg.pause(true); nc.dbg.step(150); [1, 2].forEach(i => { nc.place(i, -0.5 + i * 0.5, 0.5); nc.force(i, 'loaf') }); nc.dbg.step(80); nc.force(0, 'yawn'); let got = false; for (let k = 0; k < 200; k++) { nc.dbg.step(1); if ([1, 2].some(i => nc.CATS[i].act === 'yawn')) got = true } if (got) hit++ } return hit })
  expect(r >= 5 && r <= 19, r); return { contagious: r + '/20' }
})
await t('時間切れでフィルムが残ると「撮り忘れ」の黒い枠、0枚なら「シャッター押し忘れ」', async () => {
  await p.evaluate(() => { nc.startGame(4); nc.dbg.pause(true); nc.dbg.step(150 + 60 * 61) })
  await p.waitForSelector('#vResult:not([hidden])', { timeout: 4000 }); await p.evaluate(() => nc.finishReveal())
  const r = await p.evaluate(() => ({ blanks: document.querySelectorAll('#grid .blank').length, stamp: document.querySelector('#rStamp').textContent, tier: nc.S.result.special }))
  await p.screenshot({ path: ROOT + '/shots/07-forgot.png' })
  expect(r.blanks === 5 && r.tier === 'forgot' && r.stamp === 'シャッター押し忘れ', r); return r
})
await t('特別な称号: 毎回振りながら撮ると「全部ブレてる」、全部おしりなら「おしり写真家」', async () => {
  const r = await p.evaluate(() => {
    const run = mode => { nc.startGame(21); nc.dbg.pause(true); nc.dbg.step(150)
      for (let i = 0; i < 5; i++) { const c = i % 3; nc.dbg.step(50); if (mode === 'butt') { nc.place(c, -0.6 + c * 0.6, 0.4, Math.PI); nc.force(c, 'loaf'); nc.dbg.step(3) } nc.aimAt(c, 2); nc.dbg.step(4); nc.aimAt(c, 2); if (mode === 'blur') for (let k = 0; k < 4; k++) { nc.S.inDX += 1.5; nc.dbg.step(1) } nc.shoot() }
      nc.dbg.step(80); return nc.S.result.special }
    return [run('blur'), run('butt')] })
  expect(r[0] === 'blurry' && r[1] === 'butt', r); return r
})
await t('撮影中に画面を何度押しても、フィルムは5枚より多く使えない', async () => {
  const r = await p.evaluate(() => { nc.startGame(8); nc.dbg.pause(true); nc.dbg.step(150); let n = 0; for (let i = 0; i < 40; i++) { if (nc.shoot()) n++; nc.dbg.step(20) } return [n, nc.S.films] })
  expect(r[0] === 5 && r[1] === 0, r); return r
})

// ---------- 難しさ（台本のボット 40ゲームずつ）
let dist
await t('ボットで結果の分布を測る（上手い／ふつう／雑／何もしない）', async () => {
  dist = await p.evaluate(() => { const out = {}; for (const kind of ['good', 'normal', 'sloppy', 'none']) { const rs = []; for (let s = 1; s <= 40; s++) rs.push(nc.runBot(kind, s)); const tiers = {}; rs.forEach(r => tiers[r.tier] = (tiers[r.tier] || 0) + 1); const tot = rs.map(r => r.total).sort((a, b) => a - b); out[kind] = { avg: Math.round(tot.reduce((a, b) => a + b, 0) / 40), med: tot[20], min: tot[0], max: tot[39], tiers, miracles: rs.reduce((a, r) => a + r.miracles, 0) } } return out })
  const g = dist.good, n = dist.normal, s = dist.sloppy
  expect(g.avg > n.avg && n.avg > s.avg, 'order'); expect((g.tiers.legend || 0) >= 3 && (g.tiers.legend || 0) <= 16, 'legend should be occasional for good: ' + g.tiers.legend)
  expect((n.tiers.good || 0) + (n.tiers.meh || 0) >= 30 && !(n.tiers.legend), 'normal should be middle'); expect((s.tiers.bad || 0) >= 20, 'sloppy low'); expect(dist.none.tiers.forgot === 40, 'none')
  return dist
})
await t('ボットの結果は種が同じなら同じ（再現性）', async () => { const r = await p.evaluate(() => [nc.runBot('normal', 4).scores.join(), nc.runBot('good', 9).total, nc.runBot('normal', 4).scores.join()]); expect(r[0] === r[2], r); return r })
await p.close()

// ---------- 英語の結果画面
p = await open(browser, {}, "localStorage.setItem('nc.lang','en');localStorage.setItem('nc.how','1')")
await t('英語: 遊び方・撮影・結果まで英語で出る', async () => {
  await p.click('#bHow'); const h = await p.textContent('#h1'); await p.click('#bHowBack')
  await p.evaluate(() => nc.runBot('good', 3, true)); await p.waitForSelector('#vResult:not([hidden])', { timeout: 5000 }); await p.evaluate(() => nc.finishReveal()); await p.waitForTimeout(600)
  const r = { how: h, head: await p.textContent('#rT'), stamp: await p.textContent('#rStamp'), btn: await p.textContent('#tAgain'), cap: await p.textContent('#grid .ph .cap span') }
  await p.screenshot({ path: ROOT + '/shots/08-result-en.png' })
  expect(/Drag/.test(r.how) && r.head === 'Your Prints' && /[A-Za-z]/.test(r.stamp) && r.btn === 'Again' && !/[ぁ-ん]/.test(r.cap), r); return r
})
await t('英語: はみ出しなし', async () => { const o = await overflow(p); expect(o.sw <= o.W && !o.bad.length, o) })
await p.close()

// ---------- 性能（GPU あり・撮影中の fps）
p = await open(browser, {}, "localStorage.setItem('nc.how','1')")
await t('撮影中の fps（PC・GPU）', async () => { await p.click('#bStart'); await p.waitForTimeout(3500); const f = await p.evaluate(() => Math.round(nc.fps())); expect(f >= 40, f); return f })
const p2 = await open(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, "localStorage.setItem('nc.how','1')")
await t('撮影中の fps（スマホ相当 390x844 @3x）', async () => { await p2.tap('#bStart'); await p2.waitForTimeout(3500); const f = await p2.evaluate(() => Math.round(nc.fps())); expect(f >= 40, f); return f })
await p2.close(); await p.close()

// ---------- 6サイズ × 全画面で一画面に収まる
for (const [w, h, name] of SIZES) {
  const q = await open(browser, { viewport: { width: w, height: h } })
  const views = {}
  await q.waitForTimeout(250); views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  const ov = {}; ov.title = await overflow(q)
  await q.click('#bHow'); views.how = await fit(q); ov.how = await overflow(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` })
  await q.click('#bHowGo'); await q.evaluate(() => { nc.dbg.pause(true); nc.dbg.step(200); nc.dbg.render() })
  views.play = await fit(q); ov.play = await overflow(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await q.evaluate(() => nc.runBot('good', 3, true)); await q.waitForSelector('#vResult:not([hidden])', { timeout: 5000 }); await q.evaluate(() => nc.finishReveal()); await q.waitForTimeout(500)
  views.result = await fit(q); ov.result = await overflow(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  await t(`${name}: 結果画面で撮影中のトースト・吹き出しが見えていない`, async () => { const r = await q.evaluate(() => [...document.querySelectorAll('.toast.play,.ono,#count:not([hidden]),#hint:not([hidden])')].filter(e => e.checkVisibility()).map(e => e.className + ':' + e.textContent)); expect(!r.length, r); return 'none' })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, r) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const bad = Object.entries(ov).filter(([, o]) => o.sw > o.W || o.bad.length); expect(!bad.length && !q.errs.length, JSON.stringify(bad) + q.errs.join('|')) })
  if (name === 'land-se' || name === 'small') await t(`${name}: 結果の写真が小さすぎない（1枚 80px 以上）`, async () => { const s = await q.evaluate(() => document.querySelector('#grid .ph').getBoundingClientRect().width); expect(s >= 80, s); return Math.round(s) })
  await q.close()
}
await browser.close()

// ---------- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: 遊び方はスマホの言い方（なぞる・タップ）', async () => { await wp.tap('#bStart'); const s = await wp.textContent('#h1') + ' / ' + await wp.textContent('#h2'); expect(s.includes('なぞって') && s.includes('タップ'), s); return s })
await t('WebKit: タップで撮影 → 5枚撮って結果まで通る（写真が写っている）', async () => {
  await wp.tap('#bHowGo'); await wp.evaluate(() => { nc.dbg.pause(true); nc.dbg.step(150) })
  for (let i = 0; i < 5; i++) { await wp.evaluate(i => { nc.aimAt(i % 3, 1); nc.dbg.step(50) }, i); await wp.tap('#bShutter') }
  await wp.evaluate(() => nc.dbg.step(80)); await wp.waitForSelector('#vResult:not([hidden])', { timeout: 5000 }); await wp.evaluate(() => nc.finishReveal()); await wp.waitForTimeout(400)
  const v = await imgVar(wp, 'nc.S.shots[0].img'); const n = await wp.evaluate(() => nc.S.shots.length)
  await wp.screenshot({ path: ROOT + '/shots/30-webkit-result.png' })
  expect(n === 5 && v > 150, { n, v }); return { shots: n, photoVar: v, stamp: await wp.textContent('#rStamp') }
})
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
if (dist) writeFileSync(ROOT + '/shots/dist.json', JSON.stringify(dist, null, 1))
process.exit(fail ? 1 : 0)
