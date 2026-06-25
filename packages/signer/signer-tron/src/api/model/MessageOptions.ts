export type MessageOptions = {
  skipOpenApp?: boolean;
  /**
   * When true, sign via INS_SIGN_PERSONAL_MESSAGE_FULL_DISPLAY (0xC8), which
   * displays the full message on-device instead of a truncated hash.
   */
  fullDisplay?: boolean;
};
