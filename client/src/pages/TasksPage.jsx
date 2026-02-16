import { useState } from 'react';
import { useTasks, useCreateTask, useUpdateTaskStatus, useDeleteTask } from '../hooks/useTasks';
import TaskForm from '../components/TaskForm';
import TaskItem from '../components/TaskItem';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

function TasksPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const queryParams = { parentOnly: 'true' };
  if (statusFilter) queryParams.status = statusFilter;

  const { data, isLoading, error } = useTasks(queryParams);
  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();

  const handleCreate = (taskData) => {
    createTask.mutate(taskData, {
      onSuccess: () => setShowForm(false),
    });
  };

  const handleStatusChange = (id, status) => {
    updateStatus.mutate({ id, status });
  };

  const handleDelete = (id) => {
    if (window.confirm('Archive this task?')) {
      deleteTask.mutate(id);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1 rounded-full text-sm transition ${
              statusFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-gray-500">Loading tasks...</p>}
      {error && <p className="text-red-500">Error: {error.message}</p>}

      {data?.tasks?.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No tasks yet</p>
          <p className="text-sm mt-1">Click "+ New Task" to get started</p>
        </div>
      )}

      <div className="space-y-2">
        {data?.tasks?.map(task => (
          <TaskItem
            key={task._id}
            task={task}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onClick={setSelectedTask}
          />
        ))}
      </div>

      {data?.pagination?.pages > 1 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} tasks)
        </div>
      )}
    </div>
  );
}

export default TasksPage;
