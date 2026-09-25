// Build the two player character GLBs from the Kenney "Animated Characters: Protagonists" pack (CC0).
//
// 1. Converts the FBX model + animation files with FBX2glTF (native binary, not a project dependency).
// 2. Merges the Idle / Run / Jump clips into the model (retargeted by bone name).
// 3. Applies a skin texture and soft, non-metallic material settings.
// 4. The female variant also gets a ponytail with a scrunchie: low-poly meshes parented to the Head
//    bone (so they move with it), textured from her skin atlas's hair and T-shirt colours.
// 5. Resamples, dedups and prunes, then writes public/models/character.glb (the skater, Kenney's
//    skaterMaleA skin) and public/models/character-female.glb (the generated casualFemaleA skin).
//
// Usage:
//   npm install --prefix %TEMP%\fbxconv fbx2gltf@0.9.7        (one-off; ~30 MB native tool, kept out of the repo)
//   npm run build:character                                     (both; or: node scripts/build-character.mjs male|female|<kenneySkin>)
//
// Environment: FBX2GLTF = path to FBX2glTF(.exe) (defaults to the temp install above).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Matrix4, TorusGeometry, Vector3 } from 'three';

const PACK = 'assets-src/kenney_animated-characters-protagonists';
const VARIANTS = {
  male: { skin: join(PACK, 'Skins', 'skaterMaleA.png'), out: 'public/models/character.glb' },
  female: { skin: 'assets-src/characters/casualFemaleA.png', out: 'public/models/character-female.glb', ponytail: true },
};
const arg = process.argv[2];
// a Kenney skin name (the old usage) rebuilds the default character with that skin
const builds = !arg ? Object.values(VARIANTS) : VARIANTS[arg] ? [VARIANTS[arg]] : [{ ...VARIANTS.male, skin: join(PACK, 'Skins', `${arg}.png`) }];
const CLIPS = { Idle: 'idle', Run: 'run', Jump: 'jump' };

