import { format } from 'date-fns';

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
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
      className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition cursor-pointer ${
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
        className={`text-lg flex-shrink-0 ${
          isCompleted ? 'text-green-500' : 'text-gray-400 hover:text-green-500'
        }`}
        title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {statusIcons[task.status]}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`font-medium ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs">
          <span className={`px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
          {task.type !== 'other' && (
            <span className="text-gray-500">{task.type}</span>
          )}
          {task.dueDate && (
            <span className="text-gray-500">
              Due {format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
          {task.estimatedDuration && (
            <span className="text-gray-500">{task.estimatedDuration}min</span>
          )}
          {task.subtasks?.length > 0 && (
            <span className="text-gray-500">
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
        className="text-gray-300 hover:text-red-500 transition flex-shrink-0"
        title="Delete"
      >
        ×
      </button>
    </div>
  );
}

export default TaskItem;
