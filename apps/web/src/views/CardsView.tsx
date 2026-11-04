import { groupByPeriod, type SaveItem } from '@savesutra/core';
import { SectionLabel } from '@/components/ui';
import { SaveCard } from '@/components/SaveCard';

/** Cards grouped by the day they were saved (or first shared, for imports). */
export function CardsView({ items }: { items: SaveItem[] }) {
  const groups = groupByPeriod(items, 'day');
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label} className="flex flex-col gap-2.5">
          <SectionLabel>{g.label}</SectionLabel>
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
