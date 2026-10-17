/* ===========================================================
   VESSEL — interactions
   - Lenis 부드러운 스크롤
   - three.js 유리 오브젝트 (DOM 앵커 위치에 맞춰 그려짐)
   - 스크롤 고정 섹션 / 드럼 리스트 / 포스터 전환 / 가로 갤러리
   =========================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const isTouch = matchMedia('(hover: none)').matches;

let W = innerWidth, H = innerHeight;

/* 고정(sticky) 섹션 진행도 0 → 1 */
function progress(el) {
  const r = el.getBoundingClientRect();
  return clamp(-r.top / (r.height - H));
}

/* ---------------- 텍스트 분리 ---------------- */
$$('[data-split]').forEach(el => {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map((c, i) =>
    `<span class="char" style="--i:${i}"><span>${c === ' ' ? '&nbsp;' : c}</span></span>`).join('');
});
$$('[data-swap]').forEach(el => {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map(c => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
});
$$('[data-words]').forEach(el => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
});

/* ---------------- 화면 진입 감지 ---------------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    if (e.target.dataset.count !== undefined) countUp(e.target);
    io.unobserve(e.target);
  });
}, { threshold: .25 });
$$('[data-inview], [data-count]').forEach(el => io.observe(el));

function countUp(el) {
  const to = +el.dataset.count, t0 = performance.now();
  (function step(now) {
    const k = clamp((now - t0) / 1400);
    el.textContent = Math.round(easeOut(k) * to);
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

/* ---------------- 부드러운 스크롤 ---------------- */
const lenis = new Lenis({ lerp: .075, wheelMultiplier: .95, touchMultiplier: 1.4 });
lenis.stop();
let velocity = 0;
lenis.on('scroll', e => { velocity = e.velocity; });

$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault();
  lenis.scrollTo(id === '#top' ? 0 : id, { duration: 1.8 });
}));

/* ---------------- 로더 ---------------- */
let introStart = -1;
const loaderCount = $('.loader__count'), loaderBar = $('.loader__bar');
let loadShown = 0, pageReady = false;
const loadStart = performance.now();
const LOAD_MS = 3200;   // 로딩 최소 시간 (유리 5개가 차례로 돌아가는 시간)
const windowLoaded = document.readyState === 'complete'
  ? Promise.resolve()
  : new Promise(r => addEventListener('load', r, { once: true }));
Promise.all([document.fonts.ready, windowLoaded]).then(() => { pageReady = true; });

let readyAt = 0;
(function tickLoader(now) {
  // 시간 기준: 최소 1.4초, 준비되면 0.5초 안에 100까지
  const base = Math.min(90, (now - loadStart) / LOAD_MS * 90);
  if (pageReady && !readyAt) readyAt = now;
  const fin = readyAt ? clamp((now - Math.max(readyAt, loadStart + LOAD_MS)) / 500) : 0;
  loadShown = base + (100 - base) * easeOut(fin);
  if (fin >= 1) loadShown = 100;
  loaderCount.textContent = Math.floor(loadShown);
  loaderBar.style.width = loadShown + '%';
  if (loadShown < 100) requestAnimationFrame(tickLoader);
  else setTimeout(() => {
    document.body.classList.add('is-loaded');
    document.body.classList.remove('is-loading');
    introStart = performance.now();
    lenis.start();
    setTimeout(() => { loaderAlive = false; lRenderer.dispose(); $('.loader__gl').remove(); }, 1500);
  }, 250);
})(loadStart);

/* ---------------- 커서 ---------------- */
const cursor = $('.cursor'), cursorLabel = $('.cursor__label');
let mouseX = W / 2, mouseY = H / 2, curX = mouseX, curY = mouseY;
addEventListener('pointermove', e => { mouseX = e.clientX; mouseY = e.clientY; });
$$('[data-cursor]').forEach(el => {
  el.addEventListener('mouseenter', () => { cursorLabel.textContent = el.dataset.cursor; cursor.classList.add('has-label'); });
  el.addEventListener('mouseleave', () => cursor.classList.remove('has-label'));
});
$$('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('is-link'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('is-link'));
});

