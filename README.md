# VDP33: vocoder / strings / human voice / organ for Schwung

A sound-generator module for [Schwung](https://github.com/charlesvestal/schwung)
(Ableton Move), laid out like the **Behringer VC340** (a clone of the Roland
VP-330 "Vocoder Plus") with the extras of the **Roland RS-09**: a paraphonic
divide-down keyboard feeding **Strings**, **Human Voice**, an **Organ** and a
**10-band Vocoder**, with Ensemble, Vibrato and Pitch Shift.
Repository: <https://github.com/CairnDebil/schwung-vdp33>.

Everything is written from scratch. There is no code, sample or ROM from any
original instrument. All DSP is in one C file, `src/dsp/vdp33.c`.

## What is new in 0.4: a new look, an equalizer and a reverb

* **Equalizer** (`EQ Low`, `EQ Mid`, `EQ High`): a low shelf at 120 Hz, a broad
  bell at 1 kHz and a high shelf at 6 kHz, +-12 dB each, flat in the middle.
  A flat band is skipped, so a flat equalizer is bit-for-bit transparent.
* **Reverb** (`Reverb Mix`, `Reverb Size`, `Reverb Damping`): a small stereo
  Schroeder/Freeverb-style room (eight combs and four allpasses per side, the
  right side slightly longer). Mix 0 is off and clears the tail. Size gives a
  60 dB decay of about 0.6 s to 4 s; Damping darkens the tail.
* Both sit after Master Tone and before the output limiter, and like Master
  Tone and Volume they **survive a preset change**. The Roland originals have
  neither, so the corner frequencies and scalings are simple choices, not
  measurements. New on-screen page *EQ and Reverb*, and two presets that use
  them: *Hall Strings* and *Valley Choir* (26 in all).
* **A new look for the editor and the manual**, drawn from scratch: see *Look*
  below.

## What came in 0.3: the Roland RS-09

Version 0.3 adds what the **Roland RS-09** has beyond the VP-330, and corrects
three points against the VP-330 owner's manual.

| RS-09 feature | In VDP33 |
|---|---|
| Organ with 8' / 4' / 2' / 1' squares, Tone I / II, Ensemble switch | `Organ Level`, `Organ Keys`, `Organ Feet 8' 4' 2' 1'`, `Organ Tone`, `Organ Ensemble` |
| Strings 8' and 4' registers | `Strings Register`: VP-330 (original mix), 8', 4', 8' + 4' |
| Ensemble Mode I / II | `Ensemble Mode`: Standard, I Dynamic, II Natural |
| Release Mode I / II, Release pedal | `Release Mode`: Free, I Wait, II Hold; `Pedal (CC 64)` = Release |
| Legato attack | `Attack on Legato`: Each key / First key |
| Ext In through the ensemble | `Ext In to Ensemble` (the Move audio input; shares `Mic Level`) |
| Tone, 442 Hz reference, vibrato switches | `Master Tone`, `Reference A`, `Vibrato on Strings`, `Vibrato on Organ` |

Nine presets (`RS ...`, numbers 15 to 23) show them. The first fifteen presets and
the old parameters are unchanged, and a state saved by 0.2 loads with the new
parameters at neutral values (Release Mode defaults to Free).

**Corrected from the VP-330 owner's manual** (these replace earlier estimates):

* pitch shift reaches Strings, Voice and Organ, not only Voice and Vocoder;
* Tune is +/-50 cents (it was +/-1 semitone);
* Vocoder Hold freezes the ten band levels. The old behaviour stays as the
  `Gate` setting of `Pedal (CC 64)`; `Hold` is the new true hold.

## Web editor and manual

* **Editor:** `src/web/web_ui.html` is shipped with the module as `web_ui.html`.
  With VDP33 in a slot, open Schwung Manager (`http://move.local:7700`) ->
  *Remote UI*. The page is the instrument itself, drawn as a piece of hardware
  inspired by the VP-330 and the RS-09: routed park-sign end cheeks, a
  granite-grey panel with webbing strips, gear-tag section headers, anodised
  slider caps and knobs, tablet switches with LEDs, an amber preset display in
  a hazard-striped frame, and a 44-key keyboard on which the split point and
  the sections assigned to the lower and upper halves are drawn. Every
  parameter is there, plus one scope that draws the three Release Modes and
  another that draws the equalizer curve and the reverb decay. Changes go
  both ways.
* **Demo without a Move:** `docs/editor.html` is the same page. It has a rough
  on-screen keyboard that approximates Organ and Strings in the browser (Human
  Voice and Vocoder are silent there).
* **Manual:** `docs/index.html`, with a picture of the instrument (`docs/screens/instrument.png`). Publish `docs/` with GitHub Pages
  (*Settings -> Pages -> Deploy from branch -> main, /docs*) to get
  `https://cairndebil.github.io/schwung-vdp33/` and `.../editor.html`.
* **Look:** a loud 1970s exploitation-film poster (one flat signal yellow,
  black block lettering, halftone, a starburst) crossed with a Californian
  climbing-valley trail guide (contour lines, routed signs, webbing, anodised
  gear, decorative route grades such as 5.10a) and the banded-sky outdoor
  label. It is an homage in spirit only: the lettering, starburst, ridge
  pennant and contour art are all drawn for this module, and no film title,
  still, logo or brand mark is reproduced. The instrument carries no Roland
  artwork. Colours of the section strips on the panel are the colours of the
  headings in the manual.
* The parameter table, the preset list and the version in both pages are
  generated from the C source by `python3 scripts/gen_web.py` (run by
  `scripts/build.sh`; `--check` fails if they are out of date).

## Panel map

The controls follow the VC340 Quick Start Guide (numbers are the guide's) and the
VP-330 owner's manual.

| VC340 section | VDP33 parameters |
|---|---|
| **Balance** (6-8): Direct Mic, Human Voice, Strings. There is no vocoder fader | Direct Mic, Human Voice Level, Strings Level, Organ Level, Volume |
| **Vocoder** (12-16): Tone, Mic Level, Lower, Upper, Ensemble | Vocoder Tone, Mic Level, Vocoder Keys (Off / Lower / Upper / All), Vocoder Ensemble |
| **Human Voice** (17-22): Male 8' Lower, Male 4' Lower, Male 8' Upper, Female 4' Upper, Ensemble, Attack | four on/off switches with the same names, Voice Ensemble, Voice Attack |
| **Strings** (24-27): Attack, Tone, Lower, Upper | Strings Attack, Strings Tone, Strings Keys, Strings Register |
| **Release** (23): one fader for all sections | Release, Release Mode |
| **Vibrato** (9-11): Rate, Delay Time, Depth | Vibrato Rate / Delay / Depth |
| **Pitch Shift** (31-34): Auto / Manual / Off (pedal), Down-Normal, Pitch Set, Time | Pitch Shift Mode, Pitch Down, Pitch Set, Pitch Shift Time |
| Tune (29), keyboard split, velocity (Fixed / Dynamic) | Tune, Split Point, Velocity |
| Footswitches: Vocoder Hold, Pitch Shift | MIDI CC 64 and CC 66 |

Signal flow:

```
 keys -> oscillator banks S (strings), V (voice + vocoder), O (organ): tune, bend, pitch shift
         vibrato: always on V; on S and O by switch
      -> octave dividers -> 16' / 8' / 4' registers (organ: 8' / 4' / 2' / 1' squares), phase-locked
      -> per-key attack/release envelopes (Release Mode: Free / I Wait / II Hold)

 Strings   -> register, Tone low-pass -------------------------+ (Ensemble always on)
 Organ     -> feet, Tone I / II --------> Ensemble (switch) ---+
 Male/Female formant choirs -----------> Ensemble (switch) ----+--> Master Tone
                                                                     -> EQ (3 bands) -> Reverb -> out
 Vocoder carrier x 10 bands of mic/line-in -> Tone -> Ensemble (switch)
 Ext In -> Ensemble (level) ; Direct Mic ----------------------+
```

* **Paraphonic divide-down**: every note of a pitch class comes from one master
  oscillator through octave dividers (32.32 fixed-point phase), so notes are
  phase-locked as on the original. Waveforms are band-limited (PolyBLEP).
* **Pitch Shift**: in *Auto*, every key press drops the pitch by the Pitch Set
  amount and it glides back up over Time. *Manual* holds a static shift from the
  Pitch Down control. *Off/Pedal* does nothing unless CC 66 is held, then it
  behaves like Auto.
* **Pedal (CC 64)**: Off, Gate (the vocoder sounds only while the pedal is
  down), Hold (freeze the band levels) or Release (release is zero while the
  pedal is up).
* Attack and Release at 0 mean no delay, as the manual specifies.

## Install

Requirements: a Move with Schwung installed (see the Schwung installer), and
Docker (or an `aarch64-linux-gnu-` toolchain) to build.

```bash
bash scripts/build.sh      # -> dist/vdp33/ and dist/vdp33-module.tar.gz
```

Then install the module in one of two ways:

* **Schwung Manager** (`http://move.local:7700`): *Modules* -> install a custom
  module from a GitHub URL **or a tarball**, and give it
  `dist/vdp33-module.tar.gz`.
* **SSH**: `bash scripts/install.sh` copies `dist/vdp33/` to
  `/data/UserData/schwung/modules/sound_generators/vdp33/` on `move.local`.

Restart the Move afterwards: Schwung may keep running an older copy of a module
it had already loaded.

## Try it on the Move

1. Open a slot: hold `Track 1-4` for half a second (or `Shift+Vol` + `Track 1-4`).
2. Put **VDP33** in the sound-generator position of the chain.
3. Wire the MIDI: on the Move track set **MIDI Out** to a channel 1-4 and make
   sure the slot's **Receive Ch** is the same number (usually automatic). Load an
   empty Drum Rack on that Move track so the native sound does not double.
4. Play the pads. The first preset, *Strings*, needs no microphone.
5. For the vocoder, plug in headphones or a line-in cable, pick the *Vocoder*
   preset and speak. To see the cost of the module on the device use
   Schwung Manager -> *System* -> *Open CPU view* (the frame budget is the
   figure that matters).

> **Vocoder input.** The modulator is the Move audio input, as for Schwung's
> own Line In modules. With the built-in speakers active and no line-in cable,
> Schwung's feedback guard bypasses the slot (a **B** appears) and shows a
> "Feedback Risk" notice. Plug in headphones or a cable and it re-enables on its
> own; `Mute` + jog-click un-bypasses it if you really want it live.

The screen has ten pages (Main, Balance, Keyboard, Organ, Strings, Envelope,
Ensemble, Vibrato, Pitch, EQ and Reverb) of up to eight knobs. 26 factory presets cover strings,
choirs, vocoder, split layouts, pitch dives, the RS-09 organ and string
registers, and two with reverb. MP3 renders of all of them are in `demo/`.

## What the manuals confirm, and what is an estimate

**Confirmed by the VC340 Quick Start Guide, the VP-330 owner's manual and the
RS-09 manual:** the section structure; the four Human Voice switches; one shared
Release; separate Attack for Human Voice and Strings; Tone on Strings and
Vocoder; vibrato on Vocoder and Human Voice; Ensemble switches; the three Pitch
Shift modes and that shift reaches all sections; Tune of +/-50 cents; Vocoder
Hold; velocity Fixed / Dynamic; Lower / Upper split; footswitches; and, from the
RS-09, the organ feet, string registers, ensemble and release modes, release
pedal, legato attack, Ext In through the ensemble, Tone and 442 Hz reference.

**Estimates, not measured from hardware:**

* centre frequencies and Q of the ten vocoder bands (about half-octave spacing);
* harmonic mix of the 16' / 8' / 4' registers, the strings register weights, Tone
  filter ranges, the organ foot weights and the two organ tone filters;
* choir formant frequencies (typical male and female /a/ values);
* Ensemble delay times and LFO rates, and how Modes I and II scale them;
  attack / release / pitch-shift time ranges, vibrato depth, the maximum Pitch
  Set shift (12 semitones);
* **what Release Mode I and II mean.** The RS-09 manual's wording is ambiguous.
  VDP33 implements I as *Wait* (a new note waits until the old tail is below
  about -35 dB when no key is held) and II as *Hold* (a replayed key gets a new
  voice, the old tail runs on). *Free* is the pre-0.3 behaviour and the default;
* **Strings always go through the Ensemble** (the manuals have no Strings
  Ensemble switch).

**Additions that are not on the originals** (defaults keep them neutral):
Sibilance, Ensemble Depth / Speed, Bend Range, Organ Keys zone, Free release mode.

**Not modelled:** the Gate Out and Organ Raw Out jacks, the L/M/H output switch,
a second input (the Move has one, so Ext In is the vocoder modulator and shares
Mic Level), SysEx, analog drift and component tolerances, BBD companding noise.

If you can measure a unit, the constants worth adjusting first are `k_band_hz`
and `BAND_Q`, the register mix in `vdp_render`, the formant tables and the
ensemble constants; they are isolated and commented.

## Test

```bash
bash scripts/test.sh                  # native DSP test, renders tests/demo/*.wav
python3 scripts/gen_web.py --check    # editor and manual match the C source
node tests/web_test.mjs               # editor and manual in a browser (Playwright + Chrome)
```

The native test renders every preset (WAV files in `tests/demo/`) with a
synthetic vowel sequence as the vocoder modulator, and checks pitch accuracy,
levels, vocoder tracking, Vocoder Hold and Gate, Direct Mic, zones, the four
Human Voice switches, formants, vibrato, Pitch Shift in all modes and sections,
Tune and bend, velocity, organ feet and tone, strings registers, release modes,
legato attack, the release pedal, ensemble modes, Ext In, master tone, the equalizer, the reverb, state
round-trip and compatibility with 0.2 states, JSON, and CPU load (about 7 % of
one desktop core for 24 keys with everything on). The browser test drives the
editor in demo mode and with a mocked Schwung remote, and checks that its
presets match the engine's. `web_test.mjs --shots` refreshes `docs/screens/`.
GitHub Actions runs all three on every push.

## Licence

MIT, (c) 2026 CairnDebil. See `LICENSE` and `NOTICE`. "VP-330", "RS-09",
"SH-1" and "Vocoder Plus" are trademarks of Roland Corporation; "VC340" of Music
Tribe / Behringer. They are used only to
describe the sound this module is modelled on; this project is not affiliated
with either company.
