/**
 * Build-time OG image endpoint (spec Phase 6 Part C3). One PNG per
 * indexable page, 1200x630, plus a default for anything without a specific
 * one. This route is never linked to directly, so it's excluded from the
 * sitemap (src/config/site.ts).
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { listOgPages } from '../../lib/seo/ogPages';
import { renderOgImage } from '../../lib/seo/ogImage';

export const getStaticPaths: GetStaticPaths = async () => {
  const pages = await listOgPages();
  const paths = pages.map((page) => ({
    params: { slug: page.slug },
    props: { eyebrow: page.eyebrow, title: page.title },
  }));
  paths.push({ params: { slug: 'default' }, props: { eyebrow: 'Eidolon', title: 'Eidolon' } });
  return paths;
};

export const GET: APIRoute = async ({ props }) => {
  const { eyebrow, title } = props as { eyebrow: string; title: string };
  const png = await renderOgImage({ eyebrow, title });
  return new Response(png, {
    headers: { 'Content-Type': 'image/png' },
  });
};
