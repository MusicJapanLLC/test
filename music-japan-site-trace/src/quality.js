// Average delivered rAF cadence, measured in uninterrupted 2-second windows.
// Hidden/offscreen time must never enter the window (call reset on suspension).
export class QualityMonitor {
  constructor(onStep, onSample = () => {}) {
    this.onStep = onStep;
    this.onSample = onSample;
    this.stage = 0;
    this.reset();
  }
  reset() { this.start = null; this.frames = 0; }
  tick(now) {
    if (this.start === null) { this.start = now; return; }
    this.frames++;
    const duration = now - this.start;
    if (duration < 2000) return;
    const fps = this.frames * 1000 / duration;
    this.onSample(fps);
    if (fps < 45 && this.stage < 3) this.onStep(++this.stage);
    this.reset();
  }
}
