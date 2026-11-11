import { Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-field',
  imports: [ReactiveFormsModule],
  template: ` <div class="input-group">
    <label [for]="id()">{{ label() }}</label>
    <div class="input-wrap" [class.with-icon]="type() === 'password'">
      <input
        [id]="id()"
        [type]="visible() ? 'text' : type()"
        [formControl]="control()"
        [autocomplete]="autocomplete()"
        [placeholder]="placeholder()"
        [readOnly]="readonly()"
        [attr.aria-invalid]="invalid()"
        [attr.aria-describedby]="invalid() ? id() + '-error' : null"
      />
      @if (type() === 'password') {
        <button
          type="button"
          class="eye"
          [attr.aria-label]="visible() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
          [attr.aria-pressed]="visible()"
          (click)="visible.set(!visible())"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
          >
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            @if (visible()) {
              <path d="m3 3 18 18" />
            }
          </svg>
        </button>
      }
    </div>
    @if (invalid()) {
      <p class="error-text" [id]="id() + '-error'">{{ validationMessage() }}</p>
    }
  </div>`,
})
export class FormField {
  readonly control = input.required<FormControl<string>>();
  readonly id = input.required<string>({ alias: 'fieldId' });
  readonly label = input.required<string>();
  readonly type = input('text');
  readonly autocomplete = input('off');
  readonly placeholder = input('');
  readonly readonly = input(false);
  readonly visible = signal(false);
  invalid(): boolean {
    return this.control().invalid && this.control().touched;
  }
  validationMessage(): string {
    const errors = this.control().errors;
    if (errors?.['required'] || errors?.['blank']) return 'Ce champ est obligatoire.';
    if (errors?.['email']) return 'Saisissez une adresse e-mail valide.';
    if (errors?.['minlength'])
      return `Utilisez au moins ${errors['minlength'].requiredLength} caractères.`;
    if (errors?.['maxlength'])
      return `Utilisez au maximum ${errors['maxlength'].requiredLength} caractères.`;
    if (errors?.['pattern']) return 'Saisissez un numéro de téléphone valide.';
    return 'Vérifiez ce champ.';
  }
}
