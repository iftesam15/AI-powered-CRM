export interface ForgotPasswordResponse {
  accepted: boolean;
  /** Only populated in mock mode so the flow can be walked without SMTP. */
  devToken: string | null;
}
