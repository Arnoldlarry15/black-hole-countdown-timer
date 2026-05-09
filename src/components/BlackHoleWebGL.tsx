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
          
          // Stars
          float s = rand(floatUV * 150.0);
          if (s > 0.98) {
              bgCol += vec3(pow(s, 20.0) * 5.0);
              float twinkle = sin(u_time * 3.0 + s * 100.0) * 0.5 + 0.5;
              bgCol += vec3(0.6, 0.8, 1.0) * twinkle * pow(s, 40.0) * 8.0;
          }
          
          // Galaxies / Supernovae
          float sn = rand(floatUV * 30.0);
          if (sn > 0.995) {
              float snPulse = sin(u_time * 1.0 + sn * 50.0) * 0.5 + 0.5;
              float flare = 0.01 / max(length(fract(floatUV * 30.0) - 0.5), 0.001);
              bgCol += vec3(1.0, 0.8, 0.4) * snPulse * flare * 2.0;
          }

          // Initial white flash fading out
          float flash = exp(-postProgress * 5.0);
          bgCol = mix(bgCol, vec3(1.0), flash);
          
          gl_FragColor = vec4(bgCol, 1.0);
          return;
      }
      
      // Decrease starting distance to make BH look massive initially, linearly falling
      float dist = mix(4.0, 0.005, u_progress); // Scale linearly as time moves on
      float eh = 0.2 / max(dist, 0.0001); // Event horizon apparent size 

      // Gravitational Lensing (Einstein field equations approximation)
      vec2 lensedUV = uv;
      if (r > eh) {
          float warp = (eh * eh) / (r * r);
          lensedUV = uv * (1.0 + warp * 2.5); 
      }

      // Background Stars
      float s = rand(lensedUV * 300.0);
      vec3 col = vec3(0.0);
      if (s > 0.992) {
          col += vec3(pow(s, 50.0) * 15.0);
          col *= mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.7, 0.5), rand(lensedUV * 10.0));
      }

      // Spatial Distortion Glow
      if (r > eh) {
          float backgroundDistortion = smoothstep(eh * 5.0, eh, r);
          col += vec3(0.01, 0.03, 0.08) * backgroundDistortion * fbm(lensedUV * 15.0);
      }

      // Primary Accretion Disk (Tilted)
      vec2 diskUV = lensedUV;
      // As we get closer (dist gets smaller), the disk tilt changes simulating changing viewing plane
      diskUV.y *= mix(8.0, 2.0, u_progress); 
      float dr = length(diskUV);
      float da = atan(diskUV.y, diskUV.x);

      vec3 diskCol = vec3(0.0);
      if (dr > eh * 1.05 && dr < eh * 15.0) {
          float spin = u_time * 2.5 / max(dr, 0.1);
          float d = fbm(vec2(dr * 12.0, da * 5.0) - spin);

          // Doppler beaming
          float doppler = 1.0 - (uv.x / max(r, 0.0001)) * 0.9;
          vec3 baseColor = mix(vec3(1.0, 0.1, 0.0), vec3(1.0, 0.9, 0.5), clamp(doppler, 0.0, 1.0));

          if (u_pnr > 0.0) {
              baseColor = mix(baseColor, vec3(0.2, 0.0, 1.0), u_pnr * 0.9);
              d += fbm(diskUV * 15.0 + u_time * 8.0) * u_pnr * 0.6;
          }

          float fade = smoothstep(eh * 1.05, eh * 2.5, dr) * exp(-(dr - eh * 1.3) * 0.4);
          diskCol = baseColor * d * fade * max(doppler, 0.1) * 8.0;
      }

      // Lensed Top/Bottom Halo
      vec3 haloCol = vec3(0.0);
      if (r > eh && r < eh * 4.0) {
          float poleBlend = pow(abs(uv.y) / max(r, 0.0001), 2.5); 
          float arcR = abs(r - eh * 1.15);
          float arcFade = exp(-arcR * 5.0 / eh);
          
          float doppler = 1.0 - (uv.x / max(r, 0.0001)) * 0.6;
          vec3 arcColor = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 0.8, 0.4), clamp(doppler, 0.0, 1.0));
          float arcNoise = fbm(vec2(atan(uv.y, uv.x) * 5.0 - u_time, r * 12.0));

          haloCol = arcColor * arcFade * poleBlend * arcNoise * max(doppler, 0.2) * 6.0;
          
          if (u_pnr > 0.0) {
              haloCol = mix(haloCol, vec3(0.3, 0.1, 1.0) * arcFade * poleBlend * 4.0, u_pnr * 0.8);
          }
      }

      // Add Back Disk and Halo
      float isFrontDisk = step(uv.y, 0.0); // 1.0 if y < 0 (front of the tilted disk is below the center)
      col += diskCol * (1.0 - isFrontDisk); 
      col += haloCol;

      // Photon Sphere Outline
      float photonDist = abs(r - eh * 1.02);
      float photonRing = exp(-photonDist * 50.0 / eh);
      col += vec3(1.0, 0.9, 0.5) * photonRing * 3.5;

      // Inner event horizon subtle gradient falloff
      float ehGlow = exp(-(r - eh) * 15.0 / eh);
      col += vec3(0.8, 0.3, 0.0) * ehGlow * clamp(1.0 - u_pnr, 0.0, 1.0);

      if (u_pnr > 0.0) {
          float pnrGlow = exp(-(r - eh) * 12.0 / eh) * u_pnr;
          col += vec3(0.6, 0.0, 1.0) * pnrGlow * 3.0 * fbm(uv * 20.0 - u_time * 5.0);
      }

      // Pure Black Singular Mask
      if (r < eh) {
          col = vec3(0.0);
      }

      // Add Front Disk over the shadow
      col += diskCol * isFrontDisk; // Add the front half on top of the black shadow

      // Post-PNR eerie glitch inside
      if (r < eh * 0.98 && u_pnr > 0.0) {
          float voidGlitch = fbm(uv * 30.0 + u_time * 10.0);
          if (voidGlitch > 0.9) {
              col += vec3(0.1, 0.0, 0.2) * u_pnr * (voidGlitch - 0.9) * 5.0;
          }
      }

      if (u_progress > 0.96) {
          float flash = pow((u_progress - 0.96) * 25.0, 2.0);
          col += vec3(flash);
      }

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
