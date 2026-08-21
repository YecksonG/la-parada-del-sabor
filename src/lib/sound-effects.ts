"use client";

// Web Audio API Synthesizer - 100% nativo, sin dependencias ni archivos de audio externos
class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("parada-sound");
      this.enabled = stored !== "disabled";
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggleSound(): boolean {
    this.enabled = !this.enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("parada-sound", this.enabled ? "enabled" : "disabled");
    }
    if (this.enabled) {
      this.playPop();
    }
    return this.enabled;
  }

  // Sonido 1: Pop / Click elástico al tocar un producto o extra
  public playPop() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(420, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(860, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      // Audio context ignore
    }
  }

  // Sonido 2: Campana de Cocina "Ding" al enviar la comanda
  public playKitchenBell() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Armónico 1 (Campana principal)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1760, now); // A6
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      // Armónico 2 (Brillo metálico)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(3520, now);
      gain2.gain.setValueAtTime(0.15, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.5);
    } catch (e) {}
  }

  // Sonido 3: Caja Registradora / Monedas (Chime al facturar con éxito)
  public playCashRegister() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6 (Acorde alegre)

      notes.forEach((freq, index) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        const startTime = now + index * 0.06;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch (e) {}
  }

  // Sonido 4: Descartar / Restar item
  public playDelete() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  }
}

export const sounds = new SoundEngine();
