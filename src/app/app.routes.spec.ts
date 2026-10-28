import { Type } from '@angular/core';
import { routes } from './app.routes';
import { HistoryComponent } from './pages/history/history.component';
import { HomeComponent } from './pages/home/home.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { VideoPlayerComponent } from './pages/videos/video-player.component';
import { VideosComponent } from './pages/videos/videos.component';
import { WorkoutComponent } from './pages/workout/workout.component';

describe('routes', () => {
  const expected: [string, Type<unknown>][] = [
    ['', HomeComponent],
    ['workout/:exercise', WorkoutComponent],
    ['history', HistoryComponent],
    ['settings', SettingsComponent],
    ['videos', VideosComponent],
    ['videos/:id', VideoPlayerComponent],
  ];

  it.each(expected)('"%s" lazy-loads its page', async (path, component) => {
    const route = routes.find((r) => r.path === path)!;
    expect(route).toBeDefined();
    expect(await route.loadComponent!()).toBe(component);
    expect(route.title).toContain('TrackBody');
  });

  it('sends unknown URLs to the home page', () => {
    expect(routes[routes.length - 1]).toEqual({ path: '**', redirectTo: '' });
  });
});
