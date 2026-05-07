import test from "node:test";
import assert from "node:assert/strict";
import { AUDIO_CONFIG, REQUIRED_SFX_ROLES, validateAudioConfig } from "../client/src/audio/audioConfig.js";
import { createDefaultAudioSettings, loadAudioSettings, patchAudioSettings, saveAudioSettings } from "../client/src/audio/audioSettings.js";

test("audio config contains every required SFX role and valid tuning", () => {
  assert.deepEqual(validateAudioConfig(AUDIO_CONFIG), []);
  for (const role of REQUIRED_SFX_ROLES) {
    assert.equal(typeof AUDIO_CONFIG.assets.sfx[role], "string");
    assert.ok(AUDIO_CONFIG.assets.sfx[role].startsWith("/assets/audio/sfx/"));
    assert.ok(AUDIO_CONFIG.sfx[role].gain >= 0);
    assert.ok(AUDIO_CONFIG.sfx[role].gain <= 1);
  }
});

test("audio mix priorities keep major events above spammy events", () => {
  const priority = AUDIO_CONFIG.sfxRules.priority;
  assert.ok(priority.alphaDestroy > priority.death);
  assert.ok(priority.death > priority.destroyTank);
  assert.ok(priority.destroyTank > priority.hitTank);
  assert.ok(priority.hitTank > priority.fire);
  assert.ok(priority.fire > priority.uiClick);
  assert.ok(AUDIO_CONFIG.sfxRules.roleGain.alphaDestroyMin > 0);
  assert.ok(AUDIO_CONFIG.sfxRules.roleGain.alphaDestroyMin < 1);
  assert.ok(AUDIO_CONFIG.sfxRules.feedbackProfiles.heavy.gainMultiplier > 1);
  assert.ok(AUDIO_CONFIG.sfxRules.feedbackProfiles.storm.cooldownMs > AUDIO_CONFIG.sfxRules.feedbackProfiles.rapid.cooldownMs);
});

test("audio settings sanitize, persist, and clamp values", () => {
  const storage = createMemoryStorage();
  const defaults = createDefaultAudioSettings(AUDIO_CONFIG);
  assert.equal(defaults.masterVolume, AUDIO_CONFIG.engine.masterDefault);

  const patched = patchAudioSettings(defaults, {
    masterVolume: 2,
    musicVolume: -1,
    sfxEnabled: false
  });
  assert.equal(patched.masterVolume, 1);
  assert.equal(patched.musicVolume, 0);
  assert.equal(patched.sfxEnabled, false);

  saveAudioSettings(patched, storage, AUDIO_CONFIG);
  const loaded = loadAudioSettings(storage, AUDIO_CONFIG);
  assert.equal(loaded.masterVolume, 1);
  assert.equal(loaded.musicVolume, 0);
  assert.equal(loaded.sfxEnabled, false);
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}
