// ねこカメラマン / CAT PHOTOGRAPHER
// 気まぐれな猫の一番かわいい瞬間を、フィルム5枚で撮る。3D は three.js、時間は固定60Hz（performance.now で数える）
import * as THREE from './vendor/three.module.js'

const D = window.NC_DATA
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)]
const DT = 1 / 60, DEG = Math.PI / 180
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const lerp = (a, b, k) => a + (b - a) * k
const smooth = k => k * k * (3 - 2 * k)
const store = { get(k, d) { try { const v = localStorage.getItem('nc.' + k); return v == null ? d : v } catch (e) { return d } }, set(k, v) { try { localStorage.setItem('nc.' + k, v) } catch (e) {} } }
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const isTouch = matchMedia('(pointer:coarse)').matches
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d }

// ---------- 定数
const PLAY_T = 60, FILMS = 5, COOL = 0.75, CAT_SCALE = 1.3
const CAM_POS = new THREE.Vector3(0, 1.25, 3.2)
const FOV1 = 42, FOV2 = 20
const YAW_LIM = 40, PITCH_MIN = -40, PITCH_MAX = 8

// ---------- 状態
const S = {
  lang: store.get('lang', (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en'),
  muted: store.get('mute', '0') === '1',
  view: 'title', phase: 'none', t: 0, left: PLAY_T, cd: 0, seed: 1, rng: Math.random, sim: false,
  yaw: 0, pitch: -14, zoom: 1, fov: FOV1, camSpeed: 0, cool: 0, films: FILMS, shots: [], endT: 0,
  keys: {}, inDX: 0, inDY: 0, paused: false, result: null, titleT: 0,
}
const T = k => D.TXT[S.lang][k] ?? D.TXT.ja[k] ?? k

// ---------- 描画の土台
const canvas = $('#gl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.75 : 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
const scene = new THREE.Scene()
scene.background = new THREE.Color('#e9d6b4')
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60)
camera.rotation.order = 'YXZ'; camera.position.copy(CAM_POS)
scene.add(new THREE.HemisphereLight(0xfff3e0, 0x8a6a4a, 1.25))
const sunL = new THREE.DirectionalLight(0xffe2b0, 1.6); sunL.position.set(1.5, 5, -7); scene.add(sunL)
const fillL = new THREE.DirectionalLight(0xdfe8ff, 0.45); fillL.position.set(-2, 3, 6); scene.add(fillL)
const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o })
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]) }
  return t
}
function box(w, h, d, mat, x, y, z, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m }

// ---------- 部屋
const ROOM = { x0: -4, x1: 4, zb: -2.2, zf: 3.6, h: 2.6 }
const SILL = { x: 0.2, w: 1.7, y: 0.88, zf: -1.95 }
const BOX = { x: 2.4, z: -1.25, w: 0.58, h: 0.36, d: 0.5 }
const SOFA = { x: -2.7, w: 1.9, seat: 0.44 }
const STOOL = { x: -1.5, z: 1.3 }
const SOCK = { x: 0.62, z: 0.98 }
;(() => {
  const r = mulberry(7)
  // 床（板張り）
  const floorTex = canvasTex(512, 512, (x, w, h) => {
    const cols = ['#c9925e', '#bf8752', '#d29c66', '#c38b58']
    for (let row = 0; row < 8; row++) { let px = -r() * 200; while (px < w) { const len = 160 + r() * 220; x.fillStyle = cols[Math.floor(r() * 4)]; x.fillRect(px, row * 64, len, 64); x.fillStyle = 'rgba(80,40,10,.25)'; x.fillRect(px, row * 64, 2, 64); px += len } x.fillStyle = 'rgba(80,40,10,.3)'; x.fillRect(0, row * 64 + 62, w, 2) }
    for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(90,50,20,.08)'; x.fillRect(r() * w, r() * h, 30 + r() * 60, 1.5) }
  }, [2.5, 2.5])
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshLambertMaterial({ map: floorTex })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.7); scene.add(floor)
  // 壁（腰壁つき）
  const wallTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#f6ead6'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(200,170,130,.18)'; for (let i = 0; i < w; i += 16) x.fillRect(i, 0, 1, h) }, [6, 1])
  const wallM = new THREE.MeshLambertMaterial({ map: wallTex }), wainM = lam(0x9fc4b8), trimM = lam(0xffffff)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(8, ROOM.h), wallM); back.position.set(0, ROOM.h / 2, ROOM.zb); scene.add(back)
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(6, ROOM.h), wallM); w.rotation.y = -s * Math.PI / 2; w.position.set(s * 4, ROOM.h / 2, 0.8); scene.add(w); box(0.04, 0.7, 6, wainM, s * 3.98, 0.35, 0.8); box(0.06, 0.05, 6, trimM, s * 3.97, 0.72, 0.8) }
  box(8, 0.7, 0.04, wainM, 0, 0.35, ROOM.zb + 0.02); box(8, 0.05, 0.06, trimM, 0, 0.72, ROOM.zb + 0.03)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshBasicMaterial({ color: 0xeadcc4 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ROOM.h, 0.8); scene.add(ceil)
  // 窓（空と雲）と窓台
  const skyTex = canvasTex(256, 192, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fc9f2'); g.addColorStop(1, '#e6f4ff'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.9)'; for (const [cx, cy, s] of [[60, 60, 1], [180, 40, .8], [150, 120, .7]]) { for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + (k - 2) * 16 * s, cy + (k % 2) * 6, 16 * s, 0, 7); x.fill() } } x.fillStyle = '#9cc98a'; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 8; i++) x.lineTo(i * w / 8, h - 18 - (i % 3) * 8); x.lineTo(w, h); x.fill() })
  const win = new THREE.Mesh(new THREE.PlaneGeometry(SILL.w - 0.1, 1.25), new THREE.MeshBasicMaterial({ map: skyTex })); win.position.set(SILL.x, 1.55, ROOM.zb + 0.01); scene.add(win)
  const frameM = lam(0xffffff)
  box(SILL.w, 0.06, 0.06, frameM, SILL.x, 2.18, ROOM.zb + 0.03); box(0.06, 1.3, 0.06, frameM, SILL.x - SILL.w / 2 + 0.03, 1.55, ROOM.zb + 0.03); box(0.06, 1.3, 0.06, frameM, SILL.x + SILL.w / 2 - 0.03, 1.55, ROOM.zb + 0.03); box(0.04, 1.25, 0.04, frameM, SILL.x, 1.55, ROOM.zb + 0.03)
  box(SILL.w + 0.2, 0.06, ROOM.zb * -1 + SILL.zf + 0.01, lam(0xf2e4cc), SILL.x, SILL.y - 0.03, (ROOM.zb + SILL.zf) / 2)
  const curM = lam(0xe58f6b); for (const s of [-1, 1]) { const c = box(0.34, 1.6, 0.06, curM, SILL.x + s * (SILL.w / 2 + 0.2), 1.45, ROOM.zb + 0.08); c.rotation.y = s * 0.08 }
  box(SILL.w + 1.2, 0.04, 0.04, lam(0x8a5a3a), SILL.x, 2.28, ROOM.zb + 0.1)
  // 日だまり（床・ソファの光と、窓からの光の帯）
  const sunM = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending })
  const quad = (pts, y, m) => { const g = new THREE.BufferGeometry(); const v = []; for (const i of [0, 1, 2, 0, 2, 3]) v.push(pts[i][0], y, pts[i][1]); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); const mesh = new THREE.Mesh(g, m); mesh.material.side = THREE.DoubleSide; scene.add(mesh); return mesh }
  quad([[-1.05, -2.15], [1.35, -2.15], [0.5, -0.45], [-1.9, -0.45]], 0.006, sunM)
  quad([[-2.15, -2.0], [-1.78, -2.0], [-1.78, -1.42], [-2.5, -1.42]], SOFA.seat + 0.072, sunM)
  const shaftM = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  for (let i = 0; i < 3; i++) { const g = new THREE.BufferGeometry(); const a = [SILL.x - 0.75 + i * 0.75, 2.1, ROOM.zb + 0.02], b = [SILL.x - 0.75 + i * 0.75 + 0.6, 2.1, ROOM.zb + 0.02], c = [-0.6 + i * 0.8, 0.01, -0.5], d = [-1.2 + i * 0.8, 0.01, -0.5]; g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); scene.add(new THREE.Mesh(g, shaftM)) }
  // ソファ
  const sofaM = lam(0x3f8d8a), sofaD = lam(0x2f6f6c), cushM = lam(0xf2b84b)
  const sz = -1.8
  box(SOFA.w, 0.28, 0.8, sofaD, SOFA.x, 0.2, sz); box(SOFA.w - 0.3, 0.16, 0.66, sofaM, SOFA.x, SOFA.seat - 0.02, sz + 0.05)
  box(SOFA.w, 0.62, 0.22, sofaM, SOFA.x, 0.62, ROOM.zb + 0.13); for (const s of [-1, 1]) box(0.17, 0.62, 0.8, sofaM, SOFA.x + s * (SOFA.w / 2 - 0.08), 0.33, sz)
  const cu = box(0.36, 0.34, 0.12, cushM, SOFA.x - 0.55, 0.66, ROOM.zb + 0.3); cu.rotation.set(-0.2, 0.15, 0.1)
  for (const s of [-1, 1]) for (const z of [-0.33, 0.33]) box(0.06, 0.08, 0.06, lam(0x5a3a22), SOFA.x + s * 0.85, 0.04, sz + z)
  // ラグ
  const rugTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#e07a5f'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f4d6a6'; x.lineWidth = 8; for (const rr of [118, 92, 66]) { x.beginPath(); x.arc(128, 128, rr, 0, 7); x.stroke() } x.fillStyle = '#f4d6a6'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.beginPath(); x.arc(128 + Math.cos(a) * 80, 128 + Math.sin(a) * 80, 5, 0, 7); x.fill() } })
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshLambertMaterial({ map: rugTex })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.2, 0.004, 0.5); rug.scale.set(1.25, 0.9, 1); scene.add(rug)
  // 段ボール箱（上が開いている）
  const cbTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#c9a06a'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(120,80,30,.12)'; for (let i = 0; i < h; i += 6) x.fillRect(0, i, w, 2); x.fillStyle = '#e8d6a8'; x.fillRect(0, 10, w, 18); x.fillStyle = '#7a5a30'; x.font = 'bold 20px sans-serif'; x.fillText('FRAGILE', 18, 88) })
  const cbM = new THREE.MeshLambertMaterial({ map: cbTex, side: THREE.DoubleSide }), cbIn = lam(0x9c7442, { side: THREE.DoubleSide })
  const boxG = new THREE.Group(); boxG.position.set(BOX.x, 0, BOX.z); scene.add(boxG)
  const wall = (w, h, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cbM); m.position.set(x, h / 2, z); m.rotation.y = ry; boxG.add(m); return m }
  wall(BOX.w, BOX.h, 0, BOX.d / 2, 0); wall(BOX.w, BOX.h, 0, -BOX.d / 2, Math.PI); wall(BOX.d, BOX.h, BOX.w / 2, 0, Math.PI / 2); wall(BOX.d, BOX.h, -BOX.w / 2, 0, -Math.PI / 2)
  const bot = new THREE.Mesh(new THREE.PlaneGeometry(BOX.w, BOX.d), cbIn); bot.rotation.x = -Math.PI / 2; bot.position.y = 0.01; boxG.add(bot)
  for (const [w, x, z, ry, rx] of [[BOX.w, 0, BOX.d / 2, 0, 1], [BOX.w, 0, -BOX.d / 2, Math.PI, 1], [BOX.d, BOX.w / 2, 0, Math.PI / 2, 1]]) {
    const piv = new THREE.Group(); piv.position.set(x, BOX.h, z); piv.rotation.y = ry; boxG.add(piv)
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, BOX.d * 0.45), cbM); f.position.set(0, 0, BOX.d * 0.225); f.rotation.x = Math.PI / 2; const fp = new THREE.Group(); fp.rotation.x = -0.5 * rx; fp.add(f); piv.add(fp)
  }
  BOX.g = boxG
  // くつした（変顔のもと）
  const sockTex = canvasTex(64, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f6f1e8' : '#d6455a'; x.fillRect(0, i * 8, w, 8) } })
  const sockM = new THREE.MeshLambertMaterial({ map: sockTex })
  const sockG = new THREE.Group(); sockG.position.set(SOCK.x, 0.03, SOCK.z); sockG.rotation.y = 0.6; scene.add(sockG)
  const s1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 4, 8), sockM); s1.rotation.z = Math.PI / 2; s1.position.x = -0.05; sockG.add(s1)
  const s2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.07, 4, 8), sockM); s2.position.set(0.09, 0, 0.04); s2.rotation.x = Math.PI / 2; sockG.add(s2)
  const stink = new THREE.Group(); sockG.add(stink); const stM = new THREE.MeshBasicMaterial({ color: 0x9fbf6a, transparent: true, opacity: 0.55 })
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 10, Math.PI * 1.3), stM); m.position.set(-0.04 + i * 0.05, 0.1 + i * 0.05, 0); stink.add(m) }
  SOCK.stink = stink
  // スツールと猫じゃらし
  const woodM = lam(0xb07a48)
  box(0.34, 0.04, 0.34, woodM, STOOL.x, 0.36, STOOL.z); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.03, 0.34, 0.03, woodM, STOOL.x + dx * 0.13, 0.17, STOOL.z + dz * 0.13)
  const toyG = new THREE.Group(); toyG.position.set(STOOL.x + 0.02, 0.385, STOOL.z - 0.02); scene.add(toyG)
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 5), lam(0x6b4a2a)); stick.geometry.translate(0, 0.3, 0); stick.rotation.set(-1.05, 0, 0.25); toyG.add(stick)
  const tip = new THREE.Group(); tip.position.set(-0.13, 0.27, -0.48); toyG.add(tip)
  // 柄の先から垂れる糸と、ふさふさ
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 3), lam(0xf4f0e0)); line.geometry.translate(0, -0.08, 0); tip.add(line)
  const fluff = new THREE.Group(); fluff.position.y = -0.17; tip.add(fluff)
  const fm = lam(0xf2d74a), fm2 = lam(0xe86a8a)
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 4), i % 3 ? fm : fm2); m.position.y = -0.03; m.rotation.set(Math.sin(i * 2.3) * 0.9, i * 0.7, Math.cos(i * 1.7) * 0.9); fluff.add(m) }
  STOOL.tip = tip; STOOL.fluff = fluff
  // 本棚・観葉植物・額・お皿
  const shelfM = lam(0xa8774f)
  const sh = new THREE.Group(); sh.position.set(3.78, 0, 0.9); scene.add(sh)
  box(0.4, 1.3, 1.5, shelfM, 0, 0.65, 0, sh)
  const bookC = [0xd6455a, 0x3f8d8a, 0xf2b84b, 0x5a6fb0, 0xf6ead6, 0x7a5a3a]
  for (let sh2 = 0; sh2 < 3; sh2++) { box(0.36, 0.03, 1.42, lam(0xf3e2c4), -0.03, 0.2 + sh2 * 0.4, 0, sh); let z = -0.66; while (z < 0.62) { const w = 0.05 + r() * 0.06, h = 0.22 + r() * 0.1; box(0.28, h, w, lam(bookC[Math.floor(r() * 6)]), -0.05, 0.22 + sh2 * 0.4 + h / 2, z + w / 2, sh); z += w + 0.01 } }
  const potM = lam(0xd88c5a), leafM = lam(0x4f9a52), leafM2 = lam(0x3d7f45)
  box(0.36, 0.38, 0.36, potM, 3.4, 0.19, -1.85)
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.7, 4), i % 2 ? leafM : leafM2); l.position.set(3.4 + Math.sin(i * 2.4) * 0.14, 0.7, -1.85 + Math.cos(i * 2.4) * 0.14); l.rotation.set(Math.cos(i * 2.4) * 0.5, 0, -Math.sin(i * 2.4) * 0.5); scene.add(l) }
  const pic = box(0.7, 0.5, 0.03, lam(0x8a5a3a), -1.9, 1.75, ROOM.zb + 0.02)
  const picTex = canvasTex(128, 96, (x, w, h) => { x.fillStyle = '#fbe9cf'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8953f'; x.beginPath(); x.arc(64, 60, 26, 0, 7); x.fill(); x.beginPath(); x.moveTo(42, 46); x.lineTo(46, 22); x.lineTo(58, 38); x.fill(); x.beginPath(); x.moveTo(86, 46); x.lineTo(82, 22); x.lineTo(70, 38); x.fill(); x.fillStyle = '#2b2320'; x.fillRect(52, 56, 4, 6); x.fillRect(72, 56, 4, 6) })
  const pp = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshLambertMaterial({ map: picTex })); pp.position.set(-1.9, 1.75, ROOM.zb + 0.04); scene.add(pp)
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.07, 12), lam(0x5a6fb0)); bowl.position.set(3.2, 0.035, 2.0); scene.add(bowl)
  box(0.22, 0.02, 0.22, lam(0xf3e2c4), 3.2, 0.072, 2.0).scale.set(0.9, 1, 0.9)
})()

