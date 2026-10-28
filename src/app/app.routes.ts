import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent), title: 'TrackBody' },
  {
    path: 'workout/:exercise',
    loadComponent: () => import('./pages/workout/workout.component').then((m) => m.WorkoutComponent),
    title: 'Entrenando · TrackBody',
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/history/history.component').then((m) => m.HistoryComponent),
    title: 'Historial · TrackBody',
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Ajustes · TrackBody',
  },
  {
    path: 'videos',
    loadComponent: () => import('./pages/videos/videos.component').then((m) => m.VideosComponent),
    title: 'Vídeos · TrackBody',
  },
  {
    path: 'videos/:id',
    loadComponent: () => import('./pages/videos/video-player.component').then((m) => m.VideoPlayerComponent),
    title: 'Vídeo · TrackBody',
  },
  { path: '**', redirectTo: '' },
];
