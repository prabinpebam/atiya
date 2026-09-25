import { describe, expect, it } from 'vitest';
import { Color, Matrix4, MeshStandardMaterial, Quaternion, ShaderLib, UniformsUtils, Vector3, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { LAMP_MAX, addLamp, lampUniforms, updateLampUniforms, withLampLights, type Lamp } from '../../src/game/world/lampLights';

const lamp = (over: Partial<Lamp> = {}): Lamp => ({ pos: new Vector3(0, 11, 0), dir: null, color: new Color(1, 0.8, 0.6), intensity: 4, range: 3, ...over });

/** Run a material's onBeforeCompile on a copy of three's physical shader, as the renderer would. */
function compiled(m: MeshStandardMaterial) {
  const shader = {
    uniforms: UniformsUtils.clone(ShaderLib.physical.uniforms),
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader,
  } as unknown as WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}

describe('lamp lights', () => {
  it('pack only lit lamps, in world space, with spot cones; none by day', () => {
    const offs = [
      addLamp(lamp()),
      addLamp(lamp({ intensity: 0 })), // unlit: skipped
      addLamp(lamp({ pos: new Vector3(1, 10.5, 0), dir: new Vector3(0, -1, 0), cone: [0.8, 0.4], color: new Color(1, 1, 1), intensity: 2 })),
    ];
    // the planet has turned a quarter turn about y and moved up a little
    const planet = new Matrix4().compose(new Vector3(0, 0.5, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2), new Vector3(1, 1, 1));
    expect(updateLampUniforms(planet)).toBe(2);
    const U = lampUniforms;
    expect(U.uLampCount.value).toBe(2);
    expect(U.uLampPos.value[0].toArray().map((v) => +v.toFixed(5))).toEqual([0, 11.5, 0]);
    // the spot moved with the planet: (1, 10.5, 0) turned a quarter turn → (0, 11, −1)
    expect(U.uLampPos.value[1].x).toBeCloseTo(0, 5);
    expect(U.uLampPos.value[1].y).toBeCloseTo(11, 5);
    expect(U.uLampPos.value[1].z).toBeCloseTo(-1, 5);
    expect(U.uLampDir.value[1].y).toBeCloseTo(-1, 5);
    expect(U.uLampParams.value[1].y).toBeCloseTo(Math.cos(0.8), 6);
    expect(U.uLampParams.value[1].z).toBeCloseTo(Math.cos(0.4), 6);
    // omni lamps are flagged so the shader skips the cone
    expect(U.uLampParams.value[0].y).toBe(-2);
    // intensity scales the colour (three.js light units)
    expect(U.uLampColor.value[0].toArray()).toEqual([4, 3.2, 2.4].map((v) => expect.closeTo(v, 5)));
    offs.forEach((f) => f());
    expect(updateLampUniforms(new Matrix4())).toBe(0);
  });

  it('never exceeds the fixed-size list', () => {
    const offs = Array.from({ length: LAMP_MAX + 4 }, () => addLamp(lamp()));
    expect(updateLampUniforms(new Matrix4())).toBe(LAMP_MAX);
    offs.forEach((f) => f());
    updateLampUniforms(new Matrix4());
  });

  it('adds the lamps to the physically based diffuse term (albedo-lit, not an overlay) and keeps earlier patches', () => {
    const m = new MeshStandardMaterial();
    let earlier = false;
    m.onBeforeCompile = (s) => {
      earlier = true;
      s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n// earlier-patch');
    };
    m.customProgramCacheKey = () => 'base';
    withLampLights(m);
    const s = compiled(m);
    expect(earlier).toBe(true);
    expect(s.fragmentShader).toContain('// earlier-patch');
    expect(m.customProgramCacheKey()).toBe('base|lamps-v1');
    // the vertex stage passes the world position (after skinning / sway: it follows project_vertex)
    expect(s.vertexShader).toMatch(/#include <project_vertex>[\s\S]*vLampWorld = \( modelMatrix \* lampWP \)\.xyz/);
    // the loop sits just before three's own lights are finished, and multiplies the albedo
    const frag = s.fragmentShader;
    const loop = frag.indexOf('uLampCount > 0');
    expect(loop).toBeGreaterThan(frag.indexOf('#include <lights_fragment_begin>'));
    expect(loop).toBeLessThan(frag.indexOf('#include <lights_fragment_end>'));
    expect(frag).toContain('reflectedLight.directDiffuse += uLampColor[ i ] * ( lampAtt * lampNdl ) * BRDF_Lambert( material.diffuseColor )');
    expect(frag).toContain('getDistanceAttenuation( lampD, lampP.x, 2.0 )');
    expect(frag).toContain('getSpotAttenuation(');
    // and the shared uniforms are wired in (one uniform block for every receiving material)
    expect(s.uniforms.uLampPos).toBe(lampUniforms.uLampPos);
  });
});