const platformDir = { win32: 'Windows_NT', darwin: 'Darwin', linux: 'Linux' }[process.platform];
const exe =
  process.env.FBX2GLTF ??
  join(tmpdir(), 'fbxconv', 'node_modules', 'fbx2gltf', 'bin', platformDir, process.platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');
if (!existsSync(exe)) {
  console.error(`FBX2glTF not found at ${exe}.\nInstall it once with: npm install --prefix "${join(tmpdir(), 'fbxconv')}" fbx2gltf@0.9.7`);
  process.exit(1);
}

const work = join(tmpdir(), 'fbxconv', 'out');
mkdirSync(work, { recursive: true });
const convert = (input, name) => {
  const r = spawnSync(exe, ['--binary', '--input', input, '--output', join(work, name)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`FBX2glTF failed for ${input}:\n${r.stdout}\n${r.stderr}`);
  return join(work, `${name}.glb`);
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const modelGlb = convert(join(PACK, 'Model', 'characterMedium.fbx'), 'model');
const clipGlbs = Object.fromEntries(Object.values(CLIPS).map((file) => [file, convert(join(PACK, 'Animations', `${file}.fbx`), file)]));

async function build({ skin, out, ponytail }) {
const doc = await io.read(modelGlb);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const nodesByName = new Map(root.listNodes().map((n) => [n.getName(), n]));

const copyAccessor = (src) =>
  doc
    .createAccessor(src.getName())
    .setType(src.getType())
    .setArray(src.getArray().slice())
    .setNormalized(src.getNormalized())
    .setBuffer(buffer);

for (const [clip, file] of Object.entries(CLIPS)) {
  const animDoc = await io.read(clipGlbs[file]);
  const src = animDoc.getRoot().listAnimations().find((a) => a.getName().endsWith(`|${clip}`));
  if (!src) throw new Error(`clip ${clip} not found in ${file}.fbx`);
  const anim = doc.createAnimation(file);
  let bound = 0;
  for (const ch of src.listChannels()) {
    const target = ch.getTargetNode() && nodesByName.get(ch.getTargetNode().getName());
    if (!target) continue;
    const s = ch.getSampler();
    const sampler = doc.createAnimationSampler().setInput(copyAccessor(s.getInput())).setOutput(copyAccessor(s.getOutput())).setInterpolation(s.getInterpolation());
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    bound++;
  }
  console.log(`clip ${file}: ${bound} channels`);
}

// Skin texture + soft material
const name = skin.split(/[\\/]/).pop().replace(/\.png$/, '');
const png = readFileSync(skin);
const texture = doc.createTexture(name).setImage(new Uint8Array(png)).setMimeType('image/png').setURI(`${name}.png`);
for (const m of root.listMaterials()) {
  m.setBaseColorTexture(texture).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.85);
}
if (ponytail) addPonytail(doc, nodesByName.get('Head'), root.listMaterials()[0], buffer);

await doc.transform(resample(), dedup(), prune());
mkdirSync('public/models', { recursive: true });
await io.write(out, doc);
console.log(`wrote ${out} (${(readFileSync(out).length / 1024).toFixed(1)} KB, skin ${name}${ponytail ? ', ponytail' : ''})`);
}

// ---------------------------------------------------------------------------------------------
// Ponytail. Authored in the model's bind-pose space (y up, the head spans y 2.61–3.77, back of the
// head at z ≈ −0.53), then moved into the Head bone's frame so it follows the head.

/** UV points on the skin atlas (v down) used as flat colours: hair, and the T-shirt yellow for the scrunchie. */
const HAIR_UV = [0.1, 0.05];
const TIE_UV = [0.24, 0.55];

function addPonytail(doc, head, material, buffer) {
  const curve = new CatmullRomCurve3(
    [
      [0, 3.43, -0.44], // root, sunk into the back of the head
      [0, 3.4, -0.57], // the scrunchie
      [0, 3.33, -0.69],
      [0, 3.16, -0.8],
      [0, 2.95, -0.83],
      [0, 2.76, -0.78],
      [0, 2.62, -0.7], // tip, well clear of the back
    ].map((p) => new Vector3(...p)),
    false,
    'centripetal',
  );
  // radius along the tail: gathered at the tie, full just below it, tapering to a soft point
  const radius = (t) => (t < 0.1 ? 0.1 - 0.12 * t : 0.088 + 0.08 * Math.sin(Math.min(1, (t - 0.1) / 0.9) * Math.PI) * (1 - 0.55 * t) - 0.06 * t ** 3);
  const tail = sweep(curve, radius, 9, 12, HAIR_UV);
  // the scrunchie: a chunky ring round the tail at the tie
  const tie = new TorusGeometry(0.098, 0.04, 6, 12);
  const at = curve.getPointAt(0.1);
  const dir = curve.getTangentAt(0.1);
  tie.applyMatrix4(new Matrix4().lookAt(new Vector3(), dir, new Vector3(0, 1, 0)).setPosition(at));
  flatUV(tie, TIE_UV);

  const toHead = new Matrix4().fromArray(head.getWorldMatrix()).invert();
  const node = doc.createNode('Ponytail');
  const mesh = doc.createMesh('ponytail');
  for (const g of [tail, tie]) {
    g.applyMatrix4(toHead);
    g.computeVertexNormals();
    const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
    const prim = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute('POSITION', acc('VEC3', new Float32Array(g.getAttribute('position').array)))
      .setAttribute('NORMAL', acc('VEC3', new Float32Array(g.getAttribute('normal').array)))
      .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(g.getAttribute('uv').array)))
      .setIndices(acc('SCALAR', new Uint16Array(g.getIndex().array)));
    mesh.addPrimitive(prim);
  }
  head.addChild(node.setMesh(mesh));
}

/** A closed, tapered tube along `curve`: `sides` round, `segs` along; the tip closes to a point. */
function sweep(curve, radius, sides, segs, uv) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = i === segs ? 0 : radius(t);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      // a little flatter side to side, so it reads as a bundle of hair rather than a pipe
      const v = frames.normals[i].clone().multiplyScalar(Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r * 0.8);
      pos.push(c.x + v.x, c.y + v.y, c.z + v.z);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k;
      const b = i * sides + ((k + 1) % sides);
      idx.push(a, a + sides, b, b, a + sides, b + sides);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  flatUV(g, uv);
  return g;
}

function flatUV(g, [u, v]) {
  const n = g.getAttribute('position').count;
  g.setAttribute('uv', new Float32BufferAttribute(new Array(n).fill(0).flatMap(() => [u, v]), 2));
}

for (const variant of builds) await build(variant);
