import type { GenEnum, GenFile, GenMessage } from "@bufbuild/protobuf/codegenv2";
import { enumDesc, fileDesc, messageDesc } from "@bufbuild/protobuf/codegenv2";
import type { Message } from "@bufbuild/protobuf";

/**
 * Describes the file fluxer/user/preferences/v1/accessibility.proto.
 */
export const file_fluxer_user_preferences_v1_accessibility: GenFile = /*@__PURE__*/
  fileDesc("Ci5mbHV4ZXIvdXNlci9wcmVmZXJlbmNlcy92MS9hY2Nlc3NpYmlsaXR5LnByb3RvEhpmbHV4ZXIudXNlci5wcmVmZXJlbmNlcy52MSLiJAoVQWNjZXNzaWJpbGl0eVNldHRpbmdzEh4KEXNhdHVyYXRpb25fZmFjdG9yGAEgASgBSACIAQESHgoWYWx3YXlzX3VuZGVybGluZV9saW5rcxgCIAEoCBIiChVlbmFibGVfdGV4dF9zZWxlY3Rpb24YAyABKAhIAYgBARIlChhzaG93X21lc3NhZ2Vfc2VuZF9idXR0b24YBCABKAhIAogBARIlChhzaG93X3RleHRhcmVhX2ZvY3VzX3JpbmcYBSABKAhIA4gBARIbChNoaWRlX2tleWJvYXJkX2hpbnRzGAYgASgIEicKGmVzY2FwZV9leGl0c19rZXlib2FyZF9tb2RlGAcgASgISASIAQESLAofc3luY19yZWR1Y2VkX21vdGlvbl93aXRoX3N5c3RlbRgIIAEoCEgFiAEBEiQKF3JlZHVjZWRfbW90aW9uX292ZXJyaWRlGAkgASgISAaIAQESIgoVbWVzc2FnZV9ncm91cF9zcGFjaW5nGAogASgBSAeIAQESGwoObWVzc2FnZV9ndXR0ZXIYCyABKAFICIgBARIWCglmb250X3NpemUYDCABKAFICYgBARIuCiFzaG93X3VzZXJfYXZhdGFyc19pbl9jb21wYWN0X21vZGUYDSABKAhICogBARIrCiNtb2JpbGVfc3RpY2tlcl9hbmltYXRpb25fb3ZlcnJpZGRlbhgOIAEoCBImCh5tb2JpbGVfZ2lmX2F1dG9wbGF5X292ZXJyaWRkZW4YDyABKAgSJwofbW9iaWxlX2FuaW1hdGVfZW1vamlfb3ZlcnJpZGRlbhgQIAEoCBIrCh5tb2JpbGVfc3RpY2tlcl9hbmltYXRpb25fdmFsdWUYESABKAVIC4gBARImChltb2JpbGVfZ2lmX2F1dG9wbGF5X3ZhbHVlGBIgASgISAyIAQESJwoabW9iaWxlX2FuaW1hdGVfZW1vamlfdmFsdWUYEyABKAhIDYgBARIcChRhdXRvX3NlbmRfa2xpcHlfZ2lmcxgUIAEoCBIcCg9zaG93X2dpZl9idXR0b24YFSABKAhIDogBARIeChFzaG93X21lbWVzX2J1dHRvbhgWIAEoCEgPiAEBEiEKFHNob3dfc3RpY2tlcnNfYnV0dG9uGBcgASgISBCIAQESHgoRc2hvd19lbW9qaV9idXR0b24YGCABKAhIEYgBARIiChRzaG93X3BlcnNvbmFzX2J1dHRvbhitESABKAhIEogBARInChpzaG93X21lZGlhX2Zhdm9yaXRlX2J1dHRvbhgZIAEoCEgTiAEBEicKGnNob3dfbWVkaWFfZG93bmxvYWRfYnV0dG9uGBogASgISBSIAQESJQoYc2hvd19tZWRpYV9kZWxldGVfYnV0dG9uGBsgASgISBWIAQESKAobc2hvd19zdXBwcmVzc19lbWJlZHNfYnV0dG9uGBwgASgISBaIAQESHwoSc2hvd19naWZfaW5kaWNhdG9yGB0gASgISBeIAQESLQogc2hvd19hdHRhY2htZW50X2V4cGlyeV9pbmRpY2F0b3IYHiABKAhIGIgBARIvCiJ1c2VfYnJvd3Nlcl9sb2NhbGVfZm9yX3RpbWVfZm9ybWF0GB8gASgISBmIAQESXQodY2hhbm5lbF90eXBpbmdfaW5kaWNhdG9yX21vZGUYICABKA4yNi5mbHV4ZXIudXNlci5wcmVmZXJlbmNlcy52MS5DaGFubmVsVHlwaW5nSW5kaWNhdG9yTW9kZRIzCiZzaG93X3NlbGVjdGVkX2NoYW5uZWxfdHlwaW5nX2luZGljYXRvchghIAEoCEgaiAEBEiQKF3Nob3dfbWVzc2FnZV9hY3Rpb25fYmFyGCIgASgISBuIAQESNAonc2hvd19tZXNzYWdlX2FjdGlvbl9iYXJfcXVpY2tfcmVhY3Rpb25zGCMgASgISByIAQESMQokc2hvd19tZXNzYWdlX2FjdGlvbl9iYXJfc2hpZnRfZXhwYW5kGCQgASgISB2IAQESNQooc2hvd19tZXNzYWdlX2FjdGlvbl9iYXJfb25seV9tb3JlX2J1dHRvbhglIAEoCEgeiAEBEjAKI3Nob3dfZGVmYXVsdF9lbW9qaXNfaW5fYXV0b2NvbXBsZXRlGCYgASgISB+IAQESLwoic2hvd19jdXN0b21fZW1vamlzX2luX2F1dG9jb21wbGV0ZRgnIAEoCEggiAEBEioKHXNob3dfc3RpY2tlcnNfaW5fYXV0b2NvbXBsZXRlGCggASgISCGIAQESJwoac2hvd19tZW1lc19pbl9hdXRvY29tcGxldGUYKSABKAhIIogBARI1Cih2b2ljZV9jaGFubmVsX2pvaW5fcmVxdWlyZXNfZG91YmxlX2NsaWNrGCwgASgISCOIAQESHQoQY3VzdG9tX3RoZW1lX2NzcxgtIAEoCUgkiAEBEhsKDnNob3dfZmF2b3JpdGVzGC4gASgISCWIAQESFwoKem9vbV9sZXZlbBgvIAEoAUgmiAEBElEKF2RtX21lc3NhZ2VfcHJldmlld19tb2RlGDAgASgOMjAuZmx1eGVyLnVzZXIucHJlZmVyZW5jZXMudjEuRG1NZXNzYWdlUHJldmlld01vZGUSHwoSZW5hYmxlX3R0c19jb21tYW5kGDEgASgISCeIAQESFQoIdHRzX3JhdGUYMiABKAFIKIgBARIwCiNzaG93X2ZhZGVkX3VucmVhZF9vbl9tdXRlZF9jaGFubmVscxgzIAEoCEgpiAEBEigKG3Nob3dfY29udGV4dF9tZW51X3Nob3J0Y3V0cxg0IAEoCEgqiAEBEioKHWNvbmZpcm1fYmVmb3JlX3N0YXJ0aW5nX2NhbGxzGDUgASgISCuIAQESRAoQaGRyX2Rpc3BsYXlfbW9kZRg2IAEoDjIqLmZsdXhlci51c2VyLnByZWZlcmVuY2VzLnYxLkhkckRpc3BsYXlNb2RlEiAKE3ByZXNlcnZlX2VkaXRfZHJhZnQYNyABKAhILIgBARIsCh9zdGF5X2ludGVyYWN0aXZlX3doZW5fdW5mb2N1c2VkGDggASgISC2IAQESMgolY29uZmlybV9iZWZvcmVfam9pbmluZ192b2ljZV9jaGFubmVscxg5IAEoCEguiAEBEjAKI3NjcmVlbl9yZWFkZXJfYW5ub3VuY2VfbmV3X21lc3NhZ2VzGDogASgISC+IAQESNAonZmlyc3RfY2xpY2tfcGFzc190aHJvdWdoX3doZW5fdW5mb2N1c2VkGDsgASgISDCIAQESKgodY29tcGFjdF9tZXNzYWdlX2dyb3VwX3NwYWNpbmcYPCABKAFIMYgBARItCiBzY3JvbGxfdG9fYm90dG9tX29uX21lc3NhZ2Vfc2VuZBg9IAEoCEgyiAEBEiMKFmRpbV9zdHJpa2V0aHJvdWdoX3RleHQYPiABKAhIM4gBARIhChRzZXF1ZW50aWFsX2ZpbGVfc2VuZBg/IAEoCEg0iAEBEikKHG1vYmlsZV9zcGxhc2hfem9vbV9hbmltYXRpb24YQCABKAhINYgBARIkChdzaG93X2FsdF90ZXh0X29uX2ltYWdlcxhBIAEoCEg2iAEBEh0KEG1vYmlsZV9mb250X3NpemUYQiABKAFIN4gBARIpChxtb2JpbGVfbWVzc2FnZV9ncm91cF9zcGFjaW5nGEMgASgBSDiIAQESMQokbW9iaWxlX2NvbXBhY3RfbWVzc2FnZV9ncm91cF9zcGFjaW5nGEQgASgBSDmIAQFCFAoSX3NhdHVyYXRpb25fZmFjdG9yQhgKFl9lbmFibGVfdGV4dF9zZWxlY3Rpb25CGwoZX3Nob3dfbWVzc2FnZV9zZW5kX2J1dHRvbkIbChlfc2hvd190ZXh0YXJlYV9mb2N1c19yaW5nQh0KG19lc2NhcGVfZXhpdHNfa2V5Ym9hcmRfbW9kZUIiCiBfc3luY19yZWR1Y2VkX21vdGlvbl93aXRoX3N5c3RlbUIaChhfcmVkdWNlZF9tb3Rpb25fb3ZlcnJpZGVCGAoWX21lc3NhZ2VfZ3JvdXBfc3BhY2luZ0IRCg9fbWVzc2FnZV9ndXR0ZXJCDAoKX2ZvbnRfc2l6ZUIkCiJfc2hvd191c2VyX2F2YXRhcnNfaW5fY29tcGFjdF9tb2RlQiEKH19tb2JpbGVfc3RpY2tlcl9hbmltYXRpb25fdmFsdWVCHAoaX21vYmlsZV9naWZfYXV0b3BsYXlfdmFsdWVCHQobX21vYmlsZV9hbmltYXRlX2Vtb2ppX3ZhbHVlQhIKEF9zaG93X2dpZl9idXR0b25CFAoSX3Nob3dfbWVtZXNfYnV0dG9uQhcKFV9zaG93X3N0aWNrZXJzX2J1dHRvbkIUChJfc2hvd19lbW9qaV9idXR0b25CFwoVX3Nob3dfcGVyc29uYXNfYnV0dG9uQh0KG19zaG93X21lZGlhX2Zhdm9yaXRlX2J1dHRvbkIdChtfc2hvd19tZWRpYV9kb3dubG9hZF9idXR0b25CGwoZX3Nob3dfbWVkaWFfZGVsZXRlX2J1dHRvbkIeChxfc2hvd19zdXBwcmVzc19lbWJlZHNfYnV0dG9uQhUKE19zaG93X2dpZl9pbmRpY2F0b3JCIwohX3Nob3dfYXR0YWNobWVudF9leHBpcnlfaW5kaWNhdG9yQiUKI191c2VfYnJvd3Nlcl9sb2NhbGVfZm9yX3RpbWVfZm9ybWF0QikKJ19zaG93X3NlbGVjdGVkX2NoYW5uZWxfdHlwaW5nX2luZGljYXRvckIaChhfc2hvd19tZXNzYWdlX2FjdGlvbl9iYXJCKgooX3Nob3dfbWVzc2FnZV9hY3Rpb25fYmFyX3F1aWNrX3JlYWN0aW9uc0InCiVfc2hvd19tZXNzYWdlX2FjdGlvbl9iYXJfc2hpZnRfZXhwYW5kQisKKV9zaG93X21lc3NhZ2VfYWN0aW9uX2Jhcl9vbmx5X21vcmVfYnV0dG9uQiYKJF9zaG93X2RlZmF1bHRfZW1vamlzX2luX2F1dG9jb21wbGV0ZUIlCiNfc2hvd19jdXN0b21fZW1vamlzX2luX2F1dG9jb21wbGV0ZUIgCh5fc2hvd19zdGlja2Vyc19pbl9hdXRvY29tcGxldGVCHQobX3Nob3dfbWVtZXNfaW5fYXV0b2NvbXBsZXRlQisKKV92b2ljZV9jaGFubmVsX2pvaW5fcmVxdWlyZXNfZG91YmxlX2NsaWNrQhMKEV9jdXN0b21fdGhlbWVfY3NzQhEKD19zaG93X2Zhdm9yaXRlc0INCgtfem9vbV9sZXZlbEIVChNfZW5hYmxlX3R0c19jb21tYW5kQgsKCV90dHNfcmF0ZUImCiRfc2hvd19mYWRlZF91bnJlYWRfb25fbXV0ZWRfY2hhbm5lbHNCHgocX3Nob3dfY29udGV4dF9tZW51X3Nob3J0Y3V0c0IgCh5fY29uZmlybV9iZWZvcmVfc3RhcnRpbmdfY2FsbHNCFgoUX3ByZXNlcnZlX2VkaXRfZHJhZnRCIgogX3N0YXlfaW50ZXJhY3RpdmVfd2hlbl91bmZvY3VzZWRCKAomX2NvbmZpcm1fYmVmb3JlX2pvaW5pbmdfdm9pY2VfY2hhbm5lbHNCJgokX3NjcmVlbl9yZWFkZXJfYW5ub3VuY2VfbmV3X21lc3NhZ2VzQioKKF9maXJzdF9jbGlja19wYXNzX3Rocm91Z2hfd2hlbl91bmZvY3VzZWRCIAoeX2NvbXBhY3RfbWVzc2FnZV9ncm91cF9zcGFjaW5nQiMKIV9zY3JvbGxfdG9fYm90dG9tX29uX21lc3NhZ2Vfc2VuZEIZChdfZGltX3N0cmlrZXRocm91Z2hfdGV4dEIXChVfc2VxdWVudGlhbF9maWxlX3NlbmRCHwodX21vYmlsZV9zcGxhc2hfem9vbV9hbmltYXRpb25CGgoYX3Nob3dfYWx0X3RleHRfb25faW1hZ2VzQhMKEV9tb2JpbGVfZm9udF9zaXplQh8KHV9tb2JpbGVfbWVzc2FnZV9ncm91cF9zcGFjaW5nQicKJV9tb2JpbGVfY29tcGFjdF9tZXNzYWdlX2dyb3VwX3NwYWNpbmdKBAgqECtKBAgrECxSH2F0dGFjaG1lbnRfbWVkaWFfZGltZW5zaW9uX3NpemVSGmVtYmVkX21lZGlhX2RpbWVuc2lvbl9zaXplInEKFkFjY2Vzc2liaWxpdHlPdmVycmlkZXMSGgoSZ2lmX2F1dG9wbGF5X2RpcnR5GAEgASgIEhsKE2FuaW1hdGVfZW1vamlfZGlydHkYAiABKAgSHgoWYW5pbWF0ZV9zdGlja2Vyc19kaXJ0eRgDIAEoCCrSAQoaQ2hhbm5lbFR5cGluZ0luZGljYXRvck1vZGUSLQopQ0hBTk5FTF9UWVBJTkdfSU5ESUNBVE9SX01PREVfVU5TUEVDSUZJRUQQABIpCiVDSEFOTkVMX1RZUElOR19JTkRJQ0FUT1JfTU9ERV9BVkFUQVJTEAESMAosQ0hBTk5FTF9UWVBJTkdfSU5ESUNBVE9SX01PREVfSU5ESUNBVE9SX09OTFkQAhIoCiRDSEFOTkVMX1RZUElOR19JTkRJQ0FUT1JfTU9ERV9ISURERU4QAyqrAQoURG1NZXNzYWdlUHJldmlld01vZGUSJwojRE1fTUVTU0FHRV9QUkVWSUVXX01PREVfVU5TUEVDSUZJRUQQABIfChtETV9NRVNTQUdFX1BSRVZJRVdfTU9ERV9BTEwQARInCiNETV9NRVNTQUdFX1BSRVZJRVdfTU9ERV9VTlJFQURfT05MWRACEiAKHERNX01FU1NBR0VfUFJFVklFV19NT0RFX05PTkUQAypsCg5IZHJEaXNwbGF5TW9kZRIgChxIRFJfRElTUExBWV9NT0RFX1VOU1BFQ0lGSUVEEAASGQoVSERSX0RJU1BMQVlfTU9ERV9GVUxMEAESHQoZSERSX0RJU1BMQVlfTU9ERV9TVEFOREFSRBACYgZwcm90bzM");

