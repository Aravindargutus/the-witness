import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Audio,
  staticFile,
} from 'remotion';

// ─── Shared design tokens ────────────────────────────────────────────────────
const COLORS = {
  bg:        '#0a0a0f',
  bgCard:    '#12121a',
  bgGlass:   'rgba(255,255,255,0.04)',
  red:       '#dc2626',
  redGlow:   'rgba(220,38,38,0.4)',
  amber:     '#f59e0b',
  cyan:      '#22d3ee',
  purple:    '#a855f7',
  green:     '#22c55e',
  text:      '#f0f0f5',
  textMuted: '#6b7280',
  border:    'rgba(255,255,255,0.08)',
};

const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";
const MONO = "'Courier New', monospace";

// ─── Easing helpers ──────────────────────────────────────────────────────────
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn  = (t) => t * t * t;

function fadeIn(frame, start, duration) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

function slideUp(frame, start, duration) {
  return interpolate(frame, [start, start + duration], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
}

// ─── Reusable atoms ──────────────────────────────────────────────────────────
const GlowDot = ({ color, size = 400, x, y, opacity = 0.15 }) => (
  <div style={{
    position: 'absolute',
    left: x,
    top: y,
    width: size,
    height: size,
    borderRadius: '50%',
    background: color,
    filter: `blur(${size * 0.35}px)`,
    opacity,
    pointerEvents: 'none',
  }} />
);

const ScanLine = ({ frame }) => {
  const y = (frame * 4) % 1080;
  return (
    <div style={{
      position: 'absolute',
      left: 0,
      top: y,
      width: '100%',
      height: 2,
      background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.06), transparent)',
      pointerEvents: 'none',
    }} />
  );
};

