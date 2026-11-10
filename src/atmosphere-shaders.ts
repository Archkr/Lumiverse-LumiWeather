/**
 * Pure-WebGL2 / WebGL1 shader suite for LumiWeather's Unified Atmosphere Engine.
 *
 * All shaders output premultiplied RGBA (`gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`),
 * allowing seamless blending of translucent pigments (clouds, fog, petals, rain body)
 * and luminous additive/screen glows (sunbeams, aurora, stars, embers, fireflies,
 * lightning plasma) inside a single GPU pipeline without blend-state thrashing.
 */

export const PARTICLE_KIND = {
  STAR: 0,
  MOON: 1,
  RAIN: 2,
  RIPPLE: 3,
  SPLASH: 4,
  WIND_GUST: 5,
  SNOW: 6,
  MOTE: 7,
  BLOSSOM: 8,
  EMBER: 9,
  FIREFLY: 10,
  ASH: 11,
  SAND_STREAK: 12,
  WINDOW_DROP: 13,
  WINDOW_TRAIL: 14,
  LIGHTNING: 15,
  FROST_CORNER: 16,
} as const;

export const ATMOSPHERE_VERTEX_SHADER = `
  attribute vec2 a_pos;
  varying vec2 v_uv;

  void main() {
    // v_uv.y = 0.0 at top (zenith), 1.0 at bottom (horizon)
    v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

export const ATMOSPHERE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_uv;

  uniform vec2 u_resolution;
  uniform float u_time;

  uniform vec4 u_bgStart;
  uniform vec4 u_bgMid;
  uniform vec4 u_bgEnd;
  uniform vec4 u_glow;
  uniform vec4 u_beamColor;
  uniform vec4 u_horizonColor;
  uniform vec4 u_fogColor;
  uniform vec4 u_mistColor;

  uniform float u_skyOpacity;
  uniform float u_glowOpacity;
  uniform float u_beamOpacity;
  uniform float u_horizonOpacity;
  uniform float u_mistOpacity;
  uniform float u_fogOpacity;
  uniform float u_auroraOpacity;
  uniform float u_moonlightOpacity;
  uniform float u_moonIllumination;
  uniform float u_windX;
  uniform float u_isSandstorm;
  uniform float u_isIndoor;
  uniform float u_lightningFlash;
  uniform float u_lightningX;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float sq(float x) {
    return x * x;
  }

  // Quintic-interpolated gradient-like value noise (zero Mach-band grid lines)
  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  mat2 rot2(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
  }

  float fbm4(vec2 p) {
    float v = 0.0;
    float amp = 0.52;
    mat2 m = rot2(0.51);
    for (int i = 0; i < 4; i++) {
      v += amp * smoothNoise(p);
      p = m * p * 2.03 + vec2(13.7, 7.9);
      amp *= 0.5;
    }
    return v;
  }

  void composePremul(inout vec3 dstRgb, inout float dstA, vec3 srcRgb, float srcA, float glowFactor) {
    float a = clamp(srcA, 0.0, 1.0);
    float effectiveBlockA = a * (1.0 - clamp(glowFactor, 0.0, 0.85));
    dstRgb = srcRgb * a + dstRgb * (1.0 - effectiveBlockA);
    dstA = effectiveBlockA + dstA * (1.0 - effectiveBlockA);
  }

  void main() {
    vec2 uv = v_uv; // (0,0) top-left, (1,1) bottom-right
    float aspect = u_resolution.x / max(1.0, u_resolution.y);
    vec3 outRgb = vec3(0.0);
    float outA = 0.0;

    // 1. Multi-stop vertical + diagonal atmospheric sky gradient
    if (u_skyOpacity > 0.003) {
      float breath = sin(u_time * 0.14) * 0.02;
      float gy = clamp(uv.y + breath + (uv.x - 0.5) * 0.04, 0.0, 1.0);
      vec3 skyCol;
      if (gy < 0.46) {
        float t = smoothstep(0.0, 0.46, gy);
        skyCol = mix(u_bgStart.rgb, u_bgMid.rgb, t);
      } else {
        float t = smoothstep(0.46, 1.0, gy);
        skyCol = mix(u_bgMid.rgb, u_bgEnd.rgb, t);
      }
      // Subtle zenith richness + horizon atmospheric scatter
      skyCol *= 1.04;
      composePremul(outRgb, outA, skyCol, clamp(u_skyOpacity, 0.0, 0.95), 0.0);
    }

    // 2. Ambient moonlight atmospheric sky scatter (night upper-right & lower-left bounce)
    if (u_moonlightOpacity > 0.004) {
      vec2 m1 = vec2((uv.x - 0.84) * aspect, uv.y - 0.16);
      vec2 m2 = vec2((uv.x - 0.14) * aspect, uv.y - 0.76);
      float g1 = exp(-length(m1) * 2.35) * (0.45 + 0.55 * u_moonIllumination);
      float g2 = exp(-length(m2) * 2.1) * 0.28;
      vec3 moonScatter = mix(vec3(0.42, 0.58, 0.88), vec3(0.74, 0.85, 1.0), g1);
      float mAlpha = clamp((g1 * 0.56 + g2 * 0.32) * u_moonlightOpacity, 0.0, 0.75);
      composePremul(outRgb, outA, moonScatter, mAlpha, 0.65);
    }

    // 3. Multi-curtain geomagnetic Aurora Borealis (emerald -> cyan -> violet -> rose)
    if (u_auroraOpacity > 0.004 && uv.y < 0.78) {
      float yFade = smoothstep(0.01, 0.18, uv.y) * smoothstep(0.78, 0.34, uv.y);
      float xCentered = (uv.x - 0.5) * aspect;

      for (int c = 0; c < 2; c++) {
        float cf = float(c);
        float speed = 0.16 + cf * 0.09;
        float sway = sin(xCentered * (2.6 + cf * 1.1) + u_time * speed) * 0.14
                   + cos(xCentered * 1.4 - u_time * 0.11 + cf * 2.1) * 0.09;
        float localY = (uv.y - (0.08 + cf * 0.09) - sway) / 0.42;
        if (localY > -0.25 && localY < 1.15) {
          float curtainEnv = smoothstep(-0.2, 0.22, localY) * smoothstep(1.15, 0.35, localY);
          // Fine vertical magnetic field striations
          float rayCoord = xCentered * (8.5 + cf * 3.5) + sway * 3.2;
          float rays = smoothNoise(vec2(rayCoord, uv.y * 1.4 - u_time * 0.18));
          float fineRays = smoothNoise(vec2(rayCoord * 2.4 + 7.3, uv.y * 2.2 - u_time * 0.26));
          float intensity = smoothstep(0.24, 0.88, rays * 0.68 + fineRays * 0.42) * curtainEnv * yFade;

          // Rich multi-stop emission gradient: rose fringe -> emerald core -> cyan -> deep violet
          vec3 emerald = vec3(0.18, 0.98, 0.66);
          vec3 cyan = vec3(0.18, 0.88, 0.96);
          vec3 violet = vec3(0.62, 0.34, 0.98);
          vec3 rose = vec3(0.98, 0.36, 0.66);

          float altT = clamp(1.0 - localY, 0.0, 1.0);
          vec3 aCol = mix(emerald, cyan, smoothstep(0.18, 0.52, altT));
          aCol = mix(aCol, violet, smoothstep(0.48, 0.92, altT));
          aCol = mix(aCol, rose, smoothstep(0.22, 0.0, altT) * 0.42);

          float aAlpha = intensity * u_auroraOpacity * (cf == 0.0 ? 0.78 : 0.55);
          composePremul(outRgb, outA, aCol, aAlpha, 0.72);
        }
      }
    }

    // 4. Dual-lobe solar / ambient corona glow
    if (u_glowOpacity > 0.003) {
      vec2 drift = vec2(sin(u_time * 0.18) * 0.018, cos(u_time * 0.15) * 0.012);
      vec2 p1 = vec2((uv.x - (0.18 + drift.x)) * aspect, uv.y - (0.18 + drift.y));
      vec2 p2 = vec2((uv.x - (0.82 - drift.x)) * aspect, uv.y - (0.22 - drift.y));
      float d1 = length(p1);
      float d2 = length(p2);

      float core1 = exp(-d1 * 4.2) * 0.85 + exp(-d1 * 1.75) * 0.42;
      float core2 = exp(-d2 * 3.8) * 0.48;
      vec3 glowCol1 = mix(u_glow.rgb, vec3(1.0, 0.98, 0.92), exp(-d1 * 6.0) * 0.45);
      vec3 glowCol2 = mix(u_glow.rgb, vec3(1.0), 0.18);

      float gA1 = clamp(core1 * u_glowOpacity * u_glow.a * 1.25, 0.0, 0.85);
      float gA2 = clamp(core2 * u_glowOpacity * u_glow.a * 0.9, 0.0, 0.65);
      composePremul(outRgb, outA, glowCol1, gA1, 0.68);
      composePremul(outRgb, outA, glowCol2, gA2, 0.68);
    }

    // 5. Polar-fanning crepuscular god-rays (cathedral sunbeams)
    if (u_beamOpacity > 0.003 && uv.y < 0.92) {
      vec2 sunOrigin = vec2(0.16, -0.08);
      vec2 rel = vec2((uv.x - sunOrigin.x) * aspect, uv.y - sunOrigin.y);
      float dist = length(rel);
      float angle = atan(rel.x, max(0.02, rel.y));

      // Fan envelope centered along diagonal sunbeam corridor
      float corridor = exp(-sq((angle - 0.52) * 1.65));
      float shaft1 = sin(angle * 16.0 - u_time * 0.14) * 0.5 + 0.5;
      float shaft2 = sin(angle * 27.0 + u_time * 0.09 + 1.7) * 0.5 + 0.5;
      float shafts = pow(max(0.0001, shaft1 * 0.62 + shaft2 * 0.38), 2.1);

      float distFade = smoothstep(0.02, 0.28, dist) * smoothstep(1.38, 0.25, dist);
      float beamVal = corridor * (0.28 + 0.72 * shafts) * distFade;
      vec3 beamTint = mix(u_beamColor.rgb, vec3(1.0, 0.97, 0.90), 0.25);
      float bAlpha = clamp(beamVal * u_beamOpacity * (0.45 + u_beamColor.a * 0.85), 0.0, 0.72);
      composePremul(outRgb, outA, beamTint, bAlpha, 0.74);
    }

    // 6. Horizon Mie scattering & twilight glow gradient
    if (u_horizonOpacity > 0.003) {
      float hGrad = pow(max(0.0001, smoothstep(0.36, 1.0, uv.y)), 1.45);
      vec3 hCol = mix(u_horizonColor.rgb, u_bgEnd.rgb, 0.28);
      float hAlpha = clamp(hGrad * u_horizonOpacity * (0.48 + u_horizonColor.a * 0.8), 0.0, 0.82);
      composePremul(outRgb, outA, hCol, hAlpha, 0.25);
    }

    // 7. Volumetric 4-octave domain-warped fog, rolling valley mist & haboob sandstorm
    float fogStrength = max(u_fogOpacity, u_mistOpacity * 0.78);
    if (fogStrength > 0.004) {
      vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
      float speed = (0.036 + u_isSandstorm * 0.085) * u_windX;
      vec2 flow = vec2(speed * u_time, -0.012 * u_time);

      vec2 q = vec2(
        fbm4(p * 1.65 - flow * 0.8),
        fbm4(p * 1.65 + vec2(5.2, 1.3) - flow * 0.6)
      );
      float farBank = fbm4(p * 1.35 + q * 0.85 - flow * 0.55);
      float nearBank = fbm4(p * 2.65 + q * 1.25 - flow * 1.15);

      float fFar = smoothstep(0.30, 0.82, farBank);
      float fNear = smoothstep(0.36, 0.84, nearBank);

      // Ground-hugging mist plumes bias toward bottom, fog & sandstorm span taller
      float verticalProfile = mix(
        smoothstep(0.18, 0.98, uv.y),
        smoothstep(-0.05, 0.88, uv.y),
        clamp(u_fogOpacity * 1.35, 0.0, 1.0)
      );
      float density = (fFar * 0.46 + fNear * 0.68) * mix(0.42, 1.28, verticalProfile);

      vec3 fogCol;
      if (u_isSandstorm > 0.5) {
        vec3 deepOchre = vec3(0.74, 0.51, 0.29);
        vec3 brightSand = vec3(0.93, 0.77, 0.54);
        fogCol = mix(deepOchre, brightSand, clamp(fNear * 0.8 + (1.0 - uv.y) * 0.3, 0.0, 1.0));
      } else {
        vec3 baseMist = mix(u_fogColor.rgb, u_mistColor.rgb, smoothstep(0.35, 0.95, uv.y));
        vec3 pearlCrest = mix(baseMist, vec3(0.94, 0.97, 1.0), 0.32);
        fogCol = mix(baseMist, pearlCrest, fNear * 0.65);
      }

      float fAlpha = clamp(density * fogStrength * 1.18, 0.0, 0.86);
      composePremul(outRgb, outA, fogCol, fAlpha, 0.08);
    }

    // 8. Subtle indoor windowpane glass reflection sheen & cool edge vignette
    if (u_isIndoor > 0.5) {
      float edgeDist = length((uv - 0.5) * vec2(1.0, 1.0));
      float edgeVignette = smoothstep(0.38, 0.78, edgeDist) * 0.085;
      float diagSheen = exp(-sq((uv.x * 0.75 + uv.y * 0.65 - 0.58) * 5.5)) * 0.045;
      composePremul(outRgb, outA, vec3(0.68, 0.80, 0.94), edgeVignette + diagSheen, 0.45);
    }

    // 9. Multi-zone lightning atmospheric flash & upper cloud-deck glow
    if (u_lightningFlash > 0.005) {
      vec2 lPos = vec2(u_lightningX, 0.16);
      float lDist = length(vec2((uv.x - lPos.x) * aspect, uv.y - lPos.y));
      float coreGlow = exp(-lDist * 2.8) * 0.68;
      float sheetGlow = exp(-uv.y * 1.6) * 0.28;
      float flashAmt = clamp((coreGlow + sheetGlow) * u_lightningFlash, 0.0, 0.88);
      vec3 boltSkyTint = mix(vec3(0.76, 0.86, 1.0), vec3(0.96, 0.98, 1.0), exp(-lDist * 5.0));
      composePremul(outRgb, outA, boltSkyTint, flashAmt, 0.78);
    }

    gl_FragColor = vec4(outRgb, clamp(outA, 0.0, 0.97));
  }
`;

