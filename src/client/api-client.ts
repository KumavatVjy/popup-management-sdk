import { PublicPopup, PublicPopupsResponse, PopupPosition } from './types';

/**
 * Valid popup positions supported by the backend delivery endpoint and SDK.
 */
const VALID_POSITIONS: ReadonlySet<string> = new Set<PopupPosition>([
  'center',
  'top-banner',
  'bottom-left',
  'bottom-right',
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-center',
  'top-banner-center',
  'bottom-banner-center',
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
    if (typeof window !== 'undefined' && window.location?.pathname) {
      url.searchParams.set('page_path', window.location.pathname);
    }
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
      start_time: typeof p.start_time === 'string' ? p.start_time : null,
      end_time: typeof p.end_time === 'string' ? p.end_time : null,

      // Banner image with link
      banner_image_url: typeof p.banner_image_url === 'string' ? p.banner_image_url : '',
      banner_link_url: typeof p.banner_link_url === 'string' ? p.banner_link_url : '',
      banner_link_target: typeof p.banner_link_target === 'string' ? p.banner_link_target : '_blank',
      badge_text: typeof p.badge_text === 'string' ? p.badge_text : '',
      show_image: typeof p.show_image === 'boolean' ? p.show_image : true,
      show_content: typeof p.show_content === 'boolean' ? p.show_content : true,
      media_overlay_color: typeof p.media_overlay_color === 'string' ? p.media_overlay_color : '',
      media_overlay_opacity: typeof p.media_overlay_opacity === 'number' ? p.media_overlay_opacity : 0,
      media_border_color: typeof p.media_border_color === 'string' ? p.media_border_color : '',
      media_border_width: typeof p.media_border_width === 'number' ? p.media_border_width : 0,
      footer_background_color: typeof p.footer_background_color === 'string' ? p.footer_background_color : '',
      footer_border_color: typeof p.footer_border_color === 'string' ? p.footer_border_color : '',
      footer_border_width: typeof p.footer_border_width === 'number' ? p.footer_border_width : 0,

      // Countdown timer
      countdown_enabled: typeof p.countdown_enabled === 'boolean' ? p.countdown_enabled : false,
      countdown_end_time: typeof p.countdown_end_time === 'string' ? p.countdown_end_time : null,
      countdown_title: typeof p.countdown_title === 'string' ? p.countdown_title : '',

      // Color customization
      title_color: typeof p.title_color === 'string' ? p.title_color : '',
      background_color: typeof p.background_color === 'string' ? p.background_color : '',
      border_color: typeof p.border_color === 'string' ? p.border_color : '',
      border_width: typeof p.border_width === 'number' ? p.border_width : 1,
      border_top_color: typeof p.border_top_color === 'string' ? p.border_top_color : '',
      border_top_width: typeof p.border_top_width === 'number' ? p.border_top_width : -1,
      border_right_color: typeof p.border_right_color === 'string' ? p.border_right_color : '',
      border_right_width: typeof p.border_right_width === 'number' ? p.border_right_width : -1,
      border_bottom_color: typeof p.border_bottom_color === 'string' ? p.border_bottom_color : '',
      border_bottom_width: typeof p.border_bottom_width === 'number' ? p.border_bottom_width : -1,
      border_left_color: typeof p.border_left_color === 'string' ? p.border_left_color : '',
      border_left_width: typeof p.border_left_width === 'number' ? p.border_left_width : -1,
      box_shadow: typeof p.box_shadow === 'string' ? p.box_shadow : '',
      media_box_shadow: typeof p.media_box_shadow === 'string' ? p.media_box_shadow : '',
      footer_box_shadow: typeof p.footer_box_shadow === 'string' ? p.footer_box_shadow : '',
      border_radius: typeof p.border_radius === 'number' ? p.border_radius : 12,
      popup_width: typeof p.popup_width === 'number' ? p.popup_width : 0,
      popup_height: typeof p.popup_height === 'number' ? p.popup_height : 0,
      show_on_desktop: typeof p.show_on_desktop === 'boolean' ? p.show_on_desktop : true,
      show_on_tablet: typeof p.show_on_tablet === 'boolean' ? p.show_on_tablet : true,
      show_on_mobile: typeof p.show_on_mobile === 'boolean' ? p.show_on_mobile : true,

      // CTA button
      cta_text: typeof p.cta_text === 'string' ? p.cta_text : '',
      cta_url: typeof p.cta_url === 'string' ? p.cta_url : '',
      cta_target: typeof p.cta_target === 'string' ? p.cta_target : '_blank',
      cta_text_color: typeof p.cta_text_color === 'string' ? p.cta_text_color : '',
      cta_bg_color: typeof p.cta_bg_color === 'string' ? p.cta_bg_color : '',

      // Close button
      close_button_choice: typeof p.close_button_choice === 'string' ? p.close_button_choice : 'default',
      close_button_position: typeof p.close_button_position === 'string' ? p.close_button_position : 'top-right',
      close_button_color: typeof p.close_button_color === 'string' ? p.close_button_color : '',

      // Trigger settings
      trigger_type: typeof p.trigger_type === 'string' ? p.trigger_type : 'immediate',
      trigger_delay_seconds: typeof p.trigger_delay_seconds === 'number' ? p.trigger_delay_seconds : 0,
      trigger_scroll_percentage: typeof p.trigger_scroll_percentage === 'number' ? p.trigger_scroll_percentage : 0,

      // Cooldown
      cooldown_minutes: typeof p.cooldown_minutes === 'number' ? p.cooldown_minutes : 0,

      // Custom CSS
      custom_css: typeof p.custom_css === 'string' ? p.custom_css : '',
      custom_js: typeof p.custom_js === 'string' ? p.custom_js : '',
      target_pages: typeof p.target_pages === 'string' ? p.target_pages : '',
      exclude_pages: typeof p.exclude_pages === 'string' ? p.exclude_pages : '',
    };
  }
}
