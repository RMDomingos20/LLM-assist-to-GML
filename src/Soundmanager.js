// ============================================================================
// GERENCIADOR DE SONS DA INTERFACE — GML Assistant
// ============================================================================

class SoundManager {
  constructor() {
    this.volume = 0.5; // Padrão
  }

  /** Define o volume global (0.0 – 1.0) */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, parseFloat(v) || 0));
  }

  /** Reproduz um som pontual. Silenciosamente ignora erros. */
  play(name) {
    if (this.volume === 0) return;
    try {
      const audio = new Audio(`./sounds/${name}`);
      audio.volume = this.volume;
      audio.play().catch(() => {});
    } catch {}
  }

  /** Toca o som sutil de notificação informando que a IA começou a responder */
  startWritingSound() {
    // Toca como um "ping" único de notificação, com volume levemente menor
    if (this.volume === 0) return;
    try {
      const audio = new Audio('./sounds/IA_Writing_Sound.mp3');
      audio.volume = this.volume * 0.6; // Um pouco mais baixo para não assustar
      audio.play().catch(() => {});
    } catch {}
  }

  /** Como não é mais um loop, o stop não precisa fazer nada */
  stopWritingSound() {}
}

export const soundManager = new SoundManager();