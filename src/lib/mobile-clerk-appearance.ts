export const mobileClerkAppearance = {
  variables: {
    colorPrimary: "var(--accent-strong)",
    colorBackground: "transparent",
    colorInputBackground: "var(--surface-muted)",
    colorInputText: "var(--text-primary)",
    colorText: "var(--text-primary)",
    colorTextSecondary: "var(--text-secondary)",
    colorNeutral: "var(--text-secondary)",
    colorDanger: "var(--danger)",
    borderRadius: "1rem",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full rounded-[28px] border border-[color:var(--border)] bg-[color:var(--card)] shadow-[var(--shadow)] p-5 sm:p-6",
    headerTitle: "text-[color:var(--text-primary)] text-2xl font-semibold tracking-[-0.03em]",
    headerSubtitle: "text-[color:var(--text-secondary)]",
    socialButtonsBlockButton:
      "border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-primary)] shadow-none hover:bg-[color:var(--ink-soft)]",
    socialButtonsBlockButtonText: "text-[color:var(--text-primary)] font-medium",
    formFieldLabel: "text-[color:var(--text-secondary)] text-sm font-medium",
    formFieldInput:
      "h-12 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-primary)] shadow-none focus:border-[color:var(--accent)] focus:ring-0",
    formFieldInputShowPasswordButton:
      "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]",
    formButtonPrimary:
      "h-12 rounded-2xl bg-[color:var(--accent)] text-white shadow-none hover:bg-[color:var(--accent-strong)]",
    footerActionLink: "text-[color:var(--accent-strong)] hover:text-[color:var(--accent)]",
    identityPreviewText: "text-[color:var(--text-primary)]",
    identityPreviewEditButton:
      "text-[color:var(--accent-strong)] hover:text-[color:var(--accent)]",
    formResendCodeLink: "text-[color:var(--accent-strong)] hover:text-[color:var(--accent)]",
    otpCodeFieldInput:
      "h-12 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-primary)]",
    dividerLine: "bg-[color:var(--border)]",
    dividerText: "text-[color:var(--text-tertiary)]",
    formFieldSuccessText: "text-[color:var(--accent-strong)]",
    formFieldErrorText: "text-[color:var(--danger)]",
    alertText: "text-[color:var(--danger)]",
    alertClerkError: "border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]",
    navbar: "hidden",
    footer: "bg-transparent",
    pageScrollBox: "w-full",
  },
};
