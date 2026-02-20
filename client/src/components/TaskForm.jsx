import { useState } from 'react';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TYPES = ['work', 'personal', 'health', 'learning', 'errands', 'other'];

function TaskForm({ onSubmit, initialData, onCancel, availableTasks = [] }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    type: 'other',
    dueDate: '',
    estimatedDuration: '',
    tags: '',
    ...initialData,
    tags: initialData?.tags?.join(', ') || '',
    dueDate: initialData?.dueDate?.split('T')[0] || '',
    dependencies: initialData?.dependencies?.map(d => typeof d === 'object' ? d._id : d) || [],
  });
  const [depDropdownOpen, setDepDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        estimatedDuration: form.estimatedDuration ? parseInt(form.estimatedDuration) : undefined,
        dueDate: form.dueDate || undefined,
        dependencies: form.dependencies.length > 0 ? form.dependencies : [],
      });
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Task title"
          value={form.title}
          onChange={update('title')}
          required
          className={inputClass}
        />
      </div>

      <div>
        <textarea
          placeholder="Description (optional)"
          value={form.description}
          onChange={update('description')}
          rows={3}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Priority</label>
          <select value={form.priority} onChange={update('priority')} className={inputClass}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Type</label>
          <select value={form.type} onChange={update('type')} className={inputClass}>
            {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Due date</label>
          <input type="date" value={form.dueDate} onChange={update('dueDate')} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Est. duration (min)</label>
          <input type="number" value={form.estimatedDuration} onChange={update('estimatedDuration')} min="1" className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Tags (comma separated)</label>
        <input type="text" value={form.tags} onChange={update('tags')} placeholder="e.g. urgent, frontend" className={inputClass} />
      </div>

      {availableTasks.length > 0 && (
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Dependencies (blocked by)</label>
          {/* Selected dependencies */}
          {form.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.dependencies.map(depId => {
                const depTask = availableTasks.find(t => t._id === depId);
                if (!depTask) return null;
                return (
                  <span key={depId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    {depTask.title.length > 30 ? depTask.title.slice(0, 30) + '...' : depTask.title}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, dependencies: form.dependencies.filter(id => id !== depId) })}
                      className="ml-0.5 hover:text-red-900 dark:hover:text-red-100"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {/* Dropdown toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDepDropdownOpen(!depDropdownOpen)}
              className={`${inputClass} text-left flex items-center justify-between`}
            >
              <span className="text-gray-400 dark:text-gray-500">
                {form.dependencies.length === 0 ? 'Select tasks this depends on...' : `${form.dependencies.length} selected`}
              </span>
              <span className="text-xs">{depDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {depDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
                {availableTasks.filter(t => !form.dependencies.includes(t._id)).length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">No more tasks available</div>
                ) : (
                  availableTasks
                    .filter(t => !form.dependencies.includes(t._id))
                    .map(t => (
                      <button
                        key={t._id}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, dependencies: [...form.dependencies, t._id] });
                          setDepDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-600 last:border-0"
                      >
                        <span className="font-medium">{t.title}</span>
                        <span className="ml-2 text-xs text-gray-400">({t.status.replace('_', ' ')})</span>
                      </button>
                    ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
            Cancel
          </button>
        )}
        <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          {submitting ? 'Saving...' : `${initialData ? 'Update' : 'Create'} Task`}
        </button>
      </div>
    </form>
  );
}

export default TaskForm;
