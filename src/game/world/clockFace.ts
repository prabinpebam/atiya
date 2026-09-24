/**
 * Clock-face maths for the town-hall clock. Angles are radians clockwise from 12 o'clock, read
 * from the device's local time (so the clock matches the visitor's own clock and time zone).
 * The hour hand creeps with the minutes and the minute hand with the seconds, like a real
 * movement; the second hand ticks whole seconds.
 */
export function clockHandAngles(d: Date): { hour: number; minute: number; second: number } {
  const s = d.getSeconds();
  const m = d.getMinutes() + s / 60;
  const h = (d.getHours() % 12) + m / 60;
  const TAU = Math.PI * 2;
  return { hour: (h / 12) * TAU, minute: (m / 60) * TAU, second: (s / 60) * TAU };
}

