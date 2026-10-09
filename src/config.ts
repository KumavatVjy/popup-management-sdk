/**
 * ConfigurationError is thrown synchronously when invalid or incomplete
 * options are passed to PopupManager.init(config).
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';

    // Maintain prototype chain for instanceof checks across compilation targets
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Public configuration options provided to PopupManager.init(config).
 */
export interface PopupManagerConfig {
  /**
   * The public website integration key (e.g. 'wg_live_...').
   * Required. Must not be empty or whitespace-only.
   */
  websiteKey: string;

  /**
   * Base URL / origin of the Popup Management API server (e.g. 'http://localhost:8082' or 'https://api.example.com').
   * Required. Must be an absolute HTTP or HTTPS URL without credentials, query parameters, or fragments.
   */
  apiBaseUrl: string;

  /**
   * Whether to automatically fetch eligible popups upon initialization.
   * Optional. Defaults to true.
   */
  autoLoad?: boolean;

  /**
   * Whether to automatically display eligible popups after loading.
   * Optional. Defaults to true.
   */
  autoShow?: boolean;

  /**
   * Whether to enable debug logging.
   * Optional. Defaults to false.
   */
  debug?: boolean;
}

/**
 * Normalized internal configuration after validation and default resolution.
 * All optional options are guaranteed to have resolved boolean values.
 */
export interface NormalizedPopupManagerConfig {
  readonly websiteKey: string;
  readonly apiBaseUrl: string;
  readonly autoLoad: boolean;
  readonly autoShow: boolean;
  readonly debug: boolean;
}

/**
 * Default configuration values applied when optional fields are undefined.
 */
export const DEFAULT_CONFIG: Readonly<Omit<NormalizedPopupManagerConfig, 'websiteKey' | 'apiBaseUrl'>> = Object.freeze({
  autoLoad: true,
  autoShow: true,
  debug: false,
});

/**
 * Validates and normalizes raw configuration options.
 *
 * @param rawConfig The configuration options to validate.
 * @returns A frozen NormalizedPopupManagerConfig object.
 * @throws ConfigurationError if any required option is missing or invalid.
 */
export function parseConfig(rawConfig: unknown): NormalizedPopupManagerConfig {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    throw new ConfigurationError('Configuration must be a non-null object');
  }

  const config = rawConfig as Partial<PopupManagerConfig>;

  // 1. Validate websiteKey
  if (config.websiteKey === undefined || config.websiteKey === null) {
    throw new ConfigurationError('websiteKey is required');
  }
  if (typeof config.websiteKey !== 'string') {
    throw new ConfigurationError('websiteKey must be a string');
  }
  const trimmedKey = config.websiteKey.trim();
  if (trimmedKey.length === 0) {
    throw new ConfigurationError('websiteKey must not be empty or whitespace-only');
  }

  // 2. Validate apiBaseUrl
  if (config.apiBaseUrl === undefined || config.apiBaseUrl === null) {
    throw new ConfigurationError('apiBaseUrl is required');
  }
  if (typeof config.apiBaseUrl !== 'string') {
    throw new ConfigurationError('apiBaseUrl must be a string');
  }
  const trimmedUrl = config.apiBaseUrl.trim();
  if (trimmedUrl.length === 0) {
    throw new ConfigurationError('apiBaseUrl must not be empty or whitespace-only');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new ConfigurationError('apiBaseUrl must be a valid absolute URL');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new ConfigurationError('apiBaseUrl must use http or https protocol');
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new ConfigurationError('apiBaseUrl must not contain username or password credentials');
  }

  if (parsedUrl.search) {
    throw new ConfigurationError('apiBaseUrl must not contain query parameters');
  }

  if (parsedUrl.hash) {
    throw new ConfigurationError('apiBaseUrl must not contain a fragment');
  }

  // Normalize trailing slashes: e.g. "http://localhost:8082/" -> "http://localhost:8082"
  const normalizedBaseUrl = trimmedUrl.replace(/\/+$/, '');

  // 3. Validate boolean options (if provided)
  if (config.autoLoad !== undefined && typeof config.autoLoad !== 'boolean') {
    throw new ConfigurationError('autoLoad must be a boolean');
  }
  if (config.autoShow !== undefined && typeof config.autoShow !== 'boolean') {
    throw new ConfigurationError('autoShow must be a boolean');
  }
  if (config.debug !== undefined && typeof config.debug !== 'boolean') {
    throw new ConfigurationError('debug must be a boolean');
  }

  const normalized: NormalizedPopupManagerConfig = Object.freeze({
    websiteKey: trimmedKey,
    apiBaseUrl: normalizedBaseUrl,
    autoLoad: config.autoLoad !== undefined ? config.autoLoad : DEFAULT_CONFIG.autoLoad,
    autoShow: config.autoShow !== undefined ? config.autoShow : DEFAULT_CONFIG.autoShow,
    debug: config.debug !== undefined ? config.debug : DEFAULT_CONFIG.debug,
  });

  return normalized;
}
