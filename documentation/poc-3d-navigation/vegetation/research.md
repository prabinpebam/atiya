# Vegetation research: how stylized games draw grass

> **TL;DR:** The grass in Genshin Impact, Ghost of Tsushima and the best browser demos is made of **opaque, very low-poly blade meshes, built and animated in the vertex shader from a seed, drawn in a few big batches**. It is not alpha-tested cards. Blades take their colour from the ground under them, lean on the terrain's normal for soft lighting, bend in the wind and around characters, and receive shadows without casting them. Flowers are the only part that may use cards. On phones the limiting costs are wasted pixel work (alpha test, overdraw) and too many tiny, thin triangles, so the budget is set by visible blades × triangles per blade.

This page collects the evidence. The [proposal](./proposal.md) applies it to our planet, and the [spec](./spec.md) sets out what to build. Findings marked **[Inference]** are reasoning, not sourced fact.

## Genshin Impact

HoYoverse has given no public talk on its grass. The best primary evidence is a RenderDoc frame capture of the mobile build (in an emulator, at maximum quality): [Habr, "The art of game rendering"](https://habr.com/ru/articles/874866/).

- **Real blades, not cards.** Each blade has 2–4 triangles. Blades are grouped into clumps of 48–114 triangles (by distance LOD), and up to 32 clumps are drawn per call.
- **Opaque.** The blades are not alpha-tested; only the flowers are. The author notes that alpha-test fill rate "can simply kill" mobile performance.
- **Vertex-shader driven.** Position, bend and wind come from pseudo-random functions of world position plus a noise texture.
- **Lit like the ground.** Grass writes the terrain normal under it into the G-buffer, so it melts into the terrain. Per-blade normal variation is added separately.
- **Character bending.** Each frame the game draws flattened cones at every character's position into a top-down texture, and the next frame's grass bends away from them.
- **Totals.** 500–850 K triangles per frame across all passes, at maximum quality.
- **Targets.** HoYoverse's minimum Android device is a Snapdragon 660 with 4 GB of RAM ([mobile settings guide](https://boostroom.com/blog/genshin-impact-mobile-guide-best-settings-for-smooth-gameplay)). What the mobile "Environment Detail" setting cuts isn't documented.

## Ghost of Tsushima

Eric Wohllaib, [GDC 2021, "Procedural Grass in Ghost of Tsushima"](https://gdcvault.com/play/1027033/Advanced-Graphics-Summit-Procedural-Grass) ([video](https://www.youtube.com/watch?v=Ibe1JBF5i5Y)). This is the most complete public description of a production blade-grass system.

| Topic | What they did |
|---|---|
| Cards vs blades | Tried cards, dropped them: wind moved the whole card and overdraw was too high |
| Scale | About 1 M blades considered per frame, about 83 K drawn, about 2.5 ms on PS4 |
| Placement | A compute pass per tile jitters a grid, then culls by distance, frustum, grass type and occlusion; each blade writes 16 floats |
| Geometry | No vertex streams: the blade is built from the vertex and instance IDs. 15 vertices near, 7 far; the near shape morphs to the far one before the switch; far tiles drop 3 of 4 blades |
| Shape | A cubic Bézier per blade; normals from the curve |
| Clumps | Voronoi clumps share height and facing ("otherwise it looked like a golf course") |
| Wind | Scrolling 2D noise sets facing and bend; a sine bob varies along the blade |
| Rounded normals | Blade normals tilted outward: a rounded look "a lot cheaper than adding more verts" |
| View-space thickening | Blades seen edge-on are widened in view space, so fields look fuller and fewer very thin triangles are drawn |
| Colour | A small 2D ramp: dark base to light tip along the blade, tiny differences between clumps (a painted look) |
| Far LOD | An artist-painted texture in the terrain replaces blades at range |
| Shadows | Blades don't cast into the shadow map; an impostor (raised terrain with dithered depth) does |

## Other games

- **Zelda: Breath of the Wild.** Nintendo's CEDEC 2017 art talk ([IGN Japan](https://jp.ign.com/the-legend-of-zelda-hd/17049/botw3d)) describes the art direction only. Detailed grass everywhere looked messy, so distant land was simplified to flat fills. Emulator mods expose a single "grass blades draw distance" constant. The blade technique itself is undocumented.
- **Animal Crossing: New Horizons.** The grass is essentially a ground texture. Seasonal colours come from one gradient texture indexed by date ([ACNH modding notes](https://ac-modding.com/ACNH/mods/editing_textures.html)). A single ramp keeps the grass and ground colours in step.
- **A Short Hike** relies on textured, triplanar-mapped terrain rather than blade fields ([developer thread](https://threadreaderapp.com/thread/1113100182655262721.html)).
- **Tiny Glade** and **Sea of Thieves** have talks, but they don't cover the grass technique.

## Mobile GPU fundamentals

Phones use tile-based GPUs (Arm Mali, Qualcomm Adreno, Apple). Hidden-surface removal saves them most of the pixel shading, and alpha-tested geometry defeats it.

- **Alpha test forces late depth.** "Don't use discard… this forces late-zs." The same applies to alpha-to-coverage ([Arm Mali GPU Best Practices](https://armkeil.blob.core.windows.net/developer/Arm%20Developer%20Community/PDF/Arm%20Mali%20GPU%20Best%20Practices.pdf), pp. 7 and 51).
  - On Apple and PowerVR GPUs, hidden-surface removal fails with discard, alpha test or blending ([Apple, OpenGL ES performance](https://developer.apple.com/library/archive/documentation/3DDrawing/Conceptual/OpenGLES_ProgrammingGuide/Performance/Performance.html)).
  - On Adreno, discard disables LRZ, its early depth pass ([Igalia, Adreno LRZ](https://blogs.igalia.com/dpiliaiev/adreno-lrz/)).
- **Vertices beat wasted fragments.** Apple advises trimming cards to their shape because "the performance cost of additional vertex processing is much less than that of running fragment shaders whose results will be unused". Unity says to keep visible alpha-tested pixels to a minimum ([Unity mobile rendering](https://docs.unity3d.com/540/Documentation/Manual/MobileOptimizationPracticalRenderingOptimizations.html)). Unreal says overdraw can "double or more" the frame's GPU time ([Unreal mobile guidelines](https://dev.epicgames.com/documentation/unreal-engine/performance-guidelines-for-mobile-devices?application_version=4.27)).
- **But not too many thin triangles.** Arm's guidance:
  - aim for 10–20 fragments per primitive;
  - "for a 1080p render pass you shouldn't really need more than 250 K primitives";
  - avoid micro-triangles and long thin triangles under 10 px ([Arm](https://armkeil.blob.core.windows.net/developer/Arm%20Developer%20Community/PDF/Arm%20Mali%20GPU%20Best%20Practices.pdf) p. 23; [Android geometry guide](https://developer.android.com/games/optimize/geometry)).

  Grass blades are exactly that kind of triangle, which is why Ghost of Tsushima thickens them and cuts triangles per blade with distance.
- **Instancing.** Use one interleaved instance buffer with small data types (Arm pp. 23–24).
- **Density scales with quality.** Unreal's `grass.DensityScale` is 0 / 0.4 / 0.8 / 1.0 across its four foliage quality levels ([Unreal scalability reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/scalability-reference-for-unreal-engine)).

## Browser implementations

None of these publishes a frame rate measured on a phone.

| Project | Blades | Technique |
|---|---|---|
| [SimonDev, Quick_Grass](https://github.com/simondevyoutube/Quick_Grass) ([video](https://youtu.be/bp7REZBV4P4)) | 3,072 per 10 × 10 m patch, reused | `InstancedBufferGeometry`; shape, wind and colour from a hash; 6 segments near, 1 far; view-space thickening; normals blended toward up; `castShadow = false`; "about 1.5 ms on the GPU" (GPU not named) |
| [Bruno Simon, folio 2025](https://github.com/brunosimon/folio-2025) | 78,400 | **1 triangle per blade** in one plain geometry; colour from the terrain colour; normal fixed to up; hidden where the terrain's grass mask is low |
| [James Smyth](https://smythdesign.com/blog/stylized-grass-webgl/) | 100,000 | 3 triangles per blade merged into one mesh; each blade takes one colour sampled from the ground texture at its root |
| [Nitash Biswas](https://github.com/Nitash-Biswas/grass-shader-glsl) | 400,000+ | One instanced mesh per 4-unit patch; 7 segments near, 3 far, with a morph so the switch is invisible |
| [al-ro](https://al-ro.github.io/projects/grass/) | 100,000 | Instanced alpha cards |
| [Codrops, "Fluffiest grass"](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/) | about 1 M | Alpha-card clumps in 256 chunks with 3 LODs; the frame rate collapsed before 500 K without chunking |

## Making it look painted, not realistic

- **Root colour from the ground.** Bruno Simon, James Smyth and Genshin all tie the blade base to the terrain colour. That hides the seam, and means the ground can stand in for blades anywhere.
- **Gradient to the tip.** Dark base to light tip (Ghost of Tsushima's ramp, SimonDev's `mix(base, tip, easeIn(h))`). The dark base doubles as cheap ambient occlusion.
- **Soft normals.** Use the terrain (on a planet, the sphere) normal, or blend toward it, so the field shades like one soft surface. **[Inference]** Drop specular on blades altogether for the cozy look; Ghost of Tsushima fought specular glitter at range.
- **Clumps with tiny colour differences**, and drifts of one flower colour "as if painted by a giant brush" (Ghost of Tsushima).

## Flowers and small plants

- Genshin alpha-tests only its flowers. Ghost of Tsushima draws flowers as artist-made meshes through a GPU-instanced stream, placed where the grass-type map says so.
- Every verified system places blades on a **jittered grid**, not Poisson or blue noise.
- **[Inference]** On phones, small opaque low-poly flower heads are cheaper than cut-out cards, and need no texture.

## Loading and memory

- Blade data generated from a seed ships nothing. Ghost of Tsushima regenerates blades every frame. SimonDev reuses one patch of about 18 KB of offsets **[Inference]**.
- **[Inference]** Blades built from gradients need no blade texture. An alpha atlas would bring the costs above, so image generation is better spent on the ground and on the target look than on blade sprites.
- JPEG, PNG and WebP decode to uncompressed pixels in GPU memory. KTX2/Basis stays compressed ([Khronos KTX artist guide](https://raw.githubusercontent.com/KhronosGroup/3D-Formats-Guidelines/main/KTXArtistGuide.md)).
