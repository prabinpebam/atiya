> Research snapshot: 2026-09-24. Produced by an AI research agent; versions verified against GitHub releases and the Microsoft npm proxy. Items marked ⚠️ or 'est.' are unverified.

> **Superseded by the spec:** the `client:only="react"` island suggested below would download the game bundle before capability checks. The [spec](../spec.md#59-loading-strategy-capability-gated-dynamic-import) uses a capability-gated dynamic import instead (ADR-8).

# 3D "Little Planet" Portfolio Navigation: Stack Research (September 2026)

## Summary
- **Recommended stack:** Astro 7 with a `client:only="react"` island, React Three Fiber **9.7.0**, drei **10.7.8** and three **0.186.0**. Use the classic `WebGLRenderer`, not WebGPU.
- **Movement:** skip the physics engine and use a kinematic, quaternion-based controller. For an Animal Crossing-style fixed camera, the simplest robust option is to rotate the planet under a stationary player. Rapier would add about 811 KB gzipped of WASM for no real gain in a POC.
- **Physics path if you want it later:** `ecctrl@2.0.2` now has real spherical custom-gravity support.
- **Why not WebGPU yet:** the official three.js manual still calls `WebGPURenderer` "experimental". Most drei helpers are still being ported to WebGPU/TSL (issue #2658 is still open).
- **npm proxy warning:** I confirmed the proxy reports several wrong `latest` tags and is behind GitHub. Pin every version listed below.
- **Best reference project:** Abeto's **Messenger**, a tiny-planet game built with three.js. There is also an open-source clone whose sphere-movement code you can study.

---

## 0. npm proxy problems I confirmed (Sept 24, 2026)

| Package | Proxy `latest` | Actual stable (GitHub releases) | Note |
|---|---|---|---|
| @react-three/fiber | **10.0.0-canary.fd3335d** ❌ | v9.8.0 (2026-09-22); proxy only has up to **9.7.0** | 9.8.0 returns 404 on the proxy |
| playcanvas | **2.23.0-beta.11** ❌ | v2.22.4 (2026-09-23) | |
| @needle-tools/engine | **6.0.0-alpha.3** ❌ | 5.1.13 (proxy `stable` tag) | |
| @babylonjs/core | 9.26.2 | 9.27.1 (2026-09-18) | proxy is behind; 9.27.1 returns 404 |
| @playcanvas/web-components | 0.23.0 | v0.24.0 (2026-09-23) | proxy is behind |
| astro | 7.3.3 | astro@7.3.4 (2026-09-22) | proxy is behind |

**Peer-range trap:** R3F 9.7.0 declares `react >=19 <19.3`, but React `latest` is now 19.3.0 (2026-09-09).
- Pin **react/react-dom 19.2.8** until the proxy has R3F 9.8.0, which is the release that adds React 19.3 support (https://github.com/pmndrs/react-three-fiber/releases/tag/v9.8.0).
- ecctrl 2.x needs `react >=19.2.7`, which 19.2.8 satisfies.

---

## 1. Rendering engines

| Option | Current version / status | Size (bundlephobia min+gz; whole package, not tree-shaken) | Verdict for this POC |
|---|---|---|---|
| **three.js** | **r186 / npm 0.186.0** (2026-09-08). The `WebGPURenderer` falls back to WebGL2 automatically and has a `forceWebGL` option. `ShaderMaterial`, `onBeforeCompile` and `EffectComposer` are **not supported** under it (port those to TSL). The manual says the renderer "is still in an experimental state… you will encounter missing features or a better performance with `WebGLRenderer`". It also says `WebGLRenderer` "is still maintained and the recommended choice for pure WebGL 2 applications" (`mrdoob/three.js:manual/pages/webgpurenderer.html`, last commit 13a717c, 2026-07-12). A WebGL2-fallback resource-leak bug was only fixed 2026-09-20 (https://github.com/mrdoob/three.js/issues/34597). | 181 KB gz. Raw builds: `three.core.js` 1424 KB + `three.module.js` 647 KB, versus `three.webgpu.js` 2231 KB, so the WebGPU path is heavier (jsDelivr file listing). | ✅ Foundation |
| **React Three Fiber** | **9.7.0** stable on the proxy; **9.8.0** on GitHub (React 19.3 support; roots now configure synchronously, which fixes WebGPU and StrictMode issues). **v10.0.0-alpha.5**: supports both WebGL and WebGPU renderers, `state.gl` becomes `state.renderer`, new scheduler, TSL hooks. Maintainers say "consider all features experimental" (https://github.com/pmndrs/react-three-fiber/releases/tag/v10.0.0-alpha.1). | 51 KB gz | ✅ Use v9 |
| **@react-three/drei** | **10.7.8** stable (2026-08-05). v11.0.0-alpha.7 is the WebGPU/TSL port, still in progress (https://github.com/pmndrs/drei/issues/2658, open). | 488 KB gz if you import everything; tree-shakes | ✅ |
| **Babylon.js** | **9.x** (9.0 shipped 2026-03-26: clustered lighting, Frame Graph v1, animation retargeting; https://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0/). Apache-2.0. Batteries included: Havok (`@babylonjs/havok` 1.3.14), GUI, Inspector. React bindings are community-maintained (`react-babylonjs` 4.0.2). | 1.7 MB gz for all of `@babylonjs/core` | Strong option, but heavier and not React-native |
| **PlayCanvas** | Engine v2.22.4 (MIT, WebGPU + WebGL2). `@playcanvas/react` 0.11.5 is still pre-1.0; its 0.11.5 release only just fixed `Screen`/`Element` components that failed to render. Web components v0.24.0. | 600 KB gz | Good engine, but the React layer is immature |
| **Threlte** (Svelte) | @threlte/core 8.6.0, extras 9.21.1, rapier 3.5.0 | — | Only if you choose Svelte. flo-bit.dev uses Astro + Svelte + Threlte for tiny planets. |
| **TresJS** (Vue) | @tresjs/core 5.9.0 (2026-09-14), cientos 5.9.0, @tresjs/rapier 1.1.0 | — | Only if you choose Vue |
| **Needle Engine** | Stable 5.1.13. Ships a **three fork** (`@needle-tools/three@0.169.19`). The Hobby tier is non-commercial with Needle branding; Pro is €588/seat/yr (https://cloud.needle.tools/pricing). | — | ❌ Licensing, and a forked three |
| **Spline** | @splinetool/runtime 2.0.53, react-spline 4.1.0; proprietary. Standalone WebGL runtime is about 449 KB brotli, plus about 419 KB brotli of physics WASM (jsDelivr). | — | ❌ Weak for custom sphere gameplay; fine for decorative scenes |
| **Godot 4.7.2 / Unity web** | Godot's default web export is about 40 MB raw, roughly 9–13 MB compressed (third-party measurements, e.g. https://jion.in/devlog/godot-web-minification). | Multi-MB | ❌ Slow first load; poor fit inside an Astro page |
| **Bevy** | 0.19.1 stable, 0.20.0-rc.1. Rust/WASM. | Large WASM | ❌ Wrong skill profile for this project |

**GitHub Copilot agent mode:** three.js and R3F have by far the largest body of examples, so Copilot is strongest there. It tends to produce outdated R3F v8 patterns, so keep the pinned versions and conventions in `AGENTS.md`.

---

## 2. Physics and character control

**Physics libraries:**
- **@react-three/rapier 2.2.0** (2025-11-03) pins `@dimforge/rapier3d-compat` **0.19.2**. Don't install rapier-compat 0.20.0 separately (published 2026-08-08, not yet in the CHANGELOG on `main`).
  - The compat build inlines its WASM: about 2.2 MB min / 811 KB gz.
  - Rapier's kinematic character controller supports `setUp(vector)`, which allows an arbitrary up direction (`dimforge/rapier.js:src.ts/control/character_controller.ts:85-96`).
- **ecctrl 2.0.2** (2026-09-06, MIT) supports spherical gravity out of the box:
  - `<Physics gravity={[0,0,0]}><Ecctrl enableCustomGravity>` plus `useCustomGravity().setGravityField(pos => center−pos … ×9.81)` (pmndrs/ecctrl README lines 104-112 and 157-235).
  - `EcctrlCameraControls` adds `setUp(newUp)`, but you still drive the follow target yourself (README lines 237-275).
  - It ships a DOM `Joystick` and `VirtualButton` plus input stores (README lines 658-690).
  - Peer dependencies: drei ≥10.7, fiber ≥9.4, rapier ≥2.2.0, react ≥19.2.7, three ≥0.184; leva is optional.
  - The README doesn't mention gamepads.
- **cannon-es 0.20.0**: last release August 2022. Avoid.
- **jolt-physics 1.1.0** (2026-07-11): about 1 MB gz, low-level API, no R3F bindings. Overkill here.

**Recommended POC approach: no physics, kinematic control.** Two variants.

**Option A: rotate the world (best for a fixed Animal Crossing-style camera).**
- The player sits permanently at (0, R, 0) and the camera is fixed.
- Input turns into a world direction `d`. Each frame: `axis = UP × d`, `q = axisAngle(axis, −speed·dt/R)`, then `planet.quaternion.premultiply(q).normalize()`. Set the character's yaw with `atan2(d.x, d.z)` and smooth it with `maath` `easing.dampAngle`.
- Advantages: there are no poles or gimbal lock, the camera needs no up-vector smoothing, and lighting stays fixed.
- Limitation: it doesn't mix well with a physics engine, and NPCs must be children of the planet.

**Option B: move the player in its local tangent frame (Mario Galaxy-style follow camera).** This is what the open-source Messenger clone does (`Glowin/messager:src/player.ts:110-199`):
- Compute `up = normalize(pos)`, then `axis = up × forward` and `q = axisAngle(axis, angle)`.
- Apply `q` to **both** the position and the orientation (`position.applyQuaternion(q)` and `quaternion.premultiply(q)`). Rotating both together keeps `forward` tangent to the sphere, so there is no pole singularity.
- Turn with `rotateOnAxis(localUp)`.
- Snap back to radius R each frame, and clamp `dt` to 0.1 so switching tabs doesn't make the character jump (line 111).
- Camera: set `camera.up` to the surface normal, position it at `pos + up·h − forward·d`, lerp it, then `lookAt` the player (`Glowin/messager:src/camera.ts:17-54`).
- The underlying math follows Catlike Coding's custom-gravity tutorial (https://catlikecoding.com/unity/tutorials/movement/custom-gravity/): replace every "world up" with the local up axis.

**Terrain and obstacles:**
- Terrain bumps: raycast along `−up` against the planet using three-mesh-bvh 0.9.15 (drei `<Bvh>`).
- Obstacles: treat them as circles on the sphere and push the player out along the tangent.

---

## 3. Input
- **Keyboard: drei `KeyboardControls`.**
  - Use `event.code` values (`KeyW`/`ArrowUp` and so on) so it works on any keyboard layout.
  - It has a `domElement` prop. Scoping key listeners to the focused game container satisfies WCAG 2.1.4 (see §9).
- **Gamepad:** poll `navigator.getGamepads()` inside `useFrame`.
  - Standard mapping: `axes[0..1]` is the left stick, `buttons[0]` is confirm.
  - Use a deadzone of about 0.15–0.2. The API requires a secure context (HTTPS).
  - The wrapper libraries are stale (joypad.js 2023, gamecontroller.js 2020), so skip them.
- **Touch:**
  - **nipplejs 1.0.4**: a TypeScript-first rewrite (v1.0.0, 2026-03-21), no dependencies, about 6 KB gz, MIT (https://github.com/yoannmoinet/nipplejs/releases/tag/v1.0.0).
  - If you adopt ecctrl, its built-in `Joystick` works too.
  - react-joystick-component 6.2.1 hasn't been updated since 2023.
- **Tap/click to move:** R3F's `onPointerDown` on the planet gives you a surface point. Steer along the great circle toward it (`axis = p × target`). This also provides the non-drag alternative that WCAG 2.5.7 requires. Messenger can be played with one finger on mobile and the mouse alone on desktop (https://www.awwwards.com/messenger.html).
- **Architecture:** normalize all devices into one intent store (zustand 5.0.15), e.g. `{moveX, moveY, interact}`, and read it in `useFrame`.

---

## 4. Camera
- **camera-controls 3.1.2** (2025-11-17): configure `smoothTime`/`draggingSmoothTime` and `colliderMeshes`. After changing `camera.up`, call `updateCameraUp()` (yomotsu/camera-controls README lines 174-190 and 684-686). drei's `<CameraControls>` wraps it.
- **maath 0.10.8:** `easing.damp3`, `dampQ` and `dampLookAt` give frame-rate-independent smoothing. drei already depends on it.
- **Animal Crossing-style camera** (with Option A): fixed pitch around 25–35°, narrow FOV around 35–45°, no user orbit, and a slight lag.
- **Follow camera** (with Option B): blend `camera.up` toward the surface normal (lerp around 0.1). This is the same pattern as ecctrl's README example.

---

## 5. Assets and art pipeline

**Asset sources:**
- **Licenses I verified:**
  - **KayKit Adventurers** is CC0 (LICENSE.txt, plus https://kaylousberg.itch.io/kaykit-adventurers, which asks you not to resell unmodified copies).
  - **Kenney**: all assets are CC0 (https://kenney.nl/support).
  - **Quaternius Universal Animation Library** is CC0. It is Mixamo-rig compatible, and v2.0 was released 2026-01-23 (https://quaternius.itch.io/universal-animation-library).
- **Mixamo:**
  - Adobe still describes it as a free "limited duration technology preview".
  - It is royalty-free and attribution is optional.
  - You may not redistribute the raw files, and you may not use them to train ML models (https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400).
  - Prefer CC0 animations where you can, so licensing is unambiguous.

**Compression and loading:**
- **@gltf-transform/cli 4.5.0** (2026-09-01): `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2 --texture-size 1024`.
  - Defaults are meshopt compression, simplify=true, instance=true, palette=true (`donmccurdy/glTF-Transform:packages/cli/src/cli.ts:262-345`).
  - Use `--simplify false` on characters.
  - KTX2 output needs the KTX-Software `ktx` tool installed.
- **gltfjsx 6.5.3:** `--types --transform` generates typed JSX.
  - Note that its transform uses draco + webp by default (pmndrs/gltfjsx README lines 33-51 and 164).
  - Pick one pipeline: gltfjsx for the JSX, gltf-transform for compression.
- **Draco vs Meshopt:** prefer Meshopt, which has a smaller decoder. For KTX2 textures inside a GLB, pass a `KTX2Loader` through `useGLTF`'s `extendLoader` argument.

**Animation and style:**
- **Animation blending:** use drei `useAnimations`, with `crossFadeTo` between idle/walk/run, or blend weights and `timeScale` by speed.
- **Toon look:**
  - `MeshToonMaterial` with a 3–4 step `gradientMap` using `NearestFilter`.
  - drei `<Outlines>` draws inverted-hull outlines and supports `mesh`, `skinnedMesh` and `instancedMesh` (drei `docs/abstractions/outlines.mdx`). It uses WebGL-only shaders, which is another reason to stay on WebGL.
  - Use a small palette/atlas texture. Messenger used a single 16×16 color atlas (https://www.awwwards.com/messenger.html).
- **Grass and trees:** instanced meshes with vertex wind, via `three-custom-shader-material` 6.4.0 (WebGL) or TSL (WebGPU).
- **"Rolling log" curved world:** a reference implementation exists (https://github.com/lynnpepin/rollinglogshader, Godot; the math ports directly). You only need it if you choose a flat world. On a real sphere the curvature is already there.
- **Modeling a spherical world:** Messenger modeled its world as an unwrapped cube and then turned it into a sphere (Awwwards case study).

---

## 6. Landmark triggers, UI and routing
- **Triggers:** use a distance check, not physics sensors: `dot(nPlayer, nLandmark) > cos(r/R)`.
  - Add hysteresis (exit radius ≈ 1.3× entry radius) so the prompt doesn't flicker.
  - Pick the nearest landmark and write it to the zustand store.
  - Rapier sensors (`onIntersectionEnter`) only make sense if you already have physics.
- **Prompts:** use drei `<Html>` only for labels anchored in the world. Put the actionable prompt ("Press E / tap to open Projects") in a normal DOM overlay with a real `<button>`.
- **Panels:** use `<dialog>` with `showModal()`, which gives native focus trapping and Esc to close. Return focus to the game afterwards.
- **URL state and deep links:** `pushState('/play?at=projects')`, and spawn the player next to that landmark on load. Each panel links to its classic page (e.g. `/projects`).
- **Astro:**
  - Mount the game with `client:only="react"` (three can't server-render).
  - Astro `<ClientRouter/>` with `transition:persist` keeps an island and its state alive across navigation (https://docs.astro.build/en/guides/view-transitions/). Browser-native cross-document view transitions are enough for the classic pages.
  - Astro 7 uses Vite 8 with the Rolldown bundler (https://astro.build/blog/astro-7/). It needs Node ≥22.12.

---

## 7. Audio
- **howler 2.2.4**: last release September 2023. The last commit was a README edit in November 2025, and there are 418 open issues. It's stable but in maintenance mode, and Bruno Simon's 2025 site still uses it.
- **Alternative:** plain Web Audio, via three's `AudioListener` and drei `PositionalAudio`.
- **Behavior:**
  - Mute by default and create or resume the `AudioContext` on the first user gesture (browser autoplay policy).
  - Pause on `visibilitychange`.
  - Muting by default also satisfies WCAG 1.4.2 (Audio Control).

---

## 8. Performance

These are heuristic targets, not hard rules:
- **Draw calls:** under 100 on mobile (https://www.utsubo.com/blog/threejs-best-practices-100-tips); aim for 30–60.
- **Geometry and textures:** roughly 150k visible triangles and 32–64 MB of texture memory using KTX2.
- **Download size:** keep the initial 3D download at or below about 3–5 MB. For reference, Messenger loads 5.7 MB up front and 17.5 MB in total (https://www.webgpu.com/showcase/messenger/).
- **Pixel ratio (DPR):** clamp to [1, 1.5] on mobile and [1, 2] on desktop.
- **Shadows:** use one 1024 px shadow map or a simple blob shadow under the character.

Techniques:
- **Reduce draw calls:** InstancedMesh / drei `<Instances>` / `<Merged>`, `gltf-transform --instance`, and drei `<Detailed>` for LOD.
- **Adaptive quality:**
  - drei `PerformanceMonitor` triggers `onIncline`/`onDecline` callbacks so you can step DPR from 1.5 to 1.
  - drei `AdaptiveDpr` lowers resolution temporarily.
  - `frameloop="demand"` while a panel is open.
- **Profiling tools:**
  - **stats-gl 4.2.3** (2026-07-10), installed directly; drei's built-in `<StatsGl>` depends on the older 2.x.
  - **r3f-perf 7.2.3** hasn't changed since November 2024 and its peer range is ≥8. Treat it as untested with R3F 9.
  - three's Inspector addon is useful if you move to WebGPU (Bruno Simon uses it).
- **Lazy loading:** the homepage shows a poster image and an "Explore" button. Load the game code with dynamic `import()` or the `/play` island only after the user shows intent.
- **Device gating:**
  - Probe for a WebGL2 context. Also try creating one with `failIfMajorPerformanceCaveat: true`; if that fails, the device is using software rendering, so offer the classic site.
  - `@pmndrs/detect-gpu` 6.0.22 (the renamed official package) or drei `useDetectGPU` gives a GPU tier; tier 0 should default to the classic site.
  - Respect `saveData` and `prefers-reduced-motion`.
- **Battery and visibility:** the Battery API is Chromium-only, so don't rely on it. `requestAnimationFrame` already pauses in hidden tabs.

---

## 9. Accessibility (WCAG 2.2)

**The classic site must always be reachable:**
- The first focusable element should be a visible "Skip to classic site" link.
- Also provide a `<noscript>` link, redirect to the classic site if WebGL fails, add "Classic site" to the Esc menu, support a `?classic=1` parameter, and remember the choice in localStorage.

**Parallel DOM:**
- Render the landmarks as a list of real buttons ("Go to Projects") that teleport or auto-walk the character. This gives keyboard and screen-reader users equal access.
- Announce nearby landmarks through an `aria-live="polite"` region (4.1.3 Status Messages).

**Success criteria that matter here:**

| SC | Requirement for this project |
|---|---|
| 2.1.1 Keyboard | Everything must work from the keyboard. |
| 2.1.2 No Keyboard Trap | Keyboard users must always be able to leave the canvas. |
| **2.1.4 Character Key Shortcuts** | Single-letter keys (WASD, E) must be turn-off-able, remappable, or active only while the game has focus (https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html). |
| 2.4.11 Focus Not Obscured | The HUD must not cover the focused element. |
| **2.5.7 Dragging Movements** | The drag joystick needs a non-drag alternative such as tap-to-move or on-screen D-pad buttons (https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). |
| 2.5.8 Target Size | Touch targets at least 24×24 CSS px. |
| 2.2.2 Pause, Stop, Hide | Provide a pause for ambient motion. |
| 2.3.3 Animation from Interactions (AAA) | Honor `prefers-reduced-motion`. |

**Motion sickness:** use a fixed or slow camera, no head bob, FOV of 60° or less, and never rotate the camera automatically in a jarring way.

---

## 10. Testing
- **Playwright 1.63.0:**
  - Launch with `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader`. Chromium has deprecated automatic SwiftShader fallback and now requires opting in (https://chromium.googlesource.com/chromium/src.git/+/refs/heads/main/docs/gpu/swiftshader.md).
  - Generate screenshot baselines inside the same Playwright Docker image you run in CI.
  - Keep canvas screenshot tests few and use a tolerance such as `maxDiffPixelRatio`. Assert mostly on DOM: the prompt, the aria-live text, and URL changes.
- **Test hook:** expose `window.__game` only in development or test builds, with `pause`, `teleport`, `fps` and similar. See `Glowin/messager:src/debug-api.ts:1-12`, which removes it from production builds via `import.meta.env.DEV`.
  - For deterministic frames, use R3F's `frameloop="never"` plus `advance()`.
- **FPS:** only meaningful on a real GPU (a headed browser or a GPU runner). SwiftShader numbers are meaningless.
- **Vitest 5.0.1** (Node ^22.12, ^24 or ≥26):
  - Unit-test the pure math: moving on the sphere, trigger hysteresis, input mapping.
  - Use `@react-three/test-renderer` 9.1.1 to test the scene graph.
  - Use `@vitest/browser-playwright` 5.0.1 for tests that need a real WebGL context.
- **Lighthouse:**
  - Make sure the largest contentful paint is the HTML poster, not the canvas.
  - Load the 3D code after interaction so shader compilation and WASM don't inflate Total Blocking Time.
  - Lighthouse runs without a GPU, so its 3D numbers are misleading.

---

## 11. Inspiration (all verified to exist)
1. **Bruno Simon, Folio 2025**: https://bruno-simon.com. Awwwards Site of the Day on Jan 21, 2026 (https://www.awwwards.com/sites/brunos-portfolio).
   - Source is open (MIT) at https://github.com/brunosimon/folio-2025.
   - Stack from its `package.json`: three ^0.183.2, `@dimforge/rapier3d` ^0.17.3, camera-controls ^3.1.2, howler, gsap, stats-gl, and gltf-transform.
   - Renders with `WebGPURenderer` (`forceWebGL: false`) and TSL (`sources/Game/Rendering.js:1-43`).
   - Its README describes a GLB/texture compression pipeline using KTX2 ETC1S.
   - The older version is at github.com/brunosimon/folio-2019.
2. **Messenger (Abeto)**: https://messenger.abeto.co. A tiny spherical planet with central gravity, a dynamic camera, and a world modeled as an unwrapped cube, with outlines and a 16×16 color atlas. It works with one finger or the mouse. Built on three.js and three-mesh-bvh, with a 5.7 MB initial load (https://www.awwwards.com/messenger.html, https://www.webgpu.com/showcase/messenger/).
3. **Glowin/messager**: https://github.com/Glowin/messager. An open-source Vite + TypeScript + three.js clone of Messenger. Good reference code for sphere movement, the follow camera, and the `window.__game` test hook.
4. **flo-bit.dev**: procedurally generated tiny planets plus a VR version, built with Astro, Svelte and Threlte (https://discourse.threejs.org/t/portfolio-site-with-procedurally-generated-tiny-planets-a-vr-version/70798).
5. **Coastal World**: Awwwards Site of the Day, Aug 24, 2022 (https://www.awwwards.com/sites/coastal-world). I didn't verify its tech or who built it.

---

## 12. Legal (avoiding Nintendo IP)
- **Mechanics are generally fine.** US copyright doesn't protect "the idea for a game… or the method… for playing it" (https://www.copyright.gov/fls/fl108.pdf).
- **Patents are the exception.** Nintendo does pursue patents on game mechanics (the Palworld case). Japanese and US patent offices have reportedly rejected some of those patents, per secondary sources such as https://www.techspot.com/news/111927-uspto-rejects-nintendo-summon-character-fight-pokmon-patent.html. Walking on a sphere is common prior art, so I'd rate the risk low, but I haven't verified that.
- **Don't use any of these:** Nintendo characters or lookalikes, names or trademarks in your title or SEO ("Animal Crossing", "Mario", "Galaxy"), music, sound effects, fonts, or distinctive UI (e.g. the Nook-phone look). Describing it as "inspired by" in prose is fine.
- **Stick to CC0 or original assets.**

---

## Final recommendation

**Recommended stack (all verified on the proxy):**
```
npm i astro@7.3.3 @astrojs/react@6.0.6 react@19.2.8 react-dom@19.2.8 three@0.186.0 \
  @react-three/fiber@9.7.0 @react-three/drei@10.7.8 zustand@5.0.15 maath@0.10.8 nipplejs@1.0.4
npm i -D @types/three@0.186.0 @gltf-transform/cli@4.5.0 gltfjsx@6.5.3 stats-gl@4.2.3 \
  @playwright/test@1.63.0 vitest@5.0.1 @react-three/test-renderer@9.1.1
# optional: camera-controls@3.1.2  howler@2.2.4 (+@types/howler@2.2.13)  @pmndrs/detect-gpu@6.0.22
# physics variant later: @react-three/rapier@2.2.0 ecctrl@2.0.2
```
- Render with the default `WebGLRenderer`.
- Use the kinematic controller: Option A (rotate the world) for the Animal Crossing camera, or Option B (tangent frame) for a follow camera. No physics engine.
- Why this stack:
  - It fits React islands and gives Copilot the most examples to draw on.
  - drei covers keyboard controls, outlines, HTML labels, performance monitoring and audio.
  - The dependency set is the smallest that still meets the WCAG and fallback requirements.
- Upgrade later to R3F 9.8.0 with React 19.3.0 once the proxy has them. Consider WebGPU after R3F v10 and drei v11 are stable.

**Runner-up:** vanilla three.js 0.186.0 with camera-controls 3.1.2 in a plain Astro island (`<script>` tag).
- Same art pipeline and movement math.
- No React peer-range problems and less JavaScript.
- This is how Bruno Simon's site and Messenger are built.
- You lose drei's ready-made components and the declarative scene composition, so you'll write more code yourself.
- If you'd rather go "batteries included" (built-in physics and GUI), Babylon.js 9.26.2 is the alternative runner-up, but it's heavier.

## Gaps and uncertainties
- **WebGPU readiness:** third-party blogs (e.g. Utsubo) say three's WebGPU renderer has been "production-ready since r171", but the official manual still says "experimental". I followed the official manual.
- **drei 10.7.8 with three 0.186:** drei 10.7.8 predates r186. I didn't run an install test. If you hit problems, fall back to three 0.185.1 with @types/three 0.185.4.
- **Bundle sizes** come from bundlephobia and include whole packages without tree-shaking. The ecctrl figure (817 KB gz) probably includes Rapier.
- **Where figures come from:**
  - Godot sizes, WebGPU browser-support numbers, Mixamo's long-term status and the Palworld details come only from secondary sources.
  - The performance budgets are heuristics.
- **r3f-perf** is untested with R3F 9.
- **Rapier 0.20.0** is missing from the CHANGELOG on `main`.
- **Access limits:** I couldn't reach registry.npmjs.org directly (TLS is blocked), so every "proxy" version above comes from `packagefeedproxy.microsoft.io`, checked against GitHub releases. I couldn't call `github/get_me` because that tool wasn't available.
