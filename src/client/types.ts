/**
 * Valid display placement positions for popups supported by the backend and SDK.
 */
export type PopupPosition =
  | 'center'
  | 'top-banner'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-center'
  | 'top-banner-center'
  | 'bottom-banner-center';

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

  // Banner image with link
  banner_image_url: string;
  banner_link_url: string;
  banner_link_target: string;
  badge_text: string;
  show_image: boolean;
  show_content: boolean;
  media_overlay_color: string;
  media_overlay_opacity: number;
  media_border_color: string;
  media_border_width: number;
  footer_background_color: string;
  footer_border_color: string;
  footer_border_width: number;

  // Countdown timer
  countdown_enabled: boolean;
  countdown_end_time: string | null;
  countdown_title: string;

  // Color customization
  title_color: string;
  background_color: string;
  border_color: string;
  border_width: number;
  border_top_color: string;
  border_top_width: number;
  border_right_color: string;
  border_right_width: number;
  border_bottom_color: string;
  border_bottom_width: number;
  border_left_color: string;
  border_left_width: number;
  box_shadow: string;
  media_box_shadow: string;
  footer_box_shadow: string;
  border_radius: number;
  popup_width?: number;
  popup_height?: number;
  show_on_desktop?: boolean;
  show_on_tablet?: boolean;
  show_on_mobile?: boolean;

  // CTA button
  cta_text: string;
  cta_url: string;
  cta_target: string;
  cta_text_color: string;
  cta_bg_color: string;

  // Close button
  close_button_choice: string;
  close_button_position: string;
  close_button_color: string;

  // Trigger settings
  trigger_type: string;
  trigger_delay_seconds: number;
  trigger_scroll_percentage: number;

  // Reappearance cooldown
  cooldown_minutes: number;

  // Custom CSS
  custom_css: string;
  custom_js: string;
  target_pages: string;
  exclude_pages: string;

  // Gamified features & Layout
  popup_type?: string;
  wheel_config?: string;
  layout_type?: string;

  // Disclaimer & Compliance
  disclaimer_enabled?: boolean;
  disclaimer_text?: string;
}

/**
 * Standard API response envelope returned by GET /api/v1/public/popups.
 */
export interface PublicPopupsResponse {
  success: boolean;
  message: string;
  data: PublicPopup[];
}
