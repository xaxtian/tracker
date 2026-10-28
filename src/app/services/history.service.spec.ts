import { TestBed } from '@angular/core/testing';
import { SetRecord } from '../models/types';
import { HistoryService } from './history.service';

const KEY = 'trackbody.history';
const set = (id: string, o: Partial<SetRecord> = {}): SetRecord => ({
  id, exercise: 'squat', start: 1, end: 2, valid: 5, invalid: 0, reasons: {}, restBeforeSec: null, ...o,
});
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '[]') as SetRecord[];

describe('HistoryService', () => {
  beforeEach(() => localStorage.clear());

  it('is empty at first', () => {
    expect(TestBed.inject(HistoryService).sets()).toEqual([]);
  });

  it('adds sets and saves them', () => {
    const h = TestBed.inject(HistoryService);
    h.add(set('a'));
    h.add(set('b'));
    expect(h.sets().map((s) => s.id)).toEqual(['a', 'b']);
    expect(stored().map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('loads saved sets', () => {
    localStorage.setItem(KEY, JSON.stringify([set('x', { loadKg: 10 })]));
    expect(TestBed.inject(HistoryService).sets()[0]).toMatchObject({ id: 'x', loadKg: 10 });
  });

  it('updates a set (e.g. its load) without touching the others', () => {
    const h = TestBed.inject(HistoryService);
    h.add(set('a'));
    h.add(set('b'));
    h.update('b', { loadKg: 12.5 });
    expect(h.sets()[1].loadKg).toBe(12.5);
    expect(h.sets()[0].loadKg).toBeUndefined();
    expect(stored()[1].loadKg).toBe(12.5);
  });

  it('removes one set or clears everything', () => {
    const h = TestBed.inject(HistoryService);
    h.add(set('a'));
    h.add(set('b'));
    h.remove('a');
    expect(h.sets().map((s) => s.id)).toEqual(['b']);
    h.clear();
    expect(h.sets()).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it('exports pretty JSON', () => {
    const h = TestBed.inject(HistoryService);
    h.add(set('a'));
    expect(JSON.parse(h.exportJson())).toEqual([set('a')]);
    expect(h.exportJson()).toContain('\n  ');
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem(KEY, 'oops');
    expect(TestBed.inject(HistoryService).sets()).toEqual([]);
  });

  it('keeps the data in memory when storage is full', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    const h = TestBed.inject(HistoryService);
    h.add(set('a'));
    expect(h.sets()).toHaveLength(1);
    spy.mockRestore();
  });
});
