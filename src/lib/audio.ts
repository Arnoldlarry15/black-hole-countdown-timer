export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  rumbleSource: AudioBufferSourceNode | null = null;
  rumbleFilter: BiquadFilterNode;
  rumbleGain: GainNode;
  
  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.rumbleFilter = this.ctx.createBiquadFilter();
    this.rumbleFilter.type = 'lowpass';
    this.rumbleFilter.frequency.value = 80;

    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0;

    this.rumbleFilter.connect(this.rumbleGain);
    this.rumbleGain.connect(this.masterGain);
  }

  async init() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    // Restore master volume if silenced previously
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; 
    }

    this.rumbleSource = this.ctx.createBufferSource();
    this.rumbleSource.buffer = buffer;
    this.rumbleSource.loop = true;
    this.rumbleSource.connect(this.rumbleFilter);
    this.rumbleSource.start();
  }

  update(progress: number) {
    if (this.ctx.state === 'suspended') return;
    const time = this.ctx.currentTime;
    
    const freq = 80 + Math.pow(progress, 3) * 2000;
    const vol = 0.5 + Math.pow(progress, 2) * 1.5;
    
    this.rumbleFilter.frequency.setTargetAtTime(freq, time, 0.1);
    this.rumbleGain.gain.setTargetAtTime(vol, time, 0.1);
  }

  playTick(progress: number) {
    if (this.ctx.state === 'suspended') return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const baseFreq = 800 - Math.pow(progress, 2) * 500;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq / 2, time + 0.1);

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  playCrossing() {
    if (this.ctx.state === 'suspended') return;
    const time = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(10, time + 1.5);

    gain.gain.setValueAtTime(2.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 1.5);

    if (this.rumbleSource) {
      this.rumbleSource.stop(time);
      this.rumbleSource.disconnect();
      this.rumbleSource = null;
    }
  }

  silence() {
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
  }
}
