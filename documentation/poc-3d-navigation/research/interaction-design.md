> Research snapshot: 2026-09-24. Produced by an AI research agent; versions verified against GitHub releases and the Microsoft npm proxy. Items marked ⚠️ or 'est.' are unverified.

# Research report: making a browser tiny-planet portfolio move and feel like Animal Crossing: New Horizons

## Summary

- **Most useful source:** Bruno Simon's 2025 portfolio. Its code is open and I read it directly (commit `41046b5`), so it gives real numbers for the camera and for landmark proximity:
  - fixed camera yaw
  - camera about 41° above the horizon
  - a zoom range
  - a 2.5-unit trigger radius with nearest-landmark-wins
  - key icons that match the input device
- **Verified design intent:**
  - Nintendo's Katsuya Eguchi explained why Animal Crossing's world curves like a rolling log (so the sky is visible).
  - Yoshiaki Koizumi explained Super Mario Galaxy's "planet camera," landmark and shadow rules, and anti-motion-sickness measures.
  - Abeto's Vicente Lucendo explained Messenger's tiny-planet design choices.
- **Not published anywhere I could find:** ACNH's exact movement numbers (speeds, acceleration, turn rate). Every value marked "est." below is my own tuning suggestion, not measured data.
- **Recruiter evidence is general, not specific to game-style portfolios:** reviewers skim, and attention drops at about 10 seconds. That supports making the classic site the easy path from the first screen and making the game an option.

---

## 1. ACNH movement and camera

| Topic | What's known | Confidence and source |
|---|---|---|
| **Curved world ("rolling log")** | Added in Wild World (DS). Eguchi: *"The reason we went with the 'rolling log' effect: if you look at the top screen, that's the sky… it makes more sense… than using the scrolling camera."* The sky is there so players can see balloons, the mail pelican and constellations. | Verified, primary: https://www.ign.com/articles/2005/05/20/e3-2005-animal-crossing-ds-interview |
| How it works | A vertex shader pushes the ground down more the farther it is from the camera (a simple parabola, or the cylinder formula `y -= R(1-cos(z/R))`). It must apply to every object, not just the ground, or objects float. Later games add fog so distant ground becomes silhouettes. The bend can cause objects to disappear too early, so the culling area needs to be widened. | https://notslot.com/tutorials/2020/04/world-bending-effect · https://forum.godotengine.org/t/recreating-an-animal-crossing-esque-world-deforming-shader/43248 · https://github.com/lynnpepin/rollinglogshader · New Leaf seen in a free-camera mod: https://80.lv/articles/this-is-your-reminder-that-animal-crossing-new-leaf-s-world-is-a-cylinder |
| **Camera** | Outdoors, the right stick moves the camera up and down only; up lets you look at balloons in the sky. There is no free rotation, so yaw is fixed. The photo app adds X/Y zoom and tilt. | Controls reference: https://gameaccess.info/animal-crossing-new-horizons-controls/ · camera app: https://game8.co/games/Animal-Crossing-New-Horizons/archives/284301 |
| Zoom during dialogue | When a conversation starts the camera changes distance and angle. One Unity recreation uses 50° pitch at distance 14 normally and 30° at distance 10 in conversation. | Recreation values, not Nintendo's: https://notslot.com/tutorials/2020/04/world-bending-effect |
| **Walk and run** | Left stick moves; hold B to run. Holding A with the net gives a slow creep. How far you push the stick sets the speed. | Verified: https://gameaccess.info/animal-crossing-new-horizons-controls/ |
| Numbers (speed, acceleration, turning) | Not published. Figures floating around (for example "1.0 tile/s walk, 1.6 run", "20–23 s to run across the island") come from low-quality sites. Play feel suggests near-instant stops, a short ramp-up, and a quick turn toward the stick direction without sliding. | **Unverified.** Treat as feel, not fact. |
| **Dialogue look** | Rounded speech bubble with a name tab; text types out letter by letter with the "Animalese" babble. Pitch varies by species size and mood, and speeds up if you skip ahead. Name tags and UI use the Seurat typeface. | https://nookipedia.com/wiki/Animalese · https://fontsinuse.com/uses/51354/animal-crossing-new-horizons |
| On-screen "A" prompts | ACNH is context-sensitive: A to talk or act, Y to pick up. I **could not confirm** a consistent on-screen "A: Talk" prompt; I believe it mostly relies on which way you face plus A. | Uncertain. Search-result claims weren't backed by primary sources. |
| Footsteps and dust | Footstep sounds change by surface; footprints on sand and snow; small dust puffs when running. | Observed in gameplay; community sources only. |
| Collision sliding | No documentation found. Standard practice is to remove the part of the movement that pushes into the obstacle so the player slides along it. | Unverified. |

