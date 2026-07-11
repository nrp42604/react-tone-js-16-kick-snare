import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { evolvePattern, seededPattern, STEPS, TRACKS } from './pattern.js';

const KNOBS = ['Drift', 'Bloom', 'Mist', 'Pulse', 'Orbit', 'Decay', 'Density', 'Light'];

function App() {
  const [pattern, setPattern] = useState(() =>
    seededPattern(Math.floor(Math.random() * 2 ** 32)),
  );
  const [bpm, setBpm] = useState(84);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const patternRef = useRef(pattern);
  const synthsRef = useRef(null);
  const stepRef = useRef(0);
  const cycleRef = useRef(0);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    const transport = Tone.getTransport();

    const limiter = new Tone.Limiter(-8).toDestination();
    const compressor = new Tone.Compressor({
      threshold: -26,
      ratio: 1.35,
      attack: 0.035,
      release: 0.22,
    }).connect(limiter);
    const masterSaturation = new Tone.Distortion({
      distortion: 0.025,
      oversample: '2x',
      wet: 0.12,
    }).connect(compressor);
    const masterLowCut = new Tone.Filter({
      type: 'highpass',
      frequency: 25,
      rolloff: -24,
      Q: 0.3,
    }).connect(masterSaturation);
    const dryBus = new Tone.Gain(0.76).connect(masterLowCut);
    const ambienceReturn = new Tone.Gain(0.2).connect(masterLowCut);
    const ambience = new Tone.Reverb({
      decay: 4.2,
      preDelay: 0.038,
      wet: 1,
    }).connect(ambienceReturn);
    const kickSend = new Tone.Gain(0.035).connect(ambience);
    const percussionSend = new Tone.Gain(0.085).connect(ambience);
    const hatSend = new Tone.Gain(0.055).connect(ambience);
    const glitchSend = new Tone.Gain(0.1).connect(ambience);
    const bassSend = new Tone.Gain(0.035).connect(ambience);

    // 白色ノイズを極短エンベロープで切り出す、精密な粒子グリッチ層。
    const grainVoices = Array.from({ length: 12 }, () => new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.0005, decay: 0.018, sustain: 0, release: 0.01 },
      volume: -26,
    }));
    const grainFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: 1100,
      Q: 1.65,
    });
    const grainCrusher = new Tone.BitCrusher({
      bits: 4,
      wet: 0.24,
    });
    const grainDelay = new Tone.FeedbackDelay({
      delayTime: Tone.Time('128n').toSeconds(),
      feedback: 0.09,
      wet: 0.14,
    });
    const grainGain = new Tone.Gain(0.38).connect(dryBus);

    // 残光の層。純音に近い柔らかな粒を長い空間へ溶かす。
    const droplet = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.14, decay: 0.8, sustain: 0.08, release: 4.2 },
    });
    droplet.volume.value = -34;
    const dropletFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 1850,
      rolloff: -24,
      Q: 0.42,
    });
    const dropletDelay = new Tone.PingPongDelay({
      delayTime: Tone.Time('8n.').toSeconds(),
      feedback: 0.16,
      wet: 0.36,
    });
    const chordReverb = new Tone.Reverb({
      decay: 8.2,
      preDelay: 0.09,
      wet: 1,
    });
    const chordDry = new Tone.Gain(0.2).connect(dryBus);
    const chordReturn = new Tone.Gain(0.18).connect(masterLowCut);
    chordReverb.connect(chordReturn);

    // 空気の膜の層。輪郭を持たない低いノイズがゆっくり開いて閉じる。
    const airBed = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.18, decay: 0.72, sustain: 0.02, release: 1.1 },
      volume: -38,
    });
    const airBedFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: 820,
      Q: 0.5,
    });
    const airBedGain = new Tone.Gain(0.28).connect(ambience);

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.024,
      octaves: 2.25,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.17, sustain: 0, release: 0.055 },
      volume: -16,
    });
    const kickClicks = Array.from({ length: 4 }, () => new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.0005, decay: 0.007, sustain: 0, release: 0.004 },
      volume: -38,
    }));
    const kickClickHighPass = new Tone.Filter({
      type: 'highpass',
      frequency: 1800,
      rolloff: -24,
      Q: 0.6,
    });
    const kickClickLowPass = new Tone.Filter({
      type: 'lowpass',
      frequency: 6200,
      rolloff: -24,
    });
    const kickFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 175,
      rolloff: -24,
      Q: 0.48,
    });
    const kickLowCut = new Tone.Filter({
      type: 'highpass',
      frequency: 29,
      rolloff: -24,
      Q: 0.3,
    });
    const kickDrive = new Tone.Distortion({
      distortion: 0.065,
      oversample: '2x',
      wet: 0.18,
    });

    const bass = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.004, decay: 0.11, sustain: 0.04, release: 0.17 },
    });
    bass.volume.value = -20;
    const bassFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 340,
      rolloff: -24,
      Q: 0.62,
    });
    const bassLowCut = new Tone.Filter({
      type: 'highpass',
      frequency: 38,
      rolloff: -24,
      Q: 0.3,
    });
    const bassDrive = new Tone.Distortion({
      distortion: 0.035,
      oversample: '2x',
      wet: 0.14,
    });

    const snareVoices = Array.from({ length: 4 }, () => new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.085, sustain: 0, release: 0.028 },
      volume: -27,
    }));
    const percussionFm = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.72,
      modulationIndex: 2.4,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.025 },
      modulationEnvelope: { attack: 0.001, decay: 0.032, sustain: 0, release: 0.018 },
    });
    percussionFm.volume.value = -34;
    const snareBody = new Tone.Filter({
      type: 'bandpass',
      frequency: 1450,
      Q: 1.05,
    });
    const snareSoftener = new Tone.Filter({
      type: 'lowpass',
      frequency: 4800,
      rolloff: -24,
    });

    const hatVoices = Array.from({ length: 4 }, () => new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.042, sustain: 0, release: 0.018 },
      volume: -32,
    }));
    const hatAir = new Tone.Filter({
      type: 'highpass',
      frequency: 3300,
      rolloff: -24,
      Q: 0.42,
    });
    const hatSoftener = new Tone.Filter({
      type: 'lowpass',
      frequency: 8200,
      rolloff: -24,
    });

    kick.connect(kickFilter);
    kickFilter.connect(kickLowCut);
    kickLowCut.connect(kickDrive);
    kickDrive.connect(dryBus);
    kickDrive.connect(kickSend);
    kickClicks.forEach((voice) => voice.connect(kickClickHighPass));
    kickClickHighPass.connect(kickClickLowPass);
    kickClickLowPass.connect(dryBus);

    bass.connect(bassFilter);
    bassFilter.connect(bassLowCut);
    bassLowCut.connect(bassDrive);
    bassDrive.connect(dryBus);
    bassDrive.connect(bassSend);

    snareVoices.forEach((voice) => voice.connect(snareBody));
    percussionFm.connect(snareBody);
    snareBody.connect(snareSoftener);
    snareSoftener.connect(dryBus);
    snareSoftener.connect(percussionSend);

    hatVoices.forEach((voice) => voice.connect(hatAir));
    hatAir.connect(hatSoftener);
    hatSoftener.connect(dryBus);
    hatSoftener.connect(hatSend);

    grainVoices.forEach((voice) => voice.connect(grainFilter));
    grainFilter.connect(grainCrusher);
    grainCrusher.connect(grainDelay);
    grainDelay.connect(grainGain);
    grainDelay.connect(glitchSend);

    droplet.connect(dropletFilter);
    dropletFilter.connect(dropletDelay);
    dropletDelay.connect(chordReverb);
    dropletDelay.connect(chordDry);

    airBed.connect(airBedFilter);
    airBedFilter.connect(airBedGain);

    synthsRef.current = {
      Kick: kick,
      Bass: bass,
      Snare: snareVoices,
      'Hi-Hat': hatVoices,
      effects: [
        kickFilter,
        kickLowCut,
        ...kickClicks,
        kickClickHighPass,
        kickClickLowPass,
        kickDrive,
        bass,
        bassFilter,
        bassLowCut,
        bassDrive,
        bassSend,
        percussionFm,
        snareBody,
        snareSoftener,
        hatAir,
        hatSoftener,
        ...grainVoices,
        grainFilter,
        grainCrusher,
        grainDelay,
        grainGain,
        droplet,
        dropletFilter,
        dropletDelay,
        chordReverb,
        chordDry,
        chordReturn,
        airBed,
        airBedFilter,
        airBedGain,
        kickSend,
        percussionSend,
        hatSend,
        glitchSend,
        ambience,
        ambienceReturn,
        dryBus,
        masterLowCut,
        masterSaturation,
        compressor,
        limiter,
      ],
    };

    const eventId = transport.scheduleRepeat((time) => {
      const step = stepRef.current;
      let activePattern = patternRef.current;

      // 一周ごとに前の状態を受け継いだ次の小節を生成する。
      // 見た目の16点は現在位置の表示にだけ使い、演奏内容は固定ループにしない。
      if (step === 0 && cycleRef.current > 0) {
        activePattern = evolvePattern(activePattern);
        patternRef.current = activePattern;
        Tone.getDraw().schedule(() => setPattern(activePattern), time);
      }

      const timingFor = (track) =>
        activePattern._timingByTrack?.[track]?.[step]
        ?? activePattern._timing?.[step]
        ?? 0;
      const velocityFor = (track) =>
        activePattern._velocity?.[track]?.[step]
        ?? activePattern._accent?.[step]
        ?? 0.7;

      if (activePattern.Kick[step]) {
        const kickVelocity = velocityFor('Kick');
        kick.triggerAttackRelease(
          'C1',
          0.14,
          time + timingFor('Kick'),
          Math.min(0.5, kickVelocity * 0.52),
        );
        kickClicks[step % kickClicks.length].triggerAttackRelease(
          0.009,
          time + timingFor('Kick'),
          Math.min(0.24, kickVelocity * 0.2),
        );
      }
      if (activePattern.Snare[step]) {
        const percussionTime = time + timingFor('Snare');
        const percussionVelocity = velocityFor('Snare');
        snareVoices[step % snareVoices.length].triggerAttackRelease(
          0.09,
          percussionTime,
          Math.min(0.38, percussionVelocity * 0.42),
        );
        percussionFm.triggerAttackRelease(
          step < 8 ? 'G4' : 'C5',
          0.052,
          percussionTime,
          Math.min(0.2, percussionVelocity * 0.2),
        );
      }
      if (activePattern['Hi-Hat'][step]) {
        hatVoices[step % hatVoices.length].triggerAttackRelease(
          0.045,
          time + timingFor('Hi-Hat'),
          Math.max(0.1, velocityFor('Hi-Hat') * 0.26),
        );
      }

      // 1ステップの内側に短い応答を置き、16分グリッドより細かなフレーズを作る。
      const stepDuration = 60 / transport.bpm.value / 4;
      const fragments = activePattern._fragments?.[step] ?? [];
      const grainEvents = [];
      fragments.forEach((fragment) => {
        const fragmentTime = time
          + stepDuration * fragment.offset
          + timingFor(fragment.source) * 0.45;
        const fragmentVelocity = fragment.level ?? 0.36;

        grainEvents.push({
          time: fragmentTime,
          duration: Math.min(fragment.duration ?? 0.02, 0.028),
          level: fragmentVelocity,
          frequency: fragment.frequency ?? 1100,
        });

      });

      // 16分の内側を8分割し、128分相当の短い粒を正確な位置へ置く。
      const fineDust = activePattern._dust?.[step] ?? [];
      const oneTwentyEighth = stepDuration / 8;
      fineDust.forEach((particle) => {
        const particleTime = time + stepDuration * particle.offset;
        grainEvents.push({
          time: particleTime,
          duration: oneTwentyEighth * (particle.durationRatio ?? 0.5),
          level: particle.level ?? 0.22,
          frequency: particle.frequency ?? 1680,
        });
      });

      // 同じ音源への予約は必ず時刻順に並べ、Tone.jsの時間軸衝突を避ける。
      grainEvents
        .sort((first, second) => first.time - second.time)
        .forEach((grainEvent, index) => {
          grainFilter.frequency.setValueAtTime(grainEvent.frequency, grainEvent.time);
          grainVoices[index % grainVoices.length].triggerAttackRelease(
            grainEvent.duration,
            grainEvent.time,
            grainEvent.level,
          );
        });

      const ambientEvents = activePattern._ambientLayers?.[step] ?? [];
      ambientEvents.forEach((event) => {
        if (event.kind === 'droplet') {
          droplet.triggerAttackRelease(
            event.chord ?? ['C3', 'G3', 'B3', 'D4', 'E4'],
            stepDuration * (event.length ?? 3.5),
            time,
            event.level ?? 0.24,
          );
        } else {
          airBedFilter.frequency.setValueAtTime(event.frequency ?? 560, time);
          airBed.triggerAttackRelease(
            stepDuration * (event.length ?? 6),
            time,
            event.level ?? 0.22,
          );
        }
      });

      const bassEvents = activePattern._bassLine?.[step] ?? [];
      bassEvents.forEach((event) => {
        bass.triggerAttackRelease(
          event.note ?? 'C2',
          Math.min(stepDuration * (event.length ?? 0.72), 0.19),
          time + timingFor('Kick') * 0.6,
          event.level ?? 0.48,
        );
      });

      Tone.getDraw().schedule(() => setCurrentStep(step), time);
      stepRef.current = (step + 1) % STEPS;
      if (step === STEPS - 1) cycleRef.current += 1;
    }, '16n');

    return () => {
      transport.stop();
      transport.clear(eventId);
      kick.dispose();
      kickClicks.forEach((voice) => voice.dispose());
      kickClickHighPass.dispose();
      kickClickLowPass.dispose();
      kickFilter.dispose();
      kickLowCut.dispose();
      kickDrive.dispose();
      bass.dispose();
      bassFilter.dispose();
      bassLowCut.dispose();
      bassDrive.dispose();
      bassSend.dispose();
      snareVoices.forEach((voice) => voice.dispose());
      percussionFm.dispose();
      snareBody.dispose();
      snareSoftener.dispose();
      hatVoices.forEach((voice) => voice.dispose());
      hatAir.dispose();
      hatSoftener.dispose();
      grainVoices.forEach((voice) => voice.dispose());
      grainFilter.dispose();
      grainCrusher.dispose();
      grainDelay.dispose();
      grainGain.dispose();
      droplet.dispose();
      dropletFilter.dispose();
      dropletDelay.dispose();
      chordReverb.dispose();
      chordDry.dispose();
      chordReturn.dispose();
      airBed.dispose();
      airBedFilter.dispose();
      airBedGain.dispose();
      kickSend.dispose();
      percussionSend.dispose();
      hatSend.dispose();
      glitchSend.dispose();
      ambience.dispose();
      ambienceReturn.dispose();
      dryBus.dispose();
      masterLowCut.dispose();
      masterSaturation.dispose();
      compressor.dispose();
      limiter.dispose();
    };
  }, []);

  const play = () => {
    setIsPlaying(true);
    const transport = Tone.getTransport();
    Tone.start()
      .then(() => {
        if (transport.state !== 'started') transport.start();
      })
      .catch((error) => {
        console.error('Audio could not start', error);
        stop();
      });
  };

  const stop = () => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    stepRef.current = 0;
    cycleRef.current = 0;
    setCurrentStep(-1);
    setIsPlaying(false);
  };

  const seed = () => {
    setPattern((previous) => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const nextSeed = Math.floor(Math.random() * 2 ** 32);
        const next = seededPattern(nextSeed);
        const isDifferent = TRACKS.some((track) =>
          next[track].some((active, step) => active !== previous[track][step]),
        );

        if (isDifferent) {
          patternRef.current = next;
          cycleRef.current = 0;
          return next;
        }
      }

      // 極めて稀に再生成が重なった場合も、Hi-Hatのゴーストを1つ変える。
      return {
        ...previous,
        'Hi-Hat': previous['Hi-Hat'].map((active, step) =>
          step === 15 ? !active : active,
        ),
      };
    });
  };

  return (
    <main className="instrument">
      <section className="panel" aria-label="Fluxus Orbit instrument">
        <header className="instrument-header">
          <p className="eyebrow">quiet generative instrument</p>
          <h1>Fluxus Orbit</h1>
        </header>

        <section className="controls" aria-label="Transport controls">
          <button type="button" onClick={play} disabled={isPlaying}>Play</button>
          <button type="button" onClick={stop} disabled={!isPlaying}>Stop</button>
          <button type="button" onClick={seed}>Seed</button>
          <label>
            BPM
            <input
              type="number"
              min="40"
              max="240"
              value={bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
            />
          </label>
        </section>

        <section className="knob-grid" aria-label="Fluxus Orbit controls">
          {KNOBS.map((name, index) => (
            <div className="knob-module" key={name}>
              <div
                className="knob"
                style={{ '--rotation': `${-132 + index * 23}deg` }}
                aria-hidden="true"
              >
                <span />
              </div>
              <p>{name}</p>
            </div>
          ))}
        </section>

        <section className="orbit-window" aria-label="Fluxus Orbit activity">
          <div className="orbit-core" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, step) => {
              const active = TRACKS.some((track) => pattern[track][step]);
              return (
                <span
                  key={step}
                  className={`${active ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
                  style={{ '--step': step }}
                />
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
