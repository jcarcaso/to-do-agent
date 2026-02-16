import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useTasks, useCreateTask, useUpdateTask, useUpdateTaskStatus, useDeleteTask, useReorderTasks } from '../hooks/useTasks';
import TaskForm from '../components/TaskForm';
import TaskItem from '../components/TaskItem';
import KanbanBoard from '../components/KanbanBoard';
import TaskFilters from '../components/TaskFilters';
import { useToast } from '../components/Toast';
import { taskApi } from '../services/api';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

function TasksPage() {
  const [view, setView] = useState(() => localStorage.getItem('tasksView') || 'list');
  const [statusFilter, setStatusFilter] = useState('');
  const [filters, setFilters] = useState({ search: '', priority: '', type: '' });
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const isBoard = view === 'board';

  const queryParams = { parentOnly: 'true' };
  if (!isBoard && statusFilter) queryParams.status = statusFilter;
  if (isBoard) queryParams.limit = '200';
  if (filters.search) queryParams.search = filters.search;
  if (filters.priority) queryParams.priority = filters.priority;
  if (filters.type) queryParams.type = filters.type;

  const { data, isLoading, error } = useTasks(queryParams);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const reorderTasks = useReorderTasks();

  const toggleView = (v) => {
    setView(v);
    localStorage.setItem('tasksView', v);
  };

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

  const handleBoardStatusChange = async (taskId, newStatus) => {
    // Optimistic update: move the task in cache immediately
    const prevData = queryClient.getQueryData(['tasks', queryParams]);

    queryClient.setQueryData(['tasks', queryParams], (old) => {
      if (!old?.tasks) return old;
      return {
        ...old,
        tasks: old.tasks.map(t =>
          t._id === taskId ? { ...t, status: newStatus } : t
        ),
      };
    });

    try {
      await taskApi.updateStatus(taskId, newStatus);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      // Revert on error
      queryClient.setQueryData(['tasks', queryParams], prevData);
      addToast(err.message || 'Failed to update task status', 'error');
    }
  };

  const handleBoardReorder = async (reorderData, destStatus, sourceStatus) => {
    const prevData = queryClient.getQueryData(['tasks', queryParams]);

    // Optimistic update
    queryClient.setQueryData(['tasks', queryParams], (old) => {
      if (!old?.tasks) return old;
      const updates = new Map(reorderData.map(r => [r.id, r]));
      return {
        ...old,
        tasks: old.tasks.map(t => {
          const update = updates.get(t._id);
          if (update) {
            return { ...t, sortOrder: update.sortOrder, ...(update.status ? { status: update.status } : {}) };
          }
          return t;
        }),
      };
    });

    try {
      await taskApi.reorder(reorderData);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      queryClient.setQueryData(['tasks', queryParams], prevData);
      addToast(err.message || 'Failed to reorder tasks', 'error');
    }
  };

  const handleListDragEnd = async (result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (destination.index === source.index) return;

    const tasks = data?.tasks;
    if (!tasks) return;

    const reordered = [...tasks];
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    const reorderData = reordered.map((t, i) => ({ id: t._id, sortOrder: i + 1 }));

    // Optimistic update
    const prevData = queryClient.getQueryData(['tasks', queryParams]);
    queryClient.setQueryData(['tasks', queryParams], (old) => {
      if (!old?.tasks) return old;
      const orderMap = new Map(reorderData.map(r => [r.id, r.sortOrder]));
      const updated = old.tasks.map(t => ({ ...t, sortOrder: orderMap.get(t._id) ?? t.sortOrder }));
      updated.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      return { ...old, tasks: updated };
    });

    try {
      await taskApi.reorder(reorderData);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      queryClient.setQueryData(['tasks', queryParams], prevData);
      addToast(err.message || 'Failed to reorder tasks', 'error');
    }
  };

  // Filter out archived tasks for board view
  const boardTasks = data?.tasks?.filter(t => t.status !== 'archived') || [];

  return (
    <div className={isBoard ? 'max-w-6xl mx-auto w-full' : 'max-w-3xl mx-auto w-full'}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Tasks</h2>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleView('list')}
              className={`px-3 py-1.5 text-sm transition ${
                !isBoard
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              List
            </button>
            <button
              onClick={() => toggleView('board')}
              className={`px-3 py-1.5 text-sm transition ${
                isBoard
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Board
            </button>
          </div>

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

      <TaskFilters filters={filters} onChange={setFilters} />

      {/* List mode: status filters */}
      {!isBoard && (
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
      )}

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

      {/* Board view */}
      {isBoard && !isLoading && boardTasks.length > 0 && (
        <KanbanBoard
          tasks={boardTasks}
          onStatusChange={handleBoardStatusChange}
          onReorder={handleBoardReorder}
          onTaskClick={(task) => {
            setSelectedTask(task);
            setShowForm(false);
          }}
        />
      )}

      {/* List view */}
      {!isBoard && data?.tasks && data.tasks.length > 0 && (
        <DragDropContext onDragEnd={handleListDragEnd}>
          <Droppable droppableId="task-list">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {data.tasks.map((task, index) => (
                  <Draggable key={task._id} draggableId={task._id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={snapshot.isDragging ? 'shadow-lg rounded-lg' : ''}
                      >
                        <TaskItem
                          task={task}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                          onClick={(task) => {
                            setSelectedTask(task);
                            setShowForm(false);
                          }}
                          dragHandleProps={provided.dragHandleProps}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {!isBoard && data?.pagination?.pages > 1 && (
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} tasks)
        </div>
      )}
    </div>
  );
}

export default TasksPage;
