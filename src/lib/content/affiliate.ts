/**
 * Affiliate helpers (spec §13). The disclosure sentence is fixed copy and must
 * appear before the first sponsored link; the Amazon line is only added when
 * an Amazon product is actually used.
 */
import { PRODUCTS, productById } from '../../data/products';

export const DISCLOSURE =
  'I earn a commission if you buy through these links, at no extra cost to you.';
export const AMAZON_LINE = 'As an Amazon Associate I earn from qualifying purchases.';

export function productIdsInBody(body: string): string[] {
  const ids = new Set<string>();
  for (const match of body.matchAll(/<ProductCard[^>]*\bid=["']([^"']+)["']/g)) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids];
}

export function usesAmazonProduct(body: string): boolean {
  return productIdsInBody(body).some((id) => productById(id)?.retailer === 'amazon');
}

export function hasAffiliateProducts(body: string): boolean {
  return productIdsInBody(body).length > 0;
}

export { PRODUCTS };
