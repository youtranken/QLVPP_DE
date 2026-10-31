import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import { useRefreshStock } from './stock.api';
import { stockErrors, type StockErrors, type StockField } from './stock-errors';

export function useStockSubmit(unit: string, onClose: () => void) {
  const { t } = useTranslation();
  const toast = useToast();
  const refresh = useRefreshStock();
  const [errors, setErrors] = useState<StockErrors>({});
  const flight = useSingleFlight();
  const run = (send: () => Promise<unknown>, doneText: string) =>
    flight.run(async () => {
      try {
        await send();
        toast.show({ text: doneText, tone: 'ok' });
        void refresh();
        onClose();
      } catch (e) {
        setErrors(stockErrors(e, t, unit));
      }
    });
  const fail = (field: StockField, message: string) => setErrors((prev) => ({ ...prev, [field]: message }));
  const clear = (field: StockField) => setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }));
  return { errors, saving: flight.pending, run, fail, clear };
}
