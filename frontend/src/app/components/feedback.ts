import { Component, input } from '@angular/core';

@Component({
  selector: 'app-feedback',
  template: `@if (error()) {
      <div class="notice alert-error" role="alert">{{ error() }}</div>
    }
    @if (success()) {
      <div class="notice alert-success" role="status">{{ success() }}</div>
    }
    @if (loading()) {
      <p class="loading-message" role="status">
        <span class="spinner" aria-hidden="true"></span>{{ loading() }}
      </p>
    }`,
})
export class Feedback {
  readonly error = input('');
  readonly success = input('');
  readonly loading = input('');
}
