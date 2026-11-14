/**
 * Related-content matching (spec §12/§13), pure and unit-tested.
 * Reels match a plan by topics, region and diet; articles match each other by
 * shared topics, with explicit references first.
 */
import type { Topic } from '../../config/topics';
import { regionOf, type Region, type StateCode } from '../engine/regions';

export interface PlanAnswersForRelated {
  goal: string;
  conditions?: readonly string[];
  dietType?: string;
  budget?: string;
  foodSource?: string;
  state?: string;
  homeRegion?: string;
}

export interface RelatedReel {
  id: string;
  data: {
    title?: string;
    date?: Date | string;
    topics: readonly string[];
    regions?: readonly string[];
    diets?: readonly string[];
    featured?: boolean;
    draft?: boolean;
  };
}

type ReferenceLike = string | { collection: string; id: string } | undefined;

export interface RelatedItem {
  id: string;
  data: {
    /** Reels use `topics`. */
    topics?: readonly string[];
    /** Articles use `tags`. */
    tags?: readonly string[];
    draft?: boolean;
    relatedReel?: ReferenceLike;
  };
}

function topicList(item: RelatedItem): readonly string[] {
  return item.data.topics ?? item.data.tags ?? [];
}

export function topicsForAnswers(answers: PlanAnswersForRelated): Topic[] {
  const topics = new Set<Topic>();
  if (answers.goal === 'lose') topics.add('fat-loss');
  if (answers.goal === 'muscle' || answers.goal === 'gain') topics.add('muscle');

  const conditions = answers.conditions ?? [];
  if (conditions.includes('pcos')) topics.add('pcos');
  if (conditions.includes('diabetes')) topics.add('diabetes');
  if (conditions.some((c) => c === 'hypothyroid' || c === 'hyperthyroid' || c === 'thyroid'))
    topics.add('thyroid');

  if (answers.dietType && ['veg', 'vegan', 'jain'].includes(answers.dietType))
    topics.add('veg-protein');
  if (answers.budget === 'cheap') topics.add('budget');
  if (answers.foodSource === 'hostel' || answers.foodSource === 'eatOut') topics.add('hostel');

  return [...topics];
}

export function regionForAnswers(answers: PlanAnswersForRelated): Region | undefined {
  const code = answers.state === 'OUT' ? answers.homeRegion : answers.state;
  if (!code) return undefined;
  return regionOf(code as StateCode);
}

function dateValue(date: Date | string | undefined): number {
  if (!date) return 0;
  return (typeof date === 'string' ? new Date(date) : date).getTime();
}

/**
 * Up to `n` published reels for a saved plan. Topics score 3 each, a matching
 * region 2, a matching diet 1 and featured 0.5; ties break by newer date.
 * Reels scoring 0 are never returned.
 */
export function relatedReelsForPlan(
  answers: PlanAnswersForRelated,
  reels: readonly RelatedReel[],
  n = 3,
): RelatedReel[] {
  const topics = new Set(topicsForAnswers(answers));
  const region = regionForAnswers(answers);

  return reels
    .filter((reel) => !reel.data.draft)
    .map((reel) => {
      let score = 0;
      for (const topic of reel.data.topics) if (topics.has(topic as Topic)) score += 3;
      if (region && reel.data.regions?.includes(region)) score += 2;
      if (answers.dietType && reel.data.diets?.includes(answers.dietType)) score += 1;
      if (reel.data.featured) score += 0.5;
      return { reel, score };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) => b.score - a.score || dateValue(b.reel.data.date) - dateValue(a.reel.data.date),
    )
    .slice(0, n)
    .map((item) => item.reel);
}

function sharedTopicScore(a: RelatedItem, b: RelatedItem): number {
  const aTopics = topicList(a);
  return topicList(b).filter((topic) => aTopics.includes(topic)).length;
}

function rankedByTopic<T extends RelatedItem>(item: T, pool: T[]): T[] {
  return pool
    .map((other) => ({ other, score: sharedTopicScore(item, other) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (a.other.id < b.other.id ? -1 : 1))
    .map((entry) => entry.other);
}

export function relatedForReel<T extends RelatedItem>(reel: T, all: readonly T[]): T[] {
  const pool = all.filter((other) => other.id !== reel.id && !other.data.draft);
  return rankedByTopic(reel, pool).slice(0, 3);
}

function referenceId(reference: ReferenceLike): string | undefined {
  if (!reference) return undefined;
  return typeof reference === 'string' ? reference : reference.id;
}

/** Explicit `relatedReel` references first, then shared topics, up to 3. */
export function relatedForArticle<T extends RelatedItem>(article: T, all: readonly T[]): T[] {
  const pool = all.filter((other) => other.id !== article.id && !other.data.draft);
  const ranked = rankedByTopic(article, pool);
  const explicitId = referenceId(article.data.relatedReel);
  const explicit = explicitId ? pool.find((other) => other.id === explicitId) : undefined;
  if (explicit) {
    return [explicit, ...ranked.filter((other) => other.id !== explicit.id)].slice(0, 3);
  }
  return ranked.slice(0, 3);
}
