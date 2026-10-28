import { Component, inject, signal } from '@angular/core';
import { EXERCISE_IDS, getExercise } from '../../exercises';
import { SettingField, eccentricFields } from '../../exercises/exercise';
import { GeneralSettings, SettingsSection } from '../../models/types';
import { SettingsService } from '../../services/settings.service';

/** A setting control of any section. */
type Field = SettingField<Record<string, unknown>>;

/** A collapsible group of settings. */
interface Section {
  id: SettingsSection;
  title: string;
  fields: Field[];
}

/** Settings shared by every exercise. */
const GENERAL_FIELDS: SettingField<GeneralSettings>[] = [
  { key: 'userHeightCm', label: 'Tu altura', help: 'Se usa para convertir el movimiento a metros por segundo. Cuanto más exacta, más exacta la velocidad.', type: 'range', min: 120, max: 220, step: 1, unit: ' cm' },
  { key: 'highFps', label: 'Cámara a 60 fps', help: 'Pide 60 imágenes por segundo si la cámara lo permite: tiempos y velocidades más precisos, pero más batería. Se aplica al encender la cámara.', type: 'toggle' },
  { key: 'restTimeoutSec', label: 'Descanso para cerrar serie', help: 'Segundos sin repeticiones para dar la serie por terminada. En flexiones y pike se usa el triple. En dominadas, remo, pino y elevaciones la serie solo termina al salir de la posición.', type: 'range', min: 3, max: 60, step: 1, unit: ' s' },
  { key: 'offPositionSec', label: 'Tiempo fuera de posición', help: 'Segundos fuera de la barra, fuera de la plancha o fuera de cámara para cerrar la serie.', type: 'range', min: 0.5, max: 10, step: 0.5, unit: ' s' },
  { key: 'minRange', label: 'Recorrido mínimo para intento', help: 'Grados que tiene que cerrarse la articulación para contar como intento (válido o no). Evita contar pequeños movimientos.', type: 'range', min: 10, max: 60, step: 1, unit: '°' },
  { key: 'faultFrames', label: 'Fotogramas para confirmar un fallo', help: 'Un fallo de técnica tiene que verse en estos fotogramas seguidos para invalidar. Más alto = más permisivo con el ruido.', type: 'range', min: 1, max: 10, step: 1 },
  { key: 'minVisibility', label: 'Visibilidad mínima', help: 'Confianza mínima de cada articulación para analizarla.', type: 'range', min: 0.2, max: 0.9, step: 0.05 },
  { key: 'smoothing', label: 'Suavizado', help: 'Más alto = menos temblores pero más retraso.', type: 'range', min: 0, max: 0.9, step: 0.05 },
  {
    key: 'model', label: 'Modelo', help: 'Ligero = más rápido en móviles antiguos. Completo = más preciso.', type: 'select',
    options: [
      { value: 'full', label: 'Completo' },
      { value: 'lite', label: 'Ligero' },
    ],
  },
  { key: 'voice', label: 'Voz', help: 'Cuenta en voz alta y dice por qué una repetición no cuenta.', type: 'toggle' },
  { key: 'beep', label: 'Pitidos', help: 'Pitido agudo si cuenta, grave si no.', type: 'toggle' },
  { key: 'autoRecord', label: 'Grabar vídeo automáticamente', help: 'Empieza a grabar en cuanto enciendes la cámara. Los vídeos se guardan solo en este dispositivo (unos 15-20 MB por minuto).', type: 'toggle' },
  { key: 'showAngles', label: 'Mostrar ángulos', help: 'Muestra los ángulos medidos en pantalla, útil para ajustar los criterios.', type: 'toggle' },
];

/**
 * Every setting shown on the page: one section per exercise module (its own
 * fields plus the minimum eccentric time), then the general section.
 */
const SECTIONS: Section[] = [
  ...EXERCISE_IDS.map(getExercise).map((m) => ({
    id: m.id,
    title: `${m.icon} ${m.name}`,
    fields: [...m.fields, ...eccentricFields()] as unknown as Field[],
  })),
  { id: 'general', title: '⚙️ General', fields: GENERAL_FIELDS as unknown as Field[] },
];

/** Settings page, generated from `SECTIONS`. */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private svc = inject(SettingsService);
  readonly settings = this.svc.settings;
  readonly sections = SECTIONS;
  /** Section currently expanded. */
  readonly open = signal<SettingsSection>('squat');

  /** Current value of a setting. */
  value(section: SettingsSection, key: string): any {
    return (this.settings()[section] as unknown as Record<string, unknown>)[key];
  }

  /** Value with its unit for display (ratios as %). */
  display(section: SettingsSection, f: Field): string {
    const v = this.value(section, f.key) as number;
    if (f.unit === '%') return `${Math.round(v * 100)}%`;
    return `${v}${f.unit ?? ''}`;
  }

  /** Saves a value from a control (sliders give strings, stored as numbers). */
  set(section: SettingsSection, key: string, raw: string | boolean, f: Field): void {
    const v = f.type === 'range' ? Number(raw) : raw;
    this.svc.update(section, key as never, v);
  }

  /** Restores the defaults of a section. */
  reset(section: SettingsSection): void {
    this.svc.resetSection(section);
  }

  /** The field applies with the current values of its section. */
  shown(section: SettingsSection, f: Field): boolean {
    return !f.when || f.when(this.settings()[section] as unknown as Record<string, unknown>);
  }
}