**Tuning suggestions for WASD on a small sphere** (est., character height = 1 unit h):

- **Speed:** walk 2–2.5 h/s; run (hold Shift) 4.5–6 h/s.
- **Acceleration:** reach full speed in 0.10–0.15 s; stop in about 0.08 s.
- **Turning:** rotate the character's heading toward the input direction with exponential damping, half-life about 0.05 s. For a full reversal, play a quick pivot instead.
- **Collision:** remove the into-the-wall part of movement so the player slides; add a small side nudge around corners (the Celeste trick, section 3).
- **Juice:** a dust puff at the start of running and on sharp turns; footstep sounds synced to the walk animation, with a different sound per surface.

---

## 2. Tiny-planet references

**Super Mario Galaxy** (Koizumi's MIGS 2007 keynote: https://www.gamedeveloper.com/game-platforms/migs-2007-nintendo-s-koizumi-on-the-path-from-garden-to-i-galaxy-i-)
- **Why spheres:** on a flat field you eventually hit a wall, turn around, the camera turns, and players get lost. A sphere has no walls. The goal was that "people can play without ever having to think about the camera."
- **Planet camera:** "depicts Mario walking over the planet — even though he's changing position all the time, he never has to move." Avoiding big camera moves means less motion sickness and less getting lost.
- **Earlier lessons from Koizumi's 3D Mario games:**
  - Always draw a shadow directly under the character, whatever the light direction.
  - Use large landmarks so players orient "without stopping," plus arrow signs.
  - Use a vertical "shake cushion": the camera only pans when the character nears the screen edge.
- Galaxy's move from planet to planet is seamless, not a cut: https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-Super-Mario-Galaxy/Volume-2-The-Developers/2-Benefits-of-a-Spherical-Field/2-Benefits-of-a-Spherical-Field-222607.html

**Messenger by Abeto — verified** (Vicente Lucendo and Michael Sungaila, released 25 Sep 2025, free WebGL): https://en.wikipedia.org/wiki/Messenger_(video_game)
- The small planet exists so players never hit invisible walls: walk straight and you circle the world.
- They automated camera centering and limited options so non-gamers could play: "Seeing our parents play without any trouble was one of the highlights." https://www.commarts.com/webpicks/messenger
- Tech: three.js with custom shaders, controls, camera and networking; three-mesh-bvh; 5.7 MB initial load, 17.5 MB total; five deliveries; players communicate only by emoji. https://www.webgpu.com/showcase/messenger/
- Capped at 10 players per world "to keep the sense of calm" (commarts).
- Unverified claim: an "unwrapped cube" modeling pipeline. I found it only in AI-generated search summaries.

**Outer Wilds.** First person, "up" always points away from the nearest body, which is inherently disorienting. Its level design is covered in the GDC 2020 talk "The 4D Level Design of Outer Wilds": https://gdconf.com/article/see-the-4d-level-design-of-outer-wilds-deconstructed-at-gdc-2020/. Physics notes: https://www.mobiusdigitalgames.com/news/breaking-the-laws-of-physics. Lesson: don't copy its camera for a cozy experience.

**Cozy and small-world references:**
- Townscaper: "more of a toy" than a game, with no objective. https://en.wikipedia.org/wiki/Townscaper
- A Short Hike: dense, recognizable landmarks in place of a map (GDC 2020). https://www.youtube.com/watch?v=ZW8gWgpptI8

**Poles and orientation on a sphere (implementation):**
- A naive "fixed north" camera, like ACNH's fixed yaw, spins wildly at the poles.
- **Option A — move the planet, not the player (recommended for the ACNH feel):**
  - Keep the player fixed at the top.
  - Each frame, rotate the planet by angle = speed·dt/R around the axis cross(up, moveDir).
  - The camera can then be completely fixed: yaw fixed, pitch about 45–55°, no poles at all. This matches Koizumi's "he never has to move."
  - Precedent: the Codrops "Aviator" demo rotates a cylinder under the player (https://tympanus.net/codrops/2016/04/26/the-aviator-animating-basic-3d-character-in-threejs/).
- **Option B — move the player:** carry the camera's forward direction along with the player each frame using the smallest rotation from last frame's up to the new up (`setFromUnitVectors(prevUp,newUp)`) instead of re-deriving it from world north. A general write-up: https://github.com/chlois/spherical-world-example (unverified quality).
- A real sphere hides the horizon without a shader. Choose pitch and distance so the planet's edge sits in the upper third of the screen with sky above, which is the ACNH look.

---

## 3. Game feel

- **Juice:** stack small layers of feedback — squash and stretch, particles, sound, easing. https://www.youtube.com/watch?v=Fy0aCDmgnxg (Jonasson & Purho, GDC Europe 2012)
  - Suggested uses: squash on landing or stopping, a small anticipation lean before running, bounce-in when a landmark prompt appears. Bruno uses GSAP `back.in(4.5)` for prompt enter/exit (`InteractivePoints.js:459-505`).
- **Forgiveness:** Celeste's coyote time and jump buffering are about "widening timing or positioning windows… in the player's favor." https://maddymakesgames.com/articles/celeste_and_forgiveness/index.html
  - Translated to this project:
    - **Two radii for landmarks:** enter at r, exit at about 1.25r, so prompts don't flicker at the edge.
    - **Remember an early key press:** if the interact key is pressed shortly before the player enters the radius (about 150 ms), honor it.
    - **Nearest wins:** when landmarks overlap, the closest one gets the prompt.
    - **Corner nudges** on collisions.
- **Camera smoothing:** use frame-rate-independent exponential decay, `a = b + (a-b)·exp(-λ·dt)` with λ = ln2/half-life, not `lerp(a, b, k)` every frame. https://www.youtube.com/watch?v=LSNQuFEDOyQ
  - Bruno's follow uses `lerp(..., delta*10)` (`View.js:658-660`), which is frame-rate dependent — avoid that.
  - Suggested half-life: about 0.12 s for position, about 0.2 s for zoom.
  - Nesky's "50 Game Camera Mistakes" (Journey): https://www.gdcvault.com/play/1020870/50-Camera-Mistakes
- **Cozy principles** (Project Horseshoe 2017): safety, abundance, softness. Things that break coziness: extrinsic rewards, danger, responsibilities, unpleasant distractions or sudden noises, intense stimuli, vast distance, confinement, social presence you didn't opt into. https://www.projecthorseshoe.com/reports/featured/ph17r3.htm
  - For a portfolio: no timers, no fail states, audio muted by default, soft easing.
- **Finding landmarks:**
  - Tall, distinct silhouettes plus signposts (Koizumi).
  - A compass or off-screen indicator. On a sphere, the bearing to a landmark = the landmark's direction projected onto the ground plane under the player.
  - A map key: Bruno uses M.
  - An "I'm stuck → teleport to nearest respawn" button, confirmed on bruno-simon.com.
- **Keeping sessions short** (est.):
  - Planet radius about 8–12h, so the farthest point is πR ≈ 25–38h, reachable in about 5–7 s at 5 h/s.
  - With 6–7 landmarks, the nearest is always within about 3 s.
  - Start the player facing the first landmark with it on screen.
  - Add a fast-travel menu that auto-walks or fades to a landmark. The accessibility guidelines' "voiced GPS" is the same idea (section 5).

---

## 4. Portfolio UX

- **Recruiter behavior:**
  - Resume screens average about 7.4 s (Ladders eye-tracking, 2018). https://hrdailyadvisor.hci.org/2018/11/15/eye-tracking-recruiters-average-7-4-seconds-reviewing-a-resume/
  - NN/g surveyed 204 UX hiring managers: they "very rarely… read your entire portfolio word for word," so it must be scannable; 3–5 case studies showing problem, role, process and outcome. https://www.nngroup.com/articles/ux-design-portfolios/
  - **Gap:** I found no rigorous study on game-style portfolios specifically. The pros and cons out there are opinion pieces.
- **Timing and loading:**
  - NN/g limits: 0.1 s feels instant, 1 s keeps flow, 10 s is the attention limit; use a percent-done indicator beyond about 10 s. https://www.nngroup.com/articles/response-times-3-important-limits/ · https://www.nngroup.com/articles/progress-indicators/
  - Core Web Vitals targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. https://web.dev/articles/vitals
  - Lighthouse dropped the TTI metric in v10 (from memory, not rechecked).
  - Budget benchmark: Messenger's 5.7 MB initial load.
  - Render the HTML shell right away: name, role, "Enter island" and "Classic site." Let people use the classic site while the 3D loads.
- **Classic toggle, remembered preference, deep links:**
  - Show a persistent "Classic view" button on the first screen and in the game HUD.
  - Save the choice in localStorage. The accessibility guidelines ask that "all settings are saved/remembered." https://gameaccessibilityguidelines.com/basic/
  - Default to classic when `prefers-reduced-motion`, no WebGL, or a low-power device is detected.
  - Give every landmark a real URL, such as `/work/…`, `/writing/…`, `?mode=play`, so both modes resolve the same link and recruiters can share it.
- **Bruno Simon's 2025 portfolio (live):**
  - DOM text includes the welcome, options (audio, quality Low, renderer WebGPU), full keyboard, gamepad and touch controls, "I'm stuck! Respawn," map (M), and contact and Discord panels.
  - Areas include Projects, Lab, Career, Social, Achievements, Behind the scene, and several play or easter-egg zones (full list in section 6).
  - There's **no classic mode** that I could verify.
  - Code details:
    - Proximity check at `brunosimon/folio-2025:sources/Game/InteractivePoints.js:595` (`itemDistance < 2.5`, nearest wins, around lines 590–640).
    - Prompts can also be clicked (sphere radius 0.75, line 351).
    - Key icon swaps to Enter, Xbox A, PS Cross or touch based on input mode (lines 120–155).
    - Camera: fixed yaw θ = 0.25π, polar angle φ = 0.27π (about 41° above horizontal), distance 15–30 (`View.js:333-344`); zooms out with speed (`zoom.speedAmplitude=-0.4`, speed range 5–40, lines 287–292, 694–700).
- **A pair that works:** Henry Heffernan's 3D desk scene (henryheffernan.com) has its inner "OS" site at its own URL, os.henryheffernan.com, which acts as a direct 2D route. Both confirmed live.
  - Robby Leonardi's game-style resume: I **could not verify** a traditional-resume link (TLS error on fetch).

---

## 5. Accessibility

**Xbox Accessibility Guidelines (v3.2, updated Aug 2026)** — https://learn.microsoft.com/en-us/xbox/accessibility/guidelines

The full list: 101 Text display, 102 Contrast, 103 Additional channels for visual/audio cues, 104 Subtitles & captions, 105 Audio, 106 Screen narration, 107 Input, 108 Difficulty, 109 Objective clarity, 110 Haptics, 111 Audio description, 112 UI navigation, 113 Focus handling, 114 UI context, 115 Errors and destructive actions, 116 Time limits, 117 Visual distractions & motion, 118 Photosensitivity, 119 Speech-to-text/text-to-speech chat, 120 Communication, 121 Feature documentation, 122 Customer support, 123 Mental health.

The most relevant here:

- **107 Input:** support digital and analog navigation; single, non-simultaneous key presses; in-game remapping of everything, including Esc. The Grounded example uses arrow keys as an alternative to the mouse.
- **109 Objective clarity:** players can review objectives at any time. Use a "Landmarks visited" checklist.
- **117 Motion:** pause or disable moving, blinking or auto-updating content. Avoid camera shake, bobbing and motion blur, or allow turning them off. Let players control automatic camera changes.

**Game Accessibility Guidelines** — https://gameaccessibilityguidelines.com/basic/, /intermediate/, /advanced/
- Basic: remapping, readable default font size, high contrast, no information by color or sound alone, separate volume controls, simple clear language, interactive tutorials, saved settings.
- Intermediate: remind players of controls and objectives during play; clear indication that interactive elements are interactive; option to hide background movement; bypass non-core gameplay (supports the classic toggle); avoid requiring held buttons (offer a run toggle).
- Advanced: easy orientation to compass points; "voiced GPS"; avoid sudden unexpected movement.

**WCAG 2.2 criteria that apply:**

| Criterion | What to do |
|---|---|
| **2.1.1** Keyboard (A) | Menus and dialogs as well as movement. |
| **2.1.2** No keyboard trap (A) | Tab/Esc leaves the canvas. |
| **2.1.4** Character key shortcuts (A) | WASD keys only active while the canvas has focus, or remappable / can be turned off. |
| **2.2.2** Pause, stop, hide (A) | Ambient animation. |
| **1.4.2** Audio control (A) | Audio muted by default. |
| **2.3.1** Three flashes (A) | No flashing effects. |
| **2.3.3** Animation from interactions (AAA) | Honor `prefers-reduced-motion`: cuts instead of camera glides, no bob or shake (https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion). |
| **2.4.7 / 2.4.11** Focus visible (AA) / not obscured (AA, new in 2.2) | The HUD must not cover focused elements. |
| **2.5.7** Dragging (AA, new in 2.2) | Camera drag or joystick needs a tap or button alternative. |
| **2.5.8** Target size (AA, new in 2.2) | At least 24×24 CSS px. |
| **1.4.3 / 1.4.11** Contrast (AA) | 4.5:1 for bubble text over the 3D scene; 3:1 for prompt icons. |
| **3.2.1 / 3.2.2** On focus / on input (A) | By analogy: walking near a landmark should show a preview, not open a modal automatically. |
| **3.2.6** Consistent help (A) | Contact link always in the same place. |
| **1.2.x** Captions | For any video or voice. |
| **4.1.2** Name, role, value (A) | Real `<dialog>` and HTML content for everything the canvas shows; `aria-live` announcements such as "Near Workshop — press Enter." |

Useful library: https://github.com/pmndrs/react-three-a11y (focus and announcements for React Three Fiber scenes).

---

## 6. Landmark metaphors for a design leader

Inspiration:
- **Bruno's zones** (confirmed file names in `sources/Game/World/Areas/`): Landing, Projects, Lab, Career, Social, Achievements, BehindTheScene, TimeMachine, Circuit, Bowling, Cookie, Altar, Easter, Toilet. The lesson: mix serious zones with a couple of playful ones.
- **Messenger:** mail and delivery as the core loop — a natural fit for contact.
- **ACNH civic buildings:** Resident Services, Museum, Nook's Cranny, Airport, bulletin board. From my own knowledge, not re-fetched.

Proposed set (each needs a distinct tall silhouette):

| Landmark | Content | Silhouette / cue |
|---|---|---|
| Lighthouse (tallest; visible from anywhere on the planet) | Vision and design leadership philosophy | Rotating beam; doubles as the compass anchor |
| Town Hall / Resident Services | About me, how I lead, team rituals | Clock tower |
| Workshop / Museum wing | Case studies (3–5, NN/g) | Chimney smoke, open doors |
| Library | Writing and articles | Stacked-book spire |
| Amphitheater | Talks and podcasts | Curved seating and a stage light |
| Garden / Greenhouse | Side projects and experiments | Glass dome |
| Post Office | Contact and résumé PDF (Messenger nod) | Mailbox with a flag that pops up |
| Airport / Signpost hub (spawn point) | Fast travel, "Classic view," settings | Signposts pointing to every landmark |

---

## Gaps and uncertainties

- **ACNH:** no published speeds, acceleration, turn rates, camera angles or collision behavior. All "est." values are mine. The existence of an on-screen "A: Talk" prompt is uncertain. ACNH-specific rolling-log parameters were never disclosed; the tutorials are reverse-engineered.
- **Messenger:** its specific camera, map and controls weren't documented beyond automatic camera centering. The "unwrapped cube" pipeline is unverified.
- **Game-style portfolios:** no quantitative recruiter research exists. I found no widely cited portfolio that pairs a game mode with a classic mode other than Henry Heffernan's split. Robby Leonardi is unverified.
- **Outer Wilds:** its camera-comfort handling is sourced only secondhand.
- **Not re-fetched:** the Lighthouse TTI removal and the exact WCAG criterion wording come from memory. Check them against https://www.w3.org/TR/WCAG22/ before quoting.
