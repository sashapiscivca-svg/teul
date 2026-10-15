// The radio's stations by the real time of day, and the record player's shelf: what plays where.

import { t } from '../../i18n';
import { iconSvg } from '../../icons';
import { h } from '../dom';
import type { Mood } from '../../musicplayer';

export type StationId = 'fm' | 'classic' | 'folk';

export const STATIONS: { id: StationId; name: string }[] = [
  { id: 'fm', get name() { return t('media.radio.fm'); } },
  { id: 'classic', get name() { return t('media.radio.classic'); } },
  { id: 'folk', get name() { return t('media.radio.folk'); } },
];

/** The records pressed so far (scripts/scores.py RECORDS): id and the title on the sleeve. */
export const RECORDS: { id: string; title: string }[] = [
  { id: 'rec_shchedryk', get title() { return t('media.radio.recShchedryk'); } },
  { id: 'rec_canon', get title() { return t('media.radio.recCanon'); } },
  { id: 'rec_fur_elise', get title() { return t('media.radio.recFurElise'); } },
  { id: 'rec_silent_night', get title() { return t('media.radio.recSilentNight'); } },
  { id: 'rec_greensleeves', get title() { return t('media.radio.recGreensleeves'); } },
  { id: 'rec_ode', get title() { return t('media.radio.recOde'); } },
  { id: 'rec_moonlight', get title() { return t('media.radio.recMoonlight'); } },
];

export interface OnAir {
  station: StationId;
  name: string;
  /** What the music player plays. */
  track: Mood;
  title: string;
}

/** What a station plays at a minute of the day (and in which month: the carols come in winter). */
export function onAir(station: StationId, minute: number, month: number): OnAir {
  const hour = Math.floor((((minute % 1440) + 1440) % 1440) / 60);
  const name = STATIONS.find((s) => s.id === station)?.name ?? t('media.radio.fm');
  const winter = month === 12 || month === 1;
  if (station === 'classic') {
    if (hour < 6) return { station, name, track: 'rec/rec_moonlight', title: t('media.radio.nightClassics') };
    const rota = ['rec/rec_canon', 'rec/rec_fur_elise', 'rec/rec_ode', 'rec/rec_greensleeves', 'rec/rec_moonlight'] as const;
    const pick = rota[hour % rota.length];
    return { station, name, track: pick, title: t('media.radio.playing', { title: RECORDS.find((r) => `rec/${r.id}` === pick)?.title ?? '' }) };
  }
  if (station === 'folk') {
    if (winter && hour >= 16) return { station, name, track: 'rec/rec_shchedryk', title: t('media.radio.carols') };
    if (hour >= 22 || hour < 6) return { station, name, track: 'night', title: t('media.radio.quietNight') };
    return { station, name, track: hour % 2 === 0 ? 'farm' : 'fields', title: hour < 12 ? t('media.radio.villageMorning') : t('media.radio.fieldSongs') };
  }
  if (hour >= 23 || hour < 6) return { station, name, track: 'night', title: t('media.radio.nightAir') };
  return { station, name, track: 'radio', title: hour < 10 ? t('media.radio.morningShow') : hour < 18 ? t('media.radio.dayAir') : t('media.radio.eveningAir') };
}

/** The station after this one (the radio's knob). */
export function nextStation(s: StationId | string | undefined): StationId {
  const i = STATIONS.findIndex((x) => x.id === s);
  return STATIONS[(i + 1) % STATIONS.length].id;
}

/** The shelf by the record player: the records one has, the one on now, the stations of a radio. */
export class RecordSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;

  constructor(parent: HTMLElement) {
    this.title = h('b', null, t('media.radio.records'));
    this.body = h('div', { class: 'rec-body' });
    this.root = h(
      'div',
      { class: 'settings records', role: 'dialog', 'aria-label': t('media.radio.records') },
      h('div', { class: 'settings-card rec-card' },
        h('div', { class: 'ph' }, this.title, h('button', { class: 'round small', type: 'button', 'aria-label': t('media.radio.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        this.body),
    );
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  close(): void {
    this.root.style.display = 'none';
  }

  /** The records one has; `put` puts one on ('' takes it off and the house record plays). */
  openRecords(have: string[], on: string, put: (id: string) => void): void {
    this.title.textContent = t('media.radio.records');
    const owned = RECORDS.filter((r) => have.includes(r.id));
    const row = (id: string, label: string) =>
      h('button', { class: `rec-row${on === id ? ' on' : ''}`, type: 'button', onclick: () => {
        put(id);
        this.close();
      } }, h('span', { class: 'rec-disc' }), label);
    this.body.replaceChildren(
      row('', t('media.radio.houseRecord')),
      ...owned.map((r) => row(r.id, r.title)),
      ...(owned.length === 0 ? [h('p', { class: 'hint' }, t('media.radio.emptyShelf'))] : []),
    );
    this.root.style.display = '';
  }

  /** The radio's stations: what each plays now. */
  openRadio(on: StationId, minute: number, month: number, tune: (id: StationId) => void): void {
    this.title.textContent = t('media.radio.radio');
    this.body.replaceChildren(...STATIONS.map((s) => {
      const air = onAir(s.id, minute, month);
      return h('button', { class: `rec-row${on === s.id ? ' on' : ''}`, type: 'button', onclick: () => {
        tune(s.id);
        this.close();
      } }, h('span', { class: 'rec-radio', html: iconSvg('listen', 16) }), h('span', null, h('b', null, s.name), h('small', null, ` · ${air.title}`)));
    }));
    this.root.style.display = '';
  }
}
