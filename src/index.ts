/**
 * Popup Manager SDK
 * Standalone, lightweight browser SDK for the Popup Management System.
 *
 * Current Phase: Lesson 3A — Project Setup & Build Pipeline
 */

/**
 * Current version of the Popup Manager SDK.
 */
export const SDK_VERSION = '0.1.0';

/**
 * Alias for SDK_VERSION matching common version property conventions.
 */
export const version = SDK_VERSION;

/**
 * Bootstrap placeholder object for the PopupManager SDK.
 *
 * NOTE: This is a minimal placeholder established during Lesson 3A to verify
 * ESM and IIFE build pipelines. Full runtime capabilities (init, load, show,
 * hide, refresh, destroy, on, off) will be incrementally implemented in
 * subsequent lessons.
 */
export const PopupManager = {
  version: SDK_VERSION,
};

export default PopupManager;
