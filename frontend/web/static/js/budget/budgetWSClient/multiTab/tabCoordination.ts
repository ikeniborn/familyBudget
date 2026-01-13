/**
 * Tab Coordination Module
 * Handles BroadcastChannel messaging between tabs
 *
 * Extracted from budgetWSClient.js:742-850 (channel messaging)
 */

import { getState, updateState } from '../core/WSState';
import { updateConnectionStatus } from './followerSync';

/**
 * Handle BroadcastChannel message
 */
export function handleChannelMessage(data: any): void {
  switch (data.type) {
    case 'heartbeat':
      handleHeartbeat(data);
      break;

    case 'ws_event':
      handleWSEvent(data);
      break;

    case 'leader_changed':
      handleLeaderChanged(data);
      break;

    case 'status_request':
      handleStatusRequest();
      break;

    case 'status_response':
      handleStatusResponse(data);
      break;

    default:
      console.warn('[BudgetWS] Unknown channel message type:', data.type);
  }
}

/**
 * Handle heartbeat from leader
 */
function handleHeartbeat(data: any): void {
  updateState({ lastLeaderHeartbeat: data.timestamp });
  updateConnectionStatus(data.isConnected);
}

/**
 * Handle WebSocket event broadcast
 */
function handleWSEvent(data: any): void {
  const state = getState();
  if (!state.isLeader) {
    // Dispatch event to local handlers
    const event = new CustomEvent('ws:event-received', {
      detail: {
        event: data.event,
        data: data.data,
      },
    });
    window.dispatchEvent(event);
  }
}

/**
 * Handle leader changed notification
 */
function handleLeaderChanged(data: any): void {
  updateState({ lastLeaderHeartbeat: data.timestamp });
}

/**
 * Handle status request from another tab
 */
function handleStatusRequest(): void {
  const state = getState();
  if (state.isLeader) {
    broadcastMessage({
      type: 'status_response',
      isConnected: state.isConnected,
      connectionId: state.connectionId,
    });
  }
}

/**
 * Handle status response from leader
 */
function handleStatusResponse(data: any): void {
  updateConnectionStatus(data.isConnected);
}

/**
 * Broadcast WebSocket event to followers
 */
export function broadcastWSEvent(eventType: string, eventData: any): void {
  const state = getState();
  if (state.isLeader && state.channel) {
    broadcastMessage({
      type: 'ws_event',
      event: eventType,
      data: eventData,
    });
  }
}

/**
 * Request status from leader tab
 */
export function requestStatus(): void {
  broadcastMessage({ type: 'status_request' });
}

/**
 * Broadcast message to all tabs
 */
function broadcastMessage(message: any): void {
  const state = getState();
  if (state.channel) {
    try {
      state.channel.postMessage(message);
    } catch (e) {
      console.error('[BudgetWS] Broadcast failed:', e);
    }
  }
}