/**
 * @generated from message fluxer.user.preferences.v1.AccessibilitySettings
 */
export type AccessibilitySettings = Message<"fluxer.user.preferences.v1.AccessibilitySettings"> & {
  /**
   * @generated from field: optional double saturation_factor = 1;
   */
  saturationFactor?: number | undefined;

  /**
   * @generated from field: bool always_underline_links = 2;
   */
  alwaysUnderlineLinks: boolean;

  /**
   * @generated from field: optional bool enable_text_selection = 3;
   */
  enableTextSelection?: boolean | undefined;

  /**
   * @generated from field: optional bool show_message_send_button = 4;
   */
  showMessageSendButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_textarea_focus_ring = 5;
   */
  showTextareaFocusRing?: boolean | undefined;

  /**
   * @generated from field: bool hide_keyboard_hints = 6;
   */
  hideKeyboardHints: boolean;

  /**
   * @generated from field: optional bool escape_exits_keyboard_mode = 7;
   */
  escapeExitsKeyboardMode?: boolean | undefined;

  /**
   * @generated from field: optional bool sync_reduced_motion_with_system = 8;
   */
  syncReducedMotionWithSystem?: boolean | undefined;

  /**
   * @generated from field: optional bool reduced_motion_override = 9;
   */
  reducedMotionOverride?: boolean | undefined;

  /**
   * @generated from field: optional double message_group_spacing = 10;
   */
  messageGroupSpacing?: number | undefined;

  /**
   * @generated from field: optional double message_gutter = 11;
   */
  messageGutter?: number | undefined;

  /**
   * @generated from field: optional double font_size = 12;
   */
  fontSize?: number | undefined;

  /**
   * @generated from field: optional bool show_user_avatars_in_compact_mode = 13;
   */
  showUserAvatarsInCompactMode?: boolean | undefined;

  /**
   * @generated from field: bool mobile_sticker_animation_overridden = 14;
   */
  mobileStickerAnimationOverridden: boolean;

  /**
   * @generated from field: bool mobile_gif_autoplay_overridden = 15;
   */
  mobileGifAutoplayOverridden: boolean;

  /**
   * @generated from field: bool mobile_animate_emoji_overridden = 16;
   */
  mobileAnimateEmojiOverridden: boolean;

  /**
   * @generated from field: optional int32 mobile_sticker_animation_value = 17;
   */
  mobileStickerAnimationValue?: number | undefined;

  /**
   * @generated from field: optional bool mobile_gif_autoplay_value = 18;
   */
  mobileGifAutoplayValue?: boolean | undefined;

  /**
   * @generated from field: optional bool mobile_animate_emoji_value = 19;
   */
  mobileAnimateEmojiValue?: boolean | undefined;

  /**
   * @generated from field: bool auto_send_klipy_gifs = 20;
   */
  autoSendKlipyGifs: boolean;

  /**
   * @generated from field: optional bool show_gif_button = 21;
   */
  showGifButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_memes_button = 22;
   */
  showMemesButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_stickers_button = 23;
   */
  showStickersButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_emoji_button = 24;
   */
  showEmojiButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_personas_button = 2221;
   */
  showPersonasButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_media_favorite_button = 25;
   */
  showMediaFavoriteButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_media_download_button = 26;
   */
  showMediaDownloadButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_media_delete_button = 27;
   */
  showMediaDeleteButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_suppress_embeds_button = 28;
   */
  showSuppressEmbedsButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_gif_indicator = 29;
   */
  showGifIndicator?: boolean | undefined;

  /**
   * @generated from field: optional bool show_attachment_expiry_indicator = 30;
   */
  showAttachmentExpiryIndicator?: boolean | undefined;

  /**
   * @generated from field: optional bool use_browser_locale_for_time_format = 31;
   */
  useBrowserLocaleForTimeFormat?: boolean | undefined;

  /**
   * @generated from field: fluxer.user.preferences.v1.ChannelTypingIndicatorMode channel_typing_indicator_mode = 32;
   */
  channelTypingIndicatorMode: ChannelTypingIndicatorMode;

  /**
   * @generated from field: optional bool show_selected_channel_typing_indicator = 33;
   */
  showSelectedChannelTypingIndicator?: boolean | undefined;

  /**
   * @generated from field: optional bool show_message_action_bar = 34;
   */
  showMessageActionBar?: boolean | undefined;

  /**
   * @generated from field: optional bool show_message_action_bar_quick_reactions = 35;
   */
  showMessageActionBarQuickReactions?: boolean | undefined;

  /**
   * @generated from field: optional bool show_message_action_bar_shift_expand = 36;
   */
  showMessageActionBarShiftExpand?: boolean | undefined;

  /**
   * @generated from field: optional bool show_message_action_bar_only_more_button = 37;
   */
  showMessageActionBarOnlyMoreButton?: boolean | undefined;

  /**
   * @generated from field: optional bool show_default_emojis_in_autocomplete = 38;
   */
  showDefaultEmojisInAutocomplete?: boolean | undefined;

  /**
   * @generated from field: optional bool show_custom_emojis_in_autocomplete = 39;
   */
  showCustomEmojisInAutocomplete?: boolean | undefined;

  /**
   * @generated from field: optional bool show_stickers_in_autocomplete = 40;
   */
  showStickersInAutocomplete?: boolean | undefined;

  /**
   * @generated from field: optional bool show_memes_in_autocomplete = 41;
   */
  showMemesInAutocomplete?: boolean | undefined;

  /**
   * @generated from field: optional bool voice_channel_join_requires_double_click = 44;
   */
  voiceChannelJoinRequiresDoubleClick?: boolean | undefined;

  /**
   * @generated from field: optional string custom_theme_css = 45;
   */
  customThemeCss?: string | undefined;

  /**
   * @generated from field: optional bool show_favorites = 46;
   */
  showFavorites?: boolean | undefined;

  /**
   * @generated from field: optional double zoom_level = 47;
   */
  zoomLevel?: number | undefined;

  /**
   * @generated from field: fluxer.user.preferences.v1.DmMessagePreviewMode dm_message_preview_mode = 48;
   */
  dmMessagePreviewMode: DmMessagePreviewMode;

  /**
   * @generated from field: optional bool enable_tts_command = 49;
   */
  enableTtsCommand?: boolean | undefined;

  /**
   * @generated from field: optional double tts_rate = 50;
   */
  ttsRate?: number | undefined;

  /**
   * @generated from field: optional bool show_faded_unread_on_muted_channels = 51;
   */
  showFadedUnreadOnMutedChannels?: boolean | undefined;

  /**
   * @generated from field: optional bool show_context_menu_shortcuts = 52;
   */
  showContextMenuShortcuts?: boolean | undefined;

  /**
   * @generated from field: optional bool confirm_before_starting_calls = 53;
   */
  confirmBeforeStartingCalls?: boolean | undefined;

  /**
   * @generated from field: fluxer.user.preferences.v1.HdrDisplayMode hdr_display_mode = 54;
   */
  hdrDisplayMode: HdrDisplayMode;

  /**
   * @generated from field: optional bool preserve_edit_draft = 55;
   */
  preserveEditDraft?: boolean | undefined;

  /**
   * @generated from field: optional bool stay_interactive_when_unfocused = 56;
   */
  stayInteractiveWhenUnfocused?: boolean | undefined;

  /**
   * @generated from field: optional bool confirm_before_joining_voice_channels = 57;
   */
  confirmBeforeJoiningVoiceChannels?: boolean | undefined;

  /**
   * @generated from field: optional bool screen_reader_announce_new_messages = 58;
   */
  screenReaderAnnounceNewMessages?: boolean | undefined;

  /**
   * @generated from field: optional bool first_click_pass_through_when_unfocused = 59;
   */
  firstClickPassThroughWhenUnfocused?: boolean | undefined;

  /**
   * @generated from field: optional double compact_message_group_spacing = 60;
   */
  compactMessageGroupSpacing?: number | undefined;

  /**
   * @generated from field: optional bool scroll_to_bottom_on_message_send = 61;
   */
  scrollToBottomOnMessageSend?: boolean | undefined;

  /**
   * @generated from field: optional bool dim_strikethrough_text = 62;
   */
  dimStrikethroughText?: boolean | undefined;

  /**
   * @generated from field: optional bool sequential_file_send = 63;
   */
  sequentialFileSend?: boolean | undefined;

  /**
   * @generated from field: optional bool mobile_splash_zoom_animation = 64;
   */
  mobileSplashZoomAnimation?: boolean | undefined;

  /**
   * @generated from field: optional bool show_alt_text_on_images = 65;
   */
  showAltTextOnImages?: boolean | undefined;

  /**
   * @generated from field: optional double mobile_font_size = 66;
   */
  mobileFontSize?: number | undefined;

  /**
   * @generated from field: optional double mobile_message_group_spacing = 67;
   */
  mobileMessageGroupSpacing?: number | undefined;

  /**
   * @generated from field: optional double mobile_compact_message_group_spacing = 68;
   */
  mobileCompactMessageGroupSpacing?: number | undefined;
};

