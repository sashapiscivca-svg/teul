// A shader pass over the finished picture, for the times the world itself is not right: the winter rift (the town
// inside out — colours turned over, an aurora over the roofs, snow falling up, the air wobbling, edges split into
// colours) and the eerie nights (drained colour, a red push, grain, fog creeping along the ground, a vignette that
// beats with the heart). The scene canvas is copied into a WebGL texture each frame and drawn through the shader
// onto a canvas laid over it; where WebGL is missing, a CSS filter on the scene does a little of the same.

export type PostMode = 'none' | 'mirror' | 'horror';

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
varying vec2 uv;
uniform sampler2D tex;
uniform float t;
uniform float mode;
uniform float amount;
uniform float pulse;
uniform float still;
uniform vec2 res;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 q = vec2(uv.x, 1.0 - uv.y);
  float m = 1.0 - still;
  if (mode < 0.5) {
    // the town inside out
    // the air wobbles slowly, in long waves (never row by row: the pixels stay whole)
    q.x += sin(q.y * 5.0 + t * 0.8) * 0.0022 * m * amount;
    q.y += sin(q.x * 4.0 + t * 0.6) * 0.0016 * m * amount;
    float ab = 0.0014 * amount;
    vec3 c = vec3(texture2D(tex, q + vec2(ab, 0.0)).r, texture2D(tex, q).g, texture2D(tex, q - vec2(ab, 0.0)).b);
    // the colours turned over, the light kept: warm windows burn cold, the blue night goes to rust and violet
    float Y = dot(c, vec3(0.299, 0.587, 0.114));
    float I = dot(c, vec3(0.596, -0.274, -0.322));
    float Q = dot(c, vec3(0.211, -0.523, 0.312));
    float ang = 3.14159 + 0.35 * sin(t * 0.05);
    float I2 = I * cos(ang) - Q * sin(ang);
    float Q2 = I * sin(ang) + Q * cos(ang);
    I2 *= 1.6; Q2 *= 1.6;
    vec3 turned = vec3(Y + 0.956 * I2 + 0.621 * Q2, Y - 0.272 * I2 - 0.647 * Q2, Y - 1.106 * I2 + 1.703 * Q2);
    // and the whole of it sunk into a deep, cold night, the lit things glowing out of it
    turned = clamp(turned, 0.0, 1.0);
    vec3 night = turned * turned * 0.45 + turned * vec3(0.3, 0.36, 0.55) + vec3(0.015, 0.0, 0.05);
    c = mix(c, night, amount);
    // the aurora over the roofs
    float top = smoothstep(0.6, 0.0, q.y);
    float band = sin(q.x * 9.0 + t * 0.35 + sin(q.x * 3.0 - t * 0.2) * 2.0) * 0.5 + 0.5;
    float band2 = sin(q.x * 14.0 - t * 0.27 + 1.7) * 0.5 + 0.5;
    vec3 aur = mix(vec3(0.25, 1.0, 0.65), vec3(0.75, 0.35, 1.0), band2);
    c += aur * top * pow(band, 2.0) * (0.7 + 0.3 * sin(t * 0.7 + q.x * 5.0)) * amount;
    // snow falling up
    vec2 g = vec2(q.x * res.x / 9.0, q.y * res.y / 9.0 + t * 2.4 * m);
    vec2 cell = floor(g);
    vec2 f = fract(g) - vec2(hash(cell), hash(cell + 7.1));
    float flake = smoothstep(0.12, 0.0, length(f)) * step(0.72, hash(cell + 3.3));
    c = mix(c, vec3(0.92, 0.96, 1.0), flake * 0.85 * amount);
    // the long dark at the edges
    float v = length((uv - 0.5) * vec2(1.1, 1.0));
    c *= mix(1.0, smoothstep(0.95, 0.35, v), 0.7 * amount);
    gl_FragColor = vec4(c, 1.0);
  } else {
    // the eerie night
    q.x += sin(q.y * 60.0 + t * 7.0) * 0.0007 * pulse * m;
    vec3 c = texture2D(tex, q).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(l), 0.55 * amount);
    c *= vec3(1.0 + 0.28 * amount, 0.86, 0.82);
    // fog creeping along the ground (the lower part of the picture), drifting
    float fog = noise(vec2(q.x * 4.0 + t * 0.08 * m, q.y * 7.0)) * 0.6 + noise(vec2(q.x * 9.0 - t * 0.05 * m, q.y * 13.0)) * 0.4;
    c = mix(c, vec3(0.62, 0.6, 0.66), fog * smoothstep(0.35, 1.0, q.y) * 0.45 * amount);
    // grain
    c += (hash(q * res + fract(t * 13.0)) - 0.5) * 0.09 * amount;
    // the vignette, beating
    float v = length((uv - 0.5) * vec2(1.15, 1.0));
    float edge = smoothstep(0.85 - 0.12 * pulse, 0.25, v);
    c *= mix(1.0, edge, 0.85 * amount);
    c = mix(c, vec3(0.35, 0.0, 0.02), (1.0 - edge) * 0.35 * pulse * amount);
    gl_FragColor = vec4(c, 1.0);
  }
}
`;

export class Post {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private tex: WebGLTexture | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private mode: PostMode = 'none';
  private failed = false;

  constructor(private readonly scene: HTMLCanvasElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wonders-post';
    this.canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none;image-rendering:pixelated;';
    scene.after(this.canvas);
  }

  /** Whether the shader can run here (else a CSS filter stands in). */
  get supported(): boolean {
    return this.init();
  }

  private init(): boolean {
    if (this.gl) return true;
    if (this.failed) return false;
    try {
      const gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false }) as WebGLRenderingContext | null;
      if (!gl) throw new Error('no webgl');
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type) as WebGLShader;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
        return s;
      };
      const prog = gl.createProgram() as WebGLProgram;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      for (const n of ['tex', 't', 'mode', 'amount', 'pulse', 'still', 'res']) this.u[n] = gl.getUniformLocation(prog, n);
      this.gl = gl;
      this.prog = prog;
      this.tex = tex;
      return true;
    } catch {
      this.failed = true;
      return false;
    }
  }

  /** Draws this frame through the shader (or puts the scene back as it is with `none`). */
  render(mode: PostMode, t: number, opts: { amount?: number; pulse?: number; still?: boolean; filter?: string } = {}): void {
    if (mode !== this.mode) {
      this.mode = mode;
      this.scene.style.opacity = '';
      this.scene.style.filter = '';
      this.canvas.style.display = 'none';
    }
    if (mode === 'none') return;
    if (!this.init() || !this.gl) {
      // no shader here: a filter on the scene says some of it
      this.scene.style.filter = opts.filter ?? (mode === 'mirror' ? 'invert(0.86) hue-rotate(180deg) saturate(1.4) contrast(1.1)' : 'grayscale(0.55) sepia(0.25) contrast(1.15) brightness(0.8)');
      return;
    }
    const gl = this.gl;
    const s = this.scene;
    if (this.canvas.width !== s.width || this.canvas.height !== s.height) {
      this.canvas.width = s.width;
      this.canvas.height = s.height;
    }
    this.canvas.style.width = s.style.width || `${s.clientWidth}px`;
    this.canvas.style.height = s.style.height || `${s.clientHeight}px`;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);
    } catch {
      return;
    }
    gl.uniform1i(this.u.tex, 0);
    gl.uniform1f(this.u.t, t);
    gl.uniform1f(this.u.mode, mode === 'mirror' ? 0 : 1);
    gl.uniform1f(this.u.amount, opts.amount ?? 1);
    gl.uniform1f(this.u.pulse, opts.pulse ?? 0);
    gl.uniform1f(this.u.still, opts.still ? 1 : 0);
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.canvas.style.display = 'block';
    // the scene stays where it is for taps, unseen under the shaded copy
    s.style.opacity = '0';
  }
}
