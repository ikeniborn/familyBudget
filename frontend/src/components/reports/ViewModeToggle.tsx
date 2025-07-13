import React, { memo } from 'react';
import { Table, BarChart3 } from 'lucide-react';
import { Button } from '../ui/button';

export type ViewMode = 'table' | 'chart';

interface ViewModeToggleProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  disabled?: boolean;
  className?: string;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = memo(({
  currentMode,
  onModeChange,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`flex items-center bg-gray-100 rounded-lg p-1 ${className}`} data-testid="view-mode-toggle">
      <Button
        variant={currentMode === 'table' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('table')}
        disabled={disabled}
        className={`flex items-center gap-2 transition-all duration-200 ${
          currentMode === 'table' 
            ? 'bg-white shadow-sm text-gray-900' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        <Table className="h-4 w-4" />
        <span className="hidden sm:inline">Таблица</span>
      </Button>
      
      <Button
        variant={currentMode === 'chart' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('chart')}
        disabled={disabled}
        className={`flex items-center gap-2 transition-all duration-200 ${
          currentMode === 'chart' 
            ? 'bg-white shadow-sm text-gray-900' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        <BarChart3 className="h-4 w-4" />
        <span className="hidden sm:inline">График</span>
      </Button>
    </div>
  );
});

ViewModeToggle.displayName = 'ViewModeToggle';

export default ViewModeToggle;