export const BLIT_VERTEX_SHADER = `
  attribute vec2 a_pos;
  varying vec2 v_texCoord;

  void main() {
    v_texCoord = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

export const BLIT_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_tex;

  void main() {
    gl_FragColor = texture2D(u_tex, v_texCoord);
  }
`;

/**
 * Cloud Sprite Atlas Shader:
 * Renders the 6 hand-painted LumiWeather cumulus/stratus cloud textures (`cloud_1..cloud_6`)
 * with 4-stop vertical palette gradients, top-billow contour rim lighting, sunset/sunrise
 * horizon under-lighting, clean feathered edges, soft drop-shadows, and radial subsurface
 * lightning illumination.
 */
export const CLOUD_VERTEX_SHADER = `
  attribute vec2 a_pos;
  attribute vec2 a_atlasUv;
  attribute vec2 a_localUv;
  attribute float a_alpha;
  attribute float a_depth;

  varying vec2 v_atlasUv;
  varying vec2 v_localUv;
  varying vec2 v_screenUv;
  varying float v_alpha;
  varying float v_depth;

  void main() {
    v_atlasUv = a_atlasUv;
    v_localUv = a_localUv;
    v_screenUv = a_pos;
    v_alpha = a_alpha;
    v_depth = a_depth;
    vec2 clip = vec2(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0);
    gl_Position = vec4(clip, 0.0, 1.0);
  }
`;

