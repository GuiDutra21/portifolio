// Trechos de GLSL compartilhados pelas camadas do hero.

// Quad de tela cheia: ignora a câmera e cobre o canvas inteiro.
export const fullscreenVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Converte a coordenada da tela para a da imagem, como background-size: cover.
// Resultado com y para baixo (0 = topo da imagem).
export const coverUv = /* glsl */ `
vec2 coverUv(vec2 screenUv, vec2 res, vec2 imgSize) {
  vec2 uv = vec2(screenUv.x, 1.0 - screenUv.y);
  float rs = res.x / res.y;
  float ri = imgSize.x / imgSize.y;
  vec2 scale = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  return (uv - 0.5) * scale + 0.5;
}`;

export const noise = /* glsl */ `
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
}`;

// Movimento das nuvens (balanço, vaivém, faixas e mouse). Usado pelo céu e pela
// luz, para os resquícios de nuvem dentro da luz andarem junto com o céu.
// Precisa de ${noise} antes. Também guarda em cloudQ um ruído que o céu reusa.
export const cloudMotion = /* glsl */ `
uniform float uFlowStrength;
uniform float uFlowSpeed;
uniform float uParallax;
uniform float uDriftAmount;
uniform float uDriftSpeed;
uniform float uBandAmount;
uniform float uBandSpeed;

vec2 cloudQ;

vec2 cloudOffset(vec2 uv, float time, vec2 pointer, float motion) {
  // Balanço orgânico (domain warping)
  float t = time * uFlowSpeed;
  vec2 p = uv * vec2(2.0, 1.4);
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  cloudQ = q;
  vec2 flow = vec2(
    fbm(p + 2.0 * q + vec2(1.7, 9.2) + t * 0.6),
    fbm(p + 2.0 * q + vec2(8.3, 2.8) - t * 0.5)
  ) - 0.5;

  // Nuvens mais afastadas do centro "estão mais perto" → movem mais
  float depth = 0.65 + 0.7 * abs(uv.x - 0.5);

  // Vaivém lento do céu: duas ondas de períodos diferentes, para o movimento
  // não parecer um pêndulo. No alto move mais; perto do horizonte, menos.
  float dt = time * uDriftSpeed;
  vec2 drift = vec2(
    0.65 * sin(dt * 0.21) + 0.35 * sin(dt * 0.13 + 1.7),
    0.18 * sin(dt * 0.17 + 0.6)
  ) * uDriftAmount * mix(1.0, 0.45, smoothstep(0.0, 0.85, uv.y));

  // Faixas de nuvens em alturas diferentes deslizando em ritmos diferentes
  float bt = time * uBandSpeed;
  float bands = sin(uv.y * 7.0 + bt) + 0.6 * sin(uv.y * 13.0 - bt * 1.4 + 2.0);
  drift.x += bands * uBandAmount * 0.6;

  return (flow * uFlowStrength + drift) * motion - pointer * uParallax * depth;
}`;