// ─── Scene 1: Title (0–120 frames, 0–4s) ─────────────────────────────────────
const SceneTitle = () => {
  const frame = useCurrentFrame();
  const alpha  = fadeIn(frame, 0, 40);
  const titleY = slideUp(frame, 20, 35);
  const subAlpha = fadeIn(frame, 50, 30);

  const glitch = Math.sin(frame * 0.9) > 0.97 ? 3 : 0;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
      <GlowDot color={COLORS.redGlow} size={800} x={560} y={140} opacity={0.18} />
      <GlowDot color="rgba(168,85,247,0.3)" size={500} x={900} y={400} opacity={0.12} />
      <ScanLine frame={frame} />

      {/* Crime tape lines */}
      {[120, 900].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, top: y, width: '100%', height: 3,
          background: `repeating-linear-gradient(90deg, ${COLORS.amber} 0px, ${COLORS.amber} 80px, ${COLORS.bg} 80px, ${COLORS.bg} 100px)`,
          opacity: fadeIn(frame, i * 15, 20) * 0.5,
        }} />
      ))}

      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* THE • WITNESS */}
        <div style={{
          opacity: alpha,
          transform: `translateY(${titleY}px) translateX(${glitch}px)`,
          fontSize: 160,
          fontWeight: 900,
          letterSpacing: '0.15em',
          color: COLORS.text,
          textShadow: `0 0 80px ${COLORS.redGlow}, 0 0 20px ${COLORS.redGlow}`,
          lineHeight: 1,
        }}>
          THE WITNESS
        </div>

        {/* red underline */}
        <div style={{
          width: interpolate(frame, [40, 70], [0, 700], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          height: 4,
          background: `linear-gradient(90deg, transparent, ${COLORS.red}, transparent)`,
          marginTop: 16,
          marginBottom: 32,
        }} />

        <div style={{
          opacity: subAlpha,
          fontSize: 28,
          letterSpacing: '0.5em',
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          fontWeight: 300,
        }}>
          A Murder Mystery — Powered by AI
        </div>
      </AbsoluteFill>

      {/* Bottom case file label */}
      <div style={{
        position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
        opacity: fadeIn(frame, 80, 20),
        fontFamily: MONO, fontSize: 14, color: COLORS.textMuted, letterSpacing: '0.25em',
      }}>
        CASE FILE #2026-001 &nbsp;•&nbsp; DR. SHALINI RAO &nbsp;•&nbsp; BIONOVA RESEARCH INSTITUTE, CHENNAI
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: The Crime (120–390 frames, 4–13s) ───────────────────────────────
const SceneCrime = () => {
  const frame = useCurrentFrame();

  const lines = [
    { text: 'VICTIM', color: COLORS.red, delay: 0 },
    { text: 'Dr. Shalini Rao', color: COLORS.text, delay: 15, size: 72, weight: 700 },
    { text: 'Senior Research Scientist — BioNova Institute, Chennai', color: COLORS.textMuted, delay: 25, size: 24 },
  ];

  const facts = [
    { label: 'Time of Death', value: '23:00 – 23:30', icon: '🕑' },
    { label: 'Location',      value: 'Lab 3B, 3rd Floor',    icon: '📍' },
    { label: 'Cause',         value: 'Blunt force trauma',   icon: '🔪' },
    { label: 'Motive',        value: 'Property dispute',     icon: '💰' },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
      <GlowDot color={COLORS.redGlow} size={700} x={-100} y={200} opacity={0.2} />
      <ScanLine frame={frame} />

      {/* Red stripe on left */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 6, height: '100%',
        background: COLORS.red,
        transform: `scaleY(${interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
        transformOrigin: 'top',
      }} />

      <div style={{ padding: '80px 140px', display: 'flex', flexDirection: 'column', gap: 10, height: '100%', justifyContent: 'center' }}>
        {/* Victim card section */}
        {lines.map((l, i) => (
          <div key={i} style={{
            opacity: fadeIn(frame, l.delay, 20),
            transform: `translateX(${interpolate(frame, [l.delay, l.delay + 20], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
            fontSize: l.size ?? 16,
            fontWeight: l.weight ?? 400,
            color: l.color,
            letterSpacing: l.size === undefined ? '0.4em' : undefined,
            textTransform: l.size === undefined ? 'uppercase' : undefined,
          }}>
            {l.text}
          </div>
        ))}

        {/* Fact cards */}
        <div style={{ display: 'flex', gap: 24, marginTop: 60 }}>
          {facts.map((f, i) => (
            <div key={i} style={{
              opacity: fadeIn(frame, 60 + i * 20, 20),
              transform: `translateY(${slideUp(frame, 60 + i * 20, 20)}px)`,
              background: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: '24px 32px',
              flex: 1,
              borderTop: `3px solid ${COLORS.red}`,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.text }}>{f.value}</div>
            </div>
          ))}
        </div>

        {/* Your mission */}
        <div style={{
          opacity: fadeIn(frame, 170, 25),
          marginTop: 48,
          background: 'rgba(220,38,38,0.08)',
          border: `1px solid rgba(220,38,38,0.3)`,
          borderRadius: 12,
          padding: '24px 32px',
          fontSize: 22,
          color: COLORS.text,
        }}>
          🔍 &nbsp;<strong>Your mission:</strong> interrogate the three witnesses. Find the contradictions. Name the killer.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: The Witnesses (390–780 frames, 13–26s) ──────────────────────────
const SceneWitnesses = () => {
  const frame = useCurrentFrame();

  const witnesses = [
    {
      emoji: '🧪', name: 'Dr. Meena\nKrishnamurthy', role: 'Senior Research Scientist',
      desc: 'Composed. Precise. Hides emotion behind facts. Her keycard was swiped in Lab 3B at 11:02pm.',
      color: COLORS.cyan, secret: 'She was there.',
    },
    {
      emoji: '😰', name: 'Arjun Patel', role: 'Junior Lab Assistant',
      desc: 'Nervous. Over-explains. Slips between Tamil and English. Stole equipment and is terrified it will surface.',
      color: COLORS.amber, secret: 'He\'s hiding theft.',
    },
    {
      emoji: '🔒', name: 'Rajan Venkatesh', role: 'Night Security Guard',
      desc: 'Guarded. Loyal. Says very little. The side entrance sensor triggered on his watch at 10:40pm.',
      color: COLORS.purple, secret: 'He let someone in.',
    },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
      <GlowDot color="rgba(34,211,238,0.2)" size={600} x={1300} y={-100} opacity={0.12} />
      <ScanLine frame={frame} />

      <div style={{ padding: '60px 100px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{
          opacity: fadeIn(frame, 0, 20),
          fontSize: 16, letterSpacing: '0.4em', color: COLORS.red,
          textTransform: 'uppercase', marginBottom: 12,
        }}>
          Persons of Interest
        </div>
        <div style={{
          opacity: fadeIn(frame, 5, 20),
          fontSize: 56, fontWeight: 800, color: COLORS.text, marginBottom: 48,
        }}>
          Three Witnesses. Three Secrets.
        </div>

        {/* Witness cards */}
        <div style={{ display: 'flex', gap: 32, flex: 1, alignItems: 'stretch' }}>
          {witnesses.map((w, i) => {
            const delay = 40 + i * 45;
            const alpha = fadeIn(frame, delay, 25);
            const ty    = slideUp(frame, delay, 25);

            return (
              <div key={i} style={{
                opacity: alpha,
                transform: `translateY(${ty}px)`,
                flex: 1,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderTop: `4px solid ${w.color}`,
                borderRadius: 16,
                padding: '40px 36px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: `0 0 40px ${w.color}22`,
              }}>
                <div style={{ fontSize: 64 }}>{w.emoji}</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, whiteSpace: 'pre-line' }}>{w.name}</div>
                <div style={{ fontSize: 15, color: w.color, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{w.role}</div>
                <div style={{ fontSize: 17, color: COLORS.textMuted, lineHeight: 1.6, flex: 1 }}>{w.desc}</div>

                {/* Secret label — fade in last */}
                <div style={{
                  opacity: fadeIn(frame, delay + 60, 20),
                  background: `${w.color}18`,
                  border: `1px solid ${w.color}44`,
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 14,
                  color: w.color,
                  fontStyle: 'italic',
                }}>
                  ⚠ {w.secret}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Voice Interrogation (780–1230 frames, 26–41s) ──────────────────
const SceneVoice = () => {
  const frame = useCurrentFrame();

  const chatLines = [
    { role: 'detective', text: 'Where were you at 11pm on Tuesday night?', delay: 30 },
    { role: 'witness',   text: 'I... I was at my desk. Athu — I mean, on Floor 1. Security room.', delay: 80 },
    { role: 'detective', text: 'The elevator log shows no trips between 10:40 and 11:10.', delay: 130 },
    { role: 'witness',   text: 'Illa sir... I used the stairs — wait, no — athu...', delay: 180 },
    { role: 'system',    text: '⚡ CONTRADICTION DETECTED — Timeline conflict with Meena\'s statement', delay: 220 },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
      <GlowDot color="rgba(34,211,238,0.25)" size={700} x={1100} y={200} opacity={0.14} />
      <ScanLine frame={frame} />

      <div style={{ display: 'flex', height: '100%' }}>
        {/* Left panel - Waveform visual */}
        <div style={{
          width: 420,
          background: COLORS.bgCard,
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: 48,
        }}>
          <div style={{ fontSize: 80 }}>🔒</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, textAlign: 'center' }}>Rajan Venkatesh</div>
          <div style={{ fontSize: 14, color: COLORS.purple, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Night Security Guard</div>

          {/* Live waveform bars */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 60 }}>
            {Array.from({ length: 20 }).map((_, i) => {
              const h = Math.abs(Math.sin((frame * 0.15) + i * 0.8)) * 48 + 4;
              return (
                <div key={i} style={{
                  width: 6,
                  height: h,
                  background: COLORS.purple,
                  borderRadius: 3,
                  opacity: 0.7 + Math.sin((frame * 0.1) + i) * 0.3,
                }} />
              );
            })}
          </div>

          <div style={{
            opacity: fadeIn(frame, 0, 20),
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: COLORS.green,
          }}>
            <div style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: COLORS.green,
              boxShadow: `0 0 8px ${COLORS.green}`,
              animation: 'pulse 1s infinite',
            }} />
            LIVE — Gemini Live API
          </div>
        </div>

        {/* Right panel - Chat */}
        <div style={{
          flex: 1,
          padding: '48px 64px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            opacity: fadeIn(frame, 0, 15),
            fontSize: 13, letterSpacing: '0.35em',
            color: COLORS.red, textTransform: 'uppercase', marginBottom: 36,
          }}>
            🎙 Active Interrogation
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
            {chatLines.map((line, i) => {
              const vis = fadeIn(frame, line.delay, 18);
              if (line.role === 'system') {
                return (
                  <div key={i} style={{
                    opacity: vis,
                    transform: `scale(${interpolate(frame, [line.delay, line.delay + 18], [0.95, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
                    background: 'rgba(220,38,38,0.1)',
                    border: `1px solid rgba(220,38,38,0.5)`,
                    borderRadius: 10,
                    padding: '14px 20px',
                    fontSize: 16,
                    color: COLORS.red,
                    fontWeight: 600,
                  }}>
                    {line.text}
                  </div>
                );
              }
              const isDetective = line.role === 'detective';
              return (
                <div key={i} style={{
                  opacity: vis,
                  transform: `translateX(${interpolate(frame, [line.delay, line.delay + 18], [isDetective ? -20 : 20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
                  alignSelf: isDetective ? 'flex-start' : 'flex-end',
                  maxWidth: '70%',
                  background: isDetective ? COLORS.bgGlass : `${COLORS.purple}22`,
                  border: `1px solid ${isDetective ? COLORS.border : COLORS.purple + '44'}`,
                  borderRadius: 14,
                  padding: '14px 20px',
                  fontSize: 18,
                  color: COLORS.text,
                }}>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, letterSpacing: '0.2em' }}>
                    {isDetective ? 'DETECTIVE' : 'RAJAN'}
                  </div>
                  {line.text}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5: Contradiction Engine (1230–1680 frames, 41–56s) ────────────────
const SceneContradictions = () => {
  const frame = useCurrentFrame();

  const contras = [
    {
      witnesses: ['Meena', 'Rajan'],
      topic: 'Location at 11pm',
      a: 'I did not leave Floor 3 all evening.',
      b: 'I only saw Dr. Meena on Floor 1 at 22:50.',
      confidence: 'HIGH',
    },
    {
      witnesses: ['Arjun', 'Rajan'],
      topic: 'Side Entrance at 10:40',
      a: 'Nobody used the side entrance that night — my sensor would have triggered.',
      b: 'Aama... I was near the side door around 10:30. Just checking rounds.',
      confidence: 'MEDIUM',
    },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
      <GlowDot color="rgba(220,38,38,0.3)" size={600} x={1200} y={300} opacity={0.15} />
      <ScanLine frame={frame} />

      <div style={{ padding: '70px 120px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          opacity: fadeIn(frame, 0, 20),
          fontSize: 14, letterSpacing: '0.4em',
          color: COLORS.amber, textTransform: 'uppercase', marginBottom: 12,
        }}>
          AI-Powered Analysis
        </div>
        <div style={{
          opacity: fadeIn(frame, 8, 20),
          fontSize: 56, fontWeight: 800,
          color: COLORS.text, marginBottom: 12,
        }}>
          Contradiction Engine
        </div>
        <div style={{
          opacity: fadeIn(frame, 16, 20),
          fontSize: 20, color: COLORS.textMuted, marginBottom: 52,
        }}>
          Every witness statement is cross-checked by Gemini Flash in real time. Lies surface automatically.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, flex: 1 }}>
          {contras.map((c, i) => {
            const delay = 50 + i * 80;
            return (
              <div key={i} style={{
                opacity: fadeIn(frame, delay, 22),
                transform: `translateY(${slideUp(frame, delay, 22)}px)`,
                background: COLORS.bgCard,
                border: `1px solid rgba(220,38,38,0.3)`,
                borderRadius: 16,
                padding: '28px 36px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <span style={{ fontSize: 13, color: COLORS.red, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                      {c.witnesses[0]} vs {c.witnesses[1]}
                    </span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>
                      Topic: {c.topic}
                    </div>
                  </div>
                  <div style={{
                    background: c.confidence === 'HIGH' ? 'rgba(220,38,38,0.15)' : 'rgba(245,158,11,0.15)',
                    border: `1px solid ${c.confidence === 'HIGH' ? COLORS.red : COLORS.amber}44`,
                    borderRadius: 8,
                    padding: '6px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: c.confidence === 'HIGH' ? COLORS.red : COLORS.amber,
                    letterSpacing: '0.2em',
                  }}>
                    {c.confidence} CONFIDENCE
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  {[c.a, c.b].map((txt, j) => (
                    <div key={j} style={{
                      flex: 1,
                      background: COLORS.bgGlass,
                      borderRadius: 10,
                      padding: '14px 18px',
                      borderLeft: `3px solid ${j === 0 ? COLORS.cyan : COLORS.purple}`,
                    }}>
                      <div style={{ fontSize: 12, color: COLORS.textMuted, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>
                        {c.witnesses[j]}
                      </div>
                      <div style={{ fontSize: 16, color: COLORS.text, lineHeight: 1.5, fontStyle: 'italic' }}>
                        "{txt}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 6: Tech Stack (1680–2160 frames, 56–72s) ──────────────────────────
const SceneTechStack = () => {
  const frame = useCurrentFrame();

  const stack = [
    { icon: '🤖', name: 'Gemini Live API',    desc: 'Real-time voice conversations with AI witnesses',  color: COLORS.cyan },
    { icon: '⚡', name: 'FastAPI + Python',   desc: 'WebSocket backend, async O(n²) contradiction engine', color: COLORS.green },
    { icon: '⚛️', name: 'React 19 + Vite',   desc: 'Web Audio API mic capture, PCM streaming to WebSocket', color: COLORS.cyan },
    { icon: '🔥', name: 'Google Firestore',   desc: 'Session state, statements, contradiction store',   color: COLORS.amber },
    { icon: '🧠', name: 'Gemini Flash',       desc: 'Audio transcription + contradiction detection LLM', color: COLORS.purple },
    { icon: '☁️', name: 'Cloud Run',          desc: 'Containerised backend, auto-scaling, global CDN',  color: COLORS.red },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
      <GlowDot color="rgba(34,211,238,0.2)" size={600} x={600} y={-200} opacity={0.12} />
      <GlowDot color="rgba(168,85,247,0.2)" size={500} x={1400} y={600} opacity={0.1} />
      <ScanLine frame={frame} />

      <div style={{ padding: '70px 120px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          opacity: fadeIn(frame, 0, 20),
          fontSize: 14, letterSpacing: '0.4em',
          color: COLORS.cyan, textTransform: 'uppercase', marginBottom: 12,
        }}>
          Built With
        </div>
        <div style={{
          opacity: fadeIn(frame, 8, 20),
          fontSize: 56, fontWeight: 800, color: COLORS.text, marginBottom: 48,
        }}>
          Tech Stack
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, flex: 1 }}>
          {stack.map((s, i) => {
            const delay = 40 + i * 25;
            return (
              <div key={i} style={{
                opacity: fadeIn(frame, delay, 22),
                transform: `translateY(${slideUp(frame, delay, 22)}px)`,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 14,
                padding: '28px 28px',
                borderBottom: `3px solid ${s.color}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ fontSize: 40 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{s.name}</div>
                <div style={{ fontSize: 15, color: COLORS.textMuted, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 7: How to Play (2160–2760 frames, 72–92s) ─────────────────────────
const SceneHowToPlay = () => {
  const frame = useCurrentFrame();

  const steps = [
    { num: '01', title: 'Create a Session',    desc: 'Enter your name and start a case. Share the 6-character code with other detectives.', icon: '🎭' },
    { num: '02', title: 'Study the Evidence',  desc: 'Review the case board — known facts, witness statements, flagged contradictions.', icon: '🗂️' },
    { num: '03', title: 'Interrogate by Voice', desc: 'Click a witness and speak. Ask anything. The AI responds live in their unique voice and personality.', icon: '🎙️' },
    { num: '04', title: 'Spot the Contradictions', desc: 'The Contradiction Engine compares statements across all witnesses in real time.', icon: '⚡' },
    { num: '05', title: 'Accuse & Reveal',     desc: 'When you think you know who did it — make your accusation and find out the truth.', icon: '🔍' },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
      <GlowDot color="rgba(34,197,94,0.2)" size={600} x={1300} y={100} opacity={0.1} />
      <ScanLine frame={frame} />

      <div style={{ padding: '65px 120px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          opacity: fadeIn(frame, 0, 20),
          fontSize: 14, letterSpacing: '0.4em',
          color: COLORS.green, textTransform: 'uppercase', marginBottom: 12,
        }}>
          Gameplay
        </div>
        <div style={{
          opacity: fadeIn(frame, 8, 18),
          fontSize: 52, fontWeight: 800, color: COLORS.text, marginBottom: 44,
        }}>
          How to Play
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
          {steps.map((s, i) => {
            const delay = 35 + i * 35;
            return (
              <div key={i} style={{
                opacity: fadeIn(frame, delay, 20),
                transform: `translateX(${interpolate(frame, [delay, delay + 20], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 14,
                padding: '22px 32px',
              }}>
                <div style={{
                  fontSize: 38, fontWeight: 900, color: COLORS.red, opacity: 0.25,
                  fontFamily: MONO, minWidth: 60,
                }}>
                  {s.num}
                </div>
                <div style={{ fontSize: 32 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 16, color: COLORS.textMuted, lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 8: CTA / GitHub (2760–3120 frames, 92–104s) ───────────────────────
const SceneCTA = () => {
  const frame = useCurrentFrame();
  const glitch = Math.sin(frame * 1.1) > 0.95 ? 4 : 0;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
      <GlowDot color={COLORS.redGlow} size={900} x={500} y={100} opacity={0.2} />
      <GlowDot color="rgba(168,85,247,0.3)" size={700} x={1000} y={300} opacity={0.12} />
      <ScanLine frame={frame} />

      {/* Crime tape */}
      {[110, 920].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, top: y, width: '100%', height: 4,
          background: `repeating-linear-gradient(90deg, ${COLORS.amber} 0px, ${COLORS.amber} 80px, ${COLORS.bg} 80px, ${COLORS.bg} 100px)`,
          opacity: 0.4,
        }} />
      ))}

      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <div style={{
          opacity: fadeIn(frame, 0, 25),
          fontSize: 20, letterSpacing: '0.5em',
          color: COLORS.textMuted, textTransform: 'uppercase',
        }}>
          Now available on GitHub
        </div>

        <div style={{
          opacity: fadeIn(frame, 15, 25),
          transform: `translateY(${slideUp(frame, 15, 25)}px) translateX(${glitch}px)`,
          fontSize: 130, fontWeight: 900, letterSpacing: '0.12em', color: COLORS.text,
          textShadow: `0 0 80px ${COLORS.redGlow}, 0 0 20px ${COLORS.redGlow}`,
        }}>
          THE WITNESS
        </div>

        <div style={{
          width: interpolate(frame, [30, 60], [0, 700], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          height: 4,
          background: `linear-gradient(90deg, transparent, ${COLORS.red}, transparent)`,
        }} />

        <div style={{
          opacity: fadeIn(frame, 50, 25),
          transform: `translateY(${slideUp(frame, 50, 25)}px)`,
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 14,
          padding: '20px 48px',
          fontFamily: MONO,
          fontSize: 22,
          color: COLORS.cyan,
        }}>
          github.com/Aravindargutus/the-witness
        </div>

        {/* Tag badges */}
        <div style={{
          opacity: fadeIn(frame, 70, 25),
          display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12,
        }}>
          {['Gemini Live', 'FastAPI', 'React 19', 'WebSocket', 'Google ADK', 'Firestore'].map((tag, i) => (
            <div key={i} style={{
              opacity: fadeIn(frame, 70 + i * 8, 15),
              background: COLORS.bgGlass,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 20,
              padding: '8px 20px',
              fontSize: 15,
              color: COLORS.textMuted,
            }}>
              {tag}
            </div>
          ))}
        </div>

        <div style={{
          opacity: fadeIn(frame, 110, 20),
          fontSize: 20, color: COLORS.textMuted, marginTop: 16,
        }}>
          Built at the intersection of AI + storytelling
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 9: Extended showcase / loop (3120–5400 frames, 104–180s) ───────────
// Re-plays key scenes with slower transitions for a full 3-minute runtime
const SceneExtended = () => {
  const frame = useCurrentFrame();
  // Cycle through feature highlights every 40s
  const phase = Math.floor(frame / 720) % 3;

  const features = [
    {
      title: 'Real-Time Voice',
      body: 'Speak directly to the AI witnesses. Gemini Live streams audio back in their character voice — no pre-recorded responses, no lag.',
      accent: COLORS.cyan, icon: '🎙️',
    },
    {
      title: 'Dynamic Personality',
      body: 'Each witness has a full backstory, secrets, and a unique speaking style. Arjun slips into Tamil when nervous. Meena deflects with data. Rajan says as little as possible.',
      accent: COLORS.purple, icon: '🎭',
    },
    {
      title: 'Multiplayer Ready',
      body: 'Multiple players can join the same session, each interrogating different witnesses simultaneously. Contradictions are detected across the whole team\'s findings.',
      accent: COLORS.amber, icon: '👥',
    },
  ];

  const current = features[phase];
  const phaseFrame = frame % 720;

  const alpha = phaseFrame < 30
    ? interpolate(phaseFrame, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : phaseFrame > 680
    ? interpolate(phaseFrame, [680, 720], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
      <GlowDot color={current.accent + '44'} size={800} x={600} y={140} opacity={0.18} />
      <ScanLine frame={frame} />

      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 200px', gap: 32 }}>
        <div style={{ opacity: alpha, transform: `translateY(${alpha < 1 ? (1 - alpha) * 30 : 0}px)`, textAlign: 'center' }}>
          <div style={{ fontSize: 90, marginBottom: 24 }}>{current.icon}</div>
          <div style={{
            fontSize: 72, fontWeight: 900, color: COLORS.text, marginBottom: 24,
            textShadow: `0 0 40px ${current.accent}44`,
          }}>
            {current.title}
          </div>
          <div style={{ fontSize: 26, color: COLORS.textMuted, lineHeight: 1.7, maxWidth: 1000 }}>
            {current.body}
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          {features.map((_, i) => (
            <div key={i} style={{
              width: i === phase ? 32 : 10,
              height: 10,
              borderRadius: 5,
              background: i === phase ? current.accent : COLORS.border,
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Watermark */}
        <div style={{
          position: 'absolute', bottom: 48,
          fontSize: 14, color: COLORS.textMuted, letterSpacing: '0.3em',
          fontFamily: MONO,
        }}>
          THE WITNESS &nbsp;•&nbsp; github.com/Aravindargutus/the-witness
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Main composition ─────────────────────────────────────────────────────────
// Scene timing (frames @ 30fps):
// S1 Title           :   0 –  120  (4s)
// S2 Crime           : 120 –  390 (9s)
// S3 Witnesses       : 390 –  780 (13s)
// S4 Voice           : 780 – 1230 (15s)
// S5 Contradictions  :1230 – 1680 (15s)
// S6 Tech Stack      :1680 – 2160 (16s)
// S7 How to Play     :2160 – 2760 (20s)
// S8 CTA             :2760 – 3120 (12s)
// S9 Extended        :3120 – 5400 (76s — feature deep-dive)
// TOTAL              : 5400 frames = 180s = 3 minutes

export const WitnessVideo = () => (
  <AbsoluteFill>
    {/* Background suspense music — loops for the full 3 minutes */}
    <Audio
      src={staticFile('bg-music.mp3')}
      volume={(f) =>
        interpolate(f, [0, 30, 5370, 5400], [0, 0.45, 0.45, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      }
      loop
    />
    <Sequence from={0}    durationInFrames={120}  ><SceneTitle         /></Sequence>
    <Sequence from={120}  durationInFrames={270}  ><SceneCrime         /></Sequence>
    <Sequence from={390}  durationInFrames={390}  ><SceneWitnesses     /></Sequence>
    <Sequence from={780}  durationInFrames={450}  ><SceneVoice         /></Sequence>
    <Sequence from={1230} durationInFrames={450}  ><SceneContradictions/></Sequence>
    <Sequence from={1680} durationInFrames={480}  ><SceneTechStack     /></Sequence>
    <Sequence from={2160} durationInFrames={600}  ><SceneHowToPlay     /></Sequence>
    <Sequence from={2760} durationInFrames={360}  ><SceneCTA           /></Sequence>
    <Sequence from={3120} durationInFrames={2280} ><SceneExtended      /></Sequence>
  </AbsoluteFill>
);
