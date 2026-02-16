import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format } from 'date-fns';

const priorityColors = {
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  medium: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
};

const COLUMNS = [
  { id: 'pending', label: 'Pending', icon: '○', borderColor: 'border-t-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/50' },
  { id: 'in_progress', label: 'In Progress', icon: '◐', borderColor: 'border-t-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
  { id: 'completed', label: 'Completed', icon: '●', borderColor: 'border-t-green-500', bg: 'bg-green-50/50 dark:bg-green-900/10' },
];

function KanbanCard({ task, index, onClick }) {
  return (
    <Draggable draggableId={task._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(task)}
          className={`p-3 mb-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-grab active:cursor-grabbing transition-shadow ${
            snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : 'hover:shadow-sm'
          }`}
        >
          <div className="font-medium text-sm text-gray-800 dark:text-gray-100 mb-1.5 line-clamp-2">
            {task.title}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-xs ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            {task.dueDate && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {format(new Date(task.dueDate), 'MMM d')}
              </span>
            )}
            {task.estimatedDuration && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {task.estimatedDuration}m
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

function KanbanBoard({ tasks, onStatusChange, onTaskClick, onReorder }) {
  const sortedTasks = [...tasks].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const grouped = {
    pending: sortedTasks.filter(t => t.status === 'pending'),
    in_progress: sortedTasks.filter(t => t.status === 'in_progress'),
    completed: sortedTasks.filter(t => t.status === 'completed'),
  };

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const destStatus = destination.droppableId;
    const sourceStatus = source.droppableId;
    const isSameColumn = destStatus === sourceStatus;

    // Build the new ordered list for the destination column
    const destItems = [...grouped[destStatus]];

    if (isSameColumn) {
      // Reorder within same column
      const [moved] = destItems.splice(source.index, 1);
      destItems.splice(destination.index, 0, moved);
    } else {
      // Move from source to destination
      const task = tasks.find(t => t._id === draggableId);
      if (!task) return;
      destItems.splice(destination.index, 0, task);
    }

    // Compute new sortOrder values for all items in the destination column
    const reorderData = destItems.map((t, i) => ({
      id: t._id,
      sortOrder: i + 1,
      ...(t._id === draggableId && !isSameColumn ? { status: destStatus } : {}),
    }));

    if (onReorder) {
      onReorder(reorderData, destStatus, isSameColumn ? null : sourceStatus);
    } else if (!isSameColumn) {
      onStatusChange(draggableId, destStatus);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <div key={col.id} className={`rounded-lg border border-gray-200 dark:border-gray-700 border-t-4 ${col.borderColor} ${col.bg} min-h-[200px]`}>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
              <span className="text-base">{col.icon}</span>
              <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">{col.label}</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {grouped[col.id].length}
              </span>
            </div>
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`p-2 min-h-[150px] transition-colors ${
                    snapshot.isDraggingOver ? 'bg-blue-100/50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  {grouped[col.id].map((task, index) => (
                    <KanbanCard
                      key={task._id}
                      task={task}
                      index={index}
                      onClick={onTaskClick}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}

export default KanbanBoard;
