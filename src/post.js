// The camera. A small world photographed from close up has a thin slice of it sharp and the rest melting away in
// front and behind; that, more than anything, is what tells the eye it is looking at something tiny. The picture
// is drawn into a deep-colour target with its depth. Then:
//   1. the creases are shaded. Wherever cloth meets cloth (a seam, the foot of a wall, under a tree, between two
//      pillows) less of the room's light gets in, and a photograph of a real quilt is full of that soft dark. It
//      is worked out from the depth alone: each point looks round itself for anything standing over it.
//   2. it is blurred by how far each point is from the plane of focus;
//   3. it is developed: exposure, a film curve, a vignette, a little grain.
import * as THREE from 'three';

const QUAD = /* glsl */ `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createPost(renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const scene = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: false });
  scene.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
  const dark = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: false, generateMipmaps: false });
  const shaded = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false });
  const blurred = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false });
  const texel = { value: new THREE.Vector2(1 / size.x, 1 / size.y) };

  // --- 1a. how much of the room each point can see ---
  const crease = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    uniforms: { tDepth: { value: scene.depthTexture }, uTexel: texel, uInverse: { value: new THREE.Matrix4() }, uScale: { value: 1 }, uReach: { value: 0.5 } },
    vertexShader: QUAD,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tDepth; uniform vec2 uTexel; uniform mat4 uInverse; uniform float uScale; uniform float uReach;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;
      // where the point drawn at uv is, seen from the camera
      vec3 seen(vec2 uv) { vec4 p = uInverse * vec4(uv * 2.0 - 1.0, texture(tDepth, uv).r * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
      void main() {
        vec3 P = seen(vUv);
        if (-P.z > 160.0) { outC = vec4(1.0); return; }
        // which way the surface faces, from its nearer neighbour each way
        vec3 r = seen(vUv + vec2(uTexel.x, 0.0)), l = seen(vUv - vec2(uTexel.x, 0.0)), u = seen(vUv + vec2(0.0, uTexel.y)), d = seen(vUv - vec2(0.0, uTexel.y));
        vec3 dx = abs(r.z - P.z) < abs(P.z - l.z) ? r - P : P - l, dy = abs(u.z - P.z) < abs(P.z - d.z) ? u - P : P - d;
        vec3 N = normalize(cross(dx, dy));
        float px = min(uReach * uScale / -P.z, 70.0);
        // the looks are turned one of sixteen ways, in a pattern four pixels square, which the next pass smooths away
        ivec2 c = ivec2(gl_FragCoord.xy) & 3;
        float turn = float((c.x * 5 + c.y * 3 + (c.x ^ c.y) * 7) & 15) / 16.0 * 6.2831853;
        float sum = 0.0;
        for (int i = 0; i < 11; i++) {
          float a = turn + float(i) * 2.39996323, far = sqrt((float(i) + 0.5) / 11.0) * px;
          vec3 v = seen(vUv + vec2(cos(a), sin(a)) * far * uTexel) - P;
          float d2 = dot(v, v);
          // something stands over this point if it is out along the way the surface faces, and near
          sum += max(dot(N, v) - 0.012 - 0.0015 * -P.z, 0.0) / (d2 + 0.006) * (1.0 - smoothstep(uReach * uReach, uReach * uReach * 4.0, d2));
        }
        outC = vec4(vec3(clamp(1.0 - sum * uReach * 0.21, 0.0, 1.0)), 1.0);
      }`,
  });
  // --- 1b. smoothed, and laid over the picture ---
  const lay = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    uniforms: { tColor: { value: scene.texture }, tDark: { value: dark.texture }, tDepth: { value: scene.depthTexture }, uTexel: texel, uNear: { value: 0.3 }, uFar: { value: 400 }, uDeep: { value: 0.8 } },
    vertexShader: QUAD,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tColor; uniform sampler2D tDark; uniform sampler2D tDepth; uniform vec2 uTexel; uniform float uNear; uniform float uFar; uniform float uDeep;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;
      float metres(vec2 uv) { float z = texture(tDepth, uv).r * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      void main() {
        float d0 = metres(vUv), sum = 0.0, weight = 0.0;
        for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
          vec2 uv = vUv + (vec2(float(x), float(y)) + 0.5) * uTexel;
          // only what is at about the same distance: a thing's own dark doesn't leak onto what is behind it
          float w = 1.0 - smoothstep(0.02, 0.06, abs(metres(uv) - d0) / d0);
          sum += texture(tDark, uv).r * w; weight += w;
        }
        float open = weight > 0.0 ? sum / weight : 1.0;
        vec3 c = texture(tColor, vUv).rgb;
        // the dark of a crease keeps a little of the cloth's own colour: it is cloth lit by cloth
        outC = vec4(c * mix(vec3(1.0), pow(vec3(open), vec3(1.0, 1.08, 1.2)), uDeep), 1.0);
      }`,
  });
  // --- 2. focus ---
  const focus = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    uniforms: {
      tColor: { value: shaded.texture }, tDepth: { value: scene.depthTexture }, uTexel: texel,
      uNear: { value: 0.3 }, uFar: { value: 400 }, uFocus: { value: 8 }, uLens: { value: 26 }, uMost: { value: 22 }, uStep: { value: 1.5 },
    },
    vertexShader: QUAD,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uTexel;
      uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uLens; uniform float uMost; uniform float uStep;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;
      float metres(vec2 uv) { float z = texture(tDepth, uv).r * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      // how wide, in pixels, a point at that distance is smeared
      // (nothing within a sixth of the distance to the plane of focus is smeared at all, and the smear comes on
      // slowly: the world he walks in is to be seen clearly, and only what is far behind it or right against the
      // glass melts)
      float blurOf(float d) { float x = max(abs(d - uFocus) - 0.16 * uFocus, 0.0) / d; return clamp(uLens * x * x, 0.0, uMost); }
      void main() {
        float d0 = metres(vUv), b0 = blurOf(d0);
        vec3 sum = texture(tColor, vUv).rgb;
        float count = 1.0, r = uStep;
        // a spiral of looks outward; turned differently at every pixel so that no pattern shows
        float a = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        for (int i = 0; i < 220 && r < uMost; i++) {
          vec2 uv = vUv + vec2(cos(a), sin(a)) * uTexel * r;
          float d = metres(uv), b = blurOf(d);
          // something behind can't smear over something sharp in front of it
          if (d > d0) b = clamp(b, 0.0, b0 * 2.0);
          float m = smoothstep(r - 0.5, r + 0.5, b);
          sum += mix(sum / count, texture(tColor, uv).rgb, m);
          count += 1.0;
          a += 2.39996323;
          r += uStep / r;
        }
        outC = vec4(sum / count, 1.0);
      }`,
  });
  // --- 3. developing ---
  const develop = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    uniforms: { tColor: { value: blurred.texture }, uExposure: { value: 1 }, uTime: { value: 0 }, uGrain: { value: 0.022 }, uSize: { value: size.clone() } },
    vertexShader: QUAD,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tColor; uniform float uExposure; uniform float uTime; uniform float uGrain; uniform vec2 uSize;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;
      // a film curve (ACES, as fitted by Stephen Hill)
      vec3 film(vec3 c) {
        c = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777) * c;
        c = (c * (c + 0.0245786) - 0.000090537) / (c * (0.983729 * c + 0.4329510) + 0.238081);
        return clamp(mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602) * c, 0.0, 1.0);
      }
      void main() {
        vec3 c = texture(tColor, vUv).rgb * uExposure;
        vec2 q = vUv - 0.5;
        c *= 1.0 - 0.34 * smoothstep(0.25, 0.85, length(q * vec2(1.0, uSize.y / uSize.x) * 1.25));
        c = film(c * 1.05);
        // a touch more colour than the film gives: these are scraps chosen for being bright
        c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 1.14);
        c = pow(c, vec3(1.0 / 2.2));
        float g = fract(sin(dot(gl_FragCoord.xy + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        outC = vec4(c + g * uGrain, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), focus);
  quad.frustumCulled = false;
  const stage = new THREE.Scene();
  stage.add(quad);
  const flat = new THREE.Camera();
  const pass = (material, target) => { quad.material = material; renderer.setRenderTarget(target); renderer.render(stage, flat); };

  return {
    focus: focus.uniforms, develop: develop.uniforms, depth: scene.depthTexture,
    overlay: null, // a scene of things that are drawn over the focused picture, unblurred (dust in the air)
    resize() {
      renderer.getDrawingBufferSize(size);
      for (const target of [scene, dark, shaded, blurred]) target.setSize(size.x, size.y);
      texel.value.set(1 / size.x, 1 / size.y);
      develop.uniforms.uSize.value.copy(size);
    },
    /** distance: how far off the plane of focus is. */
    render(world, camera, distance) {
      const scale = size.y / 1080;
      for (const u of [focus.uniforms, lay.uniforms]) { u.uNear.value = camera.near; u.uFar.value = camera.far; }
      focus.uniforms.uFocus.value = distance;
      focus.uniforms.uLens.value = this.lens * scale; focus.uniforms.uMost.value = this.most * scale;
      renderer.setRenderTarget(scene);
      renderer.clear();
      renderer.render(world, camera);
      if (this.deep > 0) {
        crease.uniforms.uInverse.value.copy(camera.projectionMatrixInverse);
        crease.uniforms.uScale.value = camera.projectionMatrix.elements[5] * size.y * 0.5;
        crease.uniforms.uReach.value = this.reach;
        lay.uniforms.uDeep.value = this.deep;
        pass(crease, dark);
        pass(lay, shaded);
        focus.uniforms.tColor.value = shaded.texture;
      } else focus.uniforms.tColor.value = scene.texture;
      pass(focus, blurred);
      if (this.overlay) renderer.render(this.overlay, camera);
      pass(develop, null);
    },
    lens: 20, // how fast things blur away from the plane of focus
    most: 15, // the widest blur, in pixels at 1080
    reach: 0.5, // how far (metres) a point looks round itself for what stands over it
    deep: 0.8, // how dark a crease gets; 0: none
  };
}
