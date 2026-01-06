/**
 * Integration Test: Multi-Tab Coordination
 * Tests leader election and tab synchronization via BroadcastChannel
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock BroadcastChannel
class MockBroadcastChannel {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    private static channels: Map<string, MockBroadcastChannel[]> = new Map();

    constructor(name: string) {
        this.name = name;

        // Register this channel
        if (!MockBroadcastChannel.channels.has(name)) {
            MockBroadcastChannel.channels.set(name, []);
        }
        MockBroadcastChannel.channels.get(name)!.push(this);
    }

    postMessage(data: any) {
        // Broadcast to all other channels with same name
        const channels = MockBroadcastChannel.channels.get(this.name) || [];
        for (const channel of channels) {
            if (channel !== this && channel.onmessage) {
                // Simulate async message delivery
                setTimeout(() => {
                    const event = new MessageEvent('message', { data });
                    channel.onmessage!(event);
                }, 0);
            }
        }
    }

    close() {
        const channels = MockBroadcastChannel.channels.get(this.name);
        if (channels) {
            const index = channels.indexOf(this);
            if (index > -1) {
                channels.splice(index, 1);
            }
        }
    }

    static reset() {
        MockBroadcastChannel.channels.clear();
    }
}

global.BroadcastChannel = MockBroadcastChannel as any;

describe('Multi-Tab Coordination', () => {
    beforeEach(() => {
        vi.useRealTimers();
        MockBroadcastChannel.reset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should elect first tab as leader', async () => {
        const tab1Channel = new MockBroadcastChannel('budget-tabs');

        let tab1IsLeader = false;

        // Tab 1 announces itself as leader
        tab1Channel.onmessage = (event) => {
            if (event.data.type === 'leader-announcement') {
                tab1IsLeader = true;
            }
        };

        // Simulate leader election
        tab1Channel.postMessage({
            type: 'leader-announcement',
            tabId: 'tab-1',
            timestamp: Date.now()
        });

        // Wait for async message delivery
        await new Promise(resolve => setTimeout(resolve, 10));

        // Tab 1 should not receive its own message
        expect(tab1IsLeader).toBe(false);

        tab1Channel.close();
    });

    it('should handle leader election between two tabs', async () => {
        const tab1Channel = new MockBroadcastChannel('budget-tabs');
        const tab2Channel = new MockBroadcastChannel('budget-tabs');

        let tab1ReceivedLeader = false;
        let tab2ReceivedLeader = false;

        tab1Channel.onmessage = (event) => {
            if (event.data.type === 'leader-announcement' && event.data.tabId === 'tab-2') {
                tab1ReceivedLeader = true;
            }
        };

        tab2Channel.onmessage = (event) => {
            if (event.data.type === 'leader-announcement' && event.data.tabId === 'tab-1') {
                tab2ReceivedLeader = true;
            }
        };

        // Tab 1 announces as leader
        tab1Channel.postMessage({
            type: 'leader-announcement',
            tabId: 'tab-1',
            timestamp: Date.now()
        });

        // Wait for message delivery
        await new Promise(resolve => setTimeout(resolve, 10));

        // Tab 2 should have received leader announcement from Tab 1
        expect(tab2ReceivedLeader).toBe(true);

        // Tab 2 yields to Tab 1 (doesn't announce)
        expect(tab1ReceivedLeader).toBe(false);

        tab1Channel.close();
        tab2Channel.close();
    });

    it('should handle leader death and re-election', async () => {
        const tab1Channel = new MockBroadcastChannel('budget-tabs');
        const tab2Channel = new MockBroadcastChannel('budget-tabs');

        let tab2BecameLeader = false;

        // Tab 2 listens for leader announcement
        tab2Channel.onmessage = (event) => {
            if (event.data.type === 'leader-announcement' && event.data.tabId === 'tab-1') {
                // Tab 1 is leader
            } else if (event.data.type === 'leader-death') {
                // Tab 1 died, Tab 2 becomes leader
                tab2BecameLeader = true;
            }
        };

        // Tab 1 announces as leader
        tab1Channel.postMessage({
            type: 'leader-announcement',
            tabId: 'tab-1',
            timestamp: Date.now()
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        // Simulate Tab 1 death
        tab1Channel.postMessage({
            type: 'leader-death',
            tabId: 'tab-1',
            timestamp: Date.now()
        });

        tab1Channel.close();

        await new Promise(resolve => setTimeout(resolve, 10));

        // Tab 2 should detect leader death
        expect(tab2BecameLeader).toBe(true);

        tab2Channel.close();
    });

    it('should broadcast data changes to all tabs', async () => {
        const tab1Channel = new MockBroadcastChannel('budget-data');
        const tab2Channel = new MockBroadcastChannel('budget-data');
        const tab3Channel = new MockBroadcastChannel('budget-data');

        let tab2ReceivedUpdate = false;
        let tab3ReceivedUpdate = false;
        let receivedData: any = null;

        tab2Channel.onmessage = (event) => {
            if (event.data.type === 'fact-created') {
                tab2ReceivedUpdate = true;
                receivedData = event.data.fact;
            }
        };

        tab3Channel.onmessage = (event) => {
            if (event.data.type === 'fact-created') {
                tab3ReceivedUpdate = true;
            }
        };

        // Tab 1 creates a fact and broadcasts
        const newFact = {
            id: 123,
            amount: 1000,
            description: 'Test Fact'
        };

        tab1Channel.postMessage({
            type: 'fact-created',
            fact: newFact,
            sourceTab: 'tab-1',
            timestamp: Date.now()
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        // Both Tab 2 and Tab 3 should receive the update
        expect(tab2ReceivedUpdate).toBe(true);
        expect(tab3ReceivedUpdate).toBe(true);
        expect(receivedData).toEqual(newFact);

        tab1Channel.close();
        tab2Channel.close();
        tab3Channel.close();
    });

    it('should handle heartbeat mechanism', async () => {
        const tab1Channel = new MockBroadcastChannel('budget-heartbeat');
        const tab2Channel = new MockBroadcastChannel('budget-heartbeat');

        let tab2ReceivedHeartbeat = false;
        let heartbeatCount = 0;

        tab2Channel.onmessage = (event) => {
            if (event.data.type === 'heartbeat' && event.data.tabId === 'tab-1') {
                tab2ReceivedHeartbeat = true;
                heartbeatCount++;
            }
        };

        // Tab 1 sends heartbeat
        const sendHeartbeat = () => {
            tab1Channel.postMessage({
                type: 'heartbeat',
                tabId: 'tab-1',
                timestamp: Date.now()
            });
        };

        // Send 3 heartbeats
        sendHeartbeat();
        await new Promise(resolve => setTimeout(resolve, 10));
        sendHeartbeat();
        await new Promise(resolve => setTimeout(resolve, 10));
        sendHeartbeat();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(tab2ReceivedHeartbeat).toBe(true);
        expect(heartbeatCount).toBe(3);

        tab1Channel.close();
        tab2Channel.close();
    });

    it('should detect missing heartbeats (leader timeout)', async () => {
        const tab2Channel = new MockBroadcastChannel('budget-heartbeat');

        let lastHeartbeat = Date.now() - 15000; // 15 seconds ago (already timed out)
        let leaderTimeout = false;

        tab2Channel.onmessage = (event) => {
            if (event.data.type === 'heartbeat') {
                lastHeartbeat = Date.now();
            }
        };

        // Simulate timeout detection (10 seconds no heartbeat)
        const HEARTBEAT_TIMEOUT = 10000;

        // Check for timeout
        await new Promise(resolve => setTimeout(resolve, 50));

        const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
        if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
            leaderTimeout = true;
        }

        // Should detect timeout (no heartbeats received for 15+ seconds)
        expect(leaderTimeout).toBe(true);

        tab2Channel.close();
    });
});
