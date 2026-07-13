import React from 'react';

/**
 * ERP-style tab bar for switching between related sections of a page.
 *
 * @param {Array}    tabs     [{ key, label, icon?, count? }]
 * @param {string}   active   Key of the active tab.
 * @param {function} onChange Called with the selected tab key.
 */
const Tabs = ({ tabs = [], active, onChange }) => {
  return (
    <div role="tablist" className="flex flex-wrap items-end gap-1 border-b border-slate-200 dark:border-[#1d355f]">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
              isActive
                ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-[#27476f] dark:hover:text-slate-200'
            }`}
          >
            {tab.icon && <span className="text-base">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
