/**
 * Fixes: PERF-03 (sitemap rendered on every request in iad1), CONF-01
 * Cached at the edge and regenerated at most once per hour.
 */
import type { MetadataRoute } from 'next';

export const revalidate = 3600; // ISR: rebuild at most hourly

const SITE_URL = process.env.SITE_URL ?? 'https://www.cynbit.in';

const STATIC_ROUTES = [
  '', '/careers', '/contact', '/blog', '/case-studies',
  '/bitelevate', '/impact', '/paths', '/diaries',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // If blog posts come from a CMS/DB, fetch them here; the result is cached.
  // const posts = await getPublishedPosts();

  return STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));
}
