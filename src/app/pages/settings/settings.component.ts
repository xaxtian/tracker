import { Component, inject, signal } from '@angular/core';
import { AppSettings, SettingsSection } from '../../models/types';
import { SettingsService } from '../../services/settings.service';

interface Field {
  key: string;
  label: string;
  help: string;
  type: 'range' | 'toggle' | 'select';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  /** Only show when this returns true. */
  when?: (s: AppSettings) => boolean;
}

/** "Minimum eccentric time" fields, identical for every exercise. */
function eccentricFields(section: 'squat' | 'pushup' | 'pullup'): Field[] {
  return [
    { key: 'checkEccentric', label: 'Exigir bajada controlada', help: 'Invalida la repetición si la fase excéntrica (la bajada) dura menos del tiempo mínimo.', type: 'toggle' },
    { key: 'minEccentricSec', label: 'Tiempo mínimo de bajada', help: 'Duración mínima de la fase excéntrica.', type: 'range', min: 0.3, max: 6, step: 0.1, unit: ' s', when: (s) => s[section].checkEccentric },
  ];
}

interface Section {
  id: SettingsSection;
  title: string;
  fields: Field[];
}

const SECTIONS: Section[] = [
  {
    id: 'squat',
    title: '🏋️ Sentadillas',
    fields: [
      { key: 'topKneeAngle', label: 'Extensión arriba', help: 'Ángulo de rodilla mínimo para considerar que estás de pie del todo.', type: 'range', min: 140, max: 180, step: 1, unit: '°' },
      {
        key: 'depthMode', label: 'Criterio de profundidad', help: 'Cómo se decide que has bajado lo suficiente.', type: 'select',
        options: [
          { value: 'hipBelowKnee', label: 'Cadera por debajo de la rodilla' },
          { value: 'kneeAngle', label: 'Ángulo de rodilla' },
        ],
      },
      { key: 'depthOffset', label: 'Margen de profundidad', help: 'Positivo = más exigente (cadera más baja que la rodilla). Negativo = más permisivo. En % de la longitud del muslo.', type: 'range', min: -0.3, max: 0.3, step: 0.01, unit: '%', when: (s) => s.squat.depthMode === 'hipBelowKnee' },
      { key: 'bottomKneeAngle', label: 'Ángulo de rodilla abajo', help: 'La rodilla tiene que cerrarse al menos hasta este ángulo.', type: 'range', min: 50, max: 130, step: 1, unit: '°', when: (s) => s.squat.depthMode === 'kneeAngle' },
      { key: 'maxTorsoLean', label: 'Inclinación máxima del tronco', help: 'Ángulo máximo del tronco respecto a la vertical.', type: 'range', min: 20, max: 80, step: 1, unit: '°' },
      { key: 'checkHeels', label: 'Comprobar talones', help: 'Invalida la repetición si levantas los talones. Necesita buena visibilidad de los pies.', type: 'toggle' },
      { key: 'heelTolerance', label: 'Tolerancia de talones', help: 'Cuánto se pueden levantar los talones, en % de la longitud de la espinilla.', type: 'range', min: 0.02, max: 0.3, step: 0.01, unit: '%', when: (s) => s.squat.checkHeels },
      ...eccentricFields('squat'),
    ],
  },
  {
    id: 'pushup',
    title: '💪 Flexiones',
    fields: [
      { key: 'topElbowAngle', label: 'Extensión arriba', help: 'Ángulo de codo mínimo con los brazos estirados.', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
      { key: 'bottomElbowAngle', label: 'Ángulo de codo abajo', help: 'El codo tiene que cerrarse al menos hasta este ángulo. Más bajo = más exigente.', type: 'range', min: 45, max: 120, step: 1, unit: '°' },
      { key: 'minBodyLineAngle', label: 'Cuerpo recto (hombro-cadera-tobillo)', help: 'Por debajo de este ángulo se considera cadera caída o levantada.', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
      { key: 'minKneeAngle', label: 'Rodillas estiradas', help: 'Ángulo de rodilla mínimo.', type: 'range', min: 120, max: 180, step: 1, unit: '°' },
      ...eccentricFields('pushup'),
    ],
  },
  {
    id: 'pullup',
    title: '🧗 Dominadas',
    fields: [
      { key: 'hangElbowAngle', label: 'Colgado completo', help: 'Ángulo de codo mínimo abajo (brazos estirados).', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
      { key: 'chinMargin', label: 'Altura de la barbilla', help: 'Cuánto tiene que pasar la boca por encima de las manos. 0 = a la altura de las manos. Positivo = más exigente. En % del tronco.', type: 'range', min: -0.2, max: 0.3, step: 0.01, unit: '%' },
      { key: 'maxHipSwing', label: 'Balanceo máximo', help: 'Desplazamiento horizontal máximo de la cadera, en % del tronco.', type: 'range', min: 0.05, max: 1, step: 0.01, unit: '%' },
      { key: 'maxKneeAngleChange', label: 'Movimiento máximo de rodillas', help: 'Cambio máximo del ángulo de rodilla durante la repetición (detecta kipping).', type: 'range', min: 10, max: 120, step: 1, unit: '°' },
      ...eccentricFields('pullup'),
    ],
  },
  {
    id: 'general',
    title: '⚙️ General',
    fields: [
      { key: 'userHeightCm', label: 'Tu altura', help: 'Se usa para convertir el movimiento a metros por segundo. Cuanto más exacta, más exacta la velocidad.', type: 'range', min: 120, max: 220, step: 1, unit: ' cm' },
      { key: 'highFps', label: 'Cámara a 60 fps', help: 'Pide 60 imágenes por segundo si la cámara lo permite: tiempos y velocidades más precisos, pero más batería. Se aplica al encender la cámara.', type: 'toggle' },
      { key: 'restTimeoutSec', label: 'Descanso para cerrar serie', help: 'Segundos sin repeticiones para dar la serie por terminada (sentadillas; en flexiones se usa el triple). En dominadas la serie termina al bajarte de la barra.', type: 'range', min: 3, max: 60, step: 1, unit: ' s' },
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
    ],
  },
];

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private svc = inject(SettingsService);
  readonly settings = this.svc.settings;
  readonly sections = SECTIONS;
  readonly open = signal<SettingsSection>('squat');

  value(section: SettingsSection, key: string): any {
    return (this.settings()[section] as unknown as Record<string, unknown>)[key];
  }

  display(section: SettingsSection, f: Field): string {
    const v = this.value(section, f.key) as number;
    if (f.unit === '%') return `${Math.round(v * 100)}%`;
    return `${v}${f.unit ?? ''}`;
  }

  set(section: SettingsSection, key: string, raw: string | boolean, f: Field): void {
    const v = f.type === 'range' ? Number(raw) : raw;
    this.svc.update(section, key as never, v);
  }

  reset(section: SettingsSection): void {
    this.svc.resetSection(section);
  }
}
