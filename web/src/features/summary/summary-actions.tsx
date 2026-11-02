import { useTranslation } from 'react-i18next';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { RowMenu } from '@/ui/row-menu';
import { UnregisteredCopy } from './unregistered-copy';
import { useUnregisteredCopy } from './use-unregistered-copy';

interface Props {
  ym: string;
  deadline: string | null;
  unregistered: number;
}

function CopyMenu({ ym, deadline, unregistered }: Props) {
  const { t } = useTranslation();
  const c = useUnregisteredCopy(ym, deadline);
  return (
    <>
      <RowMenu
        label={t('summary.page.moreActions')}
        items={[
          {
            label: t('summary.unregistered.copy.button', { n: unregistered }),
            disabled: c.busy || unregistered === 0,
            title: unregistered === 0 ? t('summary.unregistered.allDone') : undefined,
            onSelect: c.copy,
          },
        ]}
      />
      {c.feedback}
    </>
  );
}

// 390: nút phụ ít dùng vào menu ⋯ (luật bố cục 8)
export function SummaryCopy({ ym, deadline, unregistered }: Props) {
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  if (phone) return <CopyMenu ym={ym} deadline={deadline} unregistered={unregistered} />;
  return <UnregisteredCopy ym={ym} deadline={deadline} count={unregistered} />;
}
