import { Component, input } from '@angular/core';
import { Brand } from './brand';

@Component({
  selector: 'app-auth-layout',
  imports: [Brand],
  templateUrl: './auth-layout.html',
})
export class AuthLayout {
  readonly signup = input(false);
}