// ---------- 猫のモデル（ローポリ・頂点カラーで柄）
const PAT = {
  tabby(d, part, x, y, z, i) {
    if (part === 'body') return y < -0.5 ? d.light : (Math.sin(z * 9.5 + 0.5) > 0.25 && y > -0.35) ? d.dark : d.base
    if (part === 'head') { if (y > 0.3 && z > -0.1 && Math.abs(Math.sin(x * 9)) > 0.65) return d.dark; if (Math.abs(x) > 0.7 && y > -0.25 && y < 0.25 && Math.sin(y * 16) > 0.2) return d.dark; return d.base }
    if (part === 'muzzle') return d.light
    if (part === 'leg') return y < -0.75 ? d.light : d.base
    if (part === 'tail') return i === 5 ? d.dark : i % 2 ? d.dark : d.base
    return d.base
  },
  tux(d, part, x, y, z) {
    if (part === 'body') return (z > 0.35 && y < 0.45) || y < -0.3 ? d.light : d.base
    if (part === 'head') return (z > 0.25 && y < 0.3 - 1.7 * Math.abs(x)) ? d.light : d.base
    if (part === 'muzzle') return d.light
    if (part === 'leg') return y < -0.35 ? d.light : d.base
    return d.base
  },
  calico(d, part, x, y, z, i) {
    if (part === 'body') { if (y < -0.4) return d.base; const n = Math.sin(x * 3.1 + 1.7) * Math.cos(z * 2.3 - 0.4) + Math.sin(y * 2.7 + z * 1.9); return n > 0.7 ? d.light : n < -0.75 ? d.dark : d.base }
    if (part === 'head') return (x < -0.1 && y > 0.05) ? d.light : (x > 0.25 && y > 0.25) ? d.dark : d.base
    if (part === 'earL') return d.light
    if (part === 'earR') return d.dark
    if (part === 'tail') return i === 5 ? d.dark : i % 2 ? d.light : d.dark
    return d.base
  },
}
const _c = new THREE.Color()
function colorize(g, fn) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3)
  g.computeBoundingBox(); const bb = g.boundingBox, cx = (bb.max.x + bb.min.x) / 2, cy = (bb.max.y + bb.min.y) / 2, cz = (bb.max.z + bb.min.z) / 2
  const sx = (bb.max.x - bb.min.x) / 2 || 1, sy = (bb.max.y - bb.min.y) / 2 || 1, sz = (bb.max.z - bb.min.z) / 2 || 1
  for (let i = 0; i < p.count; i++) { _c.set(fn((p.getX(i) - cx) / sx, (p.getY(i) - cy) / sy, (p.getZ(i) - cz) / sz)); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g
}
const vcM = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
const pinkM = lam(0xf09aa8), noseM = lam(0xe07a8c), blackM = new THREE.MeshBasicMaterial({ color: 0x15100e }), whiteM = new THREE.MeshBasicMaterial({ color: 0xffffff })
const mouthM = new THREE.MeshBasicMaterial({ color: 0x7a1f2b, side: THREE.DoubleSide }), tongueM = new THREE.MeshBasicMaterial({ color: 0xf07b8e, side: THREE.DoubleSide })
const shadowTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(40,20,10,.45)'); g.addColorStop(1, 'rgba(40,20,10,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h) })
const shadowM = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })

