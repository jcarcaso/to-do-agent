import { useState } from 'react';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TYPES = ['work', 'personal', 'health', 'learning', 'errands', 'other'];

function TaskForm({ onSubmit, initialData, onCancel }) {
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
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      estimatedDuration: form.estimatedDuration ? parseInt(form.estimatedDuration) : undefined,
      dueDate: form.dueDate || undefined,
    });
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Task title"
          value={form.title}
          onChange={update('title')}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <textarea
          placeholder="Description (optional)"
          value={form.description}
          onChange={update('description')}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Priority</label>
          <select value={form.priority} onChange={update('priority')} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Type</label>
          <select value={form.type} onChange={update('type')} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Due date</label>
          <input type="date" value={form.dueDate} onChange={update('dueDate')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Est. duration (min)</label>
          <input type="number" value={form.estimatedDuration} onChange={update('estimatedDuration')} min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Tags (comma separated)</label>
        <input type="text" value={form.tags} onChange={update('tags')} placeholder="e.g. urgent, frontend" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Cancel
          </button>
        )}
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          {initialData ? 'Update' : 'Create'} Task
        </button>
      </div>
    </form>
  );
}

export default TaskForm;
