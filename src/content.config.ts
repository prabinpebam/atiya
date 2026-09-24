import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const landmarks = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/landmarks' }),
  schema: z.object({
    title: z.string(),
    kicker: z.string(),
    summary: z.string().max(140),
    order: z.number().int(),
    lat: z.number().min(-85).max(85),
    lon: z.number().min(-180).max(180),
    modelYawDeg: z.number().default(0),
    footprintU: z.number().min(0.3),
    approachDistanceU: z.number().positive(),
    variant: z.string(),
    accent: z.string(),
    dialog: z.object({
      intro: z.string(),
      highlights: z.array(z.string()).max(5),
    }),
  }),
});

export const collections = { landmarks };