function makeCat(def, idx) {
  const pat = (part, i) => (x, y, z) => PAT[def.pat](def, part, x, y, z, i)
  const sph = (rx, ry, rz, part, ws = 12, hs = 9) => { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); return colorize(g, pat(part)) }
  const root = new THREE.Group(); root.scale.setScalar(def.size * CAT_SCALE); scene.add(root)
  const body = new THREE.Group(); root.add(body)
  const torso = new THREE.Mesh(sph(0.115, 0.105, 0.24, 'body', 14, 10), vcM); body.add(torso)
  const chest = new THREE.Mesh(sph(0.1, 0.1, 0.1, 'body'), vcM); chest.position.set(0, 0.02, 0.15); chest.geometry.translate(0, 0, 0); body.add(chest)
  const headP = new THREE.Group(); headP.position.set(0, 0.1, 0.2); headP.rotation.order = 'YXZ'; body.add(headP)
  const head = new THREE.Group(); head.position.set(0, 0.05, 0.03); headP.add(head)
  const skull = new THREE.Mesh(colorize(new THREE.IcosahedronGeometry(0.1, 1).scale(1.12, 0.95, 0.95), pat('head')), vcM); head.add(skull)
  const muzzle = new THREE.Mesh(sph(0.055, 0.04, 0.045, 'muzzle'), vcM); muzzle.position.set(0, -0.03, 0.065); head.add(muzzle)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4).scale(1.3, 0.8, 0.8), noseM); nose.position.set(0, -0.012, 0.11); head.add(nose)
  const mouth = new THREE.Group(); mouth.position.set(0, -0.048, 0.113); head.add(mouth)
  const mo = new THREE.Mesh(new THREE.CircleGeometry(0.032, 14), mouthM); mouth.add(mo)
  const tg = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), tongueM); tg.position.set(0, -0.014, 0.002); mouth.add(tg)
  mouth.scale.set(0.001, 0.001, 1)
  const eyes = []
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.043, 0.012, 0.083); e.rotation.y = s * 0.35; head.add(e)
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8).scale(1, 1, 0.5), new THREE.MeshBasicMaterial({ color: def.eye })); e.add(iris)
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6).scale(1, 1, 0.4), blackM); pup.position.z = 0.006; e.add(pup)
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 5, 4), whiteM); hl.position.set(0.006, 0.008, 0.012); e.add(hl)
    eyes.push({ g: e, pup })
  }
  // まぶた（閉じた目は線で見せる）
  const lids = []
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.005, 0.006), blackM); l.position.set(s * 0.043, 0.008, 0.094); l.rotation.y = s * 0.35; head.add(l); lids.push(l) }
  const ears = []
  for (const s of [-1, 1]) {
    const ep = new THREE.Group(); ep.position.set(s * 0.055, 0.072, -0.005); head.add(ep)
    const eg = new THREE.ConeGeometry(0.04, 0.075, 4); eg.translate(0, 0.035, 0); const em = new THREE.Mesh(colorize(eg, pat(s < 0 ? 'earL' : 'earR')), vcM); em.rotation.y = Math.PI / 4; ep.add(em)
    const ig = new THREE.ConeGeometry(0.024, 0.05, 3); ig.translate(0, 0.026, 0.012); const im = new THREE.Mesh(ig, pinkM); ep.add(im)
    ep.rotation.z = -s * 0.28; ears.push(ep)
  }
  // ひげ
  const wv = []; for (const s of [-1, 1]) for (const k of [-1, 0, 1]) wv.push(s * 0.04, -0.03, 0.1, s * 0.15, -0.03 + k * 0.022, 0.08)
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3))
  head.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: def.pat === 'tux' ? 0xffffff : 0xfdf6ea })))
  // 脚（上から下へ伸びる）
  const legs = {}
  const legG = (part) => { const g = new THREE.CylinderGeometry(0.026, 0.022, 0.14, 6); g.translate(0, -0.07, 0); colorize(g, pat(part)); return g }
  for (const [k, x, y, z] of [['fl', -0.055, -0.03, 0.15], ['fr', 0.055, -0.03, 0.15], ['bl', -0.065, -0.02, -0.14], ['br', 0.065, -0.02, -0.14]]) {
    const p = new THREE.Group(); p.position.set(x, y, z); body.add(p)
    const m = new THREE.Mesh(legG('leg'), vcM); p.add(m)
    const paw = new THREE.Mesh(sph(0.03, 0.022, 0.036, 'leg'), vcM); paw.position.set(0, -0.14, 0.01); p.add(paw)
    // パウの色は脚の下端と同じ（柄の関数で y=-1 を渡す）
    _c.set(PAT[def.pat](def, 'leg', 0, -1, 0)); const cc = paw.geometry.attributes.color; for (let i = 0; i < cc.count; i++) cc.setXYZ(i, _c.r, _c.g, _c.b)
    legs[k] = { p, m, paw }
  }
  for (const s of [-1, 1]) { const th = new THREE.Mesh(sph(0.05, 0.065, 0.075, 'body'), vcM); th.position.set(s * 0.07, -0.01, -0.13); body.add(th) }
  // しっぽ
  const tail = []; let parent = body
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group(); p.position.set(0, i ? 0 : 0.05, i ? -0.055 : -0.225); parent.add(p)
    const g = new THREE.CylinderGeometry(0.022 - i * 0.0015, 0.024 - i * 0.0015, 0.06, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, -0.028); colorize(g, pat('tail', i))
    p.add(new THREE.Mesh(g, vcM)); tail.push(p); parent = p
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), shadowM); shadow.rotation.x = -Math.PI / 2; scene.add(shadow)
  return {
    i: idx, def, root, body, headP, head, mouth, eyes, lids, ears, legs, tail, shadow, s: def.size * CAT_SCALE,
    x: 0, y: 0, z: 0, h: 0, p: { ...P0 }, tg: { ...P0 }, rate: 10, walk: 0, walkAmt: 0, earTw: 0, earSide: 1,
    gen: null, act: null, last: null, mom: null, hidden: false, spot: null, pend: null, interruptible: false,
    hw: new THREE.Vector3(), hist: [], omega: 0, bobT: Math.random() * 10, hopping: false,
  }
}
// ポーズ（tg が目標、p が今）。角度はラジアン
const P0 = { hipY: 0.17, pitch: 0, roll: 0, hx: 0, hy: 0, hr: 0, earB: 0, eye: 1, pupil: 0.65, mouth: 0, fl: 0, bl: 0, foldF: 0, foldB: 0, gF: 1, gB: 1, tailUp: 0.55, tailWag: 0.12, tailCurl: 0.25, wig: 0 }
const POSE = {
  stand: {},
  sit: { hipY: 0.11, pitch: -0.62, foldB: 1, tailUp: -0.12, tailCurl: 0.45, tailWag: 0.06 },
  loaf: { hipY: 0.085, foldF: 1, foldB: 1, gF: 0, gB: 0, tailUp: -0.08, tailCurl: 0.7, tailWag: 0.02, eye: 0.45, hx: 0.06 },
  crouch: { hipY: 0.105, pitch: -0.08, foldF: 0.45, foldB: 0.85, tailUp: 0.05, tailWag: 0.3 },
  stretch: { hipY: 0.15, pitch: 0.4, fl: -1.3, gF: 0, hx: -0.32, eye: 0.35, mouth: 0.12, tailUp: 1.1, tailWag: 0.05, earB: 0.2 },
  standup: { hipY: 0.16, pitch: -1.25, fl: -2.3, gF: 0, hx: -0.45, pupil: 1.25, tailUp: -0.3, tailCurl: 0.1, tailWag: 0.25 },
  hang: { hipY: 0.17, pitch: -1.45, fl: -2.95, gF: 0, gB: 0, bl: 0.15, hx: -0.15, eye: 1.25, pupil: 1.3, mouth: 0.18, tailUp: -0.9, tailCurl: 0.05, tailWag: 0.35, earB: 0.5 },
  belly: { hipY: 0.12, roll: 2.85, fl: -0.7, bl: -0.5, gF: 0, gB: 0, foldF: 0.35, foldB: 0.2, eye: 0, tailUp: 0, tailCurl: 0.6, tailWag: 0.04, hr: 0.3 },
  inbox: { hipY: 0.1, pitch: -0.25, foldF: 0.6, foldB: 1, gF: 0, gB: 0, tailUp: 0, tailWag: 0 },
}
function setPose(c, name, extra = {}, rate = 9) { c.tg = { ...P0, ...POSE[name], ...extra }; c.rate = rate }
function blendPose(c) { const k = Math.min(1, c.rate * DT); for (const key in c.tg) c.p[key] += (c.tg[key] - c.p[key]) * k }
function applyPose(c, t) {
  const p = c.p, b = c.body
  c.root.position.set(c.x, c.y, c.z); c.root.rotation.y = c.h
  const bob = c.walkAmt * Math.abs(Math.sin(c.walk)) * 0.012, breathe = Math.sin(t * 2.4 + c.bobT) * 0.003
  b.position.y = p.hipY + bob + breathe; b.rotation.x = p.pitch; b.rotation.z = p.roll; b.rotation.y = p.wig * Math.sin(t * 15) * 0.18
  c.headP.rotation.set(p.hx - p.pitch * 0.85 + c.walkAmt * Math.sin(c.walk * 2) * 0.03, p.hy, p.hr)
  const tw = c.earTw > 0 ? Math.sin(c.earTw * 40) * 0.5 * Math.min(1, c.earTw * 4) : 0
  c.ears.forEach((e, k) => { const s = k ? 1 : -1; e.rotation.x = -p.earB * 0.8; e.rotation.z = -s * (0.28 + p.earB * 0.5) + (k === (c.earSide > 0 ? 1 : 0) ? tw : 0) })
  const eo = clamp(p.eye, 0, 1.3)
  c.eyes.forEach(e => { e.g.scale.set(1 + (eo - 1) * 0.3, Math.max(0.02, eo), 1); e.pup.scale.set(clamp(p.pupil, 0.3, 1.4) * 0.75, 1, 1); e.g.visible = eo > 0.12 })
  c.lids.forEach(l => { l.visible = eo <= 0.12 })
  const m = clamp(p.mouth, 0, 1); c.mouth.scale.set(m > 0.02 ? 0.55 + m * 0.6 : 0.001, m > 0.02 ? m : 0.001, 1)
  // 脚。gF/gB=1 のとき床まで届く長さに伸び縮み
  const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch)
  const shY = b.position.y + (-0.03 * cp - 0.15 * sp), hipYw = b.position.y + (-0.02 * cp + 0.14 * sp)
  const wl = c.walkAmt * 0.5
  for (const [k, front, ph] of [['fl', 1, 0], ['fr', 1, Math.PI], ['bl', 0, Math.PI], ['br', 0, 0]]) {
    const L = c.legs[k], ang = (front ? p.fl : p.bl) + Math.sin(c.walk + ph) * wl
    L.p.rotation.x = ang - p.pitch
    const fold = front ? p.foldF : p.foldB, g = front ? p.gF : p.gB, need = (front ? shY : hipYw) / Math.max(0.3, Math.cos(ang)) / 0.14
    const sc = lerp(1 - fold * 0.82, clamp(need, 0.25, 1.7), g * (1 - fold))
    L.p.scale.y = Math.max(0.15, sc)
  }
  // 吊り下がり中は後ろ脚をぶらぶら
  if (c.hangSwing) { c.legs.bl.p.rotation.x += Math.sin(t * 9) * 0.5; c.legs.br.p.rotation.x += Math.sin(t * 9 + 2) * 0.5 }
  c.tail.forEach((s, i) => { s.rotation.x = i ? p.tailCurl * 0.35 : p.tailUp; s.rotation.y = Math.sin(t * (2.2 + p.tailWag * 6) + i * 0.7) * p.tailWag * (0.4 + i * 0.12) })
  c.shadow.position.set(c.x, (c.floorY ?? 0) + 0.006, c.z); const sh = 1 / (1 + Math.max(0, c.y - (c.floorY ?? 0)) * 3); c.shadow.scale.setScalar(c.s * sh); c.shadow.visible = !c.hidden && c.root.visible
}

const CATS = D.CATS.map((d, i) => makeCat(d, i))

