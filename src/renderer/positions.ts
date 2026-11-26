import { PopupPosition } from '../client/types';

/**
 * Structural positioning configuration for a popup layout.
 */
export interface PositionConfig {
  readonly wrapperClass: string;
  readonly hasBackdrop: boolean;
  readonly role: 'dialog' | 'region';
  readonly isModal: boolean;
  readonly ariaLabelDefault: string;
}

/**
 * Position mappings for all backend-supported popup positions.
 */
export const POSITION_CONFIGS: Readonly<Record<PopupPosition, PositionConfig>> = Object.freeze({
  center: {
    wrapperClass: 'popup-manager-position-center',
    hasBackdrop: true,
    role: 'dialog',
    isModal: true,
    ariaLabelDefault: 'Promotional dialog',
  },
  'top-banner': {
    wrapperClass: 'popup-manager-position-top-banner',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional banner',
  },
  'bottom-left': {
    wrapperClass: 'popup-manager-position-bottom-left',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional notification',
  },
  'bottom-right': {
    wrapperClass: 'popup-manager-position-bottom-right',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional notification',
  },
  'top-left': {
    wrapperClass: 'popup-manager-position-top-left',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional notification',
  },
  'top-center': {
    wrapperClass: 'popup-manager-position-top-center',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional notification',
  },
  'top-right': {
    wrapperClass: 'popup-manager-position-top-right',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional notification',
  },
  'middle-left': {
    wrapperClass: 'popup-manager-position-middle-left',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional notification',
  },
  'middle-center': {
    wrapperClass: 'popup-manager-position-middle-center',
    hasBackdrop: true,
    role: 'dialog',
    isModal: true,
    ariaLabelDefault: 'Promotional dialog',
  },
  'middle-right': {
    wrapperClass: 'popup-manager-position-middle-right',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional notification',
  },
  'bottom-center': {
    wrapperClass: 'popup-manager-position-bottom-center',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional notification',
  },
  'top-banner-center': {
    wrapperClass: 'popup-manager-position-top-banner-center',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional banner',
  },
  'bottom-banner-center': {
    wrapperClass: 'popup-manager-position-bottom-banner-center',
    hasBackdrop: false,
    role: 'region',
    isModal: false,
    ariaLabelDefault: 'Promotional banner',
  },
});

/**
 * Returns the position configuration for the specified popup placement.
 * Falls back to center modal layout if an unexpected position is provided.
 */
export function getPositionConfig(position: PopupPosition): PositionConfig {
  const config = POSITION_CONFIGS[position];
  if (!config) {
    return POSITION_CONFIGS.center;
  }
  return config;
}
