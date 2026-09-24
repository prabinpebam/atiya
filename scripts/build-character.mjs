// Build the player character GLB from the Kenney "Animated Characters: Protagonists" pack (CC0).
//
// 1. Converts the FBX model + animation files with FBX2glTF (native binary, not a project dependency).
// 2. Merges the Idle / Run / Jump clips into the model (retargeted by bone name).
// 3. Applies a skin texture and soft, non-metallic material settings.
// 4. Resamples, dedups and prunes, then writes public/models/character.glb.
//
// Usage:
//   npm install --prefix %TEMP%\fbxconv fbx2gltf@0.9.7        (one-off; ~30 MB native tool, kept out of the repo)
//   npm run build:character                                     (or: node scripts/build-character.mjs [skinName])
//
// Environment: FBX2GLTF = path to FBX2glTF(.exe) (defaults to the temp install above).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';

const PACK = 'assets-src/kenney_animated-characters-protagonists';
const SKIN = process.argv[2] ?? 'skaterMaleA';
const OUT = 'public/models/character.glb';
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
const doc = await io.read(convert(join(PACK, 'Model', 'characterMedium.fbx'), 'model'));
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
  const animDoc = await io.read(convert(join(PACK, 'Animations', `${file}.fbx`), file));
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
const png = readFileSync(join(PACK, 'Skins', `${SKIN}.png`));
const texture = doc.createTexture(SKIN).setImage(new Uint8Array(png)).setMimeType('image/png').setURI(`${SKIN}.png`);
for (const m of root.listMaterials()) {
  m.setBaseColorTexture(texture).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.85);
}

await doc.transform(resample(), dedup(), prune());
mkdirSync('public/models', { recursive: true });
await io.write(OUT, doc);
console.log(`wrote ${OUT} (${(readFileSync(OUT).length / 1024).toFixed(1)} KB, skin ${SKIN})`);
