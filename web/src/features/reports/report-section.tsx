import { useId, type ReactNode } from 'react';

export function ReportSection({ title, note, tools, children }: { title: string; note?: ReactNode; tools?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="bc-section" aria-labelledby={id}>
      <div className="bc-section__head">
        <div className="bc-section__text">
          <h2 id={id}>{title}</h2>
          {note && <p className="bc-section__note">{note}</p>}
        </div>
        {tools && <div className="bc-section__tools">{tools}</div>}
      </div>
      {children}
    </section>
  );
}
