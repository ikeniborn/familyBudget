/**
 * Navigator Extensions
 * Family Budget PWA
 *
 * Type definitions for Navigator API extensions (Network Information API, etc.).
 *
 * @version 1.0.0
 * @date 2026-01-05
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */

/**
 * Network Information API
 * Extends Navigator interface with connection property
 */
interface Navigator {
  /** Network connection information */
  connection?: NetworkInformation;

  /** Deprecated: Use navigator.connection instead */
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;

  /** Service Worker registration */
  serviceWorker?: ServiceWorkerContainer;

  /** Web Locks API */
  locks?: LockManager;
}

/**
 * Network Information interface
 */
interface NetworkInformation extends EventTarget {
  /** Effective connection type */
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';

  /** Downlink speed estimate in Mbps */
  downlink?: number;

  /** Downlink max speed in Mbps */
  downlinkMax?: number;

  /** Round-trip time estimate in ms */
  rtt?: number;

  /** Connection type */
  type?: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';

  /** Save data mode enabled */
  saveData?: boolean;

  /** Event handlers */
  onchange?: ((this: NetworkInformation, ev: Event) => any) | null;

  addEventListener(
    type: 'change',
    listener: (this: NetworkInformation, ev: Event) => any,
    options?: boolean | AddEventListenerOptions
  ): void;

  removeEventListener(
    type: 'change',
    listener: (this: NetworkInformation, ev: Event) => any,
    options?: boolean | EventListenerOptions
  ): void;
}

/**
 * Lock Manager (Web Locks API)
 */
interface LockManager {
  request(
    name: string,
    callback: (lock: Lock) => Promise<void>
  ): Promise<void>;

  request(
    name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => Promise<void>
  ): Promise<void>;

  query(): Promise<LockManagerSnapshot>;
}

/**
 * Lock options
 */
interface LockOptions {
  mode?: 'shared' | 'exclusive';
  ifAvailable?: boolean;
  steal?: boolean;
  signal?: AbortSignal;
}

/**
 * Lock
 */
interface Lock {
  name: string;
  mode: 'shared' | 'exclusive';
}

/**
 * Lock Manager snapshot
 */
interface LockManagerSnapshot {
  held: LockInfo[];
  pending: LockInfo[];
}

/**
 * Lock info
 */
interface LockInfo {
  name: string;
  mode: 'shared' | 'exclusive';
  clientId: string;
}

/**
 * Service Worker Container extensions
 */
interface ServiceWorkerContainer extends EventTarget {
  readonly controller: ServiceWorker | null;
  readonly ready: Promise<ServiceWorkerRegistration>;

  register(scriptURL: string | URL, options?: RegistrationOptions): Promise<ServiceWorkerRegistration>;
  getRegistration(clientURL?: string | URL): Promise<ServiceWorkerRegistration | undefined>;
  getRegistrations(): Promise<ReadonlyArray<ServiceWorkerRegistration>>;

  startMessages(): void;

  oncontrollerchange: ((this: ServiceWorkerContainer, ev: Event) => any) | null;
  onmessage: ((this: ServiceWorkerContainer, ev: MessageEvent) => any) | null;
  onmessageerror: ((this: ServiceWorkerContainer, ev: MessageEvent) => any) | null;
}

/**
 * Service Worker Registration extensions
 */
interface ServiceWorkerRegistration extends EventTarget {
  readonly installing: ServiceWorker | null;
  readonly waiting: ServiceWorker | null;
  readonly active: ServiceWorker | null;
  readonly scope: string;
  readonly updateViaCache: ServiceWorkerUpdateViaCache;

  update(): Promise<void>;
  unregister(): Promise<boolean>;

  readonly pushManager?: PushManager;
  readonly sync?: SyncManager;

  onupdatefound: ((this: ServiceWorkerRegistration, ev: Event) => any) | null;
}

/**
 * Background Sync Manager
 */
interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}
