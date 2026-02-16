import { format } from 'date-fns';

const priorityColors = {
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  medium: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
};

const statusIcons = {
  pending: '○',
  in_progress: '◐',
  completed: '●',
  archived: '◌',
};

function TaskItem({ task, onStatusChange, onDelete, onClick }) {
  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800 transition cursor-pointer ${
        isCompleted ? 'opacity-60' : ''
      }`}
      onClick={() => onClick?.(task)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStatusChange(
            task._id,
            isCompleted ? 'pending' : 'completed'
          );
        }}
        className={`text-lg flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center ${
          isCompleted ? 'text-green-500' : 'text-gray-400 hover:text-green-500'
        }`}
        title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {statusIcons[task.status]}
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