/**
 * Describes the message fluxer.user.preferences.v1.AccessibilitySettings.
 * Use `create(AccessibilitySettingsSchema)` to create a new message.
 */
export const AccessibilitySettingsSchema: GenMessage<AccessibilitySettings> = /*@__PURE__*/
  messageDesc(file_fluxer_user_preferences_v1_accessibility, 0);

/**
 * @generated from message fluxer.user.preferences.v1.AccessibilityOverrides
 */
export type AccessibilityOverrides = Message<"fluxer.user.preferences.v1.AccessibilityOverrides"> & {
  /**
   * @generated from field: bool gif_autoplay_dirty = 1;
   */
  gifAutoplayDirty: boolean;

  /**
   * @generated from field: bool animate_emoji_dirty = 2;
   */
  animateEmojiDirty: boolean;

  /**
   * @generated from field: bool animate_stickers_dirty = 3;
   */
  animateStickersDirty: boolean;
};

/**
 * Describes the message fluxer.user.preferences.v1.AccessibilityOverrides.
 * Use `create(AccessibilityOverridesSchema)` to create a new message.
 */
export const AccessibilityOverridesSchema: GenMessage<AccessibilityOverrides> = /*@__PURE__*/
  messageDesc(file_fluxer_user_preferences_v1_accessibility, 1);

