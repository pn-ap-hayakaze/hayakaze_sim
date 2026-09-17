import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  /** 数値列は右寄せ・表用数字 */
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

interface Props<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}

/** 200行未満の表。仮想化は後続作業 */
export function DataTable<T>({ caption, columns, rows, rowKey }: Props<T>) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="mb-2 text-left font-semibold">{caption}</caption>
      <thead>
        <tr className="border-b border-neutral-300 text-neutral-600">
          {columns.map((c) => (
            <th key={c.key} className={`px-2 py-1 ${c.numeric ? 'text-right' : 'text-left'}`}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={rowKey(r)} className="border-b border-neutral-100">
            {columns.map((c) => (
              <td
                key={c.key}
                className={`px-2 py-1 ${c.numeric ? 'text-right tabular-nums' : 'text-left'}`}
              >
                {c.render(r)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
