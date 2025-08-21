import { writable } from 'svelte/store';
import type { HelpContent } from '$lib/types/help';

// Store for dismissed help items
export const dismissedHelp = writable<Set<string>>(new Set());

// Help store actions
export const helpStore = {
  dismissHelp: (helpId: string) => {
    dismissedHelp.update(dismissed => new Set([...dismissed, helpId]));
  },

  isDismissed: (helpId: string): boolean => {
    let isDismissed = false;
    dismissedHelp.subscribe(dismissed => {
      isDismissed = dismissed.has(helpId);
    })();
    return isDismissed;
  },

  resetDismissed: () => {
    dismissedHelp.set(new Set());
  }
};

// Helper functions for creating help content
export const createFieldHelp = (
  field: string,
  description: string,
  examples?: string[],
  validation?: string
): HelpContent => ({
  id: `field-help-${field}`,
  title: `Поле "${field}"`,
  content: description,
  type: 'info',
  links: examples ? [
    {
      label: 'Примеры использования',
      url: '#',
      external: false
    }
  ] : undefined
});

export const createValidationHelp = (
  field: string,
  rules: string[]
): HelpContent => ({
  id: `validation-help-${field}`,
  title: 'Правила валидации',
  content: rules.join('; '),
  type: 'warning'
});

export const createFeatureHelp = (
  feature: string,
  description: string,
  tutorialUrl?: string
): HelpContent => ({
  id: `feature-help-${feature}`,
  title: feature,
  content: description,
  type: 'tutorial',
  links: tutorialUrl ? [
    {
      label: 'Смотреть руководство',
      url: tutorialUrl,
      external: true
    }
  ] : undefined
});