// ---------- 猫の行動（ジェネレータで時間割を書く）
const SPOT = {
  sofa: { ax: -2.15, az: -1.0, x: -2.3, y: SOFA.seat + 0.02, z: -1.72, h: 0.43 },
  sun: { x: -0.35, z: -1.3 },
  sock: { x: SOCK.x - 0.05, z: SOCK.z - 0.43, h: 0 },
  toy: { x: -1.6, z: 0.42, h: 0 },
  box: { ax: BOX.x - 0.15, az: BOX.z + 0.72 },
  sill: { ax: SILL.x, az: -1.42 },
}
const busy = {}
const WEIGHTS = {
  mugi: { toy: 3, jump: 2.4, stretch: 2, yawn: 1.6, look: 1.3, wander: 1.4, sofa: 0.6, loaf: 0.5, box: 0.9, flehmen: 0.8, sleep: 0.3 },
  mochi: { loaf: 1.6, sleep: 1.1, sofa: 1.4, yawn: 2.2, box: 1.7, look: 1.2, wander: 1, stretch: 1.3, toy: 0.6, flehmen: 0.7, jump: 0.8 },
  dango: { flehmen: 2.3, look: 2, box: 1.4, wander: 1.4, yawn: 1.3, stretch: 1.1, toy: 1.1, jump: 1.1, loaf: 0.6, sofa: 0.5, sleep: 0.4 },
}
function* wait(dur, fn) { for (let t = 0; t < dur - 1e-6; t += DT) { if (fn) fn(t / dur, t); yield } }
const mom = (c, type, ph, k = 0) => { if (!c.mom || c.mom.type !== type) c.momSeq = (c.momSeq || 0) + 1; c.mom = { type, ph, k } }
function camHeading(c) { return Math.atan2(CAM_POS.x - c.x, CAM_POS.z - c.z) }
function* turnTo(c, h, speed = 5) { while (Math.abs(angDiff(h, c.h)) > 0.03) { const d = angDiff(h, c.h); c.h += clamp(d, -speed * DT, speed * DT); yield } }
function* walkTo(c, x, z, speed = 0.55) {
  setPose(c, 'stand', {}, 8); mom(c, 'walk', 'hold'); c.interruptible = false
  let guard = 0
  while (guard++ < 1200) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz); if (d < 0.04) break
    const want = Math.atan2(dx, dz), diff = angDiff(want, c.h); c.h += clamp(diff, -4.5 * DT, 4.5 * DT)
    const go = Math.abs(diff) < 1.2 ? Math.min(d, speed * DT * (1 - Math.abs(diff) / 1.6)) : 0
    c.x += Math.sin(c.h) * go; c.z += Math.cos(c.h) * go; c.walk += go / 0.035; c.walkAmt = lerp(c.walkAmt, go > 0 ? 1 : 0, 0.2)
    yield
  }
  c.walkAmt = 0
}
// 放物線で跳ぶ（dur 秒）
function* hop(c, x, y, z, dur = 0.42, peakH = 0.35, pose = 'crouch') {
  const x0 = c.x, y0 = c.y, z0 = c.z; c.hopping = true; setPose(c, pose, { foldF: 0.3, foldB: 0.3, gF: 0, gB: 0, fl: -0.6, bl: 0.6, tailUp: 0.8 }, 14)
  yield* wait(dur, k => { c.x = lerp(x0, x, k); c.z = lerp(z0, z, k); c.y = lerp(y0, y, k) + Math.sin(Math.PI * k) * peakH })
  c.x = x; c.y = y; c.z = z; c.hopping = false
}
function* toFloor(c) {
  if (c.y < 0.05 && !c.inBox) return
  const nx = c.spotExit ? c.spotExit[0] : c.x + Math.sin(c.h) * 0.5, nz = c.spotExit ? c.spotExit[1] : c.z + Math.cos(c.h) * 0.5
  yield* turnTo(c, Math.atan2(nx - c.x, nz - c.z), 6)
  c.inBox = false; c.hidden = false
  yield* hop(c, nx, 0, nz, 0.45, 0.25); c.floorY = 0
  if (c.spot) { busy[c.spot] = null; c.spot = null }; c.spotExit = null
  setPose(c, 'stand', {}, 10); yield* wait(0.2)
}
function claim(c, name) { if (busy[name] && busy[name] !== c) return false; busy[name] = c; return true }
function release(c, name) { if (busy[name] === c) busy[name] = null }
// その場に座ってのんびり（中断して別の行動を差し込める）
function* sitIdle(c, dur, name = 'sit') {
  setPose(c, name, {}, 7); c.interruptible = true; mom(c, name, 'hold')
  let t = 0
  while (t < dur) { if (S.rng() < 0.01) c.tg.hy = (S.rng() - 0.5) * 0.9; if (S.rng() < 0.006) c.tg.eye = c.tg.eye > 0.5 ? 0.35 : 1; t += DT; yield }
  c.interruptible = false
}
const ACTS = {
  *wander(c) {
    let x, z, tries = 0
    do { x = -1.6 + S.rng() * 3.6; z = -1.1 + S.rng() * 3.0; tries++ } while (tries < 20 && CATS.some(o => o !== c && Math.hypot(o.x - x, o.z - z) < 0.8))
    yield* walkTo(c, x, z); yield* sitIdle(c, 1.2 + S.rng() * 1.6)
  },
  *loaf(c) { yield* sitIdle(c, 0.5); setPose(c, 'loaf', {}, 4); mom(c, 'sit', 'hold'); yield* wait(0.6); yield* sitIdle(c, 3 + S.rng() * 3, 'loaf') },
  *sleep(c) {
    if (!claim(c, 'sun')) return; yield* walkTo(c, SPOT.sun.x, SPOT.sun.z); c.spot = 'sun'
    setPose(c, 'loaf', {}, 5); yield* wait(0.6); setPose(c, 'belly', {}, 3); mom(c, 'sit', 'hold'); yield* wait(1.0)
    c.interruptible = false; mom(c, 'sleep', 'hold'); yield* wait(4 + S.rng() * 3, () => { c.tg.fl = -0.7 + Math.sin(S.t * 1.3) * 0.15 })
    setPose(c, 'loaf', {}, 4); yield* wait(0.8); release(c, 'sun'); c.spot = null
  },
  *yawn(c, quick = 0) {
    if (!quick) yield* sitIdle(c, 0.6 + S.rng() * 1.2)
    const om = quick || 0.9; c.interruptible = false
    if (!quick) contagion(c, om)
    const base = c.tg.hipY < 0.1 ? 'loaf' : 'sit'
    setPose(c, base, { tailWag: 0.35 }, 6); c.earTw = 0.9
    yield* wait(om, k => { mom(c, 'yawn', 'omen', k); c.tg.hx = -0.12 * k; if (k > 0.5 && c.earTw <= 0) c.earTw = 0.5 })
    ev(c, 'yawn')
    setPose(c, base, { hx: -0.5, mouth: 1, eye: 0, earB: 0.65, tailWag: 0.1 }, 16)
    yield* wait(0.42, k => mom(c, 'yawn', 'peak', k))
    setPose(c, base, { hx: -0.05, mouth: 0, eye: 0.6 }, 6)
    yield* wait(0.6, k => mom(c, 'yawn', 'after', k))
    yield* sitIdle(c, 0.6 + S.rng() * 0.8, base)
  },
  *stretch(c) {
    if (c.y < 0.05) yield* walkTo(c, clamp(c.x + (S.rng() - 0.5) * 1.2, -1.6, 2.0), clamp(c.z + (S.rng() - 0.5) * 1.0, -1.1, 1.9))
    yield* turnTo(c, camHeading(c) + (S.rng() < 0.5 ? 1.3 : -1.3) * (0.5 + S.rng() * 0.6), 4)
    setPose(c, 'stand', { tailUp: 1.0, tailWag: 0.5 }, 6); c.earTw = 0.6
    yield* wait(0.7, k => mom(c, 'stretch', 'omen', k))
    setPose(c, 'stretch', {}, 10); yield* wait(0.25, () => mom(c, 'stretch', 'omen', 1))
    yield* wait(0.5, k => mom(c, 'stretch', 'peak', k))
    setPose(c, 'stand', {}, 6); yield* wait(0.5, k => mom(c, 'stretch', 'after', k))
    yield* sitIdle(c, 0.8 + S.rng())
  },
  *look(c, quick) {
    if (!quick) yield* sitIdle(c, 0.6 + S.rng())
    c.interruptible = false
    const base = c.tg.hipY < 0.1 ? 'loaf' : 'sit', away = (S.rng() < 0.5 ? 1 : -1) * (0.9 + S.rng() * 0.4)
    yield* turnTo(c, camHeading(c) + away * 0.7, 3)
    setPose(c, base, { hy: away * 0.6 }, 6); c.earSide = away > 0 ? -1 : 1; c.earTw = 0.7
    yield* wait(0.65, k => { mom(c, 'look', 'omen', k); if (k > 0.55 && c.earTw <= 0) c.earTw = 0.4 })
    // こっちを向く（速い＝この間はブレる）
    const target = angDiff(camHeading(c), c.h)
    setPose(c, base, { hy: clamp(target, -1.3, 1.3), hr: 0.32 * (S.rng() < 0.5 ? 1 : -1), eye: 1.2, pupil: 1.4, earB: -0.15, tailWag: 0.05 }, 22)
    yield* wait(0.16, () => mom(c, 'look', 'omen', 1))
    yield* wait(0.55, k => mom(c, 'look', 'peak', k))
    setPose(c, base, { hy: away * 0.4 }, 5); ev(c, 'mrr')
    yield* wait(0.5, k => mom(c, 'look', 'after', k))
    yield* sitIdle(c, 0.8 + S.rng(), base)
  },
  *flehmen(c) {
    if (!claim(c, 'sock')) return
    yield* walkTo(c, SPOT.sock.x, SPOT.sock.z); c.spot = 'sock'
    yield* turnTo(c, Math.atan2(SOCK.x - c.x, SOCK.z - c.z), 4)
    setPose(c, 'stand', { hx: 0.6, earB: -0.1, tailWag: 0.25 }, 6)
    yield* wait(1.05, (k, t) => { mom(c, 'flehmen', 'omen', k); c.tg.hx = 0.6 + Math.sin(t * 18) * 0.06 })
    setPose(c, 'stand', { hx: -0.38, hr: 0.18, mouth: 0.42, eye: 0.18, earB: 0.45, tailWag: 0 }, 20)
    yield* wait(0.08, () => mom(c, 'flehmen', 'omen', 1))
    yield* wait(0.34, k => mom(c, 'flehmen', 'peak', k))
    ev(c, 'stink')
    setPose(c, 'stand', { hx: 0, mouth: 0, eye: 0.7 }, 8)
    yield* wait(0.55, (k, t) => { mom(c, 'flehmen', 'after', k); c.tg.hy = Math.sin(t * 30) * 0.5 * (1 - k) })
    release(c, 'sock'); c.spot = null
    yield* walkTo(c, c.x + (S.rng() - 0.5) * 1.2, clamp(c.z - 0.6, -1.0, 1.8))
  },
  *jump(c) {
    if (!claim(c, 'sill')) return
    yield* walkTo(c, SPOT.sill.ax, SPOT.sill.az); yield* turnTo(c, Math.PI, 5)
    const fail = S.rng() < 0.7
    setPose(c, 'crouch', { wig: 1, pupil: 1.2 }, 8); c.earTw = 0.5
    yield* wait(0.85, k => mom(c, 'jumpfail', 'omen', k))
    if (!fail) {
      yield* hop(c, SILL.x, SILL.y, -2.08, 0.42, 0.25); c.floorY = SILL.y; mom(c, 'sit', 'hold')
      c.spot = 'sill'; yield* turnTo(c, camHeading(c), 4); c.spotExit = [SILL.x, -1.35]
      yield* sitIdle(c, 2 + S.rng() * 2)
      if (S.rng() < 0.5) yield* ACTS.look(c, true)
      yield* toFloor(c); release(c, 'sill'); return
    }
    // 届かずに窓台にぶら下がる
    ev(c, 'jumpgo')
    const hy = SILL.y - (0.17 + 0.29) * c.s, hz = SILL.zf + 0.13 * c.s
    yield* hop(c, SILL.x, hy, hz, 0.36, 0.12, 'hang'); setPose(c, 'hang', {}, 30); c.hangSwing = true; c.floorY = 0
    ev(c, 'hang')
    yield* wait(0.52, k => mom(c, 'jumpfail', 'peak', k))
    ev(c, 'slip')
    yield* wait(0.45, k => { mom(c, 'jumpfail', 'after', k); c.y = hy - smooth(k) * hy * 0.7 })
    c.hangSwing = false; setPose(c, 'crouch', { eye: 1.2 }, 14)
    yield* wait(0.18, k => { mom(c, 'jumpfail', 'after', 1); c.y = lerp(hy * 0.3, 0, k); c.z = lerp(hz, hz + 0.15, k) })
    c.y = 0; ev(c, 'thud'); release(c, 'sill')
    yield* turnTo(c, camHeading(c) + 0.6, 6)
    setPose(c, 'sit', { hy: -0.7, eye: 0.55, earB: 0.3 }, 6); ev(c, 'shy'); mom(c, 'shy', 'hold')
    yield* wait(1.6)
  },
  *box(c) {
    if (!claim(c, 'box')) return
    yield* walkTo(c, SPOT.box.ax, SPOT.box.az); yield* turnTo(c, Math.atan2(BOX.x - c.x, BOX.z - c.z), 5)
    setPose(c, 'crouch', {}, 8); yield* wait(0.35)
    const hidY = BOX.h - 0.40 * c.s, peekY = BOX.h + 0.04 - 0.30 * c.s
    yield* hop(c, BOX.x, hidY, BOX.z, 0.4, 0.3, 'inbox'); c.inBox = true; c.floorY = 0; c.spot = 'box'; c.spotExit = [BOX.x - 0.2, BOX.z + 0.75]
    setPose(c, 'inbox', {}, 8); c.hidden = true; mom(c, null, 'hold'); ev(c, 'rustle')
    c.h = camHeading(c) + (S.rng() - 0.5) * 0.4
    yield* wait(0.8 + S.rng() * 1.5)
    c.hidden = false
    yield* wait(0.75, (k, t) => { mom(c, 'box', 'omen', k); BOX.shake = 1; c.y = hidY })
    BOX.shake = 0
    ev(c, 'pop')
    setPose(c, 'inbox', { eye: 1.2, pupil: 1.35, earB: -0.2, hr: 0.2 }, 18)
    yield* wait(0.14, k => { mom(c, 'box', 'omen', 1); c.y = lerp(hidY, peekY, smooth(k)) })
    c.y = peekY
    yield* wait(0.52, k => mom(c, 'box', 'peak', k))
    setPose(c, 'inbox', { eye: 0.7, hy: 0.4 }, 5)
    yield* wait(1.2, k => mom(c, 'box', 'after', k))
    yield* wait(0.3, k => { c.y = lerp(peekY, hidY + 0.05, k); mom(c, 'box', 'after', 1) })
    yield* toFloor(c); release(c, 'box')
  },
  *toy(c) {
    if (!claim(c, 'toy')) return
    yield* walkTo(c, SPOT.toy.x, SPOT.toy.z); c.spot = 'toy'; yield* turnTo(c, 0, 5)
    setPose(c, 'crouch', { wig: 1, pupil: 1.35, hx: -0.2 }, 8); c.earTw = 0.5
    yield* wait(0.65, k => mom(c, 'stand', 'omen', k))
    ev(c, 'pounce'); setPose(c, 'standup', {}, 16); c.toyHit = 1
    yield* wait(0.18, () => mom(c, 'stand', 'omen', 1))
    yield* wait(0.42, (k, t) => { mom(c, 'stand', 'peak', k); c.tg.fl = -2.3 + Math.sin(t * 9) * 0.12 })
    setPose(c, 'sit', {}, 8)
    yield* wait(0.45, k => mom(c, 'stand', 'after', k))
    c.toyHit = 0; release(c, 'toy'); c.spot = null
    yield* sitIdle(c, 0.8 + S.rng())
  },
  *sofa(c) {
    if (!claim(c, 'sofa')) return
    yield* walkTo(c, SPOT.sofa.ax, SPOT.sofa.az); yield* turnTo(c, Math.PI + 0.2, 5)
    setPose(c, 'crouch', {}, 8); yield* wait(0.35)
    yield* hop(c, SPOT.sofa.x, SPOT.sofa.y, SPOT.sofa.z, 0.42, 0.3); c.floorY = SPOT.sofa.y; c.spot = 'sofa'; c.spotExit = [SPOT.sofa.ax + 0.2, SPOT.sofa.az + 0.3]
    yield* turnTo(c, SPOT.sofa.h, 4)
    yield* sitIdle(c, 0.8); setPose(c, 'loaf', {}, 4); yield* wait(0.5)
    yield* sitIdle(c, 3 + S.rng() * 3, 'loaf')
    if (S.rng() < 0.4) yield* ACTS.yawn(c)
    yield* toFloor(c); release(c, 'sofa')
  },
}
// あくびはうつる。他の猫が座ってのんびりしていたら、少し遅れて同時にあくび
function contagion(src, om) {
  for (const o of CATS) { if (o === src || !o.interruptible || o.hidden) continue; if (S.rng() < 0.42) o.pend = { act: 'yawn', at: S.t + 0.25, arg: Math.max(0.35, om - 0.25 + S.rng() * 0.12) } }
}
const IN_PLACE = { yawn: 1, look: 1, loaf: 1 }
function startAct(c, name, arg) {
  c.act = name; c.interruptible = false
  c.gen = (function* () { if (!IN_PLACE[name] && (c.y > 0.05 || c.inBox)) yield* toFloor(c); yield* ACTS[name](c, arg) })()
}
function chooseAct(c) {
  if (c.y > 0.05 && !c.spot) return 'wander'
  const W = WEIGHTS[c.def.id], keys = Object.keys(W).filter(k => k !== c.last && !(k in { sofa: 1, sleep: 1, box: 1, jump: 1, toy: 1, flehmen: 1 } && busy[{ sofa: 'sofa', sleep: 'sun', box: 'box', jump: 'sill', toy: 'toy', flehmen: 'sock' }[k]]))
  let sum = keys.reduce((a, k) => a + W[k], 0), r = S.rng() * sum
  for (const k of keys) { r -= W[k]; if (r <= 0) return k }
  return 'wander'
}
function updateCat(c) {
  if (c.pend && S.t >= c.pend.at) { const pd = c.pend; c.pend = null; if (c.interruptible) { startAct(c, pd.act, pd.arg) } }
  if (!c.gen || c.gen.next().done) { if (c.gen) c.last = c.act; const a = chooseAct(c); startAct(c, a); c.gen.next() }
  if (c.earTw > 0) c.earTw = Math.max(0, c.earTw - DT)
  blendPose(c)
  // 床の猫どうしは重ならない
  if (c.y < 0.05 && !c.hopping) for (const o of CATS) { if (o === c || o.y > 0.05 || o.hopping) continue; const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz); if (d < 0.42 && d > 1e-4) { const push = (0.42 - d) * 0.08; c.x += dx / d * push; c.z += dz / d * push } }
  applyPose(c, S.t)
}
function resetCats(seed) {
  S.rng = mulberry(seed); for (const k in busy) busy[k] = null
  const start = [[-0.7, 0.9, 0.4], [-2.3, -1.72, 0.43], [1.3, -0.2, -0.5]]
  CATS.forEach((c, i) => {
    Object.assign(c, { x: start[i][0], z: start[i][1], h: start[i][2], y: 0, floorY: 0, gen: null, act: null, last: null, mom: null, hidden: false, inBox: false, spot: null, spotExit: null, pend: null, interruptible: false, hangSwing: false, toyHit: 0, walkAmt: 0, earTw: 0, hist: [], omega: 0, hopping: false, momSeq: 0, bobT: i * 3.1 })
    c.p = { ...P0 }; c.tg = { ...P0 }
  })
  // 最初の行動を決めて、始まりからそれなりに動く
  const m = CATS[1]; m.y = SPOT.sofa.y; m.floorY = SPOT.sofa.y; m.spot = 'sofa'; busy.sofa = m; m.spotExit = [SPOT.sofa.ax + 0.2, SPOT.sofa.az + 0.3]
  m.gen = (function* () { yield* sitIdle(m, 1.5 + S.rng() * 2, 'loaf'); yield* ACTS.yawn(m); yield* toFloor(m); release(m, 'sofa') })(); m.act = 'sofa'
  for (const c of CATS) { if (!c.gen) startAct(c, chooseAct(c)); c.p = { ...c.p, ...POSE.sit }; applyPose(c, 0) }
  BOX.shake = 0
}

