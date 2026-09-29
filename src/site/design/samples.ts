/**
 * Sample media for the design library's stories and the layout demos: the planet's painted concept
 * art (assets-src/CREDITS.md), at three widths plus a filmstrip thumbnail, and a short video made from
 * three of them. Real pictures, because this system is judged by how it carries pictures.
 */
import { withBase } from './meta';

export interface SamplePicture {
  slug: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  src: string;
  srcset: string;
  thumb: string;
  full: string;
}

const PICTURES: [string, string, string][] = [
  ['plaza', "A tiny planet's brick plaza with a compass rose, a cottage and a clock tower among trees, under a bright sky of clouds.", 'The plaza, where every path on the planet begins.'],
  ['workshop', "The workshop, a cottage with an orange roof, above the plaza's compass rose, with a stream and a small bridge beside it.", 'The workshop, just off the plaza.'],
  ['pond', 'A character stands by a lily pond among round trees and a tall pine on a green hill.', 'The pond, where the ducks keep their nest.'],
  ['waterfall', 'A waterfall spills from a cliff into a stream that runs past a greenhouse and under a wooden bridge.', 'The waterfall and the greenhouse.'],
  ['bridge', 'A path leads across a wooden bridge between an orange-roofed cottage and a blue-roofed hall, with a waterfall behind.', 'The bridge between the workshop and the town hall.'],
  ['lighthouse-dusk', 'A red and white lighthouse sweeps its beam over the hilltop at dusk, the sky pink and gold.', 'The lighthouse at dusk.'],
  ['plaza-night', "The plaza at night: the town hall's windows glow, lamps light the brick paths, and the lighthouse shines under a full moon.", 'The plaza at night.'],
];

const url = (slug: string, w: number | 'thumb') => withBase(`/design/samples/${slug}-${w}.webp`);

export const SAMPLES: SamplePicture[] = PICTURES.map(([slug, alt, caption]) => ({
  slug,
  alt,
  caption,
  width: 1600,
  height: 1067,
  src: url(slug, 960),
  srcset: `${url(slug, 480)} 480w, ${url(slug, 960)} 960w, ${url(slug, 1600)} 1600w`,
  thumb: url(slug, 'thumb'),
  full: url(slug, 1600),
}));

export const sample = (slug: string): SamplePicture => SAMPLES.find((s) => s.slug === slug)!;

export const SAMPLE_VIDEO = {
  src: withBase('/design/samples/planet-tour.mp4'),
  poster: withBase('/design/samples/planet-tour-poster.webp'),
  captions: withBase('/design/samples/planet-tour.en.vtt'),
  width: 960,
  height: 640,
  description: 'A ten-second drift over the painted planet: the plaza, the waterfall, then the lighthouse at dusk. No sound.',
};
