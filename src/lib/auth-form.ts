export type AuthMode = "login" | "register";

interface AuthFormFields {
  email: string;
  password: string;
  tenantName: string;
}

function hasEmailValue(value: string): boolean {
  return value.trim().length > 0;
}

function hasPasswordValue(value: string): boolean {
  return value.length > 0;
}

export function getAuthSubmitDisabledReason(
  mode: AuthMode,
  fields: AuthFormFields,
): string | null {
  if (!hasEmailValue(fields.email)) {
    return "Enter your email address.";
  }

  if (!hasPasswordValue(fields.password)) {
    return "Enter your password.";
  }

  if (mode === "register" && fields.password.length < 12) {
    return "Use a password with at least 12 characters.";
  }

  if (mode === "register" && fields.tenantName.trim().length < 2) {
    return "Enter a tenant name with at least 2 characters.";
  }

  return null;
}