// ---------- 演出のフック（シミュレーション中は音も画面も出さない）
const _v = new THREE.Vector3()
function ev(c, name) {
  if (S.sim) return
  const pos = c.head.getWorldPosition(_v.set(0, 0, 0)).clone(); pos.y += 0.12
  const on = S.view === 'play' || S.view === 'title'
  if (!on) return
  const say = (txt, bub) => ono(txt, pos, bub)
  switch (name) {
    case 'yawn': Snd.cat('yawn', 1 / c.def.size); break
    case 'mrr': if (Math.random() < 0.5) Snd.cat('mrr', 1 / c.def.size); break
    case 'stink': say(T('bubStink'), true); Snd.cat('squeak', 0.9 / c.def.size); break
    case 'jumpgo': Snd.sfx('swish'); break
    case 'hang': Snd.cat('squeak', 1.1 / c.def.size); say('!?'); break
    case 'slip': Snd.sfx('slip'); say(T('bubSlip')); break
    case 'thud': Snd.sfx('thud'); say(T('bubThud')); break
    case 'shy': setTimeout(() => ono(T('bubShy'), c.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.14, 0)), true), 250); break
    case 'rustle': Snd.sfx('rustle'); say(T('bubBox')); break
    case 'pop': Snd.sfx('pop'); break
    case 'pounce': Snd.sfx('swish'); say(T('bubPounce')); break
  }
}
function ono(txt, wpos, bub) {
  if (S.sim) return
  _v.copy(wpos).project(camera); if (_v.z > 1) return
  const x = (_v.x * 0.5 + 0.5) * innerWidth, y = (-_v.y * 0.5 + 0.5) * innerHeight
  if (x < -40 || x > innerWidth + 40 || y < -20 || y > innerHeight + 40) return
  const d = document.createElement('div'); d.className = 'ono' + (bub ? ' bub' : ''); d.textContent = txt
  d.style.left = clamp(x, 50, innerWidth - 50) + 'px'; d.style.top = clamp(y, 40, innerHeight) + 'px'
  ;($('#vPlay').hidden ? document.body : $('#fxl')).appendChild(d); setTimeout(() => d.remove(), 1150)
}

// ---------- カメラとファインダー
const L = { W: 390, H: 844, fs: 340, fx: 25, fy: 252, land: false }
function layout() {
  const W = innerWidth, H = innerHeight
  renderer.setSize(W, H, false); camera.aspect = W / H
  const land = W > H * 1.15
  const fs = Math.max(160, Math.floor(land ? Math.min(H - 28, W - 300, 760) : Math.min(W - 24, H - 300, 640)))
  Object.assign(L, { W, H, fs, land, fx: Math.round((W - fs) / 2), fy: Math.round((H - fs) / 2) })
  const r = document.documentElement.style; r.setProperty('--fx', L.fx + 'px'); r.setProperty('--fy', L.fy + 'px'); r.setProperty('--fs', fs + 'px')
  $('#vPlay').className = land ? 'land' : 'port'
  if (!$('#vResult').hidden) layoutAlbum()
}
function applyCamera() {
  camera.position.copy(CAM_POS)
  if (S.view === 'play') {
    camera.rotation.set(S.pitch * DEG, -S.yaw * DEG, 0)
    camera.fov = 2 * Math.atan(Math.tan(S.fov / 2 * DEG) * L.H / L.fs) / DEG
  } else {
    const t = S.titleT
    camera.rotation.set(((L.land ? -12 : -19) + Math.sin(t * 0.21) * 3) * DEG, (Math.sin(t * 0.13) * 14) * DEG, 0)
    const aspect = L.W / L.H; camera.fov = Math.max(52, 2 * Math.atan(Math.tan(34 * DEG) / aspect) / DEG)
  }
  camera.updateProjectionMatrix(); camera.updateMatrixWorld()
}
// 頭の向き（カメラ座標）の変化から、写真に写る動きの速さを出す（度/秒）
const _inv = new THREE.Matrix4(), _q = new THREE.Vector3()
function trackMotion() {
  _inv.copy(camera.matrixWorld).invert()
  for (const c of CATS) {
    c.head.getWorldPosition(c.hw); _q.copy(c.hw).applyMatrix4(_inv).normalize()
    c.hist.push(_q.clone()); if (c.hist.length > 4) c.hist.shift()
    c.omega = c.hist.length >= 4 ? Math.acos(clamp(c.hist[0].dot(c.hist[3]), -1, 1)) / DEG / (3 * DT) : 0
  }
}

// ---------- 採点
const _hc = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _b = new THREE.Vector3()
function project(wp) { _hc.copy(wp).applyMatrix4(_inv); if (_hc.z > -0.05) return null; const tf = Math.tan(S.fov / 2 * DEG); return { x: (_hc.x / -_hc.z) / tf, y: (_hc.y / -_hc.z) / tf, d: -_hc.z, tf } }
function evalCat(c) {
  if (c.hidden || !c.root.visible) return null
  const hp = project(c.hw); if (!hp) return null
  const hd = (0.1 * c.s / hp.d) / hp.tf // 頭の直径が枠の幅に占める割合
  const inside = Math.abs(hp.x) <= 1 && Math.abs(hp.y) <= 1
  c.body.getWorldPosition(_b); const bp = project(_b)
  const bodyIn = bp && Math.abs(bp.x) <= 1 && Math.abs(bp.y) <= 1
  if (!inside && !bodyIn) return null
  const m = c.mom || { type: 'sit', ph: 'hold', k: 0 }, M = D.MOM[m.type] || D.MOM.sit
  let tm = 1, tags = []
  if (!M.hold) { if (m.ph === 'omen') { tm = 0.2; tags.push('early') } else if (m.ph === 'peak') tm = 0.55 + 0.45 * Math.sin(Math.PI * clamp(m.k, 0, 1)); else if (m.ph === 'after') { tm = 0.38 - 0.25 * m.k; tags.push('late') } }
  // 顔の向き
  _f.set(0, 0, 1).applyQuaternion(c.head.getWorldQuaternion(new THREE.Quaternion())); _u.copy(CAM_POS).sub(c.hw).normalize()
  const dot = _f.dot(_u); let F = dot > 0.35 ? 1 : dot > -0.25 ? 0.7 : 0.4
  if (m.type === 'jumpfail' || m.type === 'sleep') F = Math.max(F, 0.95)
  if (F <= 0.4) tags.push('butt')
  // 構図: 中心か三分割の交点に近いか、大きさ、見切れ
  let C
  if (inside) {
    let dmin = Math.hypot(hp.x, hp.y); for (const a of [-1 / 3, 1 / 3]) for (const b of [-1 / 3, 1 / 3]) dmin = Math.min(dmin, Math.hypot(hp.x - a, hp.y - b))
    const place = 1 - clamp((dmin - 0.08) / 0.5, 0, 1)
    const size = hd < 0.06 ? 0 : hd < 0.15 ? (hd - 0.06) / 0.09 : hd < 0.4 ? 1 : Math.max(0.4, 1 - (hd - 0.4) * 2)
    const cut = Math.max(Math.abs(hp.x), Math.abs(hp.y)) + hd > 1.02 ? 0.55 : 1
    if (cut < 1) tags.push('cut'); if (hd < 0.09) tags.push('far')
    C = (0.45 * place + 0.55 * size) * cut
  } else { C = 0.08; tags.push('cut') }
  const blur = clamp((c.omega + S.camSpeed) / S.fov * 1.15 - 0.06, 0, 1)
  if (blur > 0.4) tags.push('blur')
  const v = (inside ? M.v : M.v * 0.3) * tm * (0.25 + 0.75 * C) * (0.15 + 0.85 * (1 - blur)) * F
  return { c, type: m.type, ph: m.ph, k: m.k, tm, C, F, blur, hd, x: hp.x, y: hp.y, v, tags, inside, peak: m.ph === 'peak' }
}
function evalShot() {
  _inv.copy(camera.matrixWorld).invert()
  const list = CATS.map(evalCat).filter(Boolean).sort((a, b) => b.v - a.v)
  if (!list.length) return { score: 0, type: null, tags: ['none'], blur: clamp(S.camSpeed / S.fov * 1.15 - 0.06, 0, 1), cats: 0, miracle: false }
  const top = list[0]; let score = top.v, tags = [...new Set(top.tags)], miracle = false
  const extra = list.slice(1).filter(e => e.inside && e.blur < 0.5)
  if (extra.length) { score *= 1 + 0.12 * extra.length; tags.push('two') }
  const yawning = list.filter(e => e.type === 'yawn' && e.peak && e.inside && e.blur < 0.5)
  if (yawning.length >= 2) { score *= 1.5; miracle = true; tags.push('double') }
  else if ((top.type === 'flehmen' || top.type === 'jumpfail') && top.tm > 0.85 && top.blur < 0.25 && top.C > 0.55) { score *= 1.3; miracle = true }
  score = Math.round(Math.min(150, score))
  return { score, type: top.type, ph: top.ph, tags, blur: top.blur, cats: list.length, miracle, C: +top.C.toFixed(2), tm: +top.tm.toFixed(2), F: top.F, cat: top.c.i, x: +top.x.toFixed(2), y: +top.y.toFixed(2), hd: +top.hd.toFixed(3) }
}

