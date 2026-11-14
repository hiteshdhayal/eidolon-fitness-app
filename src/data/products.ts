/**
 * Affiliate products (spec §13). One file, validated with zod at build. No
 * prices, ever. The five seed entries are placeholders until the brands and
 * links are chosen.
 */
import { z } from 'zod';

export const ProductSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    brand: z.string().min(1),
    /** Filename under src/assets/products, e.g. "pick-1.jpg". */
    image: z.string().optional(),
    bestFor: z.string().min(1),
    pros: z.array(z.string()).min(1),
    cons: z.array(z.string()).min(1),
    verdict: z.string().min(1),
    /** "" until the link is added; the card then shows "LINK COMING". */
    affiliateUrl: z.string(),
    retailer: z.enum(['amazon', 'brand', 'other']),
    placeholder: z.boolean(),
  })
  .strict();

export type Product = z.infer<typeof ProductSchema>;

export const PRODUCTS: Product[] = z.array(ProductSchema).parse([
  {
    id: 'pick-1',
    name: 'Whey protein, to be chosen',
    brand: 'Brand to be added',
    bestFor: 'A simple whey isolate for people who already eat well and want an easy top-up.',
    pros: ['Clear ingredient list', 'Third-party testing is the first thing I check'],
    cons: ['Brand and link are not chosen yet'],
    verdict: 'Not a recommendation yet. I am still checking labels and lab reports.',
    affiliateUrl: '',
    retailer: 'other',
    placeholder: true,
  },
  {
    id: 'pick-2',
    name: 'Plant protein, to be chosen',
    brand: 'Brand to be added',
    bestFor: 'Vegan and dairy-free diets where dal, chana and soya are already staples.',
    pros: ['No dairy', 'Useful when food alone is not enough'],
    cons: ['Brand and link are not chosen yet', 'Taste varies a lot between brands'],
    verdict: 'Not a recommendation yet. I am still checking labels and lab reports.',
    affiliateUrl: '',
    retailer: 'other',
    placeholder: true,
  },
  {
    id: 'pick-3',
    name: 'Creatine monohydrate, to be chosen',
    brand: 'Brand to be added',
    bestFor: 'People lifting regularly who want the most-studied supplement there is.',
    pros: ['One ingredient, nothing hidden', 'Cheap per serving when it is plain monohydrate'],
    cons: ['Brand and link are not chosen yet'],
    verdict: 'Not a recommendation yet. I am still checking labels and lab reports.',
    affiliateUrl: '',
    retailer: 'other',
    placeholder: true,
  },
  {
    id: 'pick-4',
    name: 'Vitamin D3, to be chosen',
    brand: 'Brand to be added',
    bestFor: 'Only after a blood test and a doctor says you need it.',
    pros: ['Easy to check the dose on the label'],
    cons: ['Brand and link are not chosen yet', 'Not something to take without a test'],
    verdict: 'Not a recommendation yet. I am still checking labels and lab reports.',
    affiliateUrl: '',
    retailer: 'other',
    placeholder: true,
  },
  {
    id: 'pick-5',
    name: 'Omega-3, to be chosen',
    brand: 'Brand to be added',
    bestFor: 'People who rarely eat fish, after checking with a doctor.',
    pros: ['Clear EPA and DHA numbers are easy to compare'],
    cons: ['Brand and link are not chosen yet', 'Quality varies a lot'],
    verdict: 'Not a recommendation yet. I am still checking labels and lab reports.',
    affiliateUrl: '',
    retailer: 'other',
    placeholder: true,
  },
]);

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}
