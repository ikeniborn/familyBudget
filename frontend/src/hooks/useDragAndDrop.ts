import { useState, useRef, useCallback, useEffect } from 'react';

// Types for drag and drop
export interface DragItem {
  id: string | number;
  type: string;
  data: any;
  index?: number;
}

export interface DropResult {
  item: DragItem;
  dropEffect: string;
  targetId?: string | number;
  targetIndex?: number;
}

export interface DragState {
  isDragging: boolean;
  dragItem: DragItem | null;
  dragOverIndex: number | null;
  dropPreview: {
    x: number;
    y: number;
    visible: boolean;
  };
}

export interface DragAndDropOptions {
  onDragStart?: (item: DragItem) => void;
  onDragEnd?: (item: DragItem, result?: DropResult) => void;
  onDrop?: (result: DropResult) => void;
  onReorder?: (fromIndex: number, toIndex: number, item: DragItem) => void;
  canDrag?: (item: DragItem) => boolean;
  canDrop?: (item: DragItem, targetIndex?: number) => boolean;
  dragPreview?: (item: DragItem) => React.ReactNode;
  animationDuration?: number;
}

// Custom hook for drag and drop functionality
export const useDragAndDrop = <T extends { id: string | number }>(
  items: T[],
  options: DragAndDropOptions = {}
) => {
  const {
    onDragStart,
    onDragEnd,
    onDrop,
    onReorder,
    canDrag = () => true,
    canDrop = () => true,
    animationDuration = 200
  } = options;

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragItem: null,
    dragOverIndex: null,
    dropPreview: { x: 0, y: 0, visible: false }
  });

  const dragImageRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);

  // Create drag handlers for items
  const createDragHandlers = useCallback((item: T, index: number) => {
    const dragItem: DragItem = {
      id: item.id,
      type: 'list-item',
      data: item,
      index
    };

    return {
      draggable: canDrag(dragItem),
      onDragStart: (e: React.DragEvent) => {
        if (!canDrag(dragItem)) {
          e.preventDefault();
          return;
        }

        // Set drag data
        e.dataTransfer.setData('application/json', JSON.stringify(dragItem));
        e.dataTransfer.effectAllowed = 'move';

        // Create custom drag image if needed
        if (dragImageRef.current) {
          e.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
        }

        setDragState(prev => ({
          ...prev,
          isDragging: true,
          dragItem,
          dropPreview: { ...prev.dropPreview, visible: true }
        }));

        onDragStart?.(dragItem);
      },

      onDragEnd: (e: React.DragEvent) => {
        const result: DropResult = {
          item: dragItem,
          dropEffect: e.dataTransfer.dropEffect
        };

        setDragState(prev => ({
          ...prev,
          isDragging: false,
          dragItem: null,
          dragOverIndex: null,
          dropPreview: { ...prev.dropPreview, visible: false }
        }));

        onDragEnd?.(dragItem, result);
      },

      onDrag: (e: React.DragEvent) => {
        if (e.clientX === 0 && e.clientY === 0) return; // Ignore final drag event

        setDragState(prev => ({
          ...prev,
          dropPreview: {
            ...prev.dropPreview,
            x: e.clientX,
            y: e.clientY
          }
        }));
      }
    };
  }, [items, canDrag, onDragStart, onDragEnd]);

  // Create drop handlers for drop zones
  const createDropHandlers = useCallback((targetIndex: number) => {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        setDragState(prev => ({
          ...prev,
          dragOverIndex: targetIndex
        }));
      },

      onDragLeave: (e: React.DragEvent) => {
        // Only clear drag over if we're actually leaving the element
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          setDragState(prev => ({
            ...prev,
            dragOverIndex: null
          }));
        }
      },

      onDrop: (e: React.DragEvent) => {
        e.preventDefault();

        try {
          const dragData = JSON.parse(e.dataTransfer.getData('application/json')) as DragItem;
          
          if (!canDrop(dragData, targetIndex)) {
            return;
          }

          const result: DropResult = {
            item: dragData,
            dropEffect: e.dataTransfer.dropEffect,
            targetIndex
          };

          // Handle reordering if within the same list
          if (dragData.index !== undefined && dragData.index !== targetIndex) {
            onReorder?.(dragData.index, targetIndex, dragData);
          }

          onDrop?.(result);

          setDragState(prev => ({
            ...prev,
            dragOverIndex: null
          }));

        } catch (error) {
          console.error('Failed to parse drag data:', error);
        }
      }
    };
  }, [canDrop, onDrop, onReorder]);

  // Animate item reordering
  const animateReorder = useCallback((fromIndex: number, toIndex: number) => {
    const fromElement = itemsRef.current[fromIndex];
    const toElement = itemsRef.current[toIndex];

    if (!fromElement || !toElement) return;

    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    const deltaX = toRect.left - fromRect.left;
    const deltaY = toRect.top - fromRect.top;

    // Apply initial transform
    fromElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    fromElement.style.transition = 'none';

    // Force reflow
    fromElement.offsetHeight;

    // Animate to final position
    fromElement.style.transform = '';
    fromElement.style.transition = `transform ${animationDuration}ms ease-in-out`;

    // Clean up after animation
    setTimeout(() => {
      fromElement.style.transition = '';
    }, animationDuration);
  }, [animationDuration]);

  // Reference setter for item elements
  const setItemRef = useCallback((index: number) => (el: HTMLElement | null) => {
    itemsRef.current[index] = el;
  }, []);

  // Get CSS classes for drag states
  const getDragClasses = useCallback((index: number) => {
    const classes = [];

    if (dragState.isDragging && dragState.dragItem?.index === index) {
      classes.push('dragging');
    }

    if (dragState.dragOverIndex === index) {
      classes.push('drag-over');
    }

    return classes.join(' ');
  }, [dragState]);

  // Check if currently dragging
  const isDragging = dragState.isDragging;
  const dragOverIndex = dragState.dragOverIndex;

  return {
    // State
    isDragging,
    dragOverIndex,
    dragItem: dragState.dragItem,
    dropPreview: dragState.dropPreview,

    // Handlers
    createDragHandlers,
    createDropHandlers,
    setItemRef,
    getDragClasses,
    animateReorder,

    // Refs
    dragImageRef
  };
};

