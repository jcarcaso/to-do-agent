import { useState } from 'react';
import { format } from 'date-fns';
import { parseDateOnly } from '../utils/date';

const priorityColors = {
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  medium: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
};

const statusCycle = ['pending', 'in_progress', 'completed'];
const blockedStatusCycle = ['pending', 'in_progress'];

const statusConfig = {
  pending: { icon: '○', color: 'text-gray-400 hover:text-blue-500', label: 'Pending' },
  in_progress: { icon: '◐', color: 'text-blue-500 hover:text-green-500', label: 'In Progress' },
  completed: { icon: '●', color: 'text-green-500 hover:text-gray-400', label: 'Completed' },
  archived: { icon: '◌', color: 'text-gray-300', label: 'Archived' },
};

function truncate(str, max = 25) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function TaskItem({ task, onStatusChange, onDelete, onClick, dragHandleProps, isBlocked, reverseDeps = [] }) {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = task.status === 'completed';

  const cycle = isBlocked ? blockedStatusCycle : statusCycle;
  const nextStatus = () => {
    const currentIndex = cycle.indexOf(task.status);
    if (currentIndex === -1) return cycle[0];
    return cycle[(currentIndex + 1) % cycle.length];
  };

  const config = statusConfig[task.status] || statusConfig.pending;
  const next = statusConfig[nextStatus()];

  const incompleteDeps = (task.dependencies || []).filter(d => d.status !== 'completed');
  const completedDeps = (task.dependencies || []).filter(d => d.status === 'completed');
  const hasSubtasks = task.subtasks?.length > 0;
  const completedSubtasks = hasSubtasks ? task.subtasks.filter(s => s.status === 'completed').length : 0;

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800 transition ${
        isBlocked ? 'border-l-4 border-l-red-400 dark:border-l-red-600 opacity-70' : ''
      } ${isCompleted ? 'opacity-60' : ''}`}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
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
                Due {format(parseDateOnly(task.dueDate), 'MMM d')}
              </span>
            )}
            {task.estimatedDuration && (
              <span className="text-gray-500 dark:text-gray-400">{task.estimatedDuration}min</span>
            )}

            {/* Blocked badge */}
            {isBlocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium">
                <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Blocked
              </span>
            )}

            {/* Blocked by chips (red) */}
            {incompleteDeps.slice(0, 2).map(dep => (
              <span key={dep._id} className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                Blocked by: {truncate(dep.title)}
              </span>
            ))}
            {incompleteDeps.length > 2 && (
              <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                +{incompleteDeps.length - 2} more
              </span>
            )}

            {/* Completed dependency chips (green, only show if few) */}
            {completedDeps.length > 0 && completedDeps.length <= 2 && completedDeps.map(dep => (
              <span key={dep._id} className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 line-through">
                {truncate(dep.title)}
              </span>
            ))}

            {/* Blocks chips (amber) */}
            {reverseDeps.slice(0, 2).map(dep => (
              <span key={dep._id} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                Blocks: {truncate(dep.title)}
              </span>
            ))}
            {reverseDeps.length > 2 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                +{reverseDeps.length - 2} more
              </span>
            )}

            {/* Subtask count / expand toggle */}
            {hasSubtasks && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                <span className="text-[10px]">{expanded ? '▾' : '▸'}</span>
                {completedSubtasks}/{task.subtasks.length} subtasks
              </button>
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

      {/* Expanded subtasks */}
      {expanded && hasSubtasks && (
        <div className="ml-12 mr-3 mb-3 border-t border-gray-100 dark:border-gray-700 pt-2 space-y-1">
          {task.subtasks.map(sub => {
            const subConfig = statusConfig[sub.status] || statusConfig.pending;
            return (
              <div key={sub._id} className="flex items-center gap-2 py-1 px-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className={`${subConfig.color} text-xs`}>{subConfig.icon}</span>
                <span className={sub.status === 'completed' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}>
                  {sub.title}
                </span>
                {sub.priority && (
                  <span className={`px-1.5 py-0 rounded text-[10px] ${priorityColors[sub.priority]}`}>
                    {sub.priority}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TaskItem;
