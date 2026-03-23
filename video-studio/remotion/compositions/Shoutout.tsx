import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { BRAND_COLORS, VIDEO_FPS } from '../constants';
import { IntroSequence } from '../components/IntroSequence';
import { LogoWatermark } from '../components/LogoWatermark';

export interface ShoutoutProps {
  recipientName: string;
  message: string;
  fromName: string;
  fromTitle: string;
  durationInSeconds: number;
}

export function Shoutout({
  recipientName,
  message,
  fromName,
  fromTitle,
  durationInSeconds,
}: ShoutoutProps) {
  const introFrames = VIDEO_FPS * 2;
  const outroFrames = VIDEO_FPS * 1;
  const mainFrames = durationInSeconds * VIDEO_FPS - introFrames - outroFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_COLORS.dark }}>
      <Sequence from={0} durationInFrames={introFrames}>
        <IntroSequence label="Shoutout" />
      </Sequence>

      <Sequence from={introFrames} durationInFrames={mainFrames}>
        <ShoutoutContent
          recipientName={recipientName}
          message={message}
          fromName={fromName}
          fromTitle={fromTitle}
        />
      </Sequence>

      <Sequence from={introFrames + mainFrames} durationInFrames={outroFrames}>
        <AbsoluteFill style={{ backgroundColor: BRAND_COLORS.dark }} />
      </Sequence>
    </AbsoluteFill>
  );
}

function ShoutoutContent({
  recipientName,
  message,
  fromName,
  fromTitle,
}: {
  recipientName: string;
  message: string;
  fromName: string;
  fromTitle: string;
}) {
  const frame = useCurrentFrame();

  const starScale = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const nameOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const messageOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const fromOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, ${BRAND_COLORS.darkCard} 0%, ${BRAND_COLORS.dark} 70%)`,
        }}
      />

      <LogoWatermark />

      {/* Star icon */}
      <div
        style={{
          position: 'absolute',
          top: 140,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${starScale})`,
        }}
      >
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: '50%',
            backgroundColor: 'rgba(184, 149, 107, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="50" height="50" fill={BRAND_COLORS.gold} viewBox="0 0 24 24">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
      </div>

      {/* Recipient name */}
      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: nameOpacity,
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.gold,
            fontSize: 56,
            fontWeight: 800,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {recipientName}
        </span>
      </div>

      {/* Message */}
      <div
        style={{
          position: 'absolute',
          top: 400,
          left: 120,
          right: 120,
          textAlign: 'center',
          opacity: messageOpacity,
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 36,
            fontWeight: 400,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}
        >
          &ldquo;{message}&rdquo;
        </span>
      </div>

      {/* From */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: fromOpacity,
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 24,
            fontWeight: 500,
            fontFamily: 'system-ui, sans-serif',
            opacity: 0.7,
          }}
        >
          &mdash; {fromName}, {fromTitle}
        </span>
      </div>
    </AbsoluteFill>
  );
}