// Hook for sortable lists
export const useSortableList = <T extends { id: string | number }>(
  items: T[],
  onReorder: (items: T[]) => void,
  options: Omit<DragAndDropOptions, 'onReorder'> = {}
) => {
  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    const newItems = [...items];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, removed);
    onReorder(newItems);
  }, [items, onReorder]);

  return useDragAndDrop(items, {
    ...options,
    onReorder: handleReorder
  });
};

// Utility component for drag preview
export const DragPreview: React.FC<{
  dragState: DragState;
  children?: React.ReactNode;
}> = ({ dragState, children }) => {
  if (!dragState.dropPreview.visible || !dragState.dragItem) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: dragState.dropPreview.x + 10,
        top: dragState.dropPreview.y + 10,
        zIndex: 1000,
        pointerEvents: 'none',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
      }}
    >
      {children || `Перемещение: ${dragState.dragItem.data.name || dragState.dragItem.id}`}
    </div>
  );
};

// CSS classes for drag and drop (to be added to global CSS)
export const dragAndDropStyles = `
.dragging {
  opacity: 0.5;
  transform: rotate(2deg);
  transition: all 0.2s ease;
}

.drag-over {
  border-top: 2px solid #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
}

.sortable-item {
  transition: transform 0.2s ease;
}

.sortable-item:hover {
  cursor: grab;
}

.sortable-item:active {
  cursor: grabbing;
}

.drop-zone {
  min-height: 2px;
  transition: all 0.2s ease;
}

.drop-zone.active {
  background-color: #3b82f6;
  height: 4px;
  margin: 4px 0;
  border-radius: 2px;
}
`;