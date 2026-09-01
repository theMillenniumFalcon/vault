"use client";

import { useEffect, useRef } from "react";

export const FooterText = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const vertSrc = `
            attribute vec2 a_position;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

    const fragSrc = `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;

            float noise(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            float smoothNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(noise(i), noise(i + vec2(1,0)), u.x),
                    mix(noise(i + vec2(0,1)), noise(i + vec2(1,1)), u.x),
                    u.y
                );
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float amp = 0.5;
                for (int i = 0; i < 5; i++) {
                    v += smoothNoise(p) * amp;
                    p *= 2.1;
                    amp *= 0.5;
                }
                return v;
            }

            vec3 blob(vec2 uv, vec2 center, float radius, vec3 color, float t, vec2 drift) {
                vec2 pos = center + drift;
                vec2 distort = vec2(
                    fbm(uv * 2.0 + t * 0.3),
                    fbm(uv * 2.0 + t * 0.25 + 5.2)
                ) * 0.35;
                float d = length(uv - pos + distort);
                float intensity = exp(-d * d / (2.0 * radius * radius));
                return color * intensity;
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution;
                uv.y = 1.0 - uv.y;

                float t = u_time * 0.6;

                vec2 d1 = vec2(
                    0.18 + 0.22 * sin(t * 1.1) + 0.08 * sin(t * 2.3),
                    0.50 + 0.25 * cos(t * 0.8) + 0.07 * cos(t * 3.1)
                );
                vec2 d2 = vec2(
                    0.55 + 0.20 * cos(t * 0.7 + 1.0) + 0.10 * sin(t * 2.7),
                    0.45 + 0.20 * sin(t * 1.3 + 0.5) + 0.08 * cos(t * 1.9)
                );
                vec2 d3 = vec2(
                    0.75 + 0.15 * sin(t * 1.5 + 2.1) + 0.06 * cos(t * 3.3),
                    0.55 + 0.22 * cos(t * 0.9 + 1.2) + 0.09 * sin(t * 2.1)
                );
                vec2 d4 = vec2(
                    0.38 + 0.18 * cos(t * 1.7 + 0.7) + 0.07 * sin(t * 2.5),
                    0.35 + 0.18 * sin(t * 1.1 + 3.0) + 0.06 * cos(t * 2.9)
                );
                vec2 d5 = vec2(
                    0.62 + 0.14 * sin(t * 2.0 + 1.5) + 0.05 * cos(t * 3.7),
                    0.65 + 0.16 * cos(t * 1.4 + 0.3) + 0.07 * sin(t * 1.7)
                );

                vec3 col = vec3(0.0);

                col += blob(uv, vec2(0.0), 0.24, vec3(0.55, 0.04, 0.04), t, d1);
                col += blob(uv, vec2(0.0), 0.30, vec3(0.12, 0.04, 0.62), t, d2);
                col += blob(uv, vec2(0.0), 0.20, vec3(0.38, 0.02, 0.45), t, d3);
                col += blob(uv, vec2(0.0), 0.18, vec3(0.02, 0.18, 0.42), t, d4);
                col += blob(uv, vec2(0.0), 0.14, vec3(0.05, 0.10, 0.75), t, d5);

                float pulse = 0.85 + 0.15 * sin(t * 1.8);
                col *= pulse;

                col = clamp(col, 0.0, 0.72);
                col = pow(col, vec3(1.3));

                float vignette = 1.0 - smoothstep(0.25, 0.95, length(uv - vec2(0.5)) * 1.6);
                col *= vignette;

                gl_FragColor = vec4(col, 1.0);
            }
        `;

    function createShader(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const vert = createShader(gl.VERTEX_SHADER, vertSrc);
    const frag = createShader(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");

    let animId: number;
    const start = performance.now();

    const render = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      className="relative min-h-[clamp(16rem,32vw,28rem)] overflow-hidden"
      style={{
        color: "var(--color-neutral-500, #737373)",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ display: "block" }}
      />

      <span
        className="pointer-events-none absolute bottom-0 left-1/2 w-full -translate-x-1/2 text-center font-black text-white select-none"
        style={{
          fontSize: "clamp(5rem, 18vw, 16rem)",
          lineHeight: 0.85,
          letterSpacing: "-0.04em",
          fontFamily: "var(--font-syne, ui-sans-serif, sans-serif)",
          fontWeight: 800,
          textRendering: "geometricPrecision",
          opacity: 0.18,
          zIndex: 2,
        }}
      >
        Vault.
      </span>

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(transparent 1px, rgba(0,0,0,0.5) 1px)",
          backgroundSize: "4px 4px",
          backdropFilter: "blur(1px)",
          WebkitMaskImage:
            "linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)",
          maskImage: "linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)",
          zIndex: 3,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          top: "-50%",
          height: "150%",
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0) 0% 40%, rgba(0,0,0,0.7) 100%)",
          zIndex: 4,
        }}
      />
    </div>
  );
};