// ---------- 写真を撮る（画面のファインダー部分を切り抜く）
const PH = 540
function capturePhoto(info) {
  const c = document.createElement('canvas'); c.width = c.height = PH; const x = c.getContext('2d')
  applyCamera(); renderer.render(scene, camera)
  const pr = canvas.width / L.W
  x.drawImage(canvas, L.fx * pr, L.fy * pr, L.fs * pr, L.fs * pr, 0, 0, PH, PH)
  // ブレ（動いている方向に重ねる）
  const b = info.blur
  if (b > 0.04) {
    const src = document.createElement('canvas'); src.width = src.height = PH; src.getContext('2d').drawImage(c, 0, 0)
    const len = b * PH * 0.12, a = info.blurDir ?? 0, n = 9
    x.clearRect(0, 0, PH, PH)
    for (let i = 0; i < n; i++) { const o = (i / (n - 1) - 0.5) * len; x.globalAlpha = 1 / (i + 1); x.drawImage(src, Math.cos(a) * o, Math.sin(a) * o) }
    x.globalAlpha = 1
  }
  // フィルムっぽさ: 暖色・周辺減光・日付
  x.fillStyle = 'rgba(255,190,120,.07)'; x.fillRect(0, 0, PH, PH)
  const g = x.createRadialGradient(PH / 2, PH / 2, PH * 0.3, PH / 2, PH / 2, PH * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,10,0,.42)'); x.fillStyle = g; x.fillRect(0, 0, PH, PH)
  x.font = '900 25px ui-monospace,Menlo,monospace'; x.textAlign = 'right'; x.fillStyle = '#ff9c3a'; x.shadowColor = 'rgba(255,110,20,.9)'; x.shadowBlur = 8; x.fillText(dateStr(), PH - 18, PH - 18); x.shadowBlur = 0
  return c
}
function dateStr() { const d = new Date(); return `'${String(d.getFullYear()).slice(2)} ${d.getMonth() + 1} ${d.getDate()}` }
function shoot() {
  if (S.view !== 'play' || S.phase !== 'play') return false
  if (S.films <= 0 || S.cool > 0) { if (!S.sim) { Snd.sfx('empty'); $('#bShutter').classList.add('cool') } return false }
  applyCamera()
  const info = evalShot()
  // 写真のブレの向き＝主役の頭の、画面上の動き
  const tc = info.cat != null ? CATS[info.cat] : null
  if (tc && tc.hist.length >= 4) { const a = tc.hist[0], b = tc.hist[3]; info.blurDir = Math.atan2(-(b.y - a.y), b.x - a.x) } else info.blurDir = S.lastPanDir || 0
  info.t = +(PLAY_T - S.left).toFixed(2)
  if (!S.sim) info.img = capturePhoto(info)
  S.shots.push(info); S.films--; S.cool = COOL
  // シャッター音に反応して、のんびりしている猫がこっちを見ることがある
  for (const c of CATS) if (c.interruptible && !c.pend && S.rng() < 0.22) c.pend = { act: 'look', at: S.t + 0.3, arg: true }
  if (!S.sim) {
    Snd.sfx('shutter'); setTimeout(() => Snd.sfx('wind'), 60)
    const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on')
    const st = $('#snapTxt'); st.textContent = T('snap'); st.classList.remove('on'); void st.offsetWidth; st.classList.add('on')
    $('#bShutter').classList.add('cool'); updateHud()
    const th = $('#thumb'), tx = th.querySelector('canvas').getContext('2d'); tx.drawImage(info.img, 0, 0, 96, 96); th.classList.remove('on'); void th.offsetWidth; th.classList.add('on')
    if (S.films === 1) setTimeout(() => toast(T('last')), 300)
  }
  if (S.films === 0) S.endT = 0.9
  return info
}

// ---------- 撮影の流れ
function startGame(seed = (Date.now() & 0xffff) + 1, sim = false) {
  S.sim = sim; S.seed = seed; S.view = 'play'; S.phase = sim ? 'play' : 'count'; S.cd = 2.4; S.left = PLAY_T; S.films = FILMS; S.shots = []; S.cool = 0; S.endT = 0
  S.yaw = 0; S.pitch = -19; S.zoom = 1; S.fov = FOV1; S.camSpeed = 0; S.inDX = S.inDY = 0; S.t = 0; S.result = null
  resetCats(seed)
  if (sim) { applyCamera(); return }
  go('vPlay'); Snd.setTrack('play')
  $('#bZoom').classList.remove('on'); $('#lcdZoom').textContent = 'x1'; $('#date').textContent = dateStr(); $('#thumb').classList.remove('on')
  $('#count').hidden = false; $('#count').textContent = '3'; Snd.sfx('beep'); S.lastCount = 3
  const showHint = store.get('hint', '0') !== '1'
  $('#hint').hidden = !showHint; $('#hint').style.opacity = 1; S.hintT = showHint ? 6 : 0
  updateHud(); acc = 0; lastT = performance.now()
}
function endGame() {
  S.phase = 'done'
  const R = buildResult(); S.result = R
  if (S.sim) return R
  Snd.sfx('whistle'); $('#count').hidden = false; $('#count').textContent = T('end'); store.set('hint', '1')
  setTimeout(() => { $('#count').hidden = true; showResult() }, 1100)
  return R
}
function buildResult() {
  const shots = S.shots, total = shots.reduce((a, s) => a + s.score, 0)
  let tier = [...D.TIERS].reverse().find(t => total >= t.min), special = null
  const blurN = shots.filter(s => s.tags.includes('blur')).length, buttN = shots.filter(s => s.tags.includes('butt')).length
  const ti = D.TIERS.indexOf(tier)
  if (!shots.length) special = 'forgot'
  else if (shots.length >= 3 && blurN >= Math.max(3, shots.length - 1) && ti <= 1) special = 'blurry'
  else if (buttN >= 3 && ti <= 2) special = 'butt'
  let best = -1, bs = -1; shots.forEach((s, i) => { if (s.score > bs) { bs = s.score; best = i } })
  return { total, tier: tier.id, special, best, shots: shots.length, miracles: shots.filter(s => s.miracle).length, scores: shots.map(s => s.score), types: shots.map(s => s.type) }
}
function updateHud() {
  $('#tSec').textContent = Math.ceil(Math.max(0, S.left)); $('#timer').classList.toggle('hurry', S.left <= 10)
  $$('#films i').forEach((e, i) => e.classList.toggle('used', i >= S.films))
}
function setZoom(z) {
  S.zoom = z; if (S.sim) return
  Snd.sfx('zoom', z); $('#bZoom').classList.toggle('on', z === 2); $('#lcdZoom').textContent = 'x' + z; $('#zTxt').textContent = z === 2 ? '1x' : '2x'
}

// ---------- 1ステップ（固定60Hz）
let titleTick = 0
function update() {
  S.t += DT
  if (S.view === 'play') {
    // 入力 → 構え
    const fovNow = S.fov, kx = (S.keys.ArrowRight || S.keys.KeyD ? 1 : 0) - (S.keys.ArrowLeft || S.keys.KeyA ? 1 : 0), ky = (S.keys.ArrowUp || S.keys.KeyW ? 1 : 0) - (S.keys.ArrowDown || S.keys.KeyS ? 1 : 0)
    const kspd = fovNow * 1.1 * DT
    const dy0 = S.yaw, dp0 = S.pitch
    S.yaw = clamp(S.yaw + S.inDX + kx * kspd, -YAW_LIM, YAW_LIM); S.pitch = clamp(S.pitch + S.inDY + ky * kspd, PITCH_MIN, PITCH_MAX)
    S.inDX = S.inDY = 0
    const sp = Math.hypot(S.yaw - dy0, S.pitch - dp0) / DT; S.camSpeed = lerp(S.camSpeed, sp, 0.35)
    if (sp > 1) S.lastPanDir = Math.atan2(-(S.pitch - dp0), S.yaw - dy0)
    S.fov = lerp(S.fov, S.zoom === 2 ? FOV2 : FOV1, 0.25)
    applyCamera()
    for (const c of CATS) updateCat(c)
    trackMotion()
    if (S.phase === 'count') {
      S.cd -= DT; const n = Math.ceil(S.cd / 0.8)
      if (!S.sim && n !== S.lastCount && n > 0) { S.lastCount = n; $('#count').textContent = n; Snd.sfx('beep') }
      if (S.cd <= 0) { S.phase = 'play'; if (!S.sim) { $('#count').textContent = T('goTxt'); Snd.sfx('beep', 2); setTimeout(() => { if (S.phase === 'play') $('#count').hidden = true }, 600) } }
    } else if (S.phase === 'play') {
      S.left -= DT; if (S.cool > 0) { S.cool -= DT; if (S.cool <= 0 && !S.sim) $('#bShutter').classList.remove('cool') }
      if (S.endT > 0) { S.endT -= DT; if (S.endT <= 0) return endGame() }
      if (S.left <= 0) { S.left = 0; return endGame() }
      if (!S.sim) {
        if (Math.floor(S.left * 60) % 15 === 0) updateHud()
        if (S.left <= 5 && Math.ceil(S.left) !== S.lastTick) { S.lastTick = Math.ceil(S.left); Snd.sfx('tick', S.lastTick) }
        if (S.hintT > 0) { S.hintT -= DT; if (S.hintT <= 0.5) $('#hint').style.opacity = 0; if (S.hintT <= 0) $('#hint').hidden = true }
      }
    }
    if (!S.sim) {
      // AF枠: 枠の中心に猫の顔があり、ブレていなければ緑
      let lock = false; for (const c of CATS) { if (c.hidden) continue; const p = project(c.hw); if (p && Math.abs(p.x) < 0.2 && Math.abs(p.y) < 0.2 && (c.omega + S.camSpeed) / S.fov < 0.35) lock = true }
      const af = $('#af'); af.classList.toggle('lock', lock); af.classList.toggle('shake', !lock && S.camSpeed > S.fov * 0.6)
    }
  } else if (S.view === 'title' || S.view === 'how') {
    S.titleT += DT; for (const c of CATS) updateCat(c)
  }
  // 箱のゆれ、猫じゃらしのゆれ、くつしたのにおい
  if (BOX.g) { BOX.g.rotation.z = BOX.shake ? Math.sin(S.t * 38) * 0.035 : BOX.g.rotation.z * 0.8; BOX.g.position.x = BOX.x + (BOX.shake ? Math.sin(S.t * 31) * 0.012 : 0) }
  const hit = CATS.some(c => c.toyHit); STOOL.tip.rotation.z = Math.sin(S.t * (hit ? 14 : 1.6)) * (hit ? 0.5 : 0.08); STOOL.fluff.rotation.y += hit ? 0.3 : 0.01
  SOCK.stink.position.y = (S.t * 0.05) % 0.06; SOCK.stink.rotation.y = S.t * 0.8
}

