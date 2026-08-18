import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'live',
    title: 'SoundPilot · LIVE',
    loadComponent: () => import('./features/live/live.component').then((m) => m.LiveComponent),
  },
  {
    path: 'cues',
    title: 'SoundPilot · CUES',
    loadComponent: () => import('./features/cues/cues.component').then((m) => m.CuesComponent),
  },
  {
    path: 'settings',
    title: 'SoundPilot · SETTINGS',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'live' },
  { path: '**', redirectTo: 'live' },
];
