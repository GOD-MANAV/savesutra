import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { platformLabel, type SaveItem } from '@savesutra/core';
import { ArrowDown, ArrowUp, Columns3, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Menu } from '@/components/ui';
import { CategoryBadge, categoryOf, itemTitle } from '@/components/bits';
import { exportCsv, exportXlsx } from '@/lib/exporters';
import { navigate } from '@/lib/router';

/** Numbered, sortable table (TanStack Table) with Excel and CSV export. Matches design artboard 03. */
export function TableView({ items }: { items: SaveItem[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'saved', desc: true }]);
  const [visibility, setVisibility] = useState<VisibilityState>({ summary: false, tags: false });

  const columns = useMemo<ColumnDef<SaveItem>[]>(
    () => [
      { id: 'seq', header: '#', accessorFn: (r) => r.seq, cell: (c) => <span className="font-mono text-xs text-muted">{String(c.getValue()).padStart(3, '0')}</span>, size: 56 },
      { id: 'title', header: 'Title', accessorFn: (r) => itemTitle(r), cell: (c) => <span className="line-clamp-2 font-bold">{c.getValue() as string}</span>, size: 260 },
      { id: 'category', header: 'Category', accessorFn: (r) => categoryOf(r), cell: (c) => <CategoryBadge category={categoryOf(c.row.original)} /> },
      { id: 'source', header: 'Source', accessorFn: (r) => platformLabel(r.platform), cell: (c) => <span className="text-ink-2">{c.getValue() as string}</span> },
      { id: 'tools', header: 'Tools / places', accessorFn: (r) => (r.analysis?.entities ?? []).filter((e) => e.type === 'tool' || e.type === 'place').map((e) => e.name).join(', '), cell: (c) => <span className="line-clamp-2 text-xs text-ink-2">{(c.getValue() as string) || '—'}</span>, size: 200 },
      { id: 'links', header: 'Links', accessorFn: (r) => r.analysis?.links.length ?? 0, cell: (c) => <span className="font-mono text-xs">{c.getValue() as number}</span> },
      { id: 'status', header: 'Status', accessorFn: (r) => r.progress ?? 'inbox', cell: (c) => <span className="text-xs font-semibold text-ink-2 capitalize">{c.getValue() === 'todo' ? 'To try' : (c.getValue() as string)}</span> },
      { id: 'summary', header: 'Summary', accessorFn: (r) => r.analysis?.summary ?? '', cell: (c) => <span className="line-clamp-2 text-xs text-ink-2">{c.getValue() as string}</span>, size: 320 },
      { id: 'tags', header: 'Tags', accessorFn: (r) => (r.analysis?.tags ?? []).join(', '), cell: (c) => <span className="text-xs text-ink-2">{c.getValue() as string}</span> },
      { id: 'saved', header: 'Saved', accessorFn: (r) => r.sharedAt ?? r.createdAt, cell: (c) => <span className="whitespace-nowrap text-xs text-muted">{new Date(c.getValue() as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span> },
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const run = (fn: () => Promise<void>, label: string) => () =>
    fn().then(
      () => toast.success(`${label} ready`),
      (e: Error) => toast.error(`Export failed: ${e.message}`),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button size="sm">
              <Columns3 size={15} /> Columns
            </Button>
          </Menu.Trigger>
          <Menu.Content>
            {table.getAllLeafColumns().filter((c) => c.id !== 'seq' && c.id !== 'title').map((c) => (
              <Menu.Item key={c.id} onSelect={() => c.toggleVisibility()}>
                <input type="checkbox" readOnly checked={c.getIsVisible()} className="accent-[var(--brand)]" aria-hidden="true" tabIndex={-1} />
                {String(c.columnDef.header)}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Root>
        <Button size="sm" onClick={run(() => exportCsv(items), 'CSV')}>
          CSV
        </Button>
        <Button size="sm" variant="primary" onClick={run(() => exportXlsx(items), 'Excel file')}>
          <Download size={15} /> Export .xlsx
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-surface-2 text-left">
                {hg.headers.map((h) => {
                  const dir = h.column.getIsSorted();
                  return (
                    <th key={h.id} scope="col" style={{ width: h.getSize() }} className="border-b border-line px-3 py-2.5 text-[11px] font-extrabold tracking-[0.04em] text-muted uppercase" aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
                      <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 uppercase">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {dir === 'asc' ? <ArrowUp size={12} /> : dir === 'desc' ? <ArrowDown size={12} /> : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => navigate({ name: 'item', id: row.original.id })}
                onKeyDown={(e) => e.key === 'Enter' && navigate({ name: 'item', id: row.original.id })}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{items.length} rows · Tap a row to open it. Export includes all columns.</p>
    </div>
  );
}
