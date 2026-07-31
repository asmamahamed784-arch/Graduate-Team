import React from 'react';

/**
 * Reusable data table component.
 * @param {Array} columns - [{ header: string, accessor: string, render?: (row) => JSX }]
 * @param {Array} data - array of row objects
 * @param {function} onRowClick - optional callback when a row is clicked
 */
const Table = ({ columns = [], data = [], onRowClick }) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--nqs-border)] bg-[var(--nqs-card)] shadow-sm">
      <table className="min-w-full divide-y divide-[var(--nqs-border)] bg-[var(--nqs-card)]">
        <thead className="bg-[var(--nqs-card-soft)]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.accessor}
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--nqs-muted)]"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--nqs-border)]">
          {data.map((row, idx) => (
            <tr
              key={idx}
              className={onRowClick ? 'cursor-pointer hover:bg-[var(--nqs-card-soft)]' : 'hover:bg-[var(--nqs-card-soft)]'}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((col) => (
                <td
                  key={col.accessor}
                  className="px-4 py-3 text-sm text-[var(--nqs-text)]"
                >
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-[var(--nqs-muted)]"
              >
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
