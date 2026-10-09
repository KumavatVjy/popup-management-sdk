import { PublicPopup, PublicPopupsResponse, PopupPosition } from './types';

/**
 * Valid popup positions supported by the backend delivery endpoint and SDK.
 */
const VALID_POSITIONS: ReadonlySet<string> = new Set<PopupPosition>([
  'center',
  'top-banner',
  'bottom-left',
  'bottom-right',
]);

/**
 * ApiClientError represents transport, HTTP, JSON parsing, or response validation failures.
 */
export class ApiClientError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;

    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

/**
 * Options required to initialize the ApiClient.
 */
export interface ApiClientOptions {
  websiteKey: string;
  apiBaseUrl: string;
  debug?: boolean;
}

/**
 * ApiClient performs network transport and validation for the public popup delivery route.
 */
export class ApiClient {
  private readonly websiteKey: string;
  private readonly apiBaseUrl: string;
  private readonly debug: boolean;

  constructor(options: ApiClientOptions) {
    this.websiteKey = options.websiteKey;
    this.apiBaseUrl = options.apiBaseUrl;
    this.debug = Boolean(options.debug);
  }

  /**
   * Safely constructs the public delivery URL using URL and URLSearchParams APIs.
   */
  public buildDeliveryUrl(): URL {
    const normalizedBase = this.apiBaseUrl.replace(/\/+$/, '');
    const endpoint = `${normalizedBase}/api/v1/public/popups`;
    const url = new URL(endpoint);
    url.searchParams.set('website_key', this.websiteKey);
    return url;
  }

  /**
   * Fetches and validates active eligible popups for the configured website.
   *
   * @returns A promise resolving to an array of validated PublicPopup objects.
   * @throws ApiClientError on network failure, HTTP error status, or malformed data.
   */
  public async fetchPopups(): Promise<PublicPopup[]> {
    const url = this.buildDeliveryUrl();

    if (this.debug) {
      console.debug('[PopupManager] Fetching public popups...');
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        mode: 'cors',
        credentials: 'omit',
      });
    } catch {
      if (this.debug) {
        console.debug('[PopupManager] Network request failed');
      }
      throw new ApiClientError('Network error: request failed', undefined, 'NETWORK_ERROR');
    }

    if (!response.ok) {
      if (this.debug) {
        console.debug(`[PopupManager] Request failed with HTTP status: ${response.status}`);
      }

      let errorMessage = `HTTP ${response.status} error`;
      try {
        const errorBody = await response.json();
        if (
          errorBody &&
          typeof errorBody === 'object' &&
          !Array.isArray(errorBody) &&
          typeof errorBody.message === 'string' &&
          errorBody.message.trim().length > 0
        ) {
          errorMessage = errorBody.message.trim();
        }
      } catch {
        // Fall back to generic HTTP status message if response is not JSON
      }

      throw new ApiClientError(errorMessage, response.status, 'HTTP_ERROR');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiClientError('Invalid JSON response from server', response.status, 'INVALID_JSON');
    }

    const popups = this.validateResponse(body, response.status);

    if (this.debug) {
      console.debug(`[PopupManager] Successfully fetched ${popups.length} eligible popup(s)`);
    }

    return popups;
  }

  /**
   * Performs runtime structural validation of the received response body.
   */
  private validateResponse(body: unknown, status: number): PublicPopup[] {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiClientError('Invalid response envelope: expected JSON object', status, 'INVALID_ENVELOPE');
    }

    const envelope = body as Partial<PublicPopupsResponse>;

    if (typeof envelope.success !== 'boolean' || typeof envelope.message !== 'string') {
      throw new ApiClientError(
        'Invalid response envelope: success boolean and message string required',
        status,
        'INVALID_ENVELOPE'
      );
    }

    if (!Array.isArray(envelope.data)) {
      throw new ApiClientError('Invalid response envelope: data array required', status, 'INVALID_ENVELOPE');
    }

    return envelope.data.map((item, index) => this.validatePopupItem(item, index, status));
  }

  /**
   * Validates individual popup item fields.
   */
  private validatePopupItem(item: unknown, index: number, status: number): PublicPopup {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ApiClientError(
        `Invalid popup item at index ${index}: expected an object`,
        status,
        'INVALID_POPUP_DATA'
      );
    }

    const p = item as Record<string, unknown>;

    if (typeof p.id !== 'number' || !Number.isFinite(p.id)) {
      throw new ApiClientError(
        `Invalid popup at index ${index}: id must be a finite number`,
        status,
        'INVALID_POPUP_DATA'
      );
    }

    if (typeof p.title !== 'string') {
      throw new ApiClientError(
        `Invalid popup at index ${index}: title must be a string`,
        status,
        'INVALID_POPUP_DATA'
      );
    }

    if (typeof p.content !== 'string') {
      throw new ApiClientError(
        `Invalid popup at index ${index}: content must be a string`,
        status,
        'INVALID_POPUP_DATA'
      );
    }

    if (typeof p.position !== 'string' || !VALID_POSITIONS.has(p.position)) {
      throw new ApiClientError(
        `Invalid popup at index ${index}: position must be one of ${Array.from(VALID_POSITIONS).join(', ')}`,
        status,
        'INVALID_POPUP_DATA'
      );
    }

    if (p.start_time !== null && typeof p.start_time !== 'string') {
      throw new ApiClientError(
        `Invalid popup at index ${index}: start_time must be a string or null`,
        status,
        'INVALID_POPUP_DATA'
      );
    }

    if (p.end_time !== null && typeof p.end_time !== 'string') {
      throw new ApiClientError(
        `Invalid popup at index ${index}: end_time must be a string or null`,
        status,
        'INVALID_POPUP_DATA'
      );
    }

    return {
      id: p.id,
      title: p.title,
      content: p.content,
      position: p.position as PopupPosition,
      start_time: p.start_time ?? null,
      end_time: p.end_time ?? null,
    };
  }
}
