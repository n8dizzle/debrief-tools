import { interpolate, useCurrentFrame } from 'remotion';
import { BRAND_COLORS } from '../constants';

export function LogoWatermark() {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 0.6], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        right: 50,
        opacity,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: BRAND_COLORS.green,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" fill="none" stroke={BRAND_COLORS.cream} viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <span
        style={{
          color: BRAND_COLORS.cream,
          fontSize: 20,
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.02em',
        }}
      >
        Christmas Air
      </span>
    </div>
  );
}