/**
 * @generated from enum fluxer.user.preferences.v1.ChannelTypingIndicatorMode
 */
export enum ChannelTypingIndicatorMode {
  /**
   * @generated from enum value: CHANNEL_TYPING_INDICATOR_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: CHANNEL_TYPING_INDICATOR_MODE_AVATARS = 1;
   */
  AVATARS = 1,

  /**
   * @generated from enum value: CHANNEL_TYPING_INDICATOR_MODE_INDICATOR_ONLY = 2;
   */
  INDICATOR_ONLY = 2,

  /**
   * @generated from enum value: CHANNEL_TYPING_INDICATOR_MODE_HIDDEN = 3;
   */
  HIDDEN = 3,
}

/**
 * Describes the enum fluxer.user.preferences.v1.ChannelTypingIndicatorMode.
 */
export const ChannelTypingIndicatorModeSchema: GenEnum<ChannelTypingIndicatorMode> = /*@__PURE__*/
  enumDesc(file_fluxer_user_preferences_v1_accessibility, 0);

/**
 * @generated from enum fluxer.user.preferences.v1.DmMessagePreviewMode
 */
export enum DmMessagePreviewMode {
  /**
   * @generated from enum value: DM_MESSAGE_PREVIEW_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: DM_MESSAGE_PREVIEW_MODE_ALL = 1;
   */
  ALL = 1,

