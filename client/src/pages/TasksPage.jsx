import { useState } from 'react';
import { useTasks, useCreateTask, useUpdateTask, useUpdateTaskStatus, useDeleteTask } from '../hooks/useTasks';
import TaskForm from '../components/TaskForm';
import TaskItem from '../components/TaskItem';
import { useToast } from '../components/Toast';

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
  const { addToast } = useToast();

  const queryParams = { parentOnly: 'true' };
  if (statusFilter) queryParams.status = statusFilter;

  const { data, isLoading, error } = useTasks(queryParams);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();

  const handleCreate = (taskData) => {
    createTask.mutate(taskData, {
      onSuccess: () => setShowForm(false),
    });
  };

  const handleEdit = (taskData) => {
    updateTask.mutate({ id: selectedTask._id, ...taskData }, {
      onSuccess: () => {
        setSelectedTask(null);
        addToast('Task updated', 'success');
      },
    });
  };

  const handleStatusChange = (id, status) => {
    updateStatus.mutate({ id, status });
  };

  const handleDelete = (id) => {
    if (window.confirm('Archive this task?')) {
      deleteTask.mutate(id, {
        onSuccess: () => addToast('Task archived', 'success'),
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Tasks</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setSelectedTask(null);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {showForm && !selectedTask && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {selectedTask && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-300 dark:border-blue-600">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Edit Task</h3>
          </div>
          <TaskForm
            initialData={selectedTask}
            onSubmit={handleEdit}
            onCancel={() => setSelectedTask(null)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1 rounded-full text-sm transition ${
              statusFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading tasks...</p>}
      {error && <p className="text-red-500">Error: {error.message}</p>}

      {data?.tasks?.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-lg text-gray-400 dark:text-gray-500 mb-2">No tasks yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Create your first task
          </button>
        </div>
      )}

      <div className="space-y-2">
        {data?.tasks?.map(task => (
          <TaskItem
            key={task._id}
            task={task}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onClick={(task) => {
              setSelectedTask(task);
              setShowForm(false);
            }}
          />
        ))}
      </div>

      {data?.pagination?.pages > 1 && (
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} tasks)
        </div>
      )}
    </div>
  );
}

export default TasksPage;
