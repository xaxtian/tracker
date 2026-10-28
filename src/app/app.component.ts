import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** App shell: top navigation bar and the routed page. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="topbar">
      <a routerLink="/" class="brand">TrackBody</a>
      <div class="links">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Entrenar</a>
        <a routerLink="/history" routerLinkActive="active">Historial</a>
        <a routerLink="/videos" routerLinkActive="active">Vídeos</a>
        <a routerLink="/settings" routerLinkActive="active">Ajustes</a>
      </div>
    </nav>
    <main class="container">
      <router-outlet />
    </main>
  `,
})
export class AppComponent {}
