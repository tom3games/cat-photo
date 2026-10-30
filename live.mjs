// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import { chromium, webkit } from 'playwright'
const URL0 = 'https://tom3games.github.io/cat-photo/'
const ID = ['tmk', '4men'].join('') // 公開物に出てはいけない個人ID（文字列を分けて持つ）
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts }), p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errs.push('fail ' + r.url()) })
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__ncReady, null, { timeout: 15000 })
  // 遊びの通し: タイトル → 遊び方 → 撮影 → 5枚 → 結果
  await p.click('#bStart'); if (await p.isVisible('#vHow')) await p.click('#bHowGo')
  await p.evaluate(() => { nc.dbg.pause(true); nc.dbg.step(150) })
  for (let i = 0; i < 5; i++) { await p.evaluate(i => { nc.aimAt(i % 3, 1); nc.dbg.step(50) }, i); await p.click('#bShutter') }
  await p.evaluate(() => nc.dbg.step(80)); await p.waitForSelector('#vResult:not([hidden])', { timeout: 6000 }); await p.evaluate(() => nc.finishReveal()); await p.waitForTimeout(600)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const res = await p.evaluate(() => [nc.S.shots.length, nc.S.result.total, document.querySelector('#rStamp').textContent])
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: shots=${res[0]} total=${res[1]} stamp=${res[2]} og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(), p = await b.newPage()
for (const u of ['https://github.com/tom3games/cat-photo', 'https://github.com/tom3games/cat-photo/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} id=${new RegExp(ID, 'i').test(await p.content()) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