// ---------- 結果
function tierInfo(R) { return R.special ? { ...D.SPECIAL[R.special], id: R.special } : D.TIERS.find(t => t.id === R.tier) }
function tagText(s) {
  const out = []
  if (s.miracle) out.push(['mir', T('miracle')])
  for (const k of s.tags) { if (k === 'early' || k === 'late' || k === 'blur' || k === 'butt' || k === 'cut' || k === 'far' || k === 'none') out.push(['', D.TXT[S.lang].tags[k]]); if (k === 'two' || k === 'double') out.push(['good', D.TXT[S.lang].tags[k]]) }
  return out.slice(0, 3)
}
const momName = t => t ? D.MOM[t][S.lang] : D.TXT[S.lang].tags.none
let revealTimers = []
function showResult() {
  const R = S.result; go('vResult')
  const good = R.total >= 150 && !R.special
  Snd.setTrack(good ? 'win' : 'sad')
  $('#rT').textContent = T('resT')
  const grid = $('#grid'); grid.innerHTML = ''
  for (let i = 0; i < FILMS; i++) {
    const s = S.shots[i], d = document.createElement('div'); d.className = 'ph'; d.style.setProperty('--r', ((i * 37) % 7 - 3) * 0.9 + 'deg')
    d.innerHTML = '<div class="tape"></div>'
    if (s) { d.appendChild(s.img); s.img.style.cssText = ''; const tg = document.createElement('div'); tg.className = 'tag'; tg.innerHTML = tagText(s).map(([c, t]) => `<i class="${c}">${t}</i>`).join(''); d.appendChild(tg) }
    else { const b = document.createElement('div'); b.className = 'blank'; b.textContent = T('unshot'); d.appendChild(b) }
    const cap = document.createElement('div'); cap.className = 'cap'; cap.innerHTML = `<span>${s ? momName(s.type) : '—'}</span><b>${s ? s.score : 0}</b>`; d.appendChild(cap)
    if (i === R.best && R.total > 0) { d.classList.add('best'); d.dataset.best = T('best') }
    grid.appendChild(d)
  }
  const ti = tierInfo(R)
  const tot = document.createElement('div'); tot.className = 'tot'; tot.innerHTML = `<small>${T('total')}</small><b id="rTotal">0</b><div class="stamp" id="rStamp" style="--c:${ti.col}">${ti[S.lang]}</div>`; grid.appendChild(tot)
  $('#editor').classList.remove('on'); $('#edName').textContent = T('editor')
  const ek = R.special || R.tier, list = D.EDITOR[ek][S.lang]
  let line = list[S.seed % list.length]; if (R.miracles && !R.special && R.tier !== 'legend') line = D.EDITOR.miracle[S.lang] + ' ' + line
  $('#edTxt').textContent = line
  $('#edMouth').setAttribute('d', ['legend', 'great', 'good'].includes(R.tier) && !R.special ? 'M20 39q7 7 14 0' : 'M21 43q6 -4 12 0')
  $('#rBtns').style.visibility = 'hidden'; $('#skipHint').textContent = T('skip'); $('#skipHint').hidden = false
  $('#rDev').classList.remove('off'); $('#tDev').textContent = T('dev'); $('#tDevSub').textContent = T('devSub')
  layoutAlbum()
  revealTimers.forEach(clearTimeout); revealTimers = []
  const at = (ms, fn) => revealTimers.push(setTimeout(fn, ms))
  at(1300, () => { $('#rDev').classList.add('off') })
  $$('#grid .ph').forEach((d, i) => at(1600 + i * 520, () => { d.classList.add('on'); Snd.sfx(S.shots[i] ? 'reveal' : 'empty') }))
  const t0 = 1600 + FILMS * 520 + 200
  at(t0, () => { tot.classList.add('on'); countUp($('#rTotal'), R.total, 700) })
  at(t0 + 900, () => finishReveal())
}
function countUp(el, to, ms) { const t0 = performance.now(); const f = () => { const k = Math.min(1, (performance.now() - t0) / ms); el.textContent = Math.round(to * k); if (k < 1) requestAnimationFrame(f); else el.textContent = to }; f() }
function finishReveal() {
  if (S.view !== 'result' || S.revealed) return; S.revealed = true
  revealTimers.forEach(clearTimeout); revealTimers = []
  const R = S.result
  $('#rDev').classList.add('off'); $$('#grid .ph').forEach(d => d.classList.add('on'))
  const tot = $('#grid .tot'); tot.classList.add('on'); $('#rTotal').textContent = R.total
  $('#rStamp').classList.add('on'); Snd.sfx('stamp')
  const good = R.total >= 150 && !R.special
  setTimeout(() => Snd.sfx(good ? 'cheer' : 'boo'), 250)
  $('#editor').classList.add('on'); $('#rBtns').style.visibility = 'visible'; $('#skipHint').hidden = true
}
// ハンコの文字は1行。セルの幅に収まるまで字を小さくする
function fitStamp(ph) {
  const st = $('#rStamp'); if (!st) return
  let fs = 22; st.style.fontSize = fs + 'px'
  while (st.offsetWidth > ph + 8 && fs > 10) { fs--; st.style.fontSize = fs + 'px' }
}
function layoutAlbum() {
  const a = $('#album').getBoundingClientRect(), gap = Math.max(6, Math.min(14, a.width * 0.025)), caph = 24
  // 3列x2段 と 2列x3段 のうち、写真が大きくなる方
  const fit = (cols, rows) => Math.floor(Math.min((a.width - gap * (cols - 1) - 12) / cols, (a.height - 24 - gap * (rows - 1)) / rows - caph + 4))
  const p3 = fit(3, 2), p2 = fit(2, 3), cols = p2 > p3 ? 2 : 3, ph = Math.max(60, Math.min(260, Math.max(p2, p3)))
  const g = $('#grid').style; g.setProperty('--ph', ph + 'px'); g.setProperty('--gap', gap + 'px'); g.setProperty('--caph', caph + 'px'); g.gridTemplateColumns = `repeat(${cols},var(--ph))`
  fitStamp(ph)
}

// ---------- 結果カード画像（1080x1350）
function polaroid(x, img, X, Y, size, rot, cap, score, scoreCol) {
  x.save(); x.translate(X + size / 2, Y + size / 2); x.rotate(rot)
  const pad = size * 0.045, bottom = size * 0.16
  x.shadowColor = 'rgba(70,40,10,.35)'; x.shadowBlur = 18; x.shadowOffsetY = 6
  x.fillStyle = '#fffdf8'; x.fillRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad + bottom); x.shadowColor = 'transparent'
  if (img) x.drawImage(img, -size / 2, -size / 2, size, size); else { x.fillStyle = '#1d1a18'; x.fillRect(-size / 2, -size / 2, size, size); x.fillStyle = '#8c8076'; x.font = `900 ${size * 0.09}px 'M PLUS Rounded 1c',sans-serif`; x.textAlign = 'center'; x.fillText(T('unshot'), 0, size * 0.03) }
  x.fillStyle = 'rgba(255,214,140,.8)'; x.save(); x.rotate(-0.06); x.fillRect(-size * 0.2, -size / 2 - pad - size * 0.04, size * 0.4, size * 0.08); x.restore()
  x.textAlign = 'left'; x.fillStyle = '#2b2320'; x.font = `900 ${Math.round(size * 0.075)}px 'M PLUS Rounded 1c',sans-serif`; x.fillText(cap, -size / 2, size / 2 + bottom * 0.62)
  x.textAlign = 'right'; x.fillStyle = scoreCol; x.font = `900 ${Math.round(size * 0.1)}px ui-monospace,Menlo,monospace`; x.fillText(score, size / 2, size / 2 + bottom * 0.66)
  x.restore()
}
function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath() }
async function makeCard() {
  const R = S.result, c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d')
  try { await document.fonts.ready } catch (e) {}
  const g = x.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, '#f6e9d0'); g.addColorStop(1, '#e4cda5'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350)
  x.fillStyle = 'rgba(150,110,60,.1)'; for (let yy = 8; yy < 1350; yy += 22) for (let xx = (yy / 22 % 2) * 11 + 8; xx < 1080; xx += 22) { x.beginPath(); x.arc(xx, yy, 1.6, 0, 7); x.fill() }
  x.textAlign = 'center'; x.lineJoin = 'round'
  const disp = "'Mochiy Pop One','Hiragino Maru Gothic ProN',sans-serif", body = "'M PLUS Rounded 1c','Hiragino Maru Gothic ProN',sans-serif"
  x.font = `76px ${disp}`; x.lineWidth = 14; x.strokeStyle = '#fff'; const ttl = S.lang === 'ja' ? 'ねこカメラマン' : 'CAT PHOTOGRAPHER'; x.strokeText(ttl, 540, 112); x.fillStyle = '#2b2320'; x.fillText(ttl, 540, 112)
  x.font = `900 26px ${body}`; x.fillStyle = '#b9541a'; x.fillText(S.lang === 'ja' ? `フィルム5枚・60秒の撮影結果  ${dateStr()}` : `5 shots in 60 seconds  ${dateStr()}`, 540, 156)
  const order = [R.best, ...S.shots.map((_, i) => i).filter(i => i !== R.best)].filter(i => i >= 0)
  while (order.length < FILMS) order.push(-1)
  const capOf = i => { const s = S.shots[i]; return s ? momName(s.type) + (s.tags.includes('blur') ? ` (${D.TXT[S.lang].tags.blur})` : '') : '' }
  const bi = order[0]; polaroid(x, S.shots[bi]?.img, 80, 232, 560, -0.025, bi >= 0 ? capOf(bi) : '', bi >= 0 ? S.shots[bi].score : 0, '#b9541a')
  if (bi >= 0 && S.shots[bi].miracle) { x.save(); x.translate(590, 262); x.rotate(0.18); x.fillStyle = '#ff5f8f'; roundRect(x, -110, -30, 220, 60, 16); x.fill(); x.fillStyle = '#fff'; x.font = `34px ${disp}`; x.fillText(T('miracle'), 0, 12); x.restore() }
  // 右の柱: 合計と称号のハンコ
  const ti = tierInfo(R)
  x.fillStyle = '#7a6a5c'; x.font = `900 30px ${body}`; x.fillText(T('total'), 870, 280)
  x.fillStyle = '#2b2320'; x.font = `900 130px ui-monospace,Menlo,monospace`; x.fillText(R.total, 870, 410)
  x.save(); x.translate(870, 600); x.rotate(-0.16); x.strokeStyle = x.fillStyle = ti.col; x.lineWidth = 9
  const words = ti[S.lang]; let fs = 54; x.font = `${fs}px ${disp}`
  const lines = S.lang === 'ja' ? (words.length > 6 ? [words.slice(0, Math.ceil(words.length / 2)), words.slice(Math.ceil(words.length / 2))] : [words]) : words.split(' ').reduce((a, w) => { if (a.length && (a[a.length - 1] + ' ' + w).length <= 10) a[a.length - 1] += ' ' + w; else a.push(w); return a }, [])
  while (Math.max(...lines.map(l => x.measureText(l).width)) > 300 && fs > 30) { fs -= 2; x.font = `${fs}px ${disp}` }
  const bw = Math.max(...lines.map(l => x.measureText(l).width)) + 50, bh = lines.length * fs * 1.2 + 34
  x.fillStyle = 'rgba(255,253,248,.85)'; roundRect(x, -bw / 2, -bh / 2, bw, bh, 18); x.fill(); x.stroke()
  x.fillStyle = ti.col; lines.forEach((l, i) => x.fillText(l, 0, -bh / 2 + 17 + fs * 0.98 + i * fs * 1.2)); x.restore()
  // 下の段: 残り4枚
  for (let k = 1; k < FILMS; k++) { const i = order[k], s = S.shots[i]; polaroid(x, s?.img, 70 + (k - 1) * 250, 905, 210, ((k * 37) % 5 - 2) * 0.015, i >= 0 ? capOf(i) : '', s ? s.score : 0, '#b9541a') }
  // 編集長の一言
  x.save(); x.fillStyle = '#fff'; x.strokeStyle = '#2b2320'; x.lineWidth = 5; roundRect(x, 170, 1185, 850, 100, 22); x.fill(); x.stroke()
  x.beginPath(); x.arc(110, 1235, 46, 0, 7); x.fillStyle = '#ffe2c4'; x.fill(); x.stroke()
  x.fillStyle = '#3b2b26'; x.beginPath(); x.arc(110, 1225, 40, Math.PI * 1.05, Math.PI * 1.95); x.fill()
  x.fillStyle = '#fff'; for (const ex of [94, 126]) { x.beginPath(); x.arc(ex, 1240, 10, 0, 7); x.fill(); x.stroke() }
  x.fillStyle = '#2b2320'; for (const ex of [94, 126]) { x.beginPath(); x.arc(ex, 1241, 3.5, 0, 7); x.fill() }
  x.textAlign = 'left'; x.fillStyle = '#b9541a'; x.font = `900 20px ${body}`; x.fillText(T('editor'), 196, 1218)
  x.fillStyle = '#2b2320'; let ef = 30; x.font = `900 ${ef}px ${body}`; const et = $('#edTxt').textContent
  while (x.measureText(et).width > 800 && ef > 18) { ef -= 1; x.font = `900 ${ef}px ${body}` }
  x.fillText(et, 196, 1262); x.restore()
  x.textAlign = 'center'; x.fillStyle = '#7a6a5c'; x.font = `900 24px ${body}`; x.fillText(T('cardFoot'), 540, 1328)
  return c
}
async function saveImage() {
  const c = await makeCard(), blob = await new Promise(r => c.toBlob(r, 'image/png'))
  const file = new File([blob], 'cat-photo.png', { type: 'image/png' })
  try { if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: T('title1') + T('title2') }); return blob } } catch (e) { if (e && e.name === 'AbortError') return blob }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cat-photo.png'; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(T('saved')); return blob
}
function toast(s) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = s; document.body.appendChild(d); setTimeout(() => d.remove(), 1600) }

