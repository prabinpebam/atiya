import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { arcDistance, moveAlong, rotateTangent } from '../../src/game/math/sphere';
import { PlanetSim } from '../../src/game/systems/movement';
import { SEAT, SeatMotion, benchSeats, seatInRange } from '../../src/game/systems/seating';
import { generateProps } from '../../src/game/world/layout';
import { BENCH } from '../../src/game/world/parts';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const obstacles = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles];
const seats = benchSeats(layout.furniture);
const seat = seats[0];
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);
/** A point `u` from the bench centre, `angle` rad round from its facing. */
const around = (u: number, angle: number) => moveAlong(seat.n, rotateTangent(seat.facing, seat.n, angle), u / R);

describe('benches', () => {
  it('the plaza bench is a seat, with a stand-up spot clear of its collision circle', () => {
    expect(seats.length).toBe(layout.furniture.filter((f) => f.kind === 'bench').length);
    expect(seats.length).toBeGreaterThanOrEqual(1);
    const block = obstacles.find((o) => d(o.n, seat.n) < 1e-6)!;
    expect(block).toBeTruthy();
    expect(d(seat.stand, seat.n)).toBeGreaterThan(block.radiusU + CONFIG.playerRadius);
    // standing up leaves you free: nothing else overlaps that spot either
    for (const o of obstacles) expect(d(seat.stand, o.n)).toBeGreaterThanOrEqual(o.radiusU + CONFIG.playerRadius - 1e-6);
    // you sit just behind the centre, against the backrest
    expect(d(seat.sit, seat.n)).toBeCloseTo(SEAT.sitBackU, 5);
    expect(new Vector3().subVectors(seat.sit, seat.n).dot(seat.facing)).toBeLessThan(0);
  });

  it('is offered in front of and beside the bench, not from behind or far away, with hysteresis', () => {
    expect(seatInRange(around(1.0, 0), seats, null)).toBe(seat.id);
    expect(seatInRange(around(1.0, 0.8), seats, null)).toBe(seat.id);
    expect(seatInRange(around(1.0, Math.PI / 2), seats, null)).toBe(seat.id); // at an end
    expect(seatInRange(around(1.0, Math.PI), seats, null)).toBeNull(); // behind
    expect(seatInRange(around(2.0, 0), seats, null)).toBeNull();
    // walking away: still offered past the enter radius, gone past the exit radius
    expect(seatInRange(around(1.6, 0), seats, null)).toBeNull();
    expect(seatInRange(around(1.6, 0), seats, seat.id)).toBe(seat.id);
    expect(seatInRange(around(1.8, 0), seats, seat.id)).toBeNull();
  });

  it('sits down smoothly onto the seat, then stands up in front of the bench', () => {
    const m = new SeatMotion();
    const start = around(1.0, 0.4);
    m.sit(seat, start);
    expect(m.seated).toBe(true);
    let at = m.step(SEAT.sitTime / 2)!;
    expect(m.pose).toBeGreaterThan(0.3);
    expect(m.pose).toBeLessThan(0.7);
    expect(d(at, seat.sit)).toBeLessThan(d(start, seat.sit));
    let last = m.pose;
    for (let t = 0; t < SEAT.sitTime; t += 1 / 60) {
      at = m.step(1 / 60)!;
      expect(m.pose).toBeGreaterThanOrEqual(last - 1e-9);
      last = m.pose;
    }
    expect(m.stage).toBe('seated');
    expect(m.pose).toBe(1);
    expect(d(at, seat.sit)).toBeLessThan(1e-6);
    // stays put while seated
    for (let i = 0; i < 30; i++) expect(d(m.step(1 / 60)!, seat.sit)).toBeLessThan(1e-6);
    m.stand(at);
    expect(m.seated).toBe(false);
    for (let t = 0; t <= SEAT.standTime + 0.05; t += 1 / 60) at = m.step(1 / 60) ?? at;
    expect(m.stage).toBeNull();
    expect(m.pose).toBe(0);
    expect(d(at, seat.stand)).toBeLessThan(1e-6);
    expect(m.step(1 / 60)).toBeNull();
  });

  it('can stand up halfway down, and snaps under reduced motion', () => {
    const m = new SeatMotion();
    m.sit(seat, seat.stand);
    const mid = m.step(SEAT.sitTime / 2)!.clone();
    const pose = m.pose;
    m.stand(mid);
    const next = m.step(1 / 60)!;
    expect(m.pose).toBeLessThan(pose);
    expect(m.pose).toBeGreaterThan(0);
    expect(d(next, seat.stand)).toBeLessThan(d(mid, seat.stand));
    const r = new SeatMotion();
    r.sit(seat, seat.stand);
    expect(d(r.step(1 / 60, true)!, seat.sit)).toBeLessThan(1e-6);
    expect(r.pose).toBe(1);
    r.stand(seat.sit);
    expect(d(r.step(1 / 60, true)!, seat.stand)).toBeLessThan(1e-6);
    expect(r.stage).toBeNull();
    // clearing (fast travel) drops the pose at once
    r.sit(seat, seat.stand);
    r.step(0.1);
    r.clear();
    expect(r.pose).toBe(0);
    expect(r.step(1 / 60)).toBeNull();
  });

  it('placeAt moves the player without turning the view, and walking works again after standing', () => {
    const sim = new PlanetSim(obstacles);
    sim.placeAt(seat.stand);
    expect(d(sim.pLocal, seat.stand)).toBeLessThan(1e-6);
    const heading = sim.heading;
    sim.placeAt(seat.sit);
    expect(d(sim.pLocal, seat.sit)).toBeLessThan(1e-6);
    expect(sim.heading).toBe(heading);
    sim.placeAt(seat.stand);
    const before = sim.pLocal.clone();
    // walk away from the bench (intent is screen-space: x right, y up = world −z)
    const away = seat.facing.clone().applyQuaternion(sim.planetQ);
    for (let i = 0; i < 60; i++) sim.step(1 / 60, { x: away.x, y: -away.z, run: false });
    expect(d(sim.pLocal, before)).toBeGreaterThan(0.5);
    expect(d(sim.pLocal, seat.n)).toBeGreaterThan(d(before, seat.n));
  });

  it('the bench model has its seat where the sitting pose expects it', () => {
    expect(SEAT.seatY).toBeCloseTo(BENCH.seatTop - 0.01, 6);
    expect(BENCH.seatTop).toBeGreaterThan(0.25);
    expect(BENCH.seatTop).toBeLessThan(0.36);
  });
});
