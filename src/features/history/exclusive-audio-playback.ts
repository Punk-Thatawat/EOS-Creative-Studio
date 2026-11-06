/** Pause other history players without resetting their playback positions. */
export function pauseOtherHistoryAudio<T extends Pick<HTMLAudioElement, "pause">>(
  players: Iterable<T>,
  current: T,
) {
  for (const player of players) {
    if (player !== current) player.pause();
  }
}
