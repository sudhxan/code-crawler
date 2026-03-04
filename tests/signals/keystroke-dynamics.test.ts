import { describe, it, expect, beforeEach } from 'vitest';
import { KeystrokeDynamics } from '../../src/signals/keystroke-dynamics.js';

describe('KeystrokeDynamics', () => {
  let kd: KeystrokeDynamics;

  beforeEach(() => {
    kd = new KeystrokeDynamics();
  });

  it('should score <= 0.3 for human typing with variable intervals', () => {
    let t = 1000;
    // Deterministic variable intervals simulating human typing
    const intervals = [90, 250, 120, 300, 80, 200, 150, 400, 100, 180,
                       220, 95, 350, 110, 270, 130, 310, 85, 190, 240,
                       105, 280, 140, 320, 88, 210, 160, 370, 115, 230];
    for (const gap of intervals) {
      t += gap;
      kd.recordEdit(t, 1);
    }
    expect(kd.getScore()).toBeLessThanOrEqual(0.3);
  });

  it('should score > 0.7 for AI-like large block inserts', () => {
    let t = 1000;
    for (let i = 0; i < 5; i++) {
      t += 500;
      kd.recordEdit(t, 100 + i * 10);
    }
    expect(kd.getScore()).toBeGreaterThan(0.7);
  });

  it('should have burst score < 0.3 for human burst typing', () => {
    let t = 1000;
    // Create 4 bursts of rapid edits with pauses between
    for (let burst = 0; burst < 4; burst++) {
      for (let i = 0; i < 5; i++) {
        t += 100; // rapid within burst
        kd.recordEdit(t, 1);
      }
      t += 3000; // pause between bursts
    }
    expect(kd.getBurstScore()).toBeLessThan(0.3);
  });

  it('should have burst score > 0.7 for steady large edits (no bursts)', () => {
    let t = 1000;
    for (let i = 0; i < 15; i++) {
      t += 2500; // steady pace, no bursts (gap > 2000, never < 500)
      kd.recordEdit(t, 50);
    }
    expect(kd.getBurstScore()).toBeGreaterThan(0.7);
  });

  it('should return 0.5 with insufficient data', () => {
    kd.recordEdit(1000, 1);
    kd.recordEdit(1200, 1);
    kd.recordEdit(1400, 1);
    expect(kd.getScore()).toBe(0.5);
  });

  it('should return moderate score for mixed session', () => {
    let t = 1000;
    // Some human-like typing
    for (let i = 0; i < 10; i++) {
      t += 150;
      kd.recordEdit(t, 1);
    }
    // Some AI-like block inserts
    for (let i = 0; i < 5; i++) {
      t += 500;
      kd.recordEdit(t, 80);
    }
    const score = kd.getScore();
    // With mixed data, the single-char edits still exist with decent CV
    // Score should not be extreme
    expect(score).toBeGreaterThanOrEqual(0.1);
    expect(score).toBeLessThanOrEqual(0.9);
  });
});
