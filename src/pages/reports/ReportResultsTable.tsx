import { DataTable, TablePager, tdClass, thClass, trClass } from '../../components/ui';
import type { ReportRunColumn, ReportRunResult } from './types';

const MONEY = /amount|balance|rebate|fee|gross|billed|paid|outstanding|wallet|naira|invoiced|collected|receipt/i;

export function formatReportValue(column: ReportRunColumn, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (column.type === 'number' || typeof value === 'number') {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      const money = MONEY.test(`${column.key} ${column.label}`);
      return n.toLocaleString('en-NG', {
        minimumFractionDigits: money ? 2 : 0,
        maximumFractionDigits: 2,
      });
    }
  }
  return String(value);
}

export function ReportResultsTable({
  preview,
  running,
  onPage,
}: {
  preview: ReportRunResult;
  running?: boolean;
  onPage: (page: number) => void;
}) {
  const hasTotals = preview.totals && Object.keys(preview.totals).length > 0;

  return (
    <>
      <DataTable colSpan={preview.columns.length}>
        <thead>
          <tr>
            {preview.columns.map((column) => (
              <th key={column.key} className={`${thClass} ${column.type === 'number' ? 'text-right' : ''}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.length === 0 && (
            <tr>
              <td className={`${tdClass} text-slate-500`} colSpan={preview.columns.length}>No matching rows.</td>
            </tr>
          )}
          {preview.rows.map((row, index) => (
            <tr key={index} className={trClass}>
              {preview.columns.map((column) => (
                <td key={column.key} className={`${tdClass} ${column.type === 'number' ? 'text-right tabular-nums' : ''}`}>
                  {formatReportValue(column, row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasTotals && (
          <tfoot>
            <tr className="bg-sky-50 font-semibold text-sky-900">
              {preview.columns.map((column, index) => {
                const total = preview.totals?.[column.key];
                const formatted = total !== undefined ? formatReportValue(column, total) : '';
                return (
                  <td key={column.key} className={`${tdClass} ${column.type === 'number' ? 'text-right tabular-nums' : ''}`}>
                    {index === 0 ? (formatted ? `Total · ${formatted}` : 'Total') : formatted}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </DataTable>
      <TablePager
        page={preview.meta.current_page}
        lastPage={preview.meta.last_page}
        total={preview.meta.total}
        from={preview.meta.from}
        to={preview.meta.to}
        onChange={onPage}
        disabled={running}
      />
    </>
  );
}
