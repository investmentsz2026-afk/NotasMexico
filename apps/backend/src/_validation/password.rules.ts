/**
 * Política de Contraseñas Institucional para MexAgenda:
 * - Longitud mínima de 12 caracteres.
 * - Al menos una letra mayúscula (A-Z).
 * - Al menos una letra minúscula (a-z).
 * - Al menos un dígito numérico (0-9).
 * - Al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?).
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['La contraseña es requerida y debe ser una cadena de texto.'] };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`La contraseña debe contener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`La contraseña no puede exceder los ${PASSWORD_MAX_LENGTH} caracteres.`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula.');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula.');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número.');
  }

  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    errors.push('La contraseña debe contener al menos un carácter especial.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