  /**
   * @generated from enum value: DM_MESSAGE_PREVIEW_MODE_UNREAD_ONLY = 2;
   */
  UNREAD_ONLY = 2,

  /**
   * @generated from enum value: DM_MESSAGE_PREVIEW_MODE_NONE = 3;
   */
  NONE = 3,
}

/**
 * Describes the enum fluxer.user.preferences.v1.DmMessagePreviewMode.
 */
export const DmMessagePreviewModeSchema: GenEnum<DmMessagePreviewMode> = /*@__PURE__*/
  enumDesc(file_fluxer_user_preferences_v1_accessibility, 1);

/**
 * @generated from enum fluxer.user.preferences.v1.HdrDisplayMode
 */
export enum HdrDisplayMode {
  /**
   * @generated from enum value: HDR_DISPLAY_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: HDR_DISPLAY_MODE_FULL = 1;
   */
  FULL = 1,

  /**
   * @generated from enum value: HDR_DISPLAY_MODE_STANDARD = 2;
   */
  STANDARD = 2,
}

/**
 * Describes the enum fluxer.user.preferences.v1.HdrDisplayMode.
 */
export const HdrDisplayModeSchema: GenEnum<HdrDisplayMode> = /*@__PURE__*/
  enumDesc(file_fluxer_user_preferences_v1_accessibility, 2);
