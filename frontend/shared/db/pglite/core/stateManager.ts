import { getState, updateState } from './PGliteState';
import type { PGliteState } from './PGliteState';

export { getState, updateState };
export type { PGliteState };

export function isConnected(): boolean {
  const { connectionStatus } = getState();
  return connectionStatus === 'connected';
}

export function getConnectionStatus(): string {
  return getState().connectionStatus;
}
