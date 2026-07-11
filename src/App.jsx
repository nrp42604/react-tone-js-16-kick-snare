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

    const limiter = new Tone.Limiter(-10).toDestination();
    const compressor = new Tone.Compressor({
      threshold: -34,
      ratio: 1.7,
      attack: 0.08,
      release: 0.48,
    }).connect(limiter);
    const dryBus = new Tone.Gain(0.56).connect(compressor);
    const ambience = new Tone.Reverb({
      decay: 5.6,
      preDelay: 0.045,
      wet: 0.58,
    }).connect(compressor);
    const ambienceSend = new Tone.Gain(0.3).connect(ambience);

    // 短い紙片や水滴のような粒だけを受け持つ、控えめなグリッチ層。
    const grainVoices = Array.from({ length: 12 }, () => new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.002, decay: 0.065, sustain: 0, release: 0.07 },
      volume: -22,
    }));
    const grainFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: 1100,
      Q: 0.82,
    });
    const grainCrusher = new Tone.BitCrusher({
      bits: 5,
      wet: 0.52,
    });
    const grainDelay = new Tone.FeedbackDelay({
      delayTime: Tone.Time('64n').toSeconds(),
      feedback: 0.16,
      wet: 0.34,
    });
    const grainGain = new Tone.Gain(0.34).connect(compressor);

    // 残光の層。純音に近い柔らかな粒を長い空間へ溶かす。
    const droplet = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.22, decay: 1.2, sustain: 0.12, release: 5.4 },
    });
    droplet.volume.value = -32;
    const dropletFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 2200,
      rolloff: -24,
      Q: 0.42,
    });
    const dropletDelay = new Tone.PingPongDelay({
      delayTime: Tone.Time('8n.').toSeconds(),
      feedback: 0.19,
      wet: 0.54,
    });
    const chordReverb = new Tone.Reverb({
      decay: 10.5,
      preDelay: 0.12,
      wet: 0.76,
    }).connect(compressor);

    // 空気の膜の層。輪郭を持たない低いノイズがゆっくり開いて閉じる。
    const airBed = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.32, decay: 1.1, sustain: 0.04, release: 1.45 },
      volume: -34,
    });
    const airBedFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: 560,
      Q: 0.36,
    });
    const airBedGain = new Tone.Gain(0.46).connect(compressor);

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.018,
      octaves: 1.7,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.32, sustain: 0, release: 0.16 },
      volume: -15,
    });
    const kickSub = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.14 },
    });
    kickSub.volume.value = -20;
    const kickFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 185,
      rolloff: -24,
      Q: 0.58,
    });
    const kickDrive = new Tone.Distortion({
      distortion: 0.08,
      oversample: '2x',
      wet: 0.24,
    });

    const bass = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.028, decay: 0.24, sustain: 0.18, release: 0.78 },
    });
    bass.volume.value = -21;
    const bassFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 245,
      rolloff: -24,
      Q: 0.46,
    });
    const bassDrive = new Tone.Distortion({
      distortion: 0.022,
      oversample: '2x',
      wet: 0.1,
    });
    const bassAmbience = new Tone.Gain(0.09).connect(ambience);

    const snareVoices = Array.from({ length: 4 }, () => new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.045, decay: 0.54, sustain: 0, release: 0.42 },
      volume: -25,
    }));
    const snareBody = new Tone.Filter({
      type: 'bandpass',
      frequency: 980,
      Q: 0.55,
    });
    const snareSoftener = new Tone.Filter({
      type: 'lowpass',
      frequency: 2600,
      rolloff: -24,
    });

    const hatVoices = Array.from({ length: 4 }, () => new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.026, decay: 0.18, sustain: 0.01, release: 0.26 },
      volume: -30,
    }));
    const hatAir = new Tone.Filter({
      type: 'highpass',
      frequency: 1600,
      rolloff: -12,
      Q: 0.35,
    });
    const hatSoftener = new Tone.Filter({
      type: 'lowpass',
      frequency: 4200,
      rolloff: -24,
    });
    const breathLfo = new Tone.LFO({
      frequency: 0.025,
      min: 95,
      max: 150,
    }).start();
    const paperLfo = new Tone.LFO({
      frequency: 0.017,
      min: 760,
      max: 1180,
    }).start();
    const airLfo = new Tone.LFO({
      frequency: 0.021,
      min: 3100,
      max: 4700,
    }).start();

    kick.connect(kickFilter);
    kickSub.connect(kickFilter);
    kickFilter.connect(kickDrive);
    kickDrive.connect(dryBus);
    kickDrive.connect(ambienceSend);

    bass.connect(bassFilter);
    bassFilter.connect(bassDrive);
    bassDrive.connect(dryBus);
    bassDrive.connect(bassAmbience);

    snareVoices.forEach((voice) => voice.connect(snareBody));
    snareBody.connect(snareSoftener);
    snareSoftener.connect(dryBus);
    snareSoftener.connect(ambienceSend);

    hatVoices.forEach((voice) => voice.connect(hatAir));
    hatAir.connect(hatSoftener);
    hatSoftener.connect(dryBus);
    hatSoftener.connect(ambienceSend);

    grainVoices.forEach((voice) => voice.connect(grainFilter));
    grainFilter.connect(grainCrusher);
    grainCrusher.connect(grainDelay);
    grainDelay.connect(grainGain);
    grainDelay.connect(ambienceSend);

    droplet.connect(dropletFilter);
    dropletFilter.connect(dropletDelay);
    dropletDelay.connect(chordReverb);
    dropletDelay.connect(dryBus);

    airBed.connect(airBedFilter);
    airBedFilter.connect(airBedGain);
    airBedFilter.connect(ambienceSend);

    breathLfo.connect(kickFilter.frequency);
    paperLfo.connect(snareBody.frequency);
    airLfo.connect(hatSoftener.frequency);

    synthsRef.current = {
      Kick: kick,
      Bass: bass,
      Snare: snareVoices,
      'Hi-Hat': hatVoices,
      effects: [
        kickFilter,
        kickSub,
        kickDrive,
        bass,
        bassFilter,
        bassDrive,
        bassAmbience,
        snareBody,
        snareSoftener,
        hatAir,
        hatSoftener,
        breathLfo,
        paperLfo,
        airLfo,
        ...grainVoices,
        grainFilter,
        grainCrusher,
        grainDelay,
        grainGain,
        droplet,
        dropletFilter,
        dropletDelay,
        chordReverb,
        airBed,
        airBedFilter,
        airBedGain,
        ambienceSend,
        ambience,
        dryBus,
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
          '8n',
          time + timingFor('Kick'),
          Math.min(0.48, kickVelocity * 0.5),
        );
        kickSub.triggerAttackRelease(
          'C1',
          '8n',
          time + timingFor('Kick'),
          Math.min(0.32, kickVelocity * 0.32),
        );
      }
      if (activePattern.Snare[step]) {
        snareVoices[step % snareVoices.length].triggerAttackRelease(
          0.42,
          time + timingFor('Snare'),
          Math.min(0.34, velocityFor('Snare') * 0.4),
        );
      }
      if (activePattern['Hi-Hat'][step]) {
        hatVoices[step % hatVoices.length].triggerAttackRelease(
          0.18,
          time + timingFor('Hi-Hat'),
          Math.max(0.12, velocityFor('Hi-Hat') * 0.3),
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
          duration: fragment.duration ?? 0.04,
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
          stepDuration * (event.length ?? 0.72),
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
      kickSub.dispose();
      kickFilter.dispose();
      kickDrive.dispose();
      bass.dispose();
      bassFilter.dispose();
      bassDrive.dispose();
      bassAmbience.dispose();
      snareVoices.forEach((voice) => voice.dispose());
      snareBody.dispose();
      snareSoftener.dispose();
      hatVoices.forEach((voice) => voice.dispose());
      hatAir.dispose();
      hatSoftener.dispose();
      breathLfo.dispose();
      paperLfo.dispose();
      airLfo.dispose();
      grainVoices.forEach((voice) => voice.dispose());
      grainFilter.dispose();
      grainCrusher.dispose();
      grainDelay.dispose();
      grainGain.dispose();
      droplet.dispose();
      dropletFilter.dispose();
      dropletDelay.dispose();
      chordReverb.dispose();
      airBed.dispose();
      airBedFilter.dispose();
      airBedGain.dispose();
      ambienceSend.dispose();
      ambience.dispose();
      dryBus.dispose();
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
