import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { formatDate } from '@angular/common';
import { Router } from '@angular/router';
import { appConfig } from './app.config';
import { routes } from './app.routes';

describe('appConfig', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: appConfig.providers }));

  it('runs in Spanish', () => {
    expect(TestBed.inject(LOCALE_ID)).toBe('es');
    expect(formatDate(new Date(2026, 9, 28), 'EEEE d MMMM', 'es')).toBe('miércoles 28 octubre');
  });

  it('registers the app routes', () => {
    expect(TestBed.inject(Router).config).toEqual(routes);
  });
});
