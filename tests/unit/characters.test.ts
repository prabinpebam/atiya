import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CHARACTERS, DEFAULT_CHARACTER, characterById, isCharacterId } from '../../src/game/player/characters';

const PUBLIC = join(__dirname, '..', '..', 'public');

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  skin?: number;
}

/** The JSON chunk of a binary glTF. */
function glbJson(file: string): { nodes: GltfNode[]; animations?: Array<{ name: string }>; images?: unknown[]; meshes: Array<{ name?: string }> } {
  const b = readFileSync(file);
  expect(b.toString('latin1', 0, 4)).toBe('glTF');
  const len = b.readUInt32LE(12);
  return JSON.parse(b.toString('utf8', 20, 20 + len));
}

describe('player characters', () => {
  it('has two characters with unique ids, labels, a model and a portrait each', () => {
    expect(CHARACTERS.length).toBe(2);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(2);
    for (const c of CHARACTERS) {
      expect(c.label.length).toBeGreaterThan(5);
      expect(statSync(join(PUBLIC, c.url)).size).toBeGreaterThan(50_000);
      const portrait = statSync(join(PUBLIC, c.portrait)).size;
      expect(portrait).toBeGreaterThan(1_000);
      expect(portrait).toBeLessThan(40_000);
    }
    expect(isCharacterId(DEFAULT_CHARACTER)).toBe(true);
    expect(isCharacterId('nobody')).toBe(false);
    expect(characterById('sunny').url).toMatch(/female/);
  });

  it('both models share the rig and the idle / run / jump clips; the models stay small', () => {
    for (const c of CHARACTERS) {
      const g = glbJson(join(PUBLIC, c.url));
      expect(g.animations?.map((a) => a.name).sort()).toEqual(['idle', 'jump', 'run']);
      for (const bone of ['Head', 'LeftFoot', 'RightFoot', 'Hips']) expect(g.nodes.some((n) => n.name === bone), `${c.id} ${bone}`).toBe(true);
      expect(g.images?.length).toBe(1);
      expect(statSync(join(PUBLIC, c.url)).size).toBeLessThan(400 * 1024);
    }
  });

  it('the female character has a ponytail parented to the Head bone (so it moves with the head); the skater does not', () => {
    const female = glbJson(join(PUBLIC, characterById('sunny').url));
    const tail = female.nodes.findIndex((n) => n.name === 'Ponytail');
    expect(tail).toBeGreaterThanOrEqual(0);
    expect(female.nodes[tail].mesh).toBeDefined();
    const head = female.nodes.find((n) => n.name === 'Head')!;
    expect(head.children).toContain(tail);
    const skater = glbJson(join(PUBLIC, characterById('skater').url));
    expect(skater.nodes.some((n) => n.name === 'Ponytail')).toBe(false);
  });
});
