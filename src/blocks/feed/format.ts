// Длительность заполнения в виде «3:24» — так она стоит на эталоне ленты и карточки.
// Формат один на оба экрана: два разных вида одной величины читаются как две величины.

const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_S = 3600;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Секунды отбрасываются вниз: 59,9 с — это ещё «0:59», а не «1:00».
 * Часы появляются только когда они есть: «61:00» вместо «1:01:00» читается как секунды.
 * Отрицательного времени не бывает, но часы устройства сотрудника сервером не сверены,
 * поэтому отрицательный вход даёт «0:00», а не «-1:-5».
 */
export function formatDuration(durationMs: number): string {
  const total = Math.max(0, Math.floor(durationMs / SECOND_MS));
  const seconds = total % MINUTE_S;
  const minutes = Math.floor(total / MINUTE_S) % MINUTE_S;
  const hours = Math.floor(total / HOUR_S);

  if (hours === 0) return `${String(minutes)}:${pad(seconds)}`;
  return `${String(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
