// Generador de sonidos sintéticos sutiles usando Web Audio API
// No requiere descargar archivos mp3 externos, funciona offline y con latencia cero

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Tono sutil ascendente cuando entra una nueva orden abierta en proceso (IN_PROGRESS)
 */
export function playNewTradeSound(force = false) {
  try {
    const globalEnabled = localStorage.getItem('p2p_sound_alerts_enabled') !== 'false';
    const specificEnabled = localStorage.getItem('p2p_sound_new_order_enabled') !== 'false';
    if (!force && (!globalEnabled || !specificEnabled)) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Arpegio ascendente suave (587Hz -> 880Hz / D5 -> A5)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.15);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Si el navegador bloquea audio antes de interacción del usuario
  }
}

/**
 * Tono armónico agradable de éxito cuando una orden se completa (COMPLETED)
 */
export function playCompletedTradeSound(force = false) {
  try {
    const globalEnabled = localStorage.getItem('p2p_sound_alerts_enabled') !== 'false';
    const specificEnabled = localStorage.getItem('p2p_sound_completed_order_enabled') !== 'false';
    if (!force && (!globalEnabled || !specificEnabled)) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Doble campana armónica (A5 y E6)
    [880.0, 1318.51].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  } catch {
    // Silencio seguro ante restricciones de autoplay
  }
}
