import React, { useMemo, useState } from 'react';
import {
  FiSearch, FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight,
  FiArrowUp, FiArrowDown, FiInbox,
} from 'react-icons/fi';

/**
 * Professional data table for ERP listing screens.
 *
 * @param {Array}    columns    [{ header, accessor, render?, sortable?, sortValue?, className? }]
 * @param {Array}    data       Row objects.
 * @param {boolean}  loading    Shows a skeleton state while true.
 * @param {boolean}  searchable Shows the search box (default true).
 * @param {string}   searchPlaceholder
 * @param {function} onRowClick Optional row click handler.
 * @param {ReactNode} toolbar   Optional extra controls rendered next to the search box.
 * @param {string}   emptyTitle / emptyText  Empty-state copy.
 * @param {number}   initialPageSize Default 10.
 */
const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search records...',
  onRowClick,
  toolbar = null,
  emptyTitle = 'No records found',
  emptyText = 'There are no records to display yet.',
  initialPageSize = 10,
}) => {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const cellValue = (row, col) => {
    if (col.sortValue) return col.sortValue(row);
    const raw = row[col.accessor];
    return raw === null || raw === undefined ? '' : raw;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => String(cellValue(row, col)).toLowerCase().includes(q))
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.accessor === sort.key);
    if (!col) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = cellValue(a, col);
      const bv = cellValue(b, col);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (col) => {
    if (col.sortable === false) return;
    setSort((prev) => {
      if (prev.key !== col.accessor) return { key: col.accessor, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.accessor, dir: 'desc' };
      return { key: null, dir: 'asc' };
    });
  };

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const rangeStart = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, sorted.length);

  const pagerButton = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-[#1d355f] dark:text-slate-300 dark:enabled:hover:bg-white/5';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#1d355f] dark:bg-[#071a33]">
      {/* Toolbar */}
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-[#1d355f] sm:flex-row sm:items-center sm:justify-between">
          {searchable ? (
            <div className="relative w-full max-w-xs">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 dark:border-[#1d355f] dark:bg-[#061225] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          ) : <span />}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-[#1d355f]">
          <thead className="bg-slate-50 dark:bg-[#0b2444]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.accessor}
                  scope="col"
                  onClick={() => toggleSort(col)}
                  className={`whitespace-nowrap px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 ${
                    col.sortable === false ? '' : 'cursor-pointer select-none hover:text-slate-900 dark:hover:text-white'
                  } ${col.className || ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sort.key === col.accessor && (
                      sort.dir === 'asc'
                        ? <FiArrowUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        : <FiArrowDown className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#122c50]">
            {loading && (
              [...Array(5)].map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <td key={col.accessor} className="px-4 py-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-[#0b2444]" />
                    </td>
                  ))}
                </tr>
              ))
            )}
            {!loading && pageRows.map((row, idx) => (
              <tr
                key={row._id || row.id || idx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors hover:bg-blue-50/50 dark:hover:bg-white/5 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.accessor} className={`px-4 py-3 text-sm text-slate-800 dark:text-slate-200 ${col.className || ''}`}>
                    {col.render ? col.render(row) : String(row[col.accessor] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {!loading && pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <FiInbox className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
                  <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">{emptyTitle}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{emptyText}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-[#1d355f] sm:flex-row">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <span className="font-bold text-slate-700 dark:text-slate-200">{rangeStart}-{rangeEnd}</span> of{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">{sorted.length}</span> records
          </span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-[#1d355f] dark:bg-[#061225] dark:text-slate-200"
            aria-label="Rows per page"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={pagerButton} disabled={safePage <= 1} onClick={() => setPage(1)} aria-label="First page">
            <FiChevronsLeft className="h-4 w-4" />
          </button>
          <button type="button" className={pagerButton} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
            <FiChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            Page {safePage} of {totalPages}
          </span>
          <button type="button" className={pagerButton} disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page">
            <FiChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className={pagerButton} disabled={safePage >= totalPages} onClick={() => setPage(totalPages)} aria-label="Last page">
            <FiChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
