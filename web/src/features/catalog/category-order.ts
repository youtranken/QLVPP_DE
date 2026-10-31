import { compareCategories } from '@/lib/group-tone';
import type { Category } from '@/features/catalog/catalog.api';

export const sortCategories = (list: Category[]): Category[] => [...list].sort(compareCategories);
