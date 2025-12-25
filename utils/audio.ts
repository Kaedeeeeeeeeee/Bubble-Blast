// Web Audio API Synthesizer for Neon Bubble Blast

class AudioController {
  private ctx: AudioContext | null = null;
  
  // Separate Gain Nodes for mixing
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  private isBgmPlaying: boolean = false;
  private bgmInterval: number | null = null;
  private beatCount: number = 0;

  // Volume state
  public currentSfxVol: number = 0.5;
  public currentBgmVol: number = 0.4;

  constructor() {
    // Lazy initialization
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create channel strips
      this.sfxGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      
      // Connect to output
      this.sfxGain.connect(this.ctx.destination);
      this.bgmGain.connect(this.ctx.destination);
      
      // Set initial volumes
      this.sfxGain.gain.value = this.currentSfxVol;
      this.bgmGain.gain.value = this.currentBgmVol;
    }
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setSFXVolume(value: number) {
    this.currentSfxVol = value;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }
  }

  public setBGMVolume(value: number) {
    this.currentBgmVol = value;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }
  }

  // --- SFX GENERATORS ---

  public playShoot() {
    this.init();
    if (this.currentSfxVol <= 0 || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain!); // Connect to SFX bus
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playPop(pitchMultiplier: number = 1) {
    this.init();
    if (this.currentSfxVol <= 0 || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Randomize pitch slightly for variety
    const baseFreq = 800 * pitchMultiplier + Math.random() * 100;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq + 300, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playExplosion() {
    this.init();
    if (this.currentSfxVol <= 0 || !this.ctx) return;
    const t = this.ctx.currentTime;
    
    // 1. Noise Burst
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    const noiseFilter = this.ctx.createBiquadFilter();
    
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1000, t);
    noiseFilter.frequency.linearRampToValueAtTime(100, t + 0.4);

    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain!);
    noise.start(t);

    // 2. Sub-bass drop
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(150, t);
    subOsc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    
    subGain.gain.setValueAtTime(0.8, t);
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain!);
    subOsc.start(t);
    subOsc.stop(t + 0.5);
  }

  public playLaserShoot() {
    this.init();
    if (this.currentSfxVol <= 0 || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);

    // Vibrato
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 50;
    lfoGain.gain.value = 500;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t+0.3);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playEquip() {
    this.init();
    if (this.currentSfxVol <= 0 || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.1);
    
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.1);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playSwap() {
    this.init();
    if (this.currentSfxVol <= 0 || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.05);
    
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.05);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.1);
  }
  
  public playGameOver() {
    this.init();
    if (this.currentSfxVol <= 0 || !this.ctx) return;
    const t = this.ctx.currentTime;
    
    const playNote = (freq: number, time: number) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.connect(gain);
        gain.connect(this.sfxGain!); // Game over is conceptually an SFX event
        osc.start(time);
        osc.stop(time + 0.5);
    }
    
    playNote(300, t);
    playNote(250, t + 0.3);
    playNote(200, t + 0.6);
    playNote(150, t + 0.9);
  }
  
  public playVictory() {
    this.init();
    if (this.currentSfxVol <= 0 || !this.ctx) return;
    const t = this.ctx.currentTime;
    const playNote = (freq: number, time: number) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(time);
        osc.stop(time + 0.2);
    }
    // Major Arpeggio
    playNote(523.25, t);       // C5
    playNote(659.25, t + 0.1); // E5
    playNote(783.99, t + 0.2); // G5
    playNote(1046.50, t + 0.3); // C6
  }

  // --- BGM SEQUENCER ---
  
  public startBGM() {
    this.init();
    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    this.beatCount = 0;

    // 120 BPM = 0.5s per beat, 0.25s per 8th note
    this.bgmInterval = window.setInterval(() => {
        if (!this.ctx) return;
        this.playSequencerStep();
    }, 250);
  }

  public stopBGM() {
    if (this.bgmInterval) {
        clearInterval(this.bgmInterval);
        this.bgmInterval = null;
    }
    this.isBgmPlaying = false;
  }

  private playSequencerStep() {
    if (!this.ctx || this.currentBgmVol <= 0) return;
    const t = this.ctx.currentTime;
    
    // Simple Cyberpunk Bassline (E - G - A - E)
    // 16 steps pattern
    const step = this.beatCount % 16;
    
    let freq = 0;
    // Root: E2 (82.41 Hz), G2 (98.00), A2 (110.00)
    
    if (step < 4) freq = 82.41;       // E
    else if (step < 8) freq = 98.00;  // G
    else if (step < 12) freq = 110.00;// A
    else freq = 82.41;                // E

    // Play Bass Note (Every off-beat for driving feel)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(500, t + 0.1);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.2);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain!); // Connect to BGM bus
    
    osc.start(t);
    osc.stop(t + 0.25);

    this.beatCount++;
  }
}

export const audio = new AudioController();
