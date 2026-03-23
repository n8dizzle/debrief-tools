import { interpolate, useCurrentFrame } from 'remotion';
import { BRAND_COLORS, VIDEO_WIDTH, VIDEO_HEIGHT } from '../constants';

interface IntroSequenceProps {
  label: string;
}

export function IntroSequence({ label }: IntroSequenceProps) {
  const frame = useCurrentFrame();

  // Logo scale animation
  const logoScale = interpolate(frame, [0, 20], [0.5, 1], {
    extrapolateRight: 'clamp',
  });

  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Text slide up
  const textY = interpolate(frame, [15, 35], [30, 0], {
    extrapolateRight: 'clamp',
  });

  const textOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Line width animation
  const lineWidth = interpolate(frame, [25, 50], [0, 300], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        backgroundColor: BRAND_COLORS.dark,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 24,
          backgroundColor: BRAND_COLORS.green,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          marginBottom: 30,
        }}
      >
        <svg width="60" height="60" fill="none" stroke={BRAND_COLORS.cream} viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>

      {/* Company name */}
      <div
        style={{
          transform: `translateY(${textY}px)`,
          opacity: textOpacity,
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 52,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.02em',
          }}
        >
          Christmas Air
        </span>
      </div>

      {/* Divider line */}
      <div
        style={{
          width: lineWidth,
          height: 3,
          backgroundColor: BRAND_COLORS.green,
          marginTop: 16,
          marginBottom: 16,
          borderRadius: 2,
        }}
      />

      {/* Label */}
      <div
        style={{
          opacity: interpolate(frame, [35, 50], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.gold,
            fontSize: 28,
            fontWeight: 500,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