// ---------- 画面と言語
function go(id) {
  for (const v of ['vTitle', 'vHow', 'vPlay', 'vResult']) $('#' + v).hidden = v !== id
  S.view = { vTitle: 'title', vHow: 'how', vPlay: 'play', vResult: 'result' }[id]
  S.revealed = false
  if (id === 'vTitle' || id === 'vHow') { Snd.setTrack('title'); if (S.phase !== 'title') { resetCats(7); S.phase = 'title' } }
  if (id === 'vResult') layoutAlbum()
}
function applyLang() {
  document.documentElement.lang = S.lang
  $('#langTxt').textContent = T('lang'); $('#tl1').textContent = T('title1'); $('#tl2').textContent = T('title2'); $('#tSub').innerHTML = T('sub')
  $('#tStart').textContent = T('start'); $('#tHow').textContent = T('how'); $('#hT').textContent = T('howT'); $('#tBack').textContent = T('back'); $('#tGo').textContent = T('go')
  const dev = isTouch ? 'sp' : 'pc'
  $('#h1t').textContent = T('h1t'); $('#h1').textContent = T('h1' + dev); $('#h2t').textContent = T('h2t'); $('#h2').textContent = T('h2' + dev)
  $('#h3t').textContent = T('h3t'); $('#h3').textContent = T('h3'); $('#h4t').textContent = T('h4t'); $('#h4').textContent = T('h4' + dev); $('#hRule').textContent = T('scoreRule')
  $('#tTime').textContent = T('time'); $('#tFilm').textContent = T('film'); $('#tHint').textContent = T('hint')
  $('#tAgain').textContent = T('again'); $('#tSave').textContent = T('save'); $('#tTitle').textContent = T('toTitle')
  $('#catChips').innerHTML = D.CATS.map(c => `<span><i style="background:${c.pat === 'calico' ? `linear-gradient(90deg,${c.light} 33%,${c.base} 33% 66%,${c.dark} 66%)` : c.pat === 'tux' ? `linear-gradient(${c.base} 50%,${c.light} 50%)` : c.base}"></i>${c[S.lang]}</span>`).join('')
  document.title = S.lang === 'ja' ? 'ねこカメラマン｜一番かわいい瞬間を撮れ' : 'CAT PHOTOGRAPHER | Catch the cutest moment'
  if (S.view === 'result' && S.result) { const keep = S.revealed; showResult(); if (keep) finishReveal() }
}

// ---------- 入力
let drag = null
canvas.addEventListener('pointerdown', e => { if (S.view !== 'play') return; Snd.init(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId) } catch (er) {} })
canvas.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId) return
  const k = S.fov / L.fs
  S.inDX += (e.clientX - drag.x) * k; S.inDY -= (e.clientY - drag.y) * k; drag.x = e.clientX; drag.y = e.clientY
})
const endDrag = e => { if (drag && drag.id === e.pointerId) drag = null }
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag)
window.addEventListener('keydown', e => {
  if (S.view === 'play') {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) { Snd.init(); shoot() } return }
    if (e.code === 'KeyZ' && !e.repeat) { setZoom(S.zoom === 2 ? 1 : 2); return }
    if (/^(Arrow|Key[WASD])/.test(e.code)) { S.keys[e.code] = true; e.preventDefault() }
  }
})
window.addEventListener('keyup', e => { S.keys[e.code] = false })
window.addEventListener('blur', () => { S.keys = {}; drag = null })

// ---------- ループ
let acc = 0, lastT = performance.now(), frames = 0, fpsT = performance.now(), fps = 0
function loop() {
  const now = performance.now(); let dt = (now - lastT) / 1000; lastT = now; if (dt > 0.25) dt = 0.25
  if (!S.paused && !S.sim) { acc += dt; let n = 0; while (acc >= DT && n < 8) { update(); acc -= DT; n++ } if (n >= 8) acc = 0 }
  if (S.view !== 'result') { applyCamera(); renderer.render(scene, camera) }
  Snd.tick()
  frames++; if (now - fpsT > 1000) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now }
  requestAnimationFrame(loop)
}

// ---------- 台本のボット（難しさの測定用。画面は使わずに1ゲームを回す）
function runBot(kind, seed, visual = false) {
  const R0 = mulberry(seed * 7919 + 13), B = { seed, tgt: null, notice: 0, noise: [0, 0], next: 6 + R0() * 4, lastShotT: -9 }
  const prof = { good: { vmax: 150, react: 0.22, err: 1.2, minV: 55 }, normal: { vmax: 95, react: 0.4, err: 3.5, minV: 40 }, sloppy: { vmax: 70, react: 0, err: 8, minV: 0 } }[kind]
  const prev = S.view
  if (visual) { startGame(seed); S.paused = true; S.phase = 'play'; $('#count').hidden = true } else startGame(seed, true)
  let guard = 0
  while (S.phase !== 'done' && guard++ < 6000) {
    if (kind !== 'none' && S.phase === 'play') botThink(kind, prof, B, R0)
    update()
  }
  const R = S.result; S.sim = false
  if (visual) { S.paused = false; return R }
  if (prev !== 'play') { S.phase = 'none'; go({ title: 'vTitle', how: 'vHow', result: 'vResult' }[prev] || 'vTitle') }
  return { kind, seed, total: R.total, tier: R.special || R.tier, shots: R.shots, scores: R.scores, types: R.types, miracles: R.miracles }
}
function aimAngles(c) { const d = c.hw.clone().sub(CAM_POS); return { yaw: Math.atan2(d.x, -d.z) / DEG, pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) / DEG } }
function botThink(kind, P, B, R0) {
  const remain = S.left, filmsLeft = S.films
  // 狙う猫を決める
  const cand = CATS.map(c => {
    if (c.hidden || !c.mom) return null; const M = D.MOM[c.mom.type]; if (!M) return null
    let pri = 0
    if (kind === 'good') { if (!M.hold && (c.mom.ph === 'omen' || c.mom.ph === 'peak') && M.v >= P.minV * (remain < 25 ? 0.7 : 1)) pri = M.v; else if (M.hold && remain < filmsLeft * 7) pri = M.v * 0.5 }
    else if (kind === 'normal') { const read = c.mom.ph === 'peak' || mulberry(c.momSeq * 131 + c.i * 17 + B.seed)() < 0.35; if (!M.hold && c.mom.ph !== 'after' && read && M.v >= P.minV) pri = M.v * 0.8; else if (remain < filmsLeft * 8) pri = M.v * 0.4 }
    else if (kind === 'sloppy') pri = 1 + R0()
    return pri > 0 ? { c, pri } : null
  }).filter(Boolean).sort((a, b) => b.pri - a.pri)
  if (cand.length && (!B.tgt || cand[0].c !== B.tgt && cand[0].pri > B.pri + 10 || !cand.some(e => e.c === B.tgt))) { B.tgt = cand[0].c; B.pri = cand[0].pri; B.notice = S.t + P.react * (0.6 + R0() * 0.8); B.noise = [(R0() - 0.5) * 2 * P.err, (R0() - 0.5) * 2 * P.err] }
  const c = B.tgt; if (!c) return
  if (S.t < B.notice) return
  // 構えを向ける（最高速度あり）
  const a = aimAngles(c), ty = a.yaw + B.noise[0], tp = a.pitch + B.noise[1]
  const dist = c.hw.distanceTo(CAM_POS)
  if (kind === 'good' || kind === 'normal') { const z = dist > (kind === 'good' ? 2.4 : 3.6) ? 2 : 1; if (S.zoom !== z) setZoom(z) }
  const ey = ty - S.yaw, ep = tp - S.pitch, e = Math.hypot(ey, ep), step = P.vmax * DT
  const k = e > step ? step / e : 1; S.inDX += ey * k * (e > 4 ? 1 : 0.5); S.inDY += ep * k * (e > 4 ? 1 : 0.5)
  if (S.cool > 0) return
  const m = c.mom, M = D.MOM[m.type]
  if (kind === 'good') {
    const ready = e < 2.5 && S.camSpeed < 6
    if (ready && ((!M.hold && m.ph === 'peak' && m.k > 0.2 + R0() * 0.12) || (M.hold && remain < filmsLeft * 7))) { shoot(); B.tgt = null }
  } else if (kind === 'normal') {
    // 前ぶれは読めない。ピークが始まったのを見てから押す（人の反応の遅れつき）
    if (m.ph === 'peak' && B.peakOf !== c) { B.peakOf = c; B.peakAt = S.t + 0.22 + R0() * 0.2 }
    const ok = (m.ph === 'peak' && S.t >= B.peakAt) || m.ph === 'after' || (M.hold && remain < filmsLeft * 8)
    if (e < 4 && S.camSpeed < 8 && ok) { shoot(); B.tgt = null; B.peakOf = null }
  } else if (kind === 'sloppy') {
    if (S.t > B.next) { shoot(); B.next = S.t + 7 + R0() * 6; B.tgt = null }
  }
}

// ---------- 起動
function boot() {
  try { Snd.muted = S.muted; $('#icOn').hidden = S.muted; $('#icOff').hidden = !S.muted } catch (e) {}
  applyLang(); layout()
  const on = (id, fn) => $(id).addEventListener('click', e => { Snd.init(); fn(e) })
  on('#bStart', () => { Snd.sfx('tap'); if (store.get('how', '0') !== '1') { go('vHow'); store.set('how', '1') } else startGame() })
  on('#bHow', () => { Snd.sfx('tap'); go('vHow') })
  on('#bHowBack', () => { Snd.sfx('tap'); go('vTitle') })
  on('#bHowGo', () => { Snd.sfx('tap'); startGame() })
  on('#bShutter', () => shoot())
  on('#bZoom', () => { if (S.view === 'play') setZoom(S.zoom === 2 ? 1 : 2) })
  on('#bAgain', () => { Snd.sfx('tap'); startGame() })
  on('#bSave', () => saveImage())
  on('#bTitle', () => { Snd.sfx('tap'); go('vTitle') })
  on('#album', () => finishReveal())
  on('#bLang', () => { S.lang = S.lang === 'ja' ? 'en' : 'ja'; store.set('lang', S.lang); applyLang() })
  on('#bMute', () => { Snd.setMute(!Snd.muted); S.muted = Snd.muted; $('#icOn').hidden = Snd.muted; $('#icOff').hidden = !Snd.muted; store.set('mute', Snd.muted ? '1' : '0') })
  window.addEventListener('resize', layout)
  document.addEventListener('visibilitychange', () => { lastT = performance.now(); acc = 0 })
  S.phase = 'none'; go('vTitle')
  requestAnimationFrame(loop)
  window.__ncReady = true
}

// 検証用の窓口
window.nc = {
  S, CATS, L, D, Snd, startGame, shoot, evalShot, endGame, layout, finishReveal, makeCard, saveImage, runBot, setZoom, applyCamera,
  fps: () => fps,
  snap: () => capturePhoto({ blur: 0 }).toDataURL('image/jpeg', 0.85),
  screenOf(i) { applyCamera(); const v = CATS[i].head.getWorldPosition(new THREE.Vector3()).project(camera); return [(v.x * 0.5 + 0.5) * L.W, (-v.y * 0.5 + 0.5) * L.H] },
  setCam(yaw, pitch, zoom) { S.yaw = yaw; S.pitch = pitch; if (zoom) { S.zoom = zoom; S.fov = zoom === 2 ? FOV2 : FOV1 } S.camSpeed = 0; applyCamera() },
  aimAt(i, zoom) { applyCamera(); trackMotion(); const a = aimAngles(CATS[i]); this.setCam(clamp(a.yaw, -YAW_LIM, YAW_LIM), clamp(a.pitch, PITCH_MIN, PITCH_MAX), zoom) },
  // 猫に行動をさせる（台本で撮るため）
  force(i, act, arg) { const c = CATS[i]; if (c.spot) { busy[c.spot] = null; c.spot = null } c.y = c.inBox ? 0 : c.y; c.inBox = false; c.hidden = false; c.mom = null; startAct(c, act, arg) },
  place(i, x, z, h) { const c = CATS[i]; if (c.spot) { busy[c.spot] = null; c.spot = null } Object.assign(c, { x, z, y: 0, floorY: 0, h: h ?? camHeading(c), inBox: false, hidden: false }); applyPose(c, S.t) },
  stepUntil(fn, max = 1200) { for (let i = 0; i < max; i++) { if (fn()) return i; update() } return -1 },
  dbg: { pause: v => { S.paused = v }, step: n => { for (let i = 0; i < n; i++) update() }, render: () => { applyCamera(); renderer.render(scene, camera) } },
}
boot()