export const CLOUD_FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 v_atlasUv;
  varying vec2 v_localUv;
  varying vec2 v_screenUv;
  varying float v_alpha;
  varying float v_depth;

  uniform sampler2D u_atlas;
  uniform float u_aspect;
  uniform vec4 u_cloudCore;
  uniform vec4 u_cloudEdge;
  uniform vec4 u_rimLight;
  uniform vec4 u_underGlow;
  uniform vec4 u_shadowTint;
  uniform float u_underGlowStrength;
  uniform float u_detailStrength;
  uniform float u_lightningFlash;
  uniform float u_lightningX;
  uniform float u_frontMask;

  void main() {
    // Multi-tap soft feather + contour rim detection within the sprite's padded atlas cell
    vec2 stepY = vec2(0.0, 0.0085);
    vec2 stepX = vec2(0.006, 0.0);

    vec4 center = texture2D(u_atlas, v_atlasUv);
    float aUp = texture2D(u_atlas, v_atlasUv - stepY).a;
    float aDown = texture2D(u_atlas, v_atlasUv + stepY).a;
    float aLeft = texture2D(u_atlas, v_atlasUv - stepX).a;
    float aRight = texture2D(u_atlas, v_atlasUv + stepX).a;

    // Softly feathered silhouette alpha (eliminates jagged or harsh outlines)
    float softAlpha = center.a * 0.44 + (aUp + aDown + aLeft + aRight) * 0.14;

    // Subtle offset atmospheric drop shadow beneath cloud base
    float shadowSample = aUp * 0.65;
    float dropShadow = clamp(shadowSample - softAlpha, 0.0, 1.0) * 0.22;

    if (softAlpha < 0.008 && dropShadow < 0.008) {
      discard;
    }

    // Top-facing billow crown rim (where alpha transitions from sky above into cloud dome)
    float topRim = clamp((softAlpha - aUp) * 2.35, 0.0, 1.0) * smoothstep(0.72, 0.12, v_localUv.y);
    // Horizon-facing underside rim (for dawn/dusk coral-gold bounce light)
    float bottomRim = clamp((softAlpha - aDown) * 2.1, 0.0, 1.0) * smoothstep(0.35, 0.92, v_localUv.y);

    // Extract clean internal painted puff relief while neutralizing the raw PNG's dark border line
    float rawLuma = dot(center.rgb, vec3(0.299, 0.587, 0.114));
    float interiorMask = smoothstep(0.32, 0.88, center.a);
    float puffRelief = mix(0.90, clamp(rawLuma * 1.06, 0.55, 1.08), interiorMask);

    // 4-stop vertical cloud body gradient:
    // 0.0 (crown) -> upper billow -> heart -> shadowed anvil base
    vec3 crownCol = mix(u_cloudCore.rgb, u_cloudEdge.rgb, 0.72);
    vec3 midCol = u_cloudCore.rgb;
    vec3 baseCol = mix(u_cloudCore.rgb * 0.72, u_shadowTint.rgb, 0.52);

    float vy = clamp(v_localUv.y, 0.0, 1.0);
    vec3 bodyCol = vy < 0.54
      ? mix(crownCol, midCol, smoothstep(0.08, 0.54, vy))
      : mix(midCol, baseCol, smoothstep(0.54, 0.96, vy));

    // Blend painted 3D billow volume
    bodyCol *= mix(1.0, puffRelief, u_detailStrength);

    // Apply solar / lunar silver-lining crown rim light
    bodyCol = mix(bodyCol, u_rimLight.rgb, topRim * 0.62);

    // Apply dawn/dusk warm horizon bounce on lower cloud rims
    bodyCol = mix(bodyCol, u_underGlow.rgb, bottomRim * u_underGlowStrength);

    // Depth atmospheric aerial perspective (far clouds blend gently into upper sky)
    bodyCol = mix(u_shadowTint.rgb * 1.12, bodyCol, 0.68 + 0.32 * v_depth);

    // Subsurface thunderhead lightning scatter: glows brightest along cloud rims & fissures
    if (u_lightningFlash > 0.008) {
      float distToBolt = length(vec2((v_screenUv.x - u_lightningX) * u_aspect, (v_screenUv.y - 0.18) * 1.15));
      float scatterField = exp(-distToBolt * 2.85) * u_lightningFlash;
      float silverLining = 0.45 + 0.85 * (1.0 - interiorMask * 0.65) + topRim * 0.6;
      bodyCol += vec3(0.78, 0.89, 1.0) * scatterField * silverLining * 1.15;
    }

    // Optional front-layer center readability attenuation (replaces expensive CSS mask-image)
    float maskScale = 1.0;
    if (u_frontMask > 0.5) {
      float centerDist = length((v_screenUv - 0.5) * vec2(2.0, 2.0));
      maskScale = mix(0.30, 1.0, smoothstep(0.0, 0.82, centerDist));
    }

    float finalAlpha = clamp(softAlpha * v_alpha * maskScale, 0.0, 0.95);
    float shadowAlpha = clamp(dropShadow * v_alpha * maskScale, 0.0, 0.35);

    vec3 premul = bodyCol * finalAlpha + (u_shadowTint.rgb * 0.25) * shadowAlpha;
    float totalA = clamp(finalAlpha + shadowAlpha, 0.0, 0.96);
    gl_FragColor = vec4(premul, totalA);
  }
