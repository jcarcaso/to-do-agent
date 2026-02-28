import { useState, useEffect, useRef } from 'react';

const priorityColors = {
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  medium: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
};

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TYPES = ['work', 'personal', 'health', 'learning', 'errands', 'other'];

function TaskFilters({ filters, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [searchText, setSearchText] = useState(filters.search || '');
  const debounceRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchText !== filters.search) {
        onChange({ ...filters, search: searchText });
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchText]);

  // Sync if filters.search is cleared externally
  useEffect(() => {
    if (!filters.search && searchText) {
      setSearchText('');
    }
  }, [filters.search]);

  const activeCount = (filters.priority ? 1 : 0) + (filters.type ? 1 : 0);

  const togglePriority = (p) => {
    onChange({ ...filters, priority: filters.priority === p ? '' : p });
  };

  const toggleType = (t) => {
    onChange({ ...filters, type: filters.type === t ? '' : t });
  };

  const clearFilters = () => {
    setSearchText('');
    onChange({ search: '', priority: '', type: '' });
  };

  return (
    <div className="mb-4">
      {/* Always visible: search + filter toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition ${
            expanded || activeCount > 0
              ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-600 text-white font-medium">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Expandable advanced filters */}
      {expanded && (
        <div className="mt-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Priority */}
          <div className="mb-3">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Priority</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePriority(p)}
                  className={`px-3 py-1 rounded-full text-sm capitalize transition ${
                    filters.priority === p
                      ? priorityColors[p] + ' ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-gray-800'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`px-3 py-1 rounded-full text-sm capitalize transition ${
                    filters.type === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Clear all */}
          {(activeCount > 0 || filters.search) && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskFilters;
