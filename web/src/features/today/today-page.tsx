import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { langOf, lockPhrase } from '@/lib/period-text';
import { LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { greetingKey } from './greeting';
import { attentionItems, todaySummary, todayTiles, type Text, type Tile } from './today-tiles';
import { useTodayData, type SourceState } from './use-today-data';
import '@/features/today/today.m1.css';

const ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: ZONE });

const dayLine = (now: Date, lang: string) => {
  const weekday = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { weekday: 'long', timeZone: ZONE }).format(now);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${DAY_MONTH.format(now)}`;
};

function TileView({ tile, source }: { tile: Tile; source: SourceState }) {
  const { t, i18n } = useTranslation();
  const text = (x: Text) =>
    x.key === 'today.tiles.period.hint' ? t(x.key, { lock: lockPhrase(String(x.params?.deadline), langOf(i18n.language)), count: x.params?.count }) : t(x.key, x.params);
  const label = text(tile.label);
  if (source.failed) {
    return (
      <div className="stat-card td-tile" role="group" aria-label={label}>
        <span className="stat-card__k">{label}</span>
        <span className="td-tile__err">{t('today.tileError')}</span>
        <button type="button" className="btn btn--sm" onClick={source.retry}>
          {t('common.retry')}
        </button>
      </div>
    );
  }
  const tone = tile.tone === 'warn' || tile.tone === 'danger' ? tile.tone : 'neutral';
  return (
    <Link to={tile.to} className="stat-card td-tile" data-tone={tone} aria-busy={tile.value === null || undefined}>
      <span className="stat-card__k">{label}</span>
      <span className="stat-card__v num">{tile.value ?? '…'}</span>
      {tile.hint && (
        <span className="stat-card__sub" data-ok={tile.tone === 'ok' || undefined} title={text(tile.hint)}>
          {text(tile.hint)}
        </span>
      )}
    </Link>
  );
}

type AttentionSources = { review: SourceState; people: SourceState };

function AttentionList({ items, settled, sources }: { items: ReturnType<typeof attentionItems>; settled: boolean; sources: AttentionSources }) {
  const { t } = useTranslation();
  const failed = (['review', 'people'] as const).filter((k) => sources[k].failed);
  return (
    <section className="td-panel" aria-labelledby="td-attention">
      <h2 id="td-attention">{t('today.attention.title')}</h2>
      {failed.map((k) => (
        <LoadError key={k} message={t(`today.attention.error.${k}`)} onRetry={sources[k].retry} />
      ))}
      {items.length === 0 ? (
        settled && failed.length === 0 && <p className="td-empty">{t('today.attention.empty')}</p>
      ) : (
        <ul aria-label={t('today.attention.title')}>
          {items.map((it) =>
            it.kind === 'review' ? (
              <li key={`r-${it.id}`} className="td-todo">
                <span className="tag tag--danger">{t('today.attention.waiting', { count: it.days })}</span>
                <span className="td-todo__text">
                  <b>{it.name}</b> · {t('today.attention.custom', { name: it.what })}
                </span>
                <Link className="btn btn--sm btn--primary" to={it.to}>
                  {t('today.attention.review')}
                </Link>
              </li>
            ) : (
              <li key={`l-${it.id}`} className="td-todo">
                <span className="tag tag--warn">{t('today.attention.leftTag')}</span>
                <span className="td-todo__text">
                  <b>{it.name}</b> · {t('today.attention.leftQty', { count: it.qty })}
                </span>
                <Link className="btn btn--sm" to={it.to}>
                  {t('today.attention.open')}
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

export function TodayPage() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const [now] = useState(() => new Date());
  const { data, sources } = useTodayData(now);
  const tiles = todayTiles(data);
  const { work, urgent } = todaySummary(tiles);
  const date = dayLine(now, i18n.language);
  const greeting = t(`today.greeting.${greetingKey(now)}`);
  const name = me.fullName ?? me.email;
  const sub = work === 0 ? t('today.summary.none', { date }) : t('today.summary.work', { date, count: work });
  const settled = data.review !== undefined && data.people !== undefined;
  return (
    <div className="ct-page td-page">
      <PageHeader
        crumbs={[t('nav.groups.monthly'), t('today.title')]}
        title={name ? t('today.greet', { greeting, name }) : greeting}
        sub={
          <>
            {sub}
            {urgent > 0 && <b className="td-urgent">{` · ${t('today.summary.urgent', { count: urgent })}`}</b>}
          </>
        }
        secondary={
          <Link className="btn" to="/admin/month">
            {t('today.openMonth')}
          </Link>
        }
        primary={
          <Link className="btn btn--primary" to="/admin/delivery">
            {t('today.openDelivery')}
          </Link>
        }
      />
      <section className="stat-row td-tiles" data-count={tiles.length} aria-label={t('today.tilesLabel')}>
        {tiles.map((tile) => (
          <TileView key={tile.key} tile={tile} source={sources[tile.source]} />
        ))}
      </section>
      <AttentionList items={attentionItems(data)} settled={settled} sources={sources} />
    </div>
  );
}