`;

/**
 * Unified Batched Gradient Particle, Ribbon, Celestial & Surface Uber-Shader:
 * Evaluates crisp, anti-aliased SDF geometries and rich multi-stop gradients per pixel.
 */
export const PARTICLE_VERTEX_SHADER = `
  attribute vec2 a_pos;
  attribute vec2 a_uv;
  attribute float a_kind;
  attribute float a_param;
  attribute vec4 a_colorA;
  attribute vec4 a_colorB;

  varying vec2 v_uv;
  varying vec2 v_screenUv;
  varying float v_kind;
  varying float v_param;
  varying vec4 v_colorA;
  varying vec4 v_colorB;

  void main() {
    v_uv = a_uv;
    v_screenUv = a_pos;
    v_kind = a_kind;
    v_param = a_param;
    v_colorA = a_colorA;
    v_colorB = a_colorB;
    vec2 clip = vec2(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0);
    gl_Position = vec4(clip, 0.0, 1.0);
  }
`;

export const PARTICLE_FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 v_uv;
  varying vec2 v_screenUv;
  varying float v_kind;
  varying float v_param;
  varying vec4 v_colorA;
  varying vec4 v_colorB;

  uniform float u_frontMask;
  uniform float u_time;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float sq(float x) {
    return x * x;
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vec2 p = v_uv * 2.0 - 1.0; // (-1..1, -1..1)
    float r = length(p);
    int kind = int(v_kind + 0.5);

    vec3 col = vec3(0.0);
    float alpha = 0.0;
    float glowMix = 0.0; // 0 = normal translucent pigment, >0 = luminous additive/screen glow

    if (kind == 0) {
      // STAR: Pinpoint incandescent core + chromatic airy halo + 4-point diffraction cross
      float core = exp(-r * r * 28.0);
      float halo = exp(-r * 3.8) * 0.52;
      float spikes = (exp(-abs(p.x) * 18.0) * exp(-abs(p.y) * 3.2) + exp(-abs(p.y) * 18.0) * exp(-abs(p.x) * 3.2)) * v_param;
      float intensity = clamp(core + halo + spikes * 0.65, 0.0, 1.0) * smoothstep(1.0, 0.78, r);
      col = mix(v_colorB.rgb, v_colorA.rgb, clamp(core * 1.35 + spikes * 0.5, 0.0, 1.0));
      alpha = intensity * v_colorA.a;
      glowMix = 0.72;
    } else if (kind == 1) {
      // MOON: Multi-stop atmospheric corona + crisp 3D spherical phase-lit lunar disc with maria
      float discR = 0.30;
      float corona = (exp(-r * 3.6) * 0.52 + exp(-r * 7.5) * 0.35) * smoothstep(1.0, 0.25, r);
      vec3 coronaCol = v_colorB.rgb;
      float coronaA = corona * v_colorB.a;

      if (r < discR * 1.06) {
        float discMask = smoothstep(discR * 1.03, discR * 0.94, r);
        vec2 np = p / discR;
        float z = sqrt(max(0.0, 1.0 - dot(np, np)));
        float phaseAngle = v_param * 6.2831853;
        vec3 lightDir = normalize(vec3(sin(phaseAngle), -0.08, -cos(phaseAngle)));
        float ndotl = dot(vec3(np.x, -np.y, z), lightDir);
        float lit = smoothstep(-0.07, 0.14, ndotl);

        // Subtle procedural lunar maria (Mare Imbrium / Serenitatis / Tranquillitatis impression)
        float maria1 = noise2(np * 2.4 + vec2(1.7, 3.1));
        float maria2 = noise2(np * 5.2 - vec2(0.8, 2.4));
        float surfaceAlbedo = 0.84 + 0.16 * smoothstep(0.32, 0.74, maria1 * 0.68 + maria2 * 0.32);
        float limb = 0.86 + 0.14 * z;

        vec3 litMoon = v_colorA.rgb * surfaceAlbedo * limb;
        vec3 earthshine = vec3(0.16, 0.23, 0.36) * surfaceAlbedo;
        vec3 moonRgb = mix(earthshine, litMoon, lit);

        float mA = discMask * v_colorA.a;
        col = mix(coronaCol, moonRgb, clamp(mA / max(0.001, mA + coronaA * (1.0 - discMask)), 0.0, 1.0));
        alpha = max(mA, coronaA);
        glowMix = mix(0.68, 0.12, discMask);
      } else {
        col = coronaCol;
        alpha = coronaA;
        glowMix = 0.72;
      }
    } else if (kind == 2) {
      // RAIN: 5-stop longitudinal gradient streak + cylindrical glow + bulbous specular droplet head
      // v_uv.y: 0.0 = upper tail, 1.0 = falling head
      float t = v_uv.y;
      float headBulge = 1.0 + 0.42 * exp(-sq((t - 0.94) * 14.0));
      float xDist = abs(p.x) / headBulge;

      float bodyProfile = smoothstep(0.42, 0.06, xDist);
      float outerGlow = exp(-xDist * xDist * 3.4) * 0.34 * smoothstep(0.0, 0.35, t);

      // 5-stop longitudinal gradient
      float longAlpha = smoothstep(0.0, 0.16, t) * pow(max(0.0001, t), 0.85) * smoothstep(1.0, 0.955, t);
      float headSpec = smoothstep(0.76, 0.96, t);

      vec3 streakCol = mix(v_colorA.rgb, v_colorB.rgb, smoothstep(0.22, 0.82, t));
      streakCol = mix(streakCol, vec3(1.0), headSpec * 0.88);

      col = streakCol;
      alpha = (bodyProfile + outerGlow) * longAlpha * v_colorA.a;
      glowMix = 0.28 + headSpec * 0.35;
    } else if (kind == 3) {
      // RIPPLE: Expanding perspective elliptical dual-ring water gradient + soft glow
      float ringR = 0.42 + v_param * 0.46;
      float ring1 = exp(-sq((r - ringR) * 11.5));
      float ring2 = exp(-sq((r - ringR * 0.64) * 13.0)) * 0.42;
      float glow = exp(-sq((r - ringR) * 4.5)) * 0.26;
      // Specular grazing highlight stronger at front/back of ellipse
      float specArc = 0.72 + 0.28 * abs(p.y / max(0.05, r));
      col = mix(v_colorA.rgb, v_colorB.rgb, clamp(ring1 + specArc * 0.3, 0.0, 1.0));
      alpha = clamp((ring1 + ring2 + glow) * smoothstep(1.0, 0.84, r), 0.0, 1.0) * v_colorA.a;
      glowMix = 0.38;
    } else if (kind == 4) {
      // SPLASH: Parabolic water crown rim + 3 leaping specular micro-droplets
      float lift = sin(clamp(v_param / 0.65, 0.0, 1.0) * 3.14159);
      // Lower crown arc
      vec2 arcP = vec2(p.x * 1.15, (p.y - 0.42) * 2.2);
      float arcR = length(arcP);
      float crownArc = exp(-sq((arcR - (0.45 + v_param * 0.35)) * 8.5)) * smoothstep(0.45, 0.05, p.y);

      // 3 micro-droplets leaping upward
      float spread = 0.25 + v_param * 0.48;
      vec2 dLeft = p - vec2(-spread, 0.35 - lift * 0.78);
      vec2 dMid = p - vec2(0.0, 0.22 - lift * 1.05);
      vec2 dRight = p - vec2(spread, 0.38 - lift * 0.72);
      float drops = exp(-dot(dLeft, dLeft) * 46.0)
                  + exp(-dot(dMid, dMid) * 42.0)
                  + exp(-dot(dRight, dRight) * 46.0);

      float total = clamp(crownArc * 0.78 + drops, 0.0, 1.0);
      col = mix(v_colorA.rgb, vec3(1.0), clamp(drops, 0.0, 1.0));
      alpha = total * v_colorA.a;
      glowMix = 0.42;
    } else if (kind == 5) {
      // WIND GUST: Undulating sinusoidal wind-stream ribbon with 4-stop horizontal fade gradient
      float wave = sin(v_uv.x * 6.28318 + v_param) * 0.32 + sin(v_uv.x * 12.566 - v_param * 0.7) * 0.10;
      float distY = abs(p.y - wave);
      float ribbonCore = exp(-distY * distY * 22.0);
      float ribbonMist = exp(-distY * distY * 4.5) * 0.35;
      float horizMask = smoothstep(0.0, 0.32, v_uv.x) * smoothstep(1.0, 0.66, v_uv.x);
      col = mix(v_colorB.rgb, v_colorA.rgb, ribbonCore);
      alpha = (ribbonCore * 0.75 + ribbonMist) * horizMask * v_colorA.a;
      glowMix = 0.35;
    } else if (kind == 6) {
      // SNOW: Soft radial bokeh for distant flakes, 6-fold crystalline dendrite star for near flakes
      if (v_param < 0.55) {
        float core = exp(-r * r * 6.5);
        float halo = exp(-r * 2.6) * 0.55 * smoothstep(1.0, 0.72, r);
        col = mix(v_colorB.rgb, v_colorA.rgb, core);
        alpha = clamp(core + halo, 0.0, 1.0) * v_colorA.a;
        glowMix = 0.32;
      } else {
        float rot = v_param * 6.28318 + u_time * 0.45;
        float ang = (r > 0.001 ? atan(p.y, p.x) : 0.0) + rot;
        float rays6 = pow(max(0.0001, abs(cos(ang * 3.0))), 6.0);
        float sideBranches = pow(max(0.0001, abs(cos(ang * 3.0 + sin(r * 11.0) * 0.38))), 10.0) * smoothstep(0.18, 0.65, r);
        float crystal = (rays6 * 0.85 + sideBranches * 0.55) * smoothstep(0.92, 0.12, r) + exp(-r * r * 14.0);
        float frostHalo = exp(-r * 2.8) * 0.44 * smoothstep(1.0, 0.75, r);
        col = mix(v_colorB.rgb, v_colorA.rgb, clamp(crystal, 0.0, 1.0));
        alpha = clamp(crystal * 0.85 + frostHalo, 0.0, 1.0) * v_colorA.a;
        glowMix = 0.36;
      }
    } else if (kind == 7) {
      // MOTE: Sunlit golden lens-bokeh orb / bioluminescent cavern spore
      float core = exp(-r * r * 12.0);
      float bokehRing = exp(-sq((r - 0.52) * 5.5)) * 0.28;
      float aura = exp(-r * 2.5) * 0.52 * smoothstep(1.0, 0.75, r);
      col = mix(v_colorB.rgb, v_colorA.rgb, clamp(core + bokehRing * 0.5, 0.0, 1.0));
      alpha = clamp(core + bokehRing + aura, 0.0, 1.0) * v_colorA.a;
      glowMix = 0.65;
    } else if (kind == 8) {
      // BLOSSOM: Heart-notched sakura petal SDF with 3-stop rose->blush->ivory gradient + soft glow
      vec2 sp = vec2(p.x * 1.22, -p.y * 1.08);
      // Tapered base at bottom (sp.y < 0), wider upper lobes with signature V-notch at top (sp.y > 0)
      float widthProfile = 0.68 * (0.55 + 0.45 * smoothstep(-0.85, 0.35, sp.y));
      float notch = smoothstep(0.28, 0.88, sp.y) * exp(-abs(sp.x) * 6.5) * 0.34;
      vec2 q = vec2(sp.x / max(0.18, widthProfile), (sp.y + notch) * 1.12);
      float dPetal = length(q);

      float petalMask = smoothstep(0.86, 0.70, dPetal);
      float softHalo = exp(-dPetal * 2.6) * 0.24 * smoothstep(1.15, 0.75, dPetal);

      // Botanical gradient: deep sakura rose base -> cherry blush mid -> ivory-pink notched tip
      float gradT = clamp((sp.y + 0.75) / 1.5, 0.0, 1.0);
      vec3 baseRose = v_colorB.rgb;
      vec3 tipIvory = vec3(1.0, 0.95, 0.97);
      vec3 petalCol = gradT < 0.55
        ? mix(baseRose, v_colorA.rgb, gradT / 0.55)
        : mix(v_colorA.rgb, tipIvory, (gradT - 0.55) / 0.45);

      // Subtle central vein shading
      petalCol = mix(petalCol, baseRose, exp(-abs(sp.x) * 14.0) * (1.0 - gradT) * 0.25);
      col = petalCol;
      alpha = clamp(petalMask + softHalo, 0.0, 1.0) * v_colorA.a;
      glowMix = 0.18;
    } else if (kind == 9) {
      // EMBER: Velocity-aligned blackbody spark (incandescent white-gold core -> tangerine -> crimson tail)
      // v_uv.y: 0.0 = trailing crimson wake, 1.0 = leading hot spark head
      vec2 ep = vec2(p.x * 2.1, (v_uv.y - 0.68) * 2.2);
      float dCore = length(ep);
      float hotCore = exp(-dCore * dCore * 14.0);
      float wake = exp(-p.x * p.x * 7.5) * smoothstep(0.0, 0.72, v_uv.y) * smoothstep(0.98, 0.35, v_uv.y) * 0.72;
      float heatAura = exp(-r * 2.7) * 0.48 * smoothstep(1.0, 0.72, r);

      vec3 whiteHot = vec3(1.0, 0.97, 0.86);
      vec3 tangerine = v_colorA.rgb;
      vec3 crimson = v_colorB.rgb;

      col = mix(crimson, tangerine, clamp(wake + hotCore * 0.6, 0.0, 1.0));
      col = mix(col, whiteHot, clamp(hotCore * 1.2, 0.0, 1.0));
      alpha = clamp(hotCore + wake * 0.65 + heatAura, 0.0, 1.0) * v_colorA.a;
      glowMix = 0.78;
    } else if (kind == 10) {
      // FIREFLY: Dual-exponential bioluminescent lantern (lemon-ivory core + chartreuse-emerald aura)
      float core = exp(-r * r * 20.0);
      float innerGlow = exp(-r * 4.4) * 0.68;
      float outerAura = exp(-r * 2.1) * 0.38 * smoothstep(1.0, 0.72, r);

      col = mix(v_colorB.rgb, v_colorA.rgb, clamp(core + innerGlow * 0.45, 0.0, 1.0));
      col = mix(col, vec3(0.99, 1.0, 0.86), clamp(core * 1.15, 0.0, 1.0));
      alpha = clamp(core + innerGlow + outerAura, 0.0, 1.0) * v_colorA.a;
      glowMix = 0.80;
    } else if (kind == 11) {
      // ASHFALL: Organic multi-lobed volcanic flake with charcoal-to-silver-warm rim gradient
      float ang = (r > 0.001 ? atan(p.y, p.x) : 0.0) + v_param;
      float lobeR = r * (1.0 + 0.20 * sin(ang * 3.0) + 0.12 * cos(ang * 5.0 + 1.3));
      float flake = smoothstep(0.76, 0.52, lobeR);
      float diagGrad = clamp((p.x * 0.6 + p.y * 0.8) * 0.5 + 0.5, 0.0, 1.0);
      col = mix(v_colorB.rgb, v_colorA.rgb, diagGrad);
      alpha = flake * v_colorA.a;
      glowMix = 0.06;
    } else if (kind == 12) {
      // SAND STREAK: Fast windborne Gaussian desert-ochre dust veil
      float lat = exp(-p.y * p.y * 6.5);
      float lon = smoothstep(0.0, 0.28, v_uv.x) * smoothstep(1.0, 0.68, v_uv.x);
      col = mix(v_colorB.rgb, v_colorA.rgb, v_uv.x * 0.65 + lat * 0.35);
      alpha = lat * lon * v_colorA.a;
      glowMix = 0.12;
    } else if (kind == 13) {
      // WINDOW DROPLET: 3D pseudo-refractive water bead (dark meniscus + sky caustic crescent + white specular)
      // Slightly teardrop-weighted toward bottom (p.y > 0)
      vec2 dp = vec2(p.x * (1.12 - p.y * 0.18), p.y * 0.94);
      float dr = length(dp);
      float beadMask = smoothstep(0.86, 0.70, dr);
      if (beadMask > 0.004) {
        float nz = sqrt(max(0.0, 1.0 - min(1.0, dot(dp / 0.82, dp / 0.82))));
        // Meniscus rim darkening around perimeter
        float rimShadow = smoothstep(0.32, 0.82, dr) * smoothstep(0.2, -0.6, dp.y + dp.x * 0.5);
        // Bright lower-right sky caustic concentration
        float caustic = smoothstep(-0.1, 0.68, dp.y * 0.78 + dp.x * 0.45) * smoothstep(0.84, 0.32, dr);
        // Crisp upper-left window specular reflection dot
        vec2 specPos = dp - vec2(-0.26, -0.30);
        float specDot = exp(-dot(specPos, specPos) * 34.0);

        vec3 darkRim = vec3(0.08, 0.15, 0.26);
        vec3 causticCol = v_colorA.rgb;
        col = mix(v_colorB.rgb, darkRim, rimShadow * 0.65);
        col = mix(col, causticCol, caustic * 0.85);
        col = mix(col, vec3(1.0), specDot * 0.96);

        float bodyAlpha = (0.28 + rimShadow * 0.38 + caustic * 0.52 + specDot * 0.92 + (1.0 - nz) * 0.18);
        alpha = beadMask * clamp(bodyAlpha, 0.0, 1.0) * v_colorA.a;
        glowMix = specDot * 0.45 + caustic * 0.22;
      }
    } else if (kind == 14) {
      // WINDOW TRAIL: Tapered sinuous wet rivulet wake behind sliding droplet
      float pinch = 0.45 + 0.55 * pow(max(0.0001, v_uv.y), 1.4) * (0.78 + 0.22 * sin(v_uv.y * 18.0 + v_param));
      float xProfile = smoothstep(pinch, pinch * 0.15, abs(p.x));
      float specCenter = exp(-sq(p.x / max(0.15, pinch)) * 6.0) * 0.55;
      float vertFade = smoothstep(0.0, 0.35, v_uv.y) * smoothstep(1.0, 0.90, v_uv.y) * pow(max(0.0001, v_uv.y), 0.85);
      col = mix(v_colorB.rgb, vec3(0.96, 0.99, 1.0), specCenter);
      alpha = xProfile * vertFade * v_colorA.a;
      glowMix = 0.25;
    } else if (kind == 15) {
      // LIGHTNING: 3-zone plasma channel segment (razor white core + cyan sheath + wide lavender-blue bloom)
      float xAbs = abs(p.x);
      // Taper softly at segment endpoints so joints overlap without hard box corners
      float endCap = smoothstep(0.0, 0.06, v_uv.y) * smoothstep(1.0, 0.94, v_uv.y);
      float plasmaCore = exp(-xAbs * xAbs * 52.0);
      float electricSheath = exp(-xAbs * xAbs * 8.5) * 0.72;
      float outerBloom = exp(-xAbs * 2.6) * 0.38 * smoothstep(1.0, 0.78, xAbs);

      col = mix(v_colorB.rgb, v_colorA.rgb, clamp(electricSheath + plasmaCore, 0.0, 1.0));
      col = mix(col, vec3(1.0), clamp(plasmaCore * 1.25, 0.0, 1.0));
      alpha = clamp(plasmaCore + electricSheath + outerBloom, 0.0, 1.0) * endCap * v_colorA.a;
      glowMix = 0.82;
    } else if (kind == 16) {
      // FROST CORNER: Feathered crystalline ice-fern vignette glow
      float fern = noise2(p * 6.5 + vec2(v_param, 2.3)) * 0.58 + noise2(p * 14.0 - vec2(1.4, v_param)) * 0.42;
      float radial = exp(-r * 2.15) * smoothstep(1.0, 0.42, r);
      float frostMask = radial * (0.58 + 0.62 * smoothstep(0.28, 0.82, fern));
      col = mix(v_colorB.rgb, v_colorA.rgb, fern);
      alpha = clamp(frostMask, 0.0, 1.0) * v_colorA.a;
      glowMix = 0.48;
    }

    if (alpha < 0.003) {
      discard;
    }

    if (u_frontMask > 0.5) {
      float centerDist = length((v_screenUv - 0.5) * vec2(2.0, 2.0));
      // Windowpane droplets stay slightly more visible across the glass while still protecting center text
      float minCenter = (kind == 13 || kind == 14) ? 0.52 : 0.30;
      alpha *= mix(minCenter, 1.0, smoothstep(0.0, 0.80, centerDist));
    }

    alpha = clamp(alpha, 0.0, 1.0);
    float blockA = alpha * (1.0 - clamp(glowMix, 0.0, 0.84));
    gl_FragColor = vec4(col * alpha, blockA);
  }
`;
