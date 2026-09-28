/**
 * Battle sounds, synthesized with Web Audio: no audio files. Each sound is rate-limited so a big
 * fight stays a rumble rather than a wall of noise, and panned by where it happens on screen.
 */

export type SoundName =
  | 'melee'
  | 'whoosh'
  | 'gun'
  | 'energy'
  | 'thud'
  | 'boom'
  | 'spawn'
  | 'death'
  | 'special'
  | 'advance'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'denied';

/** Minimum seconds between two plays of the same sound. */
const THROTTLE: Record<SoundName, number> = {
  melee: 0.045,
  whoosh: 0.05,
  gun: 0.04,
  energy: 0.05,
  thud: 0.06,
  boom: 0.08,
  spawn: 0.05,
  death: 0.07,
  special: 0.5,
  advance: 0.5,
  victory: 1,
  defeat: 1,
  click: 0.03,
  denied: 0.1,
};

const MASTER = 0.32;

interface Play {
  /** -1 (left) to 1 (right). */
  pan?: number;
  volume?: number;
}

export class GameAudio {
  #context: AudioContext | null = null;
  #master: GainNode | null = null;
  #noise: AudioBuffer | null = null;
  #last = new Map<SoundName, number>();
  #enabled: boolean;

  constructor(enabled: boolean) {
    this.#enabled = enabled;
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (enabled) void this.#ensure()?.resume();
  }

  /** Call from a click or key press: browsers only start audio after one. */
  unlock(): void {
    if (this.#enabled) void this.#ensure()?.resume();
  }

  suspend(): void {
    void this.#context?.suspend();
  }

  resume(): void {
    if (this.#enabled) void this.#context?.resume();
  }

  close(): void {
    void this.#context?.close();
    this.#context = null;
  }

  #ensure(): AudioContext | null {
    if (this.#context) return this.#context;
    if (typeof AudioContext === 'undefined') return null;
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = MASTER;
    master.connect(context.destination);
    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
    this.#context = context;
    this.#master = master;
    this.#noise = noise;
    return context;
  }

  play(name: SoundName, { pan = 0, volume = 1 }: Play = {}): void {
    if (!this.#enabled) return;
    const context = this.#ensure();
    const master = this.#master;
    if (!context || !master || context.state !== 'running') return;
    const now = context.currentTime;
    if (now - (this.#last.get(name) ?? -1) < THROTTLE[name]) return;
    this.#last.set(name, now);

    const out = context.createStereoPanner();
    out.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(master);
    const v = volume;

    switch (name) {
      case 'melee':
        this.#noise_(
          out,
          now,
          { type: 'bandpass', frequency: 1500 + Math.random() * 600, q: 1.2 },
          0.07,
          0.5 * v,
        );
        this.#tone(out, now, 'triangle', 220, 140, 0.06, 0.12 * v);
        break;
      case 'whoosh':
        this.#noise_(out, now, { type: 'highpass', frequency: 2400, q: 0.7 }, 0.12, 0.22 * v);
        break;
      case 'gun':
        this.#noise_(out, now, { type: 'bandpass', frequency: 1100, q: 0.8 }, 0.06, 0.45 * v);
        this.#tone(out, now, 'sine', 140, 55, 0.09, 0.3 * v);
        break;
      case 'energy':
        this.#tone(out, now, 'square', 1300, 320, 0.13, 0.07 * v);
        this.#tone(out, now, 'sine', 900, 200, 0.16, 0.12 * v);
        break;
      case 'thud':
        this.#noise_(out, now, { type: 'lowpass', frequency: 600, q: 0.7 }, 0.12, 0.4 * v);
        break;
      case 'boom':
        this.#noise_(out, now, { type: 'lowpass', frequency: 420, q: 0.6 }, 0.5, 0.7 * v);
        this.#tone(out, now, 'sine', 90, 38, 0.45, 0.45 * v);
        break;
      case 'spawn':
        this.#tone(out, now, 'triangle', 520, 700, 0.07, 0.1 * v);
        break;
      case 'death':
        this.#tone(out, now, 'sine', 320, 110, 0.22, 0.14 * v);
        break;
      case 'special':
        this.#noise_(out, now, { type: 'lowpass', frequency: 260, q: 0.5 }, 1.6, 0.6 * v, 0.25);
        this.#tone(out, now, 'sawtooth', 110, 440, 0.9, 0.05 * v, 0.1);
        break;
      case 'advance':
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
          this.#tone(out, now + index * 0.09, 'triangle', frequency, frequency, 0.5, 0.16 * v);
        });
        break;
      case 'victory':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
          this.#tone(out, now + index * 0.12, 'triangle', frequency, frequency, 0.9, 0.18 * v);
        });
        break;
      case 'defeat':
        [392, 349.23, 311.13, 261.63].forEach((frequency, index) => {
          this.#tone(out, now + index * 0.22, 'sine', frequency, frequency * 0.98, 0.7, 0.2 * v);
        });
        break;
      case 'click':
        this.#tone(out, now, 'triangle', 880, 880, 0.04, 0.08 * v);
        break;
      case 'denied':
        this.#tone(out, now, 'square', 140, 110, 0.14, 0.06 * v);
        break;
    }
  }

  /** An oscillator sweep with a click-free envelope. */
  #tone(
    out: AudioNode,
    at: number,
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    volume: number,
    attack = 0.005,
  ) {
    const context = this.#context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + duration);
    // Starting from silence avoids a click on the first sample.
    envelope.gain.value = 0;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope).connect(out);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  #noise_(
    out: AudioNode,
    at: number,
    filter: { type: BiquadFilterType; frequency: number; q: number },
    duration: number,
    volume: number,
    attack = 0.003,
  ) {
    const context = this.#context;
    if (!context || !this.#noise) return;
    const source = context.createBufferSource();
    source.buffer = this.#noise;
    source.loop = true;
    const shaping = context.createBiquadFilter();
    shaping.type = filter.type;
    shaping.frequency.value = filter.frequency;
    shaping.Q.value = filter.q;
    const envelope = context.createGain();
    envelope.gain.value = 0;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(shaping).connect(envelope).connect(out);
    source.start(at, Math.random() * 0.5);
    source.stop(at + duration + 0.02);
  }
}
