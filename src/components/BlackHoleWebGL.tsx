import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface BlackHoleRef {
  setProgress: (p: number) => void;
  setPnr: (pnr: number) => void;
}

const vsSource = `
  attribute vec4 aVertexPosition;
  void main() {
    gl_Position = aVertexPosition;
  }
`;

const fsSource = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_pnr;

  float rand(vec2 co) { 
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); 
  }

  float noise(vec2 p) {
      vec2 ip = floor(p); 
      vec2 u = fract(p); 
      u = u * u * (3.0 - 2.0 * u);
      return mix(
          mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
          mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
      float f = 0.0;
      f += 0.5000 * noise(p); p = p * 2.02;
      f += 0.2500 * noise(p); p = p * 2.03;
      f += 0.1250 * noise(p); p = p * 2.01;
      f += 0.0625 * noise(p);
      return f;
  }

  float hash31(vec3 p3) {
      p3  = fract(p3 * 0.1031);
      p3 += dot(p3, p3.zyx + 31.32);
      return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
      float r = length(uv);

      // --- SURREAL UNIVERSE AFTER CROSSING ---
      if (u_progress >= 1.0) {
          float postProgress = u_progress - 1.0;
          
          // Floating effect logic
          vec2 floatUV = uv * (1.0 - min(postProgress * 0.05, 0.2)); // slight zoom
          floatUV.x += sin(u_time * 0.1) * 0.05;
          floatUV.y += cos(u_time * 0.15) * 0.05;
          
          // Deep space galaxy background
          vec3 bgCol = vec3(0.02, 0.0, 0.05);
          
          // Nebula fields
          float neb1 = fbm(floatUV * 1.5 + u_time * 0.02);
          float neb2 = fbm(floatUV * 3.0 - u_time * 0.03 + vec2(100.0));
          float neb3 = fbm(floatUV * 5.0 + u_time * 0.01 + vec2(200.0));
          
          bgCol += vec3(0.5, 0.1, 0.8) * pow(neb1, 2.5) * 2.0;
          bgCol += vec3(0.1, 0.6, 0.9) * pow(neb2, 2.0) * 1.5;
          bgCol += vec3(0.9, 0.4, 0.2) * pow(neb3, 3.0) * 1.0;
          
          // Initial white flash fading out
          float flash = exp(-postProgress * 5.0);
          bgCol = mix(bgCol, vec3(1.0), flash);
          
          gl_FragColor = vec4(bgCol, 1.0);
          return;
      }
      
      // --- RELATIVISTIC BLACK HOLE (Geodesic Raymarching) ---
      
      // Scale visual size linearly
      float dist = mix(18.0, 0.98, u_progress);
      
      // Camera slightly above equatorial plane to see the full lensed disk
      vec3 ro = vec3(0.0, dist * 0.15, -dist); 
      vec3 ta = vec3(0.0, 0.0, 0.0);
      
      vec3 fwd = normalize(ta - ro);
      vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
      vec3 up = cross(fwd, right);
      
      float fov = mix(1.0, 2.5, u_progress); // Stretch FOV at the end for vertigo
      vec3 rd = normalize(fwd + uv.x * right * fov + uv.y * up * fov);
      
      vec3 p = ro;
      vec3 v = rd;
      
      float Rs = 1.0;
      float r_in = Rs * 1.5; // Photon sphere / ISCO area
      float r_out = Rs * 8.0;
      
      vec3 col = vec3(0.0);
      float alpha = 0.0;
      bool hitBH = false;
      
      // Raymarching Geodesics
      for (int i = 0; i < 180; i++) {
          float ray_r = length(p);
          
          if (ray_r < Rs) {
              hitBH = true;
              break;
          }
          if (ray_r > 25.0) {
              break;
          }
          
          vec3 h = cross(p, v);
          float h2 = dot(h, h);
          vec3 a = -1.5 * Rs * h2 * p / pow(ray_r, 5.0);
          
          float step_dt = max(0.04 * ray_r, 0.01);
          
          vec3 p_next = p + v * step_dt;
          vec3 v_next = v + a * step_dt;
          
          // Accretion disk intersection (y = 0 plane)
          if (sign(p.y) != sign(p_next.y)) {
              float f = -p.y / (p_next.y - p.y + 1e-6);
              vec3 hit_p = mix(p, p_next, f);
              float hit_r = length(hit_p);
              
              if (hit_r > r_in && hit_r < r_out) {
                  float vel = sqrt(Rs / (2.0 * hit_r));
                  vec3 disk_v = normalize(vec3(-hit_p.z, 0.0, hit_p.x)) * vel;
                  
                  vec3 photon_dir = -normalize(v); 
                  float dot_v = dot(photon_dir, disk_v);
                  float gamma = 1.0 / sqrt(1.0 - vel*vel);
                  float doppler = 1.0 / (gamma * (1.0 - dot_v));
                  
                  float density = smoothstep(r_in, r_in + 0.5, hit_r) * smoothstep(r_out, r_out - 4.0, hit_r);
                  float angle = atan(hit_p.z, hit_p.x);
                  float noise_val = smoothstep(0.0, 1.0, fbm(vec2(hit_r * 2.0, angle * 2.0 - u_time * 1.0)));
                  
                  // Doppler shifts color and intensity drastically
                  vec3 baseColor = mix(vec3(1.0, 0.1, 0.0), vec3(0.6, 0.8, 1.0), clamp(doppler - 0.8, 0.0, 1.0));
                  float intensity = pow(doppler, 3.0) * density * noise_val * (3.0 / hit_r);
                  
                  if (u_pnr > 0.0) {
                      baseColor = mix(baseColor, vec3(0.3, 0.0, 1.0), u_pnr);
                      intensity += u_pnr * 0.5;
                  }
                  
                  vec3 emit = baseColor * intensity * 4.0;
                  float alpha_layer = clamp(density * noise_val * 2.5, 0.0, 1.0);
                  
                  col += emit * (1.0 - alpha);
                  alpha += alpha_layer * (1.0 - alpha);
                  
                  if (alpha > 0.98) break;
              }
          }
          
          p = p_next;
          v = v_next;
      }
      
      // Starfield Background
      if (!hitBH && alpha < 0.98) {
          vec3 ray_dir = normalize(v);
          vec3 bg = vec3(0.0);
          
          // Soft Ethereal Nebula
          vec2 skyUV = ray_dir.xy * 2.5;
          float neb1 = fbm(skyUV + vec2(ray_dir.z));
          float neb2 = fbm(skyUV * 1.5 - vec2(ray_dir.z) + vec2(2.0, 3.0));
          
          bg += vec3(0.02, 0.05, 0.12) * pow(neb1, 2.0);
          bg += vec3(0.1, 0.02, 0.05) * pow(neb2, 3.0);
          
          // Beautiful Parallax Starfield (Cellular noise approach)
          for (float i = 1.0; i <= 3.0; i++) {
              vec3 p = ray_dir * (80.0 * i);
              vec3 id = floor(p);
              vec3 local = fract(p) - 0.5;
              
              float h = hash31(id);
              if (h > 0.95 + i * 0.01) {
                  float size = fract(h * 435.32);
                  
                  // Move star position randomly within the cell
                  vec3 starOffset = vec3(
                      fract(h * 153.21) - 0.5,
                      fract(h * 841.12) - 0.5,
                      fract(h * 231.44) - 0.5
                  ) * 0.5;
                  
                  float dist = length(local - starOffset);
                  float glow = smoothstep(0.1 * size + 0.08, 0.0, dist) * (1.5 + size);
                  glow *= sin(u_time * 2.0 + h * 50.0) * 0.5 + 0.5; // twinkle
                  vec3 starColor = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.8, 0.5), fract(h * 921.32));
                  bg += glow * starColor * (4.0 / i);
              }
          }
          
          col += bg * (1.0 - alpha);
      }
      
      // Horizon flash
      if (u_progress > 0.96) {
          float flash = pow((u_progress - 0.96) * 25.0, 2.0);
          col += vec3(flash);
      }
      
      // Post processing
      col = col / (1.0 + col); // Reinhard tonemapping
      col = pow(col, vec3(1.0/2.2)); // Gamma
      col *= 1.0 - 0.4 * dot(uv, uv); // Vignette

      gl_FragColor = vec4(col, 1.0);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const BlackHoleWebGL = forwardRef<BlackHoleRef, {}>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const pnrRef = useRef(0);
  const timeRef = useRef(0);

  useImperativeHandle(ref, () => ({
    setProgress: (p: number) => {
      progressRef.current = p;
    },
    setPnr: (pnr: number) => {
      pnrRef.current = pnr;
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vShader = compileShader(gl, gl.VERTEX_SHADER, vsSource)!;
    const fShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource)!;

    const program = gl.createProgram()!;
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,  1,-1, -1, 1,
      -1, 1,  1,-1,  1, 1
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'aVertexPosition');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const progLoc = gl.getUniformLocation(program, 'u_progress');
    const pnrLoc = gl.getUniformLocation(program, 'u_pnr');

    let animationFrame: number;
    let startTime = Date.now();

    const render = () => {
      timeRef.current = (Date.now() - startTime) / 1000;
      
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.useProgram(program);
      gl.uniform2f(resLoc, width, height);
      gl.uniform1f(timeLoc, timeRef.current);
      gl.uniform1f(progLoc, progressRef.current);
      gl.uniform1f(pnrLoc, pnrRef.current);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full z-0 touch-none pointer-events-none"
    />
  );
});

BlackHoleWebGL.displayName = 'BlackHoleWebGL';
