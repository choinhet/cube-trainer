import data from '../data/cfop-catalog-v1.json';
export const ALGORITHM_CATALOG_VERSION = '1.0.0';
export interface CatalogVariant {
  id: string;
  notation: string;
  sourceIds: readonly string[];
  sourceRecommendation: string;
  sourceOrder?: number;
}
export interface CatalogCase {
  id: string;
  phase: 'F2L' | 'OLL' | 'PLL';
  name: string;
  look: 'one-look' | 'two-look';
  step?: string;
  group: string;
  defaultVariantId: string;
  variants: readonly CatalogVariant[];
}
/** Curated offline identification aid; cube states determine phase progress. */
export const ALGORITHM_CATALOG: readonly CatalogCase[] = data as CatalogCase[];
export const ALGORITHM_CATALOG_SOURCES = [{
  id: 'cube-coach',
  author: 'Luke Jackson (lukejacksonn)',
  url: 'https://github.com/lukejacksonn/cube/blob/856b269c63715fbd164b90aee1de5f4725fd277a/src/algorithms.ts',
  revision: '856b269c63715fbd164b90aee1de5f4725fd277a',
  license: 'MIT (declared in upstream README)',
  retrieved: '2026-10-15',
}] as const;

