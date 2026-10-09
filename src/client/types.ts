/**
 * Valid display placement positions for popups supported by the backend and SDK.
 */
export type PopupPosition = 'center' | 'top-banner' | 'bottom-left' | 'bottom-right';

/**
 * Sanitized public popup entity returned by the public delivery endpoint.
 * Deliberately excludes internal administrative metadata (e.g. website_id, status, created_by).
 */
export interface PublicPopup {
  id: number;
  title: string;
  content: string;
  position: PopupPosition;
  start_time: string | null;
  end_time: string | null;
}

/**
 * Standard API response envelope returned by GET /api/v1/public/popups.
 */
export interface PublicPopupsResponse {
  success: boolean;
  message: string;
  data: PublicPopup[];
}
