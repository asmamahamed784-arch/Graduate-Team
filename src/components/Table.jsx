import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Reusable data table component.
 * @param {Array} columns - [{ header: string, accessor: string, render?: (row) => JSX }]
 * @param {Array} data - array of row objects
 * @param {function} onRowClick - optional callback when a row is clicked
 */
const Table = ({ columns = [], data = [], onRowClick }) => {
  return (
    <div className="overflow-x-auto rounded-lg shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {columns.map((col) => (
              <th
                key={col.accessor}
                scope="col"
                className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          <AnimatePresence>
            {data.map((row, idx) => (
              <motion.tr
                key={idx}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.15, delay: idx * 0.03 }}
                className="hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.accessor}
                    className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200"
                  >
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-500"
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
