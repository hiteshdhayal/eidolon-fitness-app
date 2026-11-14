/**
 * Enumerates every indexable page so the OG-image endpoint (Part C3) can
 * build one PNG per page at build time. Static routes are listed by hand;
 * content-collection routes are resolved from the collections themselves so
 * a new reel/article/exercise/workout gets an image without code changes.
 */
import { getCollection } from 'astro:content';
import { publishedOnly } from '../content/published';
import { TOPICS, topicLabel, type Topic } from '../../config/topics';
import { ogSlugFor } from './ogSlug';

export interface OgPage {
  path: string;
  slug: string;
  eyebrow: string;
  title: string;
}

const STATIC_PAGES: Omit<OgPage, 'slug'>[] = [
  { path: '/', eyebrow: 'Home', title: 'Eidolon' },
  { path: '/plan/', eyebrow: 'Tool', title: 'Free Indian diet plan, built on your food' },
  { path: '/learn/', eyebrow: 'Learn', title: 'Learn something' },
  { path: '/learn/guides/', eyebrow: 'Guides', title: 'Get the basics right' },
  { path: '/workouts/', eyebrow: 'Workouts', title: 'Ready-made workouts' },
  { path: '/tools/', eyebrow: 'Tools', title: 'Quick numbers' },
  { path: '/tools/bmi/', eyebrow: 'Tool', title: 'BMI calculator with Asian cutoffs' },
  { path: '/tools/calories/', eyebrow: 'Tool', title: 'Calorie calculator for Indians' },
  { path: '/tools/protein/', eyebrow: 'Tool', title: 'Daily protein calculator, from food' },
  { path: '/reels/', eyebrow: 'Reels', title: 'Every reel, written down' },
  { path: '/articles/', eyebrow: 'Articles', title: 'Articles' },
  { path: '/articles/picks/', eyebrow: 'Picks', title: 'Things I actually recommend' },
  { path: '/links/', eyebrow: 'Links', title: 'All my links' },
  { path: '/about/', eyebrow: 'About', title: 'Built for your kitchen' },
  { path: '/disclaimer/', eyebrow: 'Legal', title: 'Disclaimer' },
  { path: '/privacy/', eyebrow: 'Legal', title: 'Privacy' },
  { path: '/affiliate-disclosure/', eyebrow: 'Legal', title: 'Affiliate disclosure' },
  { path: '/terms/', eyebrow: 'Legal', title: 'Terms' },
];

export async function listOgPages(): Promise<OgPage[]> {
  const pages: Omit<OgPage, 'slug'>[] = [...STATIC_PAGES];

  const reels = publishedOnly(await getCollection('reels'));
  for (const reel of reels) {
    pages.push({ path: `/reels/${reel.id}/`, eyebrow: 'Reel', title: reel.data.title });
  }
  const topics = (Object.keys(TOPICS) as Topic[]).filter((topic) =>
    reels.some((reel) => reel.data.topics.includes(topic)),
  );
  for (const topic of topics) {
    pages.push({
      path: `/reels/topic/${topic}/`,
      eyebrow: 'Reels',
      title: topicLabel(topic),
    });
  }

  const articles = publishedOnly(await getCollection('articles'));
  for (const entry of articles) {
    const isGuide = entry.data.kind === 'guide';
    pages.push({
      path: isGuide ? `/learn/guides/${entry.id}/` : `/articles/${entry.id}/`,
      eyebrow: isGuide ? 'Guide' : 'Article',
      title: entry.data.title,
    });
  }

  const exercises = publishedOnly(await getCollection('exercises'));
  for (const entry of exercises) {
    pages.push({ path: `/learn/${entry.id}/`, eyebrow: 'Exercise', title: entry.data.name });
  }

  const workouts = publishedOnly(await getCollection('workouts'));
  for (const entry of workouts) {
    pages.push({ path: `/workouts/${entry.id}/`, eyebrow: 'Workout', title: entry.data.title });
  }

  return pages.map((page) => ({ ...page, slug: ogSlugFor(page.path) }));
}
