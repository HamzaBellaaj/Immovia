import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const notBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && !control.value.trim() ? { blank: true } : null;

export const nameValidators = [Validators.required, notBlank, Validators.maxLength(100)];
export const emailValidators = [Validators.required, Validators.email, Validators.maxLength(254)];
export const passwordValidators = [
  Validators.required,
  Validators.minLength(8),
  Validators.maxLength(128),
];
export const phoneValidators = [
  Validators.maxLength(30),
  Validators.pattern(/^\+?[0-9 ()\-.]{6,30}$/),
];

export const matchingPasswords: ValidatorFn = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };
