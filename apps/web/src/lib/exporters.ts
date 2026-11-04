import { toCsv, toRows, type SaveItem } from '@savesutra/core';
import { saveFile } from './native';

const stamp = () => new Date().toISOString().slice(0, 10);

/** Excel workbook with a numbered row per save and readable column widths. */
export async function exportXlsx(items: SaveItem[]): Promise<void> {
  const rows = toRows(items);
  const headers = Object.keys(rows[0] ?? { '#': '', Title: '' });
  const sheet = [
    headers.map((h) => ({ value: h, fontWeight: 'bold' as const })),
    ...rows.map((r) => headers.map((h) => ({ value: r[h] as string | number }))),
  ];
  const widths: Record<string, number> = { '#': 6, Title: 48, Summary: 70, Places: 30, 'Links found': 50, URL: 50, Tags: 30, Note: 30, Tools: 30 };
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const blob = await writeExcelFile(sheet, { columns: headers.map((h) => ({ width: widths[h] ?? 14 })), sheet: 'Saves' }).toBlob();
  await saveFile(`savesutra-${stamp()}.xlsx`, blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function exportCsv(items: SaveItem[]): Promise<void> {
  await saveFile(`savesutra-${stamp()}.csv`, toCsv(toRows(items)), 'text/csv;charset=utf-8');
}

export async function exportJson(json: string): Promise<void> {
  await saveFile(`savesutra-${stamp()}.json`, json, 'application/json');
}
