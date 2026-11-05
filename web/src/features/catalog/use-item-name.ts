import { useTranslation } from 'react-i18next';
import type { CatalogRow } from './catalog-rows';

export function useItemName() {
  const { i18n } = useTranslation();
  return (r: Pick<CatalogRow, 'name' | 'name_en'>) => (i18n.language === 'en' && r.name_en ? r.name_en : r.name);
}
