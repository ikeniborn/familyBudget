// Types for inline help system
export interface HelpContent {
  id: string;
  title: string;
  content: string;
  type: 'tip' | 'warning' | 'info' | 'tutorial';
  icon?: string; // Lucide icon name
  actions?: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
  links?: Array<{
    label: string;
    url: string;
    external?: boolean;
  }>;
}

export interface InlineHelpProps {
  content: HelpContent;
  compact?: boolean;
  dismissible?: boolean;
  expanded?: boolean;
  className?: string;
}

export interface HelpPanelProps {
  title?: string;
  items: HelpContent[];
  compact?: boolean;
  className?: string;
}

// Types for guided tour system
export interface TourStep {
  id: string;
  target: string; // CSS selector or element ID
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  offset?: { x: number; y: number };
  action?: () => void;
  beforeStep?: () => Promise<void> | void;
  afterStep?: () => Promise<void> | void;
  nextButtonText?: string;
  showSkip?: boolean;
  allowBackwards?: boolean;
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
  category?: string;
  prerequisites?: string[];
}

export interface TourState {
  activeTour: Tour | null;
  currentStepIndex: number;
  isActive: boolean;
  completedTours: string[];
  userProgress: Record<string, number>;
}

export interface GuidedTourProps {
  tours: Tour[];
  showOnMount?: boolean;
  autoStart?: string; // Tour ID to auto-start
}

export interface TourLauncherProps {
  tours: Tour[];
  completedTours: string[];
  className?: string;
}

// Helper types for positioning
export interface Position {
  x: number;
  y: number;
  position: string;
}

export interface StyleConfig {
  bg: string;
  border: string;
  text: string;
  icon: string;
}