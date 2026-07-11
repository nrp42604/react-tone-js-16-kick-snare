export const TRACKS = ['Kick', 'Snare', 'Hi-Hat'];
export const STEPS = 16;

export const makeEmptyPattern = () => ({
  ...Object.fromEntries(TRACKS.map((track) => [track, Array(STEPS).fill(false)])),
  _timing: Array(STEPS).fill(0),
  _accent: Array(STEPS).fill(0.8),
  _timingByTrack: Object.fromEntries(
    TRACKS.map((track) => [track, Array(STEPS).fill(0)]),
  ),
  _velocity: Object.fromEntries(
    TRACKS.map((track) => [track, Array(STEPS).fill(0.7)]),
  ),
  _seed: 1,
  _generation: 0,
  _phraseLength: 4,
  _breathPhase: 0,
  _fragments: Array.from({ length: STEPS }, () => []),
  _dust: Array.from({ length: STEPS }, () => []),
  _ambientLayers: Array.from({ length: STEPS }, () => []),
  _bassLine: Array.from({ length: STEPS }, () => []),
  _bassMotifIndex: 0,
});

const createRandom = (seed) => {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const pick = (items, random) => items[Math.floor(random() * items.length)];
const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

const HAT_MOTIFS = [
  [true, false, true, false, true, false, true, false],
  [false, false, true, false, false, false, true, false],
  [true, true, false, true, true, false, true, false],
  [true, false, true, true, false, true, false, true],
];

// 共通音を残しながらゆっくり移れる、開いたテンションコードの循環。
const HARMONY_CYCLE = [
  { name: 'Cmaj9', notes: ['C3', 'G3', 'B3', 'D4', 'E4'], bass: ['C2', 'G2', 'D3', 'C3'] },
  { name: 'Am9', notes: ['A2', 'E3', 'G3', 'B3', 'C4'], bass: ['A1', 'E2', 'B2', 'A2'] },
  { name: 'Fmaj9#11', notes: ['F2', 'C3', 'E3', 'G3', 'B3'], bass: ['F1', 'C2', 'G2', 'F2'] },
  { name: 'G13sus', notes: ['G2', 'D3', 'F3', 'A3', 'E4'], bass: ['G1', 'D2', 'A2', 'G2'] },
  { name: 'Dm11', notes: ['D3', 'A3', 'C4', 'E4', 'G4'], bass: ['D2', 'A2', 'E3', 'D3'] },
  { name: 'Em11', notes: ['E3', 'B3', 'D4', 'F#4', 'A4'], bass: ['E2', 'B2', 'F#3', 'E3'] },
];

const BASS_MOTIFS = [
  [0, 4, 9, 14],
  [0, 5, 10, 14],
  [0, 3, 8, 13],
  [0, 5, 9, 15],
];

const harmonyAt = (generation) =>
  HARMONY_CYCLE[Math.floor(generation / 2) % HARMONY_CYCLE.length];

const breakLongHatRuns = (hat) => {
  let run = 0;

  // ループの終端と先頭をまたぐ連打も含めて確認する。
  for (let cursor = 0; cursor < STEPS * 2; cursor += 1) {
    const step = cursor % STEPS;
    run = hat[step] ? run + 1 : 0;
    if (run >= 4) {
      hat[step] = false;
      run = 0;
    }
  }
};

const makeFragments = ({ random, generation, phraseLength, breathAt, pattern }) => {
  const fragments = Array.from({ length: STEPS }, () => []);
  const phrasePosition = generation % phraseLength;
  const phraseEdge = phrasePosition === phraseLength - 1;
  const smallTurn = generation > 0 && generation % 3 === 2;

  // 細かな断片は常駐させず、フレーズの折り返しや三小節目にだけ現れる。
  if (!phraseEdge && !smallTurn && random() > 0.16) return fragments;

  const activeHatSteps = pattern['Hi-Hat']
    .map((active, step) => (active && step % 4 !== 0 ? step : -1))
    .filter((step) => step >= 0);
  const activeSnareSteps = pattern.Snare
    .map((active, step) => (active ? step : -1))
    .filter((step) => step >= 0);
  const windows = phraseEdge ? (random() < 0.42 ? 2 : 1) : 1;

  for (let window = 0; window < windows; window += 1) {
    const source = random() < 0.76 || !activeSnareSteps.length ? 'Hi-Hat' : 'Snare';
    const candidates = source === 'Hi-Hat' ? activeHatSteps : activeSnareSteps;
    if (!candidates.length) continue;

    const step = pick(candidates, random);
    if (fragments[step].length) continue;

    const count = phraseEdge
      ? pick([2, 2, 3], random)
      : pick([1, 2], random);
    const offsets = count === 3 ? [0.24, 0.51, 0.79] : count === 2 ? [0.38, 0.73] : [0.62];

    fragments[step] = offsets.map((offset, index) => ({
      source,
      offset: clamp(offset + (random() - 0.5) * 0.09, 0.18, 0.88),
      level: clamp((source === 'Hi-Hat' ? 0.48 : 0.4) - index * 0.075 + breathAt(step) * 0.08, 0.24, 0.56),
      frequency: pick([640, 820, 1080, 1460, 1980, 2360], random),
      duration: pick([0.025, 0.035, 0.055, 0.075], random),
    }));
  }

  return fragments;
};

const makeFineDust = ({ random, generation, phraseLength, pattern }) => {
  const dust = Array.from({ length: STEPS }, () => []);
  const phrasePosition = generation % phraseLength;
  const phraseEdge = phrasePosition === phraseLength - 1;
  const rareTurn = generation > 0 && generation % 5 === 3;

  // 128分相当の粒は、フレーズ終端を中心に一箜所だけ置く。
  if ((!phraseEdge && !rareTurn) || random() > 0.82) return dust;

  const candidates = pattern['Hi-Hat']
    .map((active, step) => (active && step % 4 !== 0 ? step : -1))
    .filter((step) => step >= 0);
  const step = pick(candidates.length ? candidates : [3, 7, 11, 15], random);
  const grids = [
    [1, 3, 6],
    [1, 2, 5, 7],
    [1, 3, 4, 6, 7],
    [1, 2, 3, 5, 6, 7],
  ];
  const slots = pick(grids, random);

  dust[step] = slots.map((slot, index) => ({
    offset: slot / 8,
    level: clamp(0.32 - index * 0.026 + (random() - 0.5) * 0.05, 0.15, 0.34),
    frequency: pick([920, 1240, 1680, 2140, 2860], random),
    durationRatio: pick([0.38, 0.52, 0.68], random),
  }));

  return dust;
};

const makeAmbientLayers = ({ random, generation, phraseLength, breathAt }) => {
  const layers = Array.from({ length: STEPS }, () => []);
  const phrasePosition = generation % phraseLength;

  // 空気の膜は周期の始まり、残光は中盤にだけ現れる。
  if (generation === 0 || phrasePosition === 0) {
    const step = random() < 0.7 ? 0 : 8;
    layers[step].push({
      kind: 'air',
      length: pick([5, 6, 8], random),
      level: clamp(0.2 + breathAt(step) * 0.08, 0.18, 0.28),
      frequency: pick([420, 520, 680, 760], random),
    });
  }

  if (phrasePosition === Math.floor(phraseLength / 2) || (generation > 0 && generation % 5 === 1)) {
    const step = pick([2, 6, 10, 14], random);
    const harmony = harmonyAt(generation);
    layers[step].push({
      kind: 'droplet',
      chord: harmony.notes,
      harmony: harmony.name,
      length: pick([10, 12, 14], random),
      level: clamp(0.14 + breathAt(step) * 0.055, 0.13, 0.2),
    });
  }

  return layers;
};

const makeBassLine = ({ generation, phraseLength, breathAt, motifIndex }) => {
  const bassLine = Array.from({ length: STEPS }, () => []);
  const harmony = harmonyAt(generation);
  const motif = BASS_MOTIFS[motifIndex % BASS_MOTIFS.length];
  const phraseEnding = generation % phraseLength === phraseLength - 1;

  motif.forEach((step, index) => {
    // ルート → 5度 → ルート → オクターブを基本形とし、周期末だけ9度へ開く。
    const noteIndex = index === 0 ? 0 : index === 1 ? 1 : index === 2 ? 0 : phraseEnding ? 2 : 3;
    const length = index === 0 ? 1.18 : index === 3 ? 0.96 : 0.76;
    bassLine[step].push({
      note: harmony.bass[noteIndex],
      harmony: harmony.name,
      length,
      level: clamp(0.41 + breathAt(step) * 0.1 + (index === 0 ? 0.055 : 0), 0.4, 0.56),
    });
  });

  return bassLine;
};

export const seededPattern = (seed) => {
  const random = createRandom(seed);
  const chance = (probability) => random() < probability;
  const breathPhase = random() * Math.PI * 2;
  const breathAt = (step) =>
    0.5 + Math.sin(breathPhase + (step / STEPS) * Math.PI * 2) * 0.5;

  const kick = Array(STEPS).fill(false);
  const snare = Array(STEPS).fill(false);
  const hat = Array(STEPS).fill(false);

  // 拍の骨格。1拍目は固定し、残りは呼吸の波に沿って少し疎密をつける。
  kick[0] = true;
  kick[8] = chance(0.82);
  [4, 12].forEach((step) => {
    kick[step] = chance(0.46 + breathAt(step) * 0.28);
  });

  if (chance(0.34)) {
    const livingSteps = [6, 7, 10, 14, 15].filter((step) => breathAt(step) > 0.42);
    kick[pick(livingSteps.length ? livingSteps : [7, 15], random)] = true;
  }

  // 2拍目・4拍目の応答を維持し、ときどき16分だけ前後へ動かす。
  [4, 12].forEach((anchor) => {
    const offset = chance(0.16) ? pick([-1, 1], random) : 0;
    snare[anchor + offset] = true;
  });

  if (chance(0.24)) {
    const ghostSteps = [3, 5, 10, 11, 13, 15]
      .filter((step) => breathAt(step) > 0.5 && !snare[step]);
    if (ghostSteps.length) snare[pick(ghostSteps, random)] = true;
  }

  // 8ステップのモチーフを反復し、後半だけ1音変えて「記憶と変化」を作る。
  const motif = pick(HAT_MOTIFS, random);
  for (let step = 0; step < STEPS; step += 1) {
    hat[step] = motif[step % motif.length];
  }

  const mutationCandidates = Array.from({ length: 8 }, (_, index) => index + 8)
    .filter((step) => breathAt(step) > 0.28);
  const mutationStep = pick(mutationCandidates, random);
  hat[mutationStep] = !hat[mutationStep];

  if (chance(0.22)) {
    const softStep = pick([3, 7, 11, 15], random);
    hat[softStep] = breathAt(softStep) > 0.55;
  }

  breakLongHatRuns(hat);
  if (hat.filter(Boolean).length < 3) {
    [2, 6, 10, 14].forEach((step) => { hat[step] = true; });
  }
  for (const step of [15, 13, 11, 9, 7, 5, 3, 1]) {
    if (hat.filter(Boolean).length <= 9) break;
    hat[step] = false;
  }

  // 1周期で滑らかに戻る微細な遅れ（約1〜9ms）と強弱を全トラックで共有する。
  // 音同士のまとまりを保ちながら、機械的に等間隔な印象だけを和らげる。
  const timing = Array.from({ length: STEPS }, (_, step) => {
    const breath = breathAt(step);
    const pulseStability = step % 4 === 0 ? 0.55 : 1;
    const jitter = (random() - 0.5) * 0.0014;
    return clamp((0.002 + breath * 0.006) * pulseStability + jitter, 0.001, 0.009);
  });

  const accent = Array.from({ length: STEPS }, (_, step) => {
    const pulse = step % 4 === 0 ? 0.12 : step % 2 === 0 ? 0.05 : 0;
    const jitter = (random() - 0.5) * 0.06;
    return clamp(0.64 + breathAt(step) * 0.16 + pulse + jitter, 0.55, 0.96);
  });

  // 各層を完全に同時に鳴らさず、まとまりを壊さない範囲で前後関係を作る。
  // 偶数・奇数の固定スウィングではなく、呼吸曲線を使うことで周期感をぼかす。
  const timingByTrack = {
    Kick: timing.map((value, step) =>
      clamp(value * 0.36 + (step % 4 === 0 ? 0 : breathAt(step) * 0.0015), 0, 0.005),
    ),
    Snare: timing.map((value, step) =>
      clamp(value * 0.72 + breathAt(step) * 0.0026, 0.001, 0.009),
    ),
    'Hi-Hat': timing.map((value, step) => {
      const leaning = step % 2 === 1 ? 0.0035 : -0.0005;
      return clamp(value * 0.55 + leaning + breathAt(step) * 0.0018, 0, 0.011);
    }),
  };

  const velocity = {
    Kick: accent.map((value, step) =>
      clamp(value * (step === 0 ? 0.92 : 0.76), 0.48, 0.88),
    ),
    Snare: accent.map((value) => clamp(value * 0.72, 0.43, 0.74)),
    'Hi-Hat': accent.map((value, step) =>
      clamp(value * (step % 2 === 0 ? 0.58 : 0.46), 0.3, 0.62),
    ),
  };

  const phraseLength = pick([4, 4, 6, 8], random);
  const bassMotifIndex = Math.floor(random() * BASS_MOTIFS.length);
  const pattern = {
    Kick: kick,
    Snare: snare,
    'Hi-Hat': hat,
    _timing: timing,
    _accent: accent,
    _timingByTrack: timingByTrack,
    _velocity: velocity,
    _seed: seed >>> 0,
    _generation: 0,
    _phraseLength: phraseLength,
    _breathPhase: breathPhase,
    _bassMotifIndex: bassMotifIndex,
  };

  pattern._fragments = makeFragments({
    random,
    generation: 0,
    phraseLength,
    breathAt,
    pattern,
  });
  pattern._dust = makeFineDust({
    random,
    generation: 0,
    phraseLength,
    pattern,
  });
  pattern._ambientLayers = makeAmbientLayers({
    random,
    generation: 0,
    phraseLength,
    breathAt,
  });
  pattern._bassLine = makeBassLine({
    generation: 0,
    phraseLength,
    breathAt,
    motifIndex: bassMotifIndex,
  });
  return pattern;
};

const copyTrack = (track) => [...track];

const keepDensity = (track, minimum, maximum, protectedSteps = []) => {
  const protectedSet = new Set(protectedSteps);
  const activeSteps = track
    .map((active, step) => (active ? step : -1))
    .filter((step) => step >= 0 && !protectedSet.has(step));

  while (track.filter(Boolean).length > maximum && activeSteps.length) {
    track[activeSteps.pop()] = false;
  }

  if (track.filter(Boolean).length < minimum) {
    for (let step = 0; step < STEPS && track.filter(Boolean).length < minimum; step += 2) {
      if (!track[step]) track[step] = true;
    }
  }
};

// 直前の小節を「記憶」として受け取り、少しだけ次の状態へ進める。
// 音符の変化は数小節おきに一箇所だけ。タイミングと強弱は毎小節滑らかに動く。
export const evolvePattern = (previous) => {
  const generation = (previous._generation ?? 0) + 1;
  const seed = previous._seed ?? 1;
  const random = createRandom((seed ^ Math.imul(generation, 2654435761)) >>> 0);
  const chance = (probability) => random() < probability;
  const phraseLength = previous._phraseLength ?? 4;
  const phrasePosition = generation % phraseLength;
  const breathPhase = previous._breathPhase ?? 0;
  const slowBreath = (step) =>
    0.5 + Math.sin(breathPhase + generation * 0.47 + (step / STEPS) * Math.PI * 2) * 0.5;

  const next = {
    ...previous,
    Kick: copyTrack(previous.Kick),
    Snare: copyTrack(previous.Snare),
    'Hi-Hat': copyTrack(previous['Hi-Hat']),
    _generation: generation,
  };

  // 変化のない小節も意図的に残し、フレーズの終わりでは変化しやすくする。
  const mutationMoment = generation % 2 === 0 && chance(phrasePosition === 0 ? 0.92 : 0.58);
  if (mutationMoment) {
    const layer = pick(['Kick', 'Snare', 'Hi-Hat', 'Hi-Hat'], random);

    if (layer === 'Kick') {
      const candidates = [4, 6, 7, 8, 10, 12, 14, 15]
        .filter((step) => slowBreath(step) > 0.3);
      const step = pick(candidates, random);
      next.Kick[step] = !next.Kick[step];
      next.Kick[0] = true;
      keepDensity(next.Kick, 2, 5, [0]);
    } else if (layer === 'Snare') {
      const anchor = pick([4, 12], random);
      const destination = clamp(anchor + pick([-1, 0, 1], random), 0, STEPS - 1);
      [anchor - 1, anchor, anchor + 1]
        .filter((step) => step >= 0 && step < STEPS)
        .forEach((step) => { next.Snare[step] = false; });
      next.Snare[destination] = true;
      keepDensity(next.Snare, 2, 3);
    } else {
      const half = phrasePosition < phraseLength / 2 ? 0 : 8;
      const candidates = [1, 2, 3, 5, 6, 7].map((step) => step + half);
      const step = pick(candidates, random);
      next['Hi-Hat'][step] = !next['Hi-Hat'][step];
      breakLongHatRuns(next['Hi-Hat']);
      keepDensity(next['Hi-Hat'], 4, 9);
    }
  }

  const previousTiming = previous._timingByTrack ?? Object.fromEntries(
    TRACKS.map((track) => [track, previous._timing ?? Array(STEPS).fill(0)]),
  );
  const previousVelocity = previous._velocity ?? Object.fromEntries(
    TRACKS.map((track) => [track, previous._accent ?? Array(STEPS).fill(0.7)]),
  );

  const timingTargets = {
    Kick: (step) => clamp((step % 4 === 0 ? 0.0007 : 0.002) + slowBreath(step) * 0.0016, 0, 0.005),
    Snare: (step) => clamp(0.0025 + slowBreath(step) * 0.004, 0.001, 0.009),
    'Hi-Hat': (step) => clamp(
      (step % 2 === 1 ? 0.005 : 0.0004) + slowBreath(step) * 0.0022,
      0,
      0.011,
    ),
  };

  next._timingByTrack = Object.fromEntries(TRACKS.map((track) => [
    track,
    Array.from({ length: STEPS }, (_, step) => {
      const target = timingTargets[track](step) + (random() - 0.5) * 0.0007;
      return clamp(previousTiming[track][step] * 0.72 + target * 0.28, 0, 0.012);
    }),
  ]));

  next._velocity = Object.fromEntries(TRACKS.map((track) => [
    track,
    Array.from({ length: STEPS }, (_, step) => {
      const base = track === 'Kick' ? 0.66 : track === 'Snare' ? 0.54 : 0.42;
      const pulse = step % 4 === 0 ? 0.08 : step % 2 === 0 ? 0.035 : 0;
      const target = base + slowBreath(step) * 0.1 + pulse + (random() - 0.5) * 0.035;
      return clamp(previousVelocity[track][step] * 0.78 + target * 0.22, 0.28, 0.84);
    }),
  ]));

  next._timing = next._timingByTrack['Hi-Hat'];
  next._accent = next._velocity.Kick;
  next._fragments = makeFragments({
    random,
    generation,
    phraseLength,
    breathAt: slowBreath,
    pattern: next,
  });
  next._dust = makeFineDust({
    random,
    generation,
    phraseLength,
    pattern: next,
  });
  next._ambientLayers = makeAmbientLayers({
    random,
    generation,
    phraseLength,
    breathAt: slowBreath,
  });
  next._bassLine = makeBassLine({
    generation,
    phraseLength,
    breathAt: slowBreath,
    motifIndex: previous._bassMotifIndex ?? 0,
  });
  return next;
};
