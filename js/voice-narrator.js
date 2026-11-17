// voice-narrator.js — Narration vocale (Web Speech API) avec segmentation
//
// Le narrateur sait speak() une phrase unitaire et signale la fin de la
// prononciation. Le moteur de story s'en sert pour enchainer les "cues" :
// chaque phrase de la narration est prononcee, et l'action visuelle
// correspondante est declenchee en parallele.

export class VoiceNarrator {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voice = null;
    this.speaking = false;
    this.enabled = true;
    this._initVoice();
  }

  _initVoice() {
    if (!this.synth) return;
    const setVoice = () => {
      const voices = this.synth.getVoices();
      if (!voices.length) return;
      // Priorite : voix Google FR > voix FR > premiere voix disponible.
      this.voice = voices.find(v => /^fr/i.test(v.lang) && /google/i.test(v.name)) ||
                   voices.find(v => /^fr/i.test(v.lang)) ||
                   voices.find(v => /^fr/i.test(v.lang)) ||
                   voices[0];
    };
    if (this.synth.getVoices().length > 0) setVoice();
    else this.synth.addEventListener?.('voiceschanged', setVoice);
  }

  /**
   * Prononce une phrase. onEnd est appele a la fin (ou en cas d'erreur).
   * Retourne une promesse resolue quand la phrase est terminee.
   */
  speak(text, onEnd) {
    if (!this.synth || !this.enabled || !text) {
      if (onEnd) onEnd();
      return Promise.resolve();
    }
    this.stop();
    this.speaking = true;

    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.speaking = false;
        if (onEnd) onEnd();
        resolve();
      };
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = this.voice;
        utterance.lang = this.voice?.lang || 'fr-FR';
        utterance.rate = 0.92;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.onend = finish;
        utterance.onerror = finish;
        this.synth.speak(utterance);
        // Filet de securite : si l'evenement onend n'arrive jamais
        // (certains navigateurs), on degage quand meme apres une duree estimee.
        const estimate = Math.max(2500, text.length * 62);
        setTimeout(finish, estimate + 4000);
      } catch (e) {
        console.warn('Narration impossible:', e);
        finish();
      }
    });
  }

  /** Interrompt la lecture en cours. */
  stop() {
    if (this.synth) {
      try { this.synth.cancel(); } catch (_) { /* ignore */ }
    }
    this.speaking = false;
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!v) this.stop();
  }

  isSpeaking() { return this.speaking; }
  isSupported() { return !!(window.speechSynthesis); }
  hasFrenchVoice() { return !!(this.voice && /^fr/i.test(this.voice.lang)); }
}

/**
 * Decoupe un texte de narration en phrases prononcables.
 * Les phrases trop courtes sont fusionnees pour une fluidite vocale.
 */
export function splitSentences(text) {
  if (!text) return [];
  const raw = String(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÿ0-9"«])/);
  const out = [];
  for (const s of raw) {
    const t = s.trim();
    if (!t) continue;
    if (out.length && t.length < 25) {
      out[out.length - 1] = out[out.length - 1] + ' ' + t;
    } else {
      out.push(t);
    }
  }
  return out;
}
