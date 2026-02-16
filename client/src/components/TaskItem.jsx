import { format } from 'date-fns';

const priorityColors = {
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  medium: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
};

const statusCycle = ['pending', 'in_progress', 'completed'];

const statusConfig = {
  pending: { icon: '○', color: 'text-gray-400 hover:text-blue-500', label: 'Pending' },
  in_progress: { icon: '◐', color: 'text-blue-500 hover:text-green-500', label: 'In Progress' },
  completed: { icon: '●', color: 'text-green-500 hover:text-gray-400', label: 'Completed' },
  archived: { icon: '◌', color: 'text-gray-300', label: 'Archived' },
};

function TaskItem({ task, onStatusChange, onDelete, onClick, dragHandleProps }) {
  const isCompleted = task.status === 'completed';

  const nextStatus = () => {
    const currentIndex = statusCycle.indexOf(task.status);
    return statusCycle[(currentIndex + 1) % statusCycle.length];
  };

  const config = statusConfig[task.status] || statusConfig.pending;
  const next = statusConfig[nextStatus()];

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800 transition cursor-pointer ${
        isCompleted ? 'opacity-60' : ''
      }`}
      onClick={() => onClick?.(task)}
    >
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStatusChange(task._id, nextStatus());
        }}
        className={`text-lg flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${config.color}`}
        title={`${config.label} — click for ${next.label}`}
      >
        {config.icon}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`font-medium ${isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
          <span className={`px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
          {task.type !== 'other' && (
            <span className="text-gray-500 dark:text-gray-400">{task.type}</span>
          )}
          {task.dueDate && (
            <span className="text-gray-500 dark:text-gray-400">
              Due {format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
          {task.estimatedDuration && (
            <span className="text-gray-500 dark:text-gray-400">{task.estimatedDuration}min</span>
          )}
          {task.subtasks?.length > 0 && (
            <span className="text-gray-500 dark:text-gray-400">
              {task.subtasks.filter(s => s.status === 'completed').length}/{task.subtasks.length} subtasks
            </span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(task._id);
        }}
        className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-xl"
        title="Delete"
      >
        ×
      </button>
    </div>
  );
}

export default TaskItem;
