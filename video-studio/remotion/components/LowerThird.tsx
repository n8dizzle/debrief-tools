import { interpolate, useCurrentFrame } from 'remotion';
import { BRAND_COLORS } from '../constants';

interface LowerThirdProps {
  name: string;
  title: string;
}

export function LowerThird({ name, title }: LowerThirdProps) {
  const frame = useCurrentFrame();

  const slideIn = interpolate(frame, [0, 15], [100, 0], {
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: 60,
        display: 'flex',
        flexDirection: 'column',
        transform: `translateX(${slideIn}px)`,
        opacity,
      }}
    >
      <div
        style={{
          backgroundColor: BRAND_COLORS.green,
          padding: '12px 28px',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 36,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {name}
        </span>
      </div>
      <div
        style={{
          backgroundColor: BRAND_COLORS.dark,
          padding: '8px 28px',
          borderRadius: '0 0 8px 8px',
          border: `2px solid ${BRAND_COLORS.green}`,
          borderTop: 'none',
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 22,
            fontWeight: 400,
            fontFamily: 'system-ui, sans-serif',
            opacity: 0.85,
          }}
        >
          {title}
        </span>
      </div>
    </div>
  );
}
