import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const healthNotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/health-notes' }),
  schema: z.object({
    title: z.string(),
    appliesTo: z.array(z.string()),
    priority: z.number(),
    reviewedBy: z.string().default(''),
  }),
});

export const collections = { healthNotes };
