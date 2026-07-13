export type FogRendererOptions = {
  intensity: number;
  paused: boolean;
  reducedMotion: boolean;
  tint: readonly [number, number, number];
};

const VERTEX_SHADER = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_intensity;
  uniform vec3 u_tint;

  #define OCTAVES 6

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x)
      + (c - a) * u.y * (1.0 - u.x)
      + (d - b) * u.x * u.y;
  }

  mat2 rot(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = rot(0.48);

    for (int i = 0; i < OCTAVES; i++) {
      value += amplitude * noise(p);
      p = rotation * p * 2.02 + vec2(13.7, 7.9);
      amplitude *= 0.5;
    }
    return value;
  }

  float fogLayer(vec2 uv, float scale, float speed, vec2 drift, float warp) {
    float t = u_time * speed;
    vec2 q;
    q.x = fbm(uv * scale + drift * t);
    q.y = fbm(uv * scale + vec2(5.2, 1.3) - drift.yx * t * 0.75);

    vec2 r;
    r.x = fbm(uv * scale + warp * q + vec2(1.7, 9.2) + drift * t * 0.65);
    r.y = fbm(uv * scale + warp * q + vec2(8.3, 2.8) - drift * t * 0.45);
    return fbm(uv * scale + warp * r + drift * t);
  }

  void main() {
    vec2 resolution = max(u_resolution, vec2(1.0));
    vec2 uv = gl_FragCoord.xy / resolution;
    vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / resolution.y;
    vec2 flow = vec2(0.34, 0.06);

    float farFog = fogLayer(p + vec2(0.0, 0.18), 1.35, 0.030, flow, 1.05);
    float midFog = fogLayer(p * rot(-0.06) + vec2(0.0, 0.04), 2.15, 0.052, flow * 1.28, 1.20);
    float nearFog = fogLayer(p * rot(0.08) - vec2(0.0, 0.12), 3.15, 0.078, flow * 1.55, 1.35);
    float curl = fbm(p * 4.8 + vec2(u_time * 0.10, -u_time * 0.035) + vec2(farFog, midFog) * 2.0);

    farFog = smoothstep(0.35, 0.84, farFog);
    midFog = smoothstep(0.37, 0.82, midFog + curl * 0.08);
    nearFog = smoothstep(0.40, 0.80, nearFog + curl * 0.11);

    float fog = farFog * 0.34 + midFog * 0.54 + nearFog * 0.76;
    float lowerBias = smoothstep(0.96, 0.12, uv.y);
    float horizon = smoothstep(0.85, 0.18, uv.y);
    fog *= mix(0.55, 1.35, lowerBias) * mix(0.70, 1.0, horizon);

    float density = clamp(fog * mix(0.58, 0.94, u_intensity), 0.0, 0.9);
    vec3 pearl = mix(u_tint, vec3(0.90, 0.93, 0.94), 0.34 + nearFog * 0.16);
    float grain = noise(gl_FragCoord.xy * 0.31 + u_time * 31.0) - 0.5;
    pearl += grain * 0.025;

    gl_FragColor = vec4(max(pearl, 0.0), density);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create fog shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Fog shader compilation failed.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

class ProceduralFogRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private readonly resolutionLocation: WebGLUniformLocation | null;
  private readonly timeLocation: WebGLUniformLocation | null;
  private readonly intensityLocation: WebGLUniformLocation | null;
  private readonly tintLocation: WebGLUniformLocation | null;
  private animationFrame: number | null = null;
  private elapsed = Math.random() * 40;
  private lastFrame = performance.now();
  private destroyed = false;
  private dirty = true;
  private options: FogRendererOptions = {
    intensity: 0.7,
    paused: false,
    reducedMotion: false,
    tint: [0.74, 0.8, 0.84],
  };

  constructor(private readonly canvas: HTMLCanvasElement, private readonly root: HTMLElement) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL is unavailable.");
    this.gl = gl;

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to create fog program.");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || "Fog shader linking failed.";
      gl.deleteProgram(program);
      throw new Error(message);
    }
    this.program = program;

    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Unable to create fog geometry.");
    this.buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    this.timeLocation = gl.getUniformLocation(program, "u_time");
    this.intensityLocation = gl.getUniformLocation(program, "u_intensity");
    this.tintLocation = gl.getUniformLocation(program, "u_tint");
    gl.clearColor(0, 0, 0, 0);

    this.frame = this.frame.bind(this);
    this.animationFrame = window.requestAnimationFrame(this.frame);
  }

  update(options: FogRendererOptions): void {
    this.options = options;
    this.dirty = true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.animationFrame !== null) window.cancelAnimationFrame(this.animationFrame);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
    fogRenderers.delete(this.canvas);
  }

  private frame(now: number): void {
    if (this.destroyed) return;
    if (!this.canvas.isConnected) {
      this.destroy();
      return;
    }

    const visible =
      this.root.dataset.condition === "fog" &&
      this.root.classList.contains("weather-visible") &&
      !this.root.classList.contains("weather-hidden") &&
      document.visibilityState !== "hidden";
    const animated = visible && !this.options.paused && !this.options.reducedMotion;
    const delta = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (animated) this.elapsed += delta;

    if (visible && (animated || this.dirty)) {
      this.render(this.options.reducedMotion ? 12 : this.elapsed);
      this.dirty = false;
    }
    this.animationFrame = window.requestAnimationFrame(this.frame);
  }

  private render(time: number): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width < 1 || height < 1) return;
    const compact = width <= 768;
    const requestedDpr = Math.min(window.devicePixelRatio || 1, compact ? 0.8 : 1.15);
    const pixelBudgetScale = Math.sqrt(1_200_000 / Math.max(1, width * height));
    const dpr = Math.min(requestedDpr, pixelBudgetScale);
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    const gl = this.gl;
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(this.resolutionLocation, pixelWidth, pixelHeight);
    gl.uniform1f(this.timeLocation, time);
    gl.uniform1f(this.intensityLocation, Math.min(1, Math.max(0, this.options.intensity / 1.5)));
    gl.uniform3f(this.tintLocation, ...this.options.tint);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

const fogRenderers = new WeakMap<HTMLCanvasElement, ProceduralFogRenderer>();

export function updateProceduralFog(root: HTMLElement, options: FogRendererOptions): void {
  const canvas = root.querySelector<HTMLCanvasElement>(".weather-fx-procedural-fog");
  if (!canvas) {
    root.classList.remove("weather-fog-webgl-ready");
    return;
  }

  let renderer = fogRenderers.get(canvas);
  if (!renderer) {
    try {
      renderer = new ProceduralFogRenderer(canvas, root);
      fogRenderers.set(canvas, renderer);
      root.classList.add("weather-fog-webgl-ready");
    } catch (error) {
      root.classList.remove("weather-fog-webgl-ready");
      console.warn("[weather_hud] Procedural fog unavailable; using the CSS fallback.", error);
      return;
    }
  }
  renderer.update(options);
}

export function destroyProceduralFog(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>(".weather-fx-procedural-fog");
  if (canvas) fogRenderers.get(canvas)?.destroy();
  root.classList.remove("weather-fog-webgl-ready");
}
