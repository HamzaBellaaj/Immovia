import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-brand',
  imports: [RouterLink],
  template: `<a class="brand" routerLink="/connexion" aria-label="Immovia — accueil"
    ><span class="brand-logo"><img src="/assets/immovia-logo.svg" alt="" aria-hidden="true" /></span
    >Immovia<span class="brand-dot">.</span></a
  >`,
})
export class Brand {}
