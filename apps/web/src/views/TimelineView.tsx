import { useMemo, useState } from 'react';
import { groupByPeriod, itemDate, type Period, type SaveItem } from '@savesutra/core';
import { SaveCard } from '@/components/SaveCard';
import { Segmented, SectionLabel } from '@/components/ui';
import { cn } from '@/lib/utils';

const WEEKS = 18;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A GitHub-style heatmap of how much you saved each day. Tap a day to see it. */
function Heatmap({ items, selected, onSelect }: { items: SaveItem[]; selected: string | null; onSelect: (k: string | null) => void }) {
  const { cells, max } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) {
      const k = dayKey(new Date(itemDate(it)));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(end.getDate() - (WEEKS * 7 - 1) - ((end.getDay() + 6) % 7 === 6 ? 0 : 0));
    const cells: Array<{ key: string; date: Date; count: number }> = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d);
      cells.push({ key: k, date: new Date(d), count: counts.get(k) ?? 0 });
    }
    return { cells, max: Math.max(1, ...cells.map((c) => c.count)) };
  }, [items]);

  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const shades = ['var(--surface-3)', '#F7C7AE', '#EE9A6F', '#D9622E', '#A83A0C'];

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Last {WEEKS} weeks</SectionLabel>
        {selected && (
          <button type="button" onClick={() => onSelect(null)} className="text-xs font-bold text-brand">
            Clear day
          </button>
        )}
      </div>
      <div className="no-scrollbar overflow-x-auto">
        <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]" role="grid" aria-label="Saves per day">
          {cells.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelect(c.count ? c.key : null)}
              title={`${c.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${c.count} save${c.count === 1 ? '' : 's'}`}
              aria-label={`${c.date.toDateString()}: ${c.count} saves`}
              className={cn('h-3.5 w-3.5 rounded-[3px]', selected === c.key && 'ring-2 ring-brand ring-offset-1 ring-offset-surface')}
              style={{ background: shades[level(c.count)] }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted">
        Less {shades.map((s) => <span key={s} className="h-3 w-3 rounded-[3px]" style={{ background: s }} />)} More
      </div>
    </div>
  );
}

/** Timeline: what you saved by day, week or month. */
export function TimelineView({ items }: { items: SaveItem[] }) {
  const [period, setPeriod] = useState<Period>('week');
  const [day, setDay] = useState<string | null>(null);
  const visible = day ? items.filter((i) => dayKey(new Date(itemDate(i))) === day) : items;
  const groups = groupByPeriod(visible, day ? 'day' : period);
  return (
    <div className="flex flex-col gap-4">
      <Heatmap items={items} selected={day} onSelect={setDay} />
      {!day && (
        <Segmented
          label="Group by"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
      )}
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <SectionLabel>{g.label}</SectionLabel>
            <span className="text-xs font-semibold text-muted">{g.items.length} saved</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {g.items.map((it) => (
              <SaveCard key={it.id} item={it} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
