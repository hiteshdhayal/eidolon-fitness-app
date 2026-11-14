import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { TOPIC_KEYS } from './config/topics';
import { REGIONS } from './lib/engine/regions';

const DIETS = ['veg', 'eggetarian', 'nonveg', 'vegan', 'jain'] as const;
const MUSCLES = [
  'quads',
  'glutes',
  'hamstrings',
  'calves',
  'chest',
  'back',
  'lats',
  'shoulders',
  'triceps',
  'biceps',
  'core',
  'full-body',
] as const;
const EQUIPMENT = ['none', 'dumbbells', 'barbell', 'machine', 'band'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

const healthNotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/health-notes' }),
  schema: z.object({
    title: z.string(),
    appliesTo: z.array(z.string()),
    priority: z.number(),
    reviewedBy: z.string().default(''),
  }),
});

const reels = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/reels' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(70),
      instagramUrl: z
        .string()
        .url()
        .refine((url) => url.startsWith('https://www.instagram.com/'), {
          message: 'instagramUrl must start with https://www.instagram.com/',
        }),
      date: z.coerce.date(),
      thumbnail: image().optional(),
      topics: z.array(z.enum(TOPIC_KEYS)).min(1),
      regions: z.array(z.enum(REGIONS)).optional(),
      diets: z.array(z.enum(DIETS)).optional(),
      relatedArticle: reference('articles').optional(),
      relatedExercise: reference('exercises').optional(),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
    }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string().max(70),
    description: z.string().max(155),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.enum(TOPIC_KEYS)),
    kind: z.enum(['article', 'guide']).default('article'),
    relatedReel: reference('reels').optional(),
    hasAffiliateLinks: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const exercises = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/exercises' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      otherNames: z.array(z.string()).default([]),
      muscles: z.array(z.enum(MUSCLES)).min(1),
      equipment: z.enum(EQUIPMENT),
      level: z.enum(LEVELS),
      summary: z.string(),
      steps: z.array(z.string()).min(3).max(7),
      cues: z.array(z.string()).min(2).max(5),
      commonMistakes: z.array(z.string()).min(2).max(5),
      easierVersion: reference('exercises').optional(),
      harderVersion: reference('exercises').optional(),
      relatedReel: reference('reels').optional(),
      media: image().optional(),
      draft: z.boolean().default(false),
    }),
});

const workouts = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/workouts' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    level: z.enum(LEVELS),
    daysPerWeek: z.number().int(),
    where: z.enum(['home', 'gym', 'anywhere']),
    days: z
      .array(
        z.object({
          name: z.string(),
          exercises: z.array(
            z.object({
              exercise: reference('exercises'),
              sets: z.string(),
              reps: z.string(),
              rest: z.string(),
              note: z.string().optional(),
            }),
          ),
        }),
      )
      .default([]),
    steps: z
      .array(
        z.object({
          week: z.number().int(),
          dailySteps: z.number().int(),
          note: z.string().optional(),
        }),
      )
      .optional(),
    progression: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { healthNotes, reels, articles, exercises, workouts };
