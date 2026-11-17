// Hero V2 — céu (assets/background-base.png) com as nuvens animadas e a
// pessoa (assets/person-layer.png) por cima, parada.
// Um quad WebGL desenha a imagem; a máscara assets/cloud-mask.png diz onde as
// nuvens podem se mover (some antes do horizonte, então o chão fica parado).
//  - balanço: ruído animado desloca levemente os pixels das nuvens;
//  - vento: manchas suaves de luz e sombra atravessam as nuvens;
//  - mouse: as nuvens seguem o ponteiro; parado, um passeio automático lento.

const CONFIG = {
  // Nuvens
  flowStrength: 0.022,   // amplitude do balanço das nuvens (em UV)
  flowSpeed: 0.05,       // velocidade do balanço
  lightStrength: 0.35,   // luz/sombra que atravessa as nuvens
  lightSpeed: 0.02,      // velocidade dessa luz (UV por segundo)
  windDir: [1, -0.12],   // direção do vento (x para a direita, y para baixo)
  cloudParallax: 0.012,  // quanto as nuvens seguem o mouse (em UV)

  // Pessoa. Ela foi recortada de uma cena com a coluna de luz batendo nela;
  // sem a luz, fica em silhueta escura. 0 = silhueta, 1 = iluminada como na
  // cena original (usar 1 quando a luz voltar).
  personLight: 0.0,

  // Ponteiro
  follow: 2.2,           // rapidez com que alcança o alvo
  idleAfterMs: 2500,     // mouse parado por esse tempo → passeio automático
  maxDpr: 2,
};

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImage;
uniform sampler2D uMask;
uniform sampler2D uPerson;
uniform float uPersonLight;
uniform vec2 uRes;
uniform vec2 uImgSize;
uniform float uTime;
uniform vec2 uPointer;     // -1..1, y para baixo
uniform float uMotion;     // 0 = reduced motion
uniform float uFlowStrength;
uniform float uFlowSpeed;
uniform float uLightStrength;
uniform float uLightSpeed;
uniform vec2 uWindDir;
uniform float uCloudParallax;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  // background-size: cover
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float rs = uRes.x / uRes.y;
  float ri = uImgSize.x / uImgSize.y;
  vec2 scale = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  uv = (uv - 0.5) * scale + 0.5;

  // ---------- 1. fundo com nuvens em movimento ----------
  // A máscara some perto das bordas para nunca amostrar fora da imagem.
  float m = texture2D(uMask, uv).r;
  m *= smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x) * smoothstep(0.0, 0.05, uv.y);

  float t = uTime * uFlowSpeed;
  vec2 p = uv * vec2(2.0, 1.4);
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 flow = vec2(
    fbm(p + 2.0 * q + vec2(1.7, 9.2) + t * 0.6),
    fbm(p + 2.0 * q + vec2(8.3, 2.8) - t * 0.5)
  ) - 0.5;

  // Nuvens mais afastadas do centro "estão mais perto" → movem mais
  float depth = 0.65 + 0.7 * abs(uv.x - 0.5);
  vec2 offset = flow * uFlowStrength * uMotion - uPointer * uCloudParallax * depth;

  // Uma única amostra → nitidez total
  vec3 color = texture2D(uImage, uv + offset * m).rgb;

  // Manchas de luz e sombra atravessando as nuvens (vento)
  vec2 lp = uv * vec2(2.6, 3.4) - uWindDir * uTime * uLightSpeed * 2.6;
  float light = fbm(lp + q * 0.8) - 0.5;
  color *= 1.0 + light * uLightStrength * m * uMotion;

  // Pessoa (parada). Sem a luz, vira silhueta: tons apagados e frios, só com
  // um resto de claridade nos contornos e nas telas.
  vec4 person = texture2D(uPerson, uv);
  float pl = dot(person.rgb, vec3(0.2126, 0.7152, 0.0722));
  // as bordas do recorte carregam o brilho da luz que estava atrás: apagadas aqui
  float core = smoothstep(0.75, 1.0, person.a);
  vec3 silhouette = vec3(0.05, 0.06, 0.085) + pl * pl * core * vec3(0.55, 0.62, 0.85);
  vec3 pc = mix(silhouette, person.rgb, uPersonLight);
  color = mix(color, pc, person.a);

  gl_FragColor = vec4(color, 1.0);
}`;

const hero = document.querySelector(".hero");
const canvas = hero.querySelector(".hero__canvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

init().catch((err) => {
  // Mantém o fallback estático
  console.warn("[scene] WebGL indisponível, usando imagem estática.", err);
});

async function init() {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) throw new Error("WebGL não suportado");

  const [image, mask, person] = await Promise.all([
    loadImage("assets/background-base.png"),
    loadImage("assets/cloud-mask.png"),
    loadImage("assets/person-layer.png"),
  ]);

  const program = createProgram(gl, VERT, FRAG);
  gl.useProgram(program);

  // Quad de tela cheia
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  createTexture(gl, image, 0);
  createTexture(gl, mask, 1);
  createTexture(gl, person, 2);

  const u = (name) => gl.getUniformLocation(program, name);
  const uni = {
    res: u("uRes"),
    time: u("uTime"),
    pointer: u("uPointer"),
    motion: u("uMotion"),
  };
  gl.uniform1i(u("uImage"), 0);
  gl.uniform1i(u("uMask"), 1);
  gl.uniform1i(u("uPerson"), 2);
  gl.uniform1f(u("uPersonLight"), CONFIG.personLight);
  gl.uniform2f(u("uImgSize"), image.naturalWidth, image.naturalHeight);
  gl.uniform1f(u("uFlowStrength"), CONFIG.flowStrength);
  gl.uniform1f(u("uFlowSpeed"), CONFIG.flowSpeed);
  gl.uniform1f(u("uLightStrength"), CONFIG.lightStrength);
  gl.uniform1f(u("uLightSpeed"), CONFIG.lightSpeed);
  gl.uniform2f(u("uWindDir"), CONFIG.windDir[0], CONFIG.windDir[1]);
  gl.uniform1f(u("uCloudParallax"), CONFIG.cloudParallax);


  // --- Ponteiro: segue o mouse; parado, faz um passeio lento ---
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let lastMove = -Infinity;

  window.addEventListener("pointermove", (e) => {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
    lastMove = performance.now();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => {
    lastMove = -Infinity;
  });

  function wander(t) {
    return {
      x: Math.sin(t * 0.11) * 0.55 + Math.sin(t * 0.037 + 2.0) * 0.25,
      y: Math.sin(t * 0.083 + 1.3) * 0.35,
    };
  }

  // --- Resize ---
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uni.res, w, h);
  }

  // --- Loop ---
  let prev = performance.now();
  let rafId = 0;

  function frame(now) {
    const dt = Math.min((now - prev) / 1000, 0.1);
    prev = now;
    const t = now / 1000;
    const still = reducedMotion.matches;

    if (!still && now - lastMove > CONFIG.idleAfterMs) {
      const w = wander(t);
      target.x = w.x;
      target.y = w.y;
    }
    const k = 1 - Math.exp(-dt * CONFIG.follow);
    pointer.x += ((still ? 0 : target.x) - pointer.x) * k;
    pointer.y += ((still ? 0 : target.y) - pointer.y) * k;

    resize();
    gl.uniform1f(uni.time, t);
    gl.uniform1f(uni.motion, still ? 0 : 1);
    gl.uniform2f(uni.pointer, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    rafId = requestAnimationFrame(frame);
  }

  hero.classList.add("is-webgl");
  rafId = requestAnimationFrame(frame);

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    cancelAnimationFrame(rafId);
    hero.classList.remove("is-webgl");
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    img.src = src;
  });
}

function createTexture(gl, img, unit) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  return tex;
}

function createProgram(gl, vsSrc, fsSrc) {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p));
  }
  return p;
}
