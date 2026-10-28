import { EXERCISES } from '../../exercises';
import { RecordingMeta, VideoStoreService, fileExtension } from '../../services/video-store.service';

/** File name like `trackbody_sentadillas_2026-10-28_18-05.mp4`. */
export function recordingFileName(r: RecordingMeta): string {
  const d = new Date(r.start);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  // "Curl de bíceps" → "curl-de-biceps": no accents or spaces in file names.
  const name = (EXERCISES[r.exercise]?.name ?? r.exercise)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `trackbody_${name}_${stamp}.${fileExtension(r.mime)}`;
}

/** Downloads a recording through a temporary link. */
export async function downloadRecording(store: VideoStoreService, r: RecordingMeta, blob?: Blob): Promise<void> {
  blob ??= await store.getBlob(r);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = recordingFileName(r);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Uses the phone's share sheet (save to gallery, WhatsApp…) when available. */
export async function shareRecording(store: VideoStoreService, r: RecordingMeta, blob?: Blob): Promise<boolean> {
  blob ??= await store.getBlob(r);
  const file = new File([blob], recordingFileName(r), { type: blob.type || r.mime });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: `TrackBody · ${EXERCISES[r.exercise].name}` });
  } catch {
    /* user cancelled */
  }
  return true;
}

/** The browser can share video files (mobile share sheet). */
export function canShareFiles(): boolean {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'x.mp4', { type: 'video/mp4' })] });
  } catch {
    return false;
  }
}