/* 자석 버튼 */
$$('.magnetic').forEach(el => {
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${dx * .3}px, ${dy * .4}px)`;
  });
  el.addEventListener('pointerleave', () => {
    el.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)';
    el.style.transform = '';
    setTimeout(() => (el.style.transition = ''), 600);
  });
});

/* ---------------- 라이트박스 ---------------- */
const cards = $$('.gcard');
const lb = $('.lightbox'), lbImg = $('.lightbox__img');
let lbIndex = 0;
function openLightbox(i) {
  lbIndex = (i + cards.length) % cards.length;
  const c = cards[lbIndex];
  lbImg.src = c.dataset.src;
  lbImg.alt = c.dataset.title;
  $('.lightbox__title').textContent = c.dataset.title;
  $('.lightbox__sub').textContent = c.dataset.sub;
  lb.classList.add('is-open');
  lb.setAttribute('aria-hidden', 'false');
  cursor.classList.remove('has-label');
  lenis.stop();
}
function closeLightbox() {
  lb.classList.remove('is-open');
  lb.setAttribute('aria-hidden', 'true');
  lenis.start();
}
cards.forEach((c, i) => c.addEventListener('click', () => openLightbox(i)));
$('.lightbox__close').addEventListener('click', closeLightbox);
$('.lightbox__prev').addEventListener('click', () => openLightbox(lbIndex - 1));
$('.lightbox__next').addEventListener('click', () => openLightbox(lbIndex + 1));
lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
addEventListener('keydown', e => {
  if (!lb.classList.contains('is-open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') openLightbox(lbIndex - 1);
  if (e.key === 'ArrowRight') openLightbox(lbIndex + 1);
});

/* ---------------- 01→02 STAGE ---------------- */
const stage = $('.stage');
const outChars = $$('[data-swap="out"] .ch');
const inLines = $$('[data-swap="in"]').map(l => ({ d: +(l.dataset.delay || 0), chars: $$('.ch', l) }));
const metaOut = $$('[data-swap-block="out"] .mask > span');
const metaIn = $$('[data-swap-block="in"] .mask > span');
const fog = $('.stage__fog');
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/* 진행도 p 에서 a 부터 d 동안 0→1 */
const seg = (p, a, d) => clamp((p - a) / d);

/* ---------------- 04 WE HOLD ---------------- */
const weSec = $('.wehold'), weAnchor = $('.wehold__anchor');

/* ---------------- 05 COLLECTION 드럼 ---------------- */
const colSec = $('.collection'), drum = $('.drum'), drumList = $('.drum__list');
const drumItems = $$('.drum__item');
let drumPos = 0, drumActive = -1, itemH = 100;
function measureDrum() { itemH = drumItems[0].offsetHeight; }
drumItems.forEach((it, i) => it.addEventListener('click', () => openLightbox(i)));

function setCollection(i) {
  drumActive = i;
}

/* ---------------- 06 POSTERS ---------------- */
const pItems = $$('.pitem'), pImgs = $$('.frame__img'), preview = $('.preview');
let pActive = 0, pZ = 10, pToken = 0;
let pvX = W * .6, pvY = H / 2, pvR = 0;
function setPoster(i) {
  if (i === pActive) return;
  const prev = pActive;
  pActive = i;
  const img = pImgs[i];
  img.classList.add('no-anim');
  img.classList.remove('is-shown');
  img.style.zIndex = ++pZ;
  void img.offsetWidth;
  img.classList.remove('no-anim');
  img.classList.add('is-shown');
  const token = ++pToken;
  setTimeout(() => {
    if (token !== pToken) return;
    pImgs.forEach((im, j) => { if (j !== pActive) { im.classList.add('no-anim'); im.classList.remove('is-shown'); } });
    requestAnimationFrame(() => pImgs.forEach(im => im.classList.remove('no-anim')));
  }, 1200);
  return prev;
}
pItems.forEach((it, i) => {
  it.addEventListener('mouseenter', () => { setPoster(i); preview.classList.add('is-on'); });
  it.addEventListener('click', () => openLightbox(i));
});
$('.posters__list').addEventListener('mouseleave', () => preview.classList.remove('is-on'));

/* ---------------- 07 GALLERY ---------------- */
const gal = $('.gallery'), track = $('.gallery__track'), galBar = $('.gallery__progress span');
const galImgs = $$('.gcard__img img');
let galDist = 0;
function sizeGallery() {
  galDist = Math.max(0, track.scrollWidth - W);
  gal.style.height = (H + galDist) + 'px';
}

/* ---------------- 08 MARQUEE ---------------- */
const mq = $('.marquee__inner');
let mqX = 0, mqDir = -1;

/* ===========================================================
   WebGL — 유리 셰이더
   흰 바탕에서는 검은 테두리 + 흰 하이라이트(이미지1 느낌),
   어두운 바탕에서는 밝은 테두리로 반전됩니다.
   =========================================================== */
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = /* glsl */`
uniform float uTime; uniform float uWobble; uniform float uSeed;
varying vec3 vN;
${NOISE}
vec3 displace(vec3 p){
  float n = snoise(p * .55 + vec3(uSeed, uSeed * .5, uTime * .14));
  n += .16 * snoise(p * 1.15 - vec3(uTime * .09, uSeed, 0.));
  return p + normalize(p) * n * uWobble;
}
void main(){
  vec3 p = position; vec3 n = normal;
  if (uWobble > 0.0) {
    vec3 t = normalize(cross(n, vec3(0.0, 1.0, 0.01)));
    vec3 b = cross(n, t);
    vec3 d0 = displace(p);
    vec3 d1 = displace(p + t * .01);
    vec3 d2 = displace(p + b * .01);
    n = normalize(cross(d1 - d0, d2 - d0));
    p = d0;
  }
  vN = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */`
uniform vec3 uInk; uniform vec3 uPaper;
uniform float uOpacity; uniform float uDarkEnv; uniform float uRim; uniform float uIri;
varying vec3 vN;
/* 가상의 스튜디오 조명: 위쪽 소프트박스 + 좌우 세로 스트립 + 가는 반사선 */
float softbox(vec3 r){
  float e = smoothstep(.62, .98, r.y) * .9;
  e += smoothstep(.86, .985, r.x) * smoothstep(-.6, .4, r.y);
  e += smoothstep(.93, .995, -r.x) * .55;
  e += smoothstep(.988, .999, dot(r, normalize(vec3(.55, .72, .42)))) * .9;
  return e;
}
/* 수평선/바닥에 비친 어두운 반사 */
float darkband(vec3 r){
  float d = smoothstep(.3, .0, abs(r.y + .12));
  d += smoothstep(-.35, -.85, r.y) * .45;
  return clamp(d, 0., 1.);
}
void main(){
  vec3 n = normalize(vN);
  float face = gl_FrontFacing ? 1. : .5;           // 뒷면은 옅게 → 깊이감
  if (!gl_FrontFacing) n = -n;
  float ndv = clamp(abs(n.z), 0., 1.);
  float fres = pow(1. - ndv, 2.4);
  vec3 r = reflect(vec3(0., 0., -1.), n);

  // 거의 옆에서 보이는 바닥/받침 같은 수평면은 테두리를 약하게 (검은 원판 방지)
  float horiz = smoothstep(.8, .985, abs(n.y));
  float rim = pow(smoothstep(.32, 1., 1. - ndv), 1.4) * uRim * (1. - horiz * .8);
  float dk = darkband(r) * uDarkEnv * (.25 + .75 * fres);
  float ink = clamp((rim * .95 + dk * .6 * (1. - horiz * .7) + fres * .1) * face, 0., 1.);
  vec3 col = mix(uPaper, uInk, ink);

  // 얇은 막 간섭색 (아주 약하게)
  vec3 iri = mix(vec3(.78, .88, 1.), vec3(1., .86, .98), smoothstep(.25, .85, fres));
  float iriK = uIri * smoothstep(.08, .55, fres) * (1. - ink * .7) * (1. - horiz);
  col = mix(col, col * iri * 1.25, iriK);

  float hi = clamp(softbox(r), 0., 1.);
  col = mix(col, vec3(1.), hi * (.4 + .6 * fres));
  float a = clamp(.025 + ink + hi * fres * .7 + iriK * .35, 0., 1.) * uOpacity;
  gl_FragColor = vec4(col, a);
}`;

const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
// 픽셀 단위 정사영 카메라 → DOM 좌표와 1:1로 맞춤
const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -5000, 5000);
camera.position.z = 1000;

const materials = [];
function glass({ wobble = 0, seed = 0, dark = false, darkEnv = .9, rim = 1, iri } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uWobble: { value: wobble }, uSeed: { value: seed },
      uInk: { value: new THREE.Color(dark ? 0xe6e6e8 : 0x0a0a0a) },
      uPaper: { value: new THREE.Color(dark ? 0x1d1d1f : 0xffffff) },
      uOpacity: { value: 1 }, uDarkEnv: { value: dark ? .2 : darkEnv }, uRim: { value: rim },
      uIri: { value: iri ?? (dark ? .3 : .35) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  materials.push(m);
  return m;
}

/* ---- 유리 형태 ----
   바깥 단면 → 입구의 둥근 테두리 → 안쪽 단면(두께만큼 안으로) 순서로 이어
   두께가 있는 진짜 유리처럼 만든 뒤 회전(Lathe)시킵니다. */
const V2 = (x, y) => new THREE.Vector2(x, y);
function vessel(wall, { base, t = .035, from = -Infinity, floor = .06, smooth = true }) {
  const w = wall.map(([x, y]) => V2(x, y));
  const outer = [V2(0, base), ...(smooth ? new THREE.SplineCurve(w).getPoints(140) : w)];
  const floorY = (from === -Infinity ? base : from) + floor;
  const inner = [];
  for (let i = 1; i < outer.length; i++) {
    const p = outer[i];
    if (p.y < from) continue;
    const a = outer[Math.max(1, i - 1)], b = outer[Math.min(outer.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    inner.push(V2(Math.max(0, p.x - ty / l * t), Math.max(floorY, p.y + tx / l * t)));
  }
  const O = outer[outer.length - 1], I = inner[inner.length - 1];
  const C = V2((O.x + I.x) / 2, (O.y + I.y) / 2), rad = O.distanceTo(I) / 2;
  const a0 = Math.atan2(O.y - C.y, O.x - C.x);
  const lip = [];
  for (let k = 1; k < 8; k++) {
    const an = a0 + Math.PI * k / 8;
    lip.push(V2(C.x + Math.cos(an) * rad, C.y + Math.sin(an) * rad));
  }
  const pts = [...outer, ...lip, ...inner.reverse(), V2(0, floorY)];
  return new THREE.LatheGeometry(pts, 160);
}
const GEO = {
  vase: vessel([[.34, -1], [.48, -.93], [.6, -.72], [.62, -.5], [.55, -.27], [.38, -.05], [.22, .18], [.16, .45], [.155, .7], [.19, .9], [.25, 1]], { base: -1, t: .03, floor: .07 }),
  wine: vessel([[.44, -1], [.42, -.98], [.14, -.94], [.045, -.88], [.032, -.55], [.034, -.2], [.07, -.11], [.25, -.03], [.42, .18], [.47, .46], [.45, .76], [.39, 1]], { base: -1, t: .022, from: -.06, floor: .05 }),
  tumbler: vessel([[.355, -1], [.38, -.985], [.385, -.9], [.52, 1]], { base: -1, t: .035, floor: .16, smooth: false }),
  fishbowl: (() => {
    const wall = [];
    for (let k = 0; k <= 60; k++) {
      const th = -0.95 + 1.9 * k / 60;
      wall.push([Math.cos(th) * .96, Math.sin(th) * .82]);
    }
    wall.push([.6, .7], [.6, .72]);
    return vessel(wall, { base: -.67, t: .03, floor: .05, smooth: false });
  })(),
};
function perfume(mat) {
  const g = new THREE.Group();
  const add = (geo, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); };
  add(new RoundedBoxGeometry(1.36, 1.28, .72, 8, .16), -.3);        // 몸체
  add(new RoundedBoxGeometry(1.14, 1.02, .5, 8, .12), -.25);        // 안쪽 공간 (두꺼운 유리벽)
  add(new THREE.CylinderGeometry(.21, .21, .2, 64, 1, true), .44);  // 목
  add(new THREE.CylinderGeometry(.15, .15, .2, 64, 1, true), .44);
  add(new RoundedBoxGeometry(.66, .42, .44, 6, .1), .75);           // 마개
  return g;
}
const SHAPES = ['vase', 'perfume', 'wine', 'tumbler', 'fishbowl'];
const SHAPE_SCALE = { vase: 1, perfume: .9, wine: 1, tumbler: .9, fishbowl: .82 };
function makeVessel(name, mat, parent = scene) {
  const o = name === 'perfume' ? perfume(mat) : new THREE.Mesh(GEO[name], mat);
  const holder = new THREE.Group();
  holder.add(o);
  holder.userData.k = SHAPE_SCALE[name];
  holder.userData.mat = mat;
  parent.add(holder);
  return holder;
}

/* ---- 장면 구성 ---- */
const blobGeo = new THREE.IcosahedronGeometry(1, 48);
const heroBlob = new THREE.Mesh(blobGeo, glass({ wobble: .16, seed: 1.3 }));
const holdsB = new THREE.Mesh(blobGeo, glass({ wobble: .18, seed: 7.7 }));
scene.add(heroBlob, holdsB);

const weVase = makeVessel('vase', glass({ darkEnv: .35 }));
const colVessels = SHAPES.map(s => {
  const v = makeVessel(s, glass({ dark: true }));
  v.userData.vis = 0;
  return v;
});

/* 로딩 화면: 다섯 개의 유리가 하나씩 돌며 나타남 */
const lRenderer = new THREE.WebGLRenderer({ canvas: $('.loader__gl'), antialias: true, alpha: true });
lRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const lScene = new THREE.Scene();
const lVessels = SHAPES.map(s => {
  const v = makeVessel(s, glass({ darkEnv: .35 }), lScene);
  v.userData.vis = 0;
  return v;
});
let loaderAlive = true;

const anchors = Object.fromEntries($$('[data-gl]').map(el => [el.dataset.gl, el]));

/* DOM 앵커의 화면 위치/크기에 오브젝트를 맞춤 */
function place(obj, el, { size = 'h', mul = 1, dy = 0 } = {}) {
  const r = el.getBoundingClientRect();
  const on = r.bottom > -H * .4 && r.top < H * 1.4;
  obj.visible = on;
  if (!on) return r;
  obj.position.set(r.left + r.width / 2 - W / 2, -(r.top + r.height / 2 - H / 2) + dy, 0);
  obj.scale.setScalar((size === 'h' ? r.height : r.width) / 2 * mul * (obj.userData.k || 1));
  return r;
}
const inView = el => { const r = el.getBoundingClientRect(); return r.bottom > -50 && r.top < H + 50; };

/* ---------------- 리사이즈 ---------------- */
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H);
  if (loaderAlive) lRenderer.setSize(W, H);
  camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2;
  camera.updateProjectionMatrix();
  measureDrum();
  sizeGallery();
}
addEventListener('resize', resize);
resize();
setCollection(0);

/* ===========================================================
   매 프레임
   damp(): 프레임 속도와 상관없이 같은 부드러움으로 따라가게 함
   =========================================================== */
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const ideaText = $('.idea__text'), ideaWords = $$('.idea__text .w');
const clock = new THREE.Clock();
let smx = 0, smy = 0;
let spin = 0, sway = 0;              // 스크롤 속도에 따른 회전/기울기 (관성)
let sStage = 0, sWe = 0, sCol = 0;   // 부드럽게 따라가는 진행도
let glCleared = false;

function frameLoop(time) {
  lenis.raf(time);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const t = clock.elapsedTime;
  const sy = lenis.scroll;
  const v = lenis.velocity || 0;

  smx = damp(smx, mouseX / W - .5, 3, dt);
  smy = damp(smy, mouseY / H - .5, 3, dt);
  spin += v * .0011;
  sway = damp(sway, clamp(v * .012, -.35, .35), 5, dt);
  materials.forEach(m => (m.uniforms.uTime.value = t));

  // 커서
  curX = damp(curX, mouseX, 22, dt); curY = damp(curY, mouseY, 22, dt);
  cursor.style.transform = `translate3d(${curX}px, ${curY}px, 0) translate(-50%, -50%)`;

  // 01→02 STAGE — VESSEL 이 아래로 떨어지고 GLASS / HOLDS 가 올라옴 (스크롤에 연동)
  sStage = damp(sStage, progress(stage), 10, dt);
  const ps = sStage;
  const intro = introStart < 0 ? 0 : (performance.now() - introStart) / 1000;
  document.body.classList.toggle('past-hero', ps > .25 || sy > H);
  const stageOn = inView(stage);

  if (stageOn) {
    outChars.forEach((c, i) => {
      const up = easeOut(clamp((intro - .1 - i * .06) / 1.1));
      const down = easeInOut(seg(ps, .08 + i * .03, .2));
      c.style.transform = `translate3d(0, ${(1 - up) * 115 + down * 115}%, 0) rotate(${(1 - up) * 7 + down * 7}deg)`;
    });
    inLines.forEach(l => l.chars.forEach((c, i) => {
      const k = easeInOut(seg(ps, .3 + l.d + i * .03, .22));
      c.style.transform = `translate3d(0, ${(1 - k) * 115}%, 0) rotate(${(1 - k) * 7}deg)`;
    }));
    metaOut.forEach((m, i) => {
      const up = easeOut(clamp((intro - .7 - i * .08) / 1));
      const down = easeInOut(seg(ps, .06 + i * .03, .16));
      m.style.transform = `translate3d(0, ${(1 - up) * 110 + down * 110}%, 0) rotate(${(1 - up) * 5 + down * 5}deg)`;
    });
    metaIn.forEach((m, i) => {
      const k = easeInOut(seg(ps, .4 + i * .04, .2));
      m.style.transform = `translate3d(0, ${(1 - k) * 110}%, 0) rotate(${(1 - k) * 5}deg)`;
    });
    fog.style.opacity = seg(ps, .72, .28);
  }

  // 물방울: 첫 장면 위치 → 두 번째 장면 위치로 이동/축소, 두 번째 물방울은 아래에서 떠오름
  const introK = easeOut(clamp((intro - .2) / 1.8));
  const mv = easeInOut(seg(ps, .12, .5));
  const r1 = anchors.hero.getBoundingClientRect(), r2 = anchors.holdsA.getBoundingClientRect();
  heroBlob.visible = r2.bottom > -H * .4 && introK > .001;
  heroBlob.position.set(lerp(r1.left + r1.width / 2, r2.left + r2.width / 2, mv) - W / 2,
    -(lerp(r1.top + r1.height / 2, r2.top + r2.height / 2, mv) - H / 2) + (1 - introK) * -60, 0);
  heroBlob.scale.setScalar(lerp(r1.height, r2.height, mv) / 2 * lerp(.7, 1, introK));
  heroBlob.material.uniforms.uOpacity.value = introK;
  heroBlob.rotation.set(t * .07 + ps * 2.4 + smy * .5 + sway, t * .1 + ps * 3.6 + smx * .7 + spin, ps * .8);

  const kb = easeOut(seg(ps, .34, .4));
  place(holdsB, anchors.holdsB, { mul: Math.max(kb, .001) });
  holdsB.position.y -= (1 - kb) * H * .45;
  holdsB.visible = holdsB.visible && kb > .01;
  holdsB.rotation.set(-t * .12 - ps * 2 - sway, t * .09 + ps * 1.5 - spin * .8, 0);

  // 03 THE IDEA — 스크롤에 따라 단어가 하나씩 진해짐
  if (inView(ideaText)) {
    const r = ideaText.getBoundingClientRect();
    const pi = clamp((H * .82 - r.top) / (r.height + H * .3));
    const lit = Math.round(pi * ideaWords.length);
    ideaWords.forEach((w, i) => w.classList.toggle('on', i < lit));
  }

  // 04 WE HOLD — 처음엔 글자만 있다가, 스크롤하면 WE 와 HOLD 사이가 벌어지며 화병이 나타남
  sWe = damp(sWe, progress(weSec), 10, dt);
  const pw = sWe;
  const open = easeInOut(seg(pw, .12, .45));
  if (inView(weSec)) weAnchor.style.width = `calc(var(--gap) * ${open.toFixed(4)})`;
  place(weVase, anchors.wehold, { mul: open });
  weVase.visible = weVase.visible && open > .01;
  weVase.userData.mat.uniforms.uOpacity.value = clamp(open * 1.6);
  weVase.rotation.set(.16 + sway * .6, t * .3 + pw * Math.PI * 2 + smx * .6 + spin, lerp(-.9, 0, easeOut(seg(pw, .2, .55))));

  // 05 COLLECTION — 드럼 리스트 + 형태 교체
  sCol = damp(sCol, progress(colSec), 10, dt);
  const pc = sCol;
  const colOn = inView(colSec);
  if (colOn) {
    drumPos = damp(drumPos, pc * (drumItems.length - 1), 9, dt);
    drumList.style.transform = `translate3d(0, ${-itemH * .5 - drumPos * itemH}px, 0)`;
    drumItems.forEach((it, i) => {
      const d = Math.abs(i - drumPos);
      it.style.opacity = clamp(1 - d * .45, .07, 1);
      it.style.transform = `scale(${1 - Math.min(d, 2) * .06})`;
    });
    const ai = clamp(Math.round(drumPos), 0, drumItems.length - 1);
    if (ai !== drumActive) setCollection(ai);
  }
  colVessels.forEach((cv, i) => {
    cv.userData.vis = damp(cv.userData.vis, i === drumActive ? 1 : 0, i === drumActive ? 6 : 12, dt);
    const vis = cv.userData.vis;
    place(cv, anchors.collection, { mul: .6 + .4 * easeOut(vis) });
    cv.visible = colOn && vis > .01;
    cv.userData.mat.uniforms.uOpacity.value = vis;
    cv.rotation.set(.18 + smy * .3 + sway * .5, t * .35 + i * 1.3 + pc * 6 + (1 - vis) * 1.8 + spin, smx * .15 + (1 - vis) * .3);
  });

  // 06 POSTERS — 미리보기가 마우스를 따라오며, 움직임에 따라 살짝 기울어짐
  if (preview.classList.contains('is-on') || Math.abs(pvR) > .01) {
    const pvW = preview.offsetWidth, pvH = preview.offsetHeight;
    const tx = clamp(W * .56 + (mouseX / W - .5) * 80, 0, W - pvW);
    const ty = clamp(mouseY - pvH / 2, 10, H - pvH - 10);
    pvR = damp(pvR, clamp((ty - pvY) * .04, -6, 6), 6, dt);
    pvX = damp(pvX, tx, 6, dt); pvY = damp(pvY, ty, 6, dt);
    preview.style.transform = `translate3d(${pvX}px, ${pvY}px, 0) rotate(${pvR}deg)`;
  }

  // 07 GALLERY — 세로 스크롤 → 가로 이동
  if (inView(gal)) {
    const pg = progress(gal);
    track.style.transform = `translate3d(${-pg * galDist}px, 0, 0)`;
    galBar.style.transform = `scaleX(${pg})`;
    galImgs.forEach(img => {
      const r = img.parentElement.getBoundingClientRect();
      const c = (r.left + r.width / 2) / W - .5;
      img.style.transform = `translate3d(${c * -3}%, 0, 0) scale(1.06)`;
    });
  }

  // 08 MARQUEE — 스크롤 속도/방향에 반응
  if (Math.abs(v) > .1) mqDir = v > 0 ? -1 : 1;
  mqX += mqDir * (36 + Math.min(Math.abs(v), 50) * 14) * dt;
  const half = mq.scrollWidth / 2;
  if (mqX <= -half) mqX += half;
  if (mqX > 0) mqX -= half;
  if (inView(mq)) mq.style.transform = `translate3d(${mqX}px, 0, 0)`;

  // 로딩 화면 유리
  if (loaderAlive) {
    const li = Math.min(SHAPES.length - 1, Math.floor(loadShown / 100 * SHAPES.length));
    const base = Math.min(W, H) * .2;
    const othersGone = lVessels.every((o, j) => j === li || o.userData.vis < .2);
    lVessels.forEach((lv, i) => {
      const target = i === li && othersGone ? 1 : 0;
      lv.userData.vis = damp(lv.userData.vis, target, target ? 10 : 20, dt);
      const vis = lv.userData.vis;
      lv.visible = vis > .01;
      lv.position.set(0, H * .04 + (1 - vis) * 30, 0);
      lv.scale.setScalar(base * lv.userData.k * (.7 + .3 * easeOut(vis)));
      lv.userData.mat.uniforms.uOpacity.value = vis;
      lv.rotation.set(.22, t * 2.2 + i * 1.1 + (1 - vis) * 2, (1 - vis) * .35 * (i % 2 ? 1 : -1));
    });
    lRenderer.render(lScene, camera);
  }

  // 화면에 보이는 유리가 없으면 그리지 않음 (성능)
  const anyGL = scene.children.some(o => o.visible);
  if (anyGL) { renderer.render(scene, camera); glCleared = false; }
  else if (!glCleared) { renderer.clear(); glCleared = true; }

  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);
