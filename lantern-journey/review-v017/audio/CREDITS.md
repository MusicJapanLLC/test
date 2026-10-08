# Lantern Journey audio v10

## Current BGM: user-provided full-length scores

These five WAVs were supplied by the game's owner for this project on 2026-10-05. They supersede all earlier scores for in-game BGM. Originals are unchanged. Distribution derivatives are stereo 44.1 kHz / 160 kbps MP3, normalized in two passes toward -18 LUFS with -2 dBTP ceiling. No melodies were synthesized or substituted.

| Supplied title | Derivative | Assignment | Duration |
|---|---|---|---|
| ホーム・灯の里 | tidebell-v10-home.mp3 | Title, home, equipment, growth, forge, result after fanfare | 205 s |
| 通常戦闘 | tidebell-v10-battle.mp3 | Waves 1–2 | 219.2 s |
| 強敵感 | tidebell-v10-stageboss.mp3 | Wave 3 of stages 1–2 in each chapter | 212.2 s |
| 章ボス A｜感情爆発型 | tidebell-v10-chapterboss.mp3 | Wave 3 of stage 3 in each chapter | 172.4 s |
| 王道冒険 | tidebell-v10-map.mp3 | Destination / quest selection | 189.16 s |

Long BGM uses streaming HTMLAudioElements connected to the Web Audio music bus, not five decoded full-length PCM buffers. Scene changes crossfade for 1.6 s. Near the end of a track, a second instance starts from the beginning and fades across the seam. This softens the original whole-track ending/start boundary; it is not a bespoke musically edited seamless arrangement. Loading failures remain visible through audio diagnostics and a player notice. BGM tempo is unchanged at 2× combat speed. Dialogue and finishers duck music; music, effects and ambience have separate sliders. Backgrounding suspends audio and cancels pending effects.

The older compositions below are retained as historical project assets; they are no longer selected as BGM. Their sampled magic/victory cues remain active and require the attributions below.

# Historical sampled audio v06

The three music tracks are original compositions created for this project. They
are rendered from actual sampled instruments rather than oscillators. The hosted
OGG files and MP3 fallbacks are bundled beside this credit file; WAV masters
are development assets.

| Track | Duration | Meter | Arrangement |
|---|---:|---|---|
| town-lantern-harbor | 45 seconds | 6/8 | Flute, rolling harp, warm strings, cello |
| battle-daybreak-v07 | 50.53 seconds | 4/4 | Original clear flute melody, moving cello bass, rhythmic strings, harp and sampled percussion |
| boss-rising-lights-v07 | 48 seconds | 4/4 | Original heroic melody, articulated bass, string responses and percussion fills |

Percussion uses sampled taiko, timpani and woodblock. It is not an authentic
bodhran recording. These are Celtic-inspired original arrangements with sampled
GM instruments, not recordings of a live Celtic ensemble.

## Required sample credit

The sample publisher's README explicitly identifies FluidR3 material as CC BY
3.0 US. Its repository-level MIT license is not treated as replacing the sample
license. Carry the following credit into the game's audio credits:

> Music: original Lantern Journey compositions, arranged and rendered for this
> project using FluidR3 General MIDI soundfont samples from
> gleitz/midi-js-soundfonts. FluidR3 soundfont by Frank Wen; browser sample
> renderings by Benjamin Gleitzman. Samples: CC BY 3.0 US.
> https://github.com/gleitz/midi-js-soundfonts
> https://creativecommons.org/licenses/by/3.0/us/
> Changes: selected notes, pitch adjustment where needed, original sequencing,
> amplitude envelopes, stereo placement, filtering and room reverb.

Primary sample-publisher source:
https://github.com/gleitz/midi-js-soundfonts/blob/gh-pages/README.md

## Original sampled magic cues

`sfx/magic-healing` (1.1 seconds), `magic-light-mark` (0.65 seconds),
`magic-ultimate` (1.6 seconds), and `magic-victory` (2.1 seconds) are original
layered cue arrangements using the same selected FluidR3 samples. Healing uses
a warm harp flourish and quiet flute overtone; light mark uses a harp ripple;
ultimate adds a charging string swell, sampled drum impact at 0.62 seconds, and
a bright harp/fiddle chord; victory uses a gentle harp/flute cadence. Their
sample attribution is the CC BY 3.0 credit above. They are supplied as WAV, OGG
and MP3. `render_magic_cues.py` reproduces them.

