/**
 * Discrete runtime lifecycle states representing the current condition of the SDK.
 */
export type RuntimeState =
  | 'UNINITIALIZED'
  | 'CONFIGURED'
  | 'LOADING'
  | 'READY'
  | 'IDLE'
  | 'ERROR'
  | 'DESTROYED';

/**
 * Read-only dictionary of runtime state string constants.
 */
export const RuntimeStates: Readonly<Record<RuntimeState, RuntimeState>> = Object.freeze({
  UNINITIALIZED: 'UNINITIALIZED',
  CONFIGURED: 'CONFIGURED',
  LOADING: 'LOADING',
  READY: 'READY',
  IDLE: 'IDLE',
  ERROR: 'ERROR',
  DESTROYED: 'DESTROYED',
});