## Genuine foley / interface assets

This audio directory contains 12 original Kenney OGG sounds, a Kenney UI click converted from
the WAV mirror, and artisticdude's bow recording. Each also has an MP3 fallback.

| Files | Creator | License | Primary source |
|---|---|---|---|
| knifeSlice, knifeSlice2, chop, footstep00, footstep01, handleCoins2, metalClick | Kenney | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| footstep_wood_000, footstep_wood_001, impactMetal_medium_000, impactPunch_heavy_000, impactGeneric_light_000 | Kenney | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| ui-click1 | Kenney | CC0 1.0 | https://kenney.nl/assets/ui-audio |
| Bow | artisticdude, submitted by Ogrebane | CC0 chosen from offered licenses | https://opengameart.org/content/battle-sound-effects |

Retrieved from the public mirrors
https://github.com/Mcamento8/open-game-sfx-index and
https://github.com/Calinou/kenney-ui-audio. Licenses were checked against the
creator / original publication pages. CC0 attribution is optional; the above
credits are supplied for provenance. `source/kenney-manifest.json` records the
mirror file names and GitHub blob SHAs.

## Original synthesized ambience

This audio directory has 45-second stereo coastal surf, forest canopy and campfire hearth
loops. These are original procedural synthesis, not field recordings. The forest
bird calls are synthesized. No third-party environmental recording is used.

## Reproduction and integration

`compose_original_scores.py` creates the original MIDI scores.
`render_sampled_scores.py` renders them with the selected sample JSON banks.
`render_ambiences.py` creates the atmospheric loops. Requirements: Python, NumPy,
SciPy and ffmpeg. No FluidSynth dependency is needed for this renderer.

Music WAV loop boundaries have zero sample mismatch after a 4 ms seam correction.
Percussion / reverb tails wrap into the start of each loop. MP3 encoding can add
padding; OGG or decoded WAV is preferred for exact loops. Start background
music after the user's Play action, route everything through the game's master
gain and honor its mute control. Suggested starting gains: music 0.3, ambience
0.1, footstep 0.25, combat 0.55, interface 0.3.


Version 0.7 battle/boss scores are new original major-key adventure arrangements. No commercial-game melody or named-composer style is reproduced. The FluidR3 CC BY attribution and listed modifications above apply. compose_v07.py and the original MIDI scores are retained in scripts/audio-source.

## 0.8 HOME — 朝の窓灯り / Windows in the Morning

Original G-major 4/4 theme, 108 BPM, 71.111 seconds: flute, harp, warm strings, cello bass and light sampled taiko/woodblock percussion. Sample recordings: FluidR3 GM by Frank Wen, rendered samples by Benjamin Gleitzman, CC BY 3.0 US as above. Changes include resampling, note envelopes, stereo placement, filters, room echoes and gain. No quoted melody. OGG verification: −18.66 LUFS, −8.98 dBTP, no clipping. Source/MIDI: scripts/audio-source/home-v08 and scripts/audio-source/scores.

## v0.12 combat layers
Eight stereo cues (`v12-*`) combine existing credited foley / FluidR3-derived samples with original filtered-noise transients, pitch layering and short stereo delays. Source and levels: `scripts/audio/build-v12.py`, `src/audio/v12-levels.json`. Original BGM supplied by Music Japan is unchanged. FluidR3-derived layers retain the attribution and CC BY 3.0 notice above.

## v0.13 interface and performance mix
Six cues (`v13-ui`, `v13-ward`, `v13-heal`, `v13-summon`, `v13-legend`, `v13-clear`) use the existing credited Kenney and FluidR3-derived material, pitch/time layering, equal-power stereo placement, filtered transients and short reflections. Script: `scripts/audio/build-v13.py`; levels: `src/audio/v13-levels.json`. The sample license and attribution above remain applicable. No SUNO tracks were generated or used.


## v0.17 performed Japanese voices
48 distinct recordings: 少年元気 / 少女元気め
フリーボイス素材屋すぱらんど。/すぱるな瀟洒
https://soalunashosya.jimdofree.com/
https://soalunashosya.jimdofree.com/利用規約/
Commercial game incorporation and editing permitted (terms 2026-04-30); standalone redistribution and AI training prohibited. Trimmed silence, gain normalization, edge fades only. No voice cloning or pitch changes.

36 v0.17 SE and 4 procedural ambience clips: original DSP combined with existing credited CC0 Foley.
