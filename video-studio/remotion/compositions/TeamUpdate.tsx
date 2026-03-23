import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { BRAND_COLORS, VIDEO_FPS } from '../constants';
import { IntroSequence } from '../components/IntroSequence';
import { LowerThird } from '../components/LowerThird';
import { LogoWatermark } from '../components/LogoWatermark';

export interface TeamUpdateProps {
  title: string;
  speakerName: string;
  speakerTitle: string;
  message: string;
  durationInSeconds: number;
}

export function TeamUpdate({
  title,
  speakerName,
  speakerTitle,
  message,
  durationInSeconds,
}: TeamUpdateProps) {
  const frame = useCurrentFrame();
  const introFrames = VIDEO_FPS * 2; // 2 second intro
  const outroFrames = VIDEO_FPS * 1; // 1 second outro
  const mainFrames = durationInSeconds * VIDEO_FPS - introFrames - outroFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_COLORS.dark }}>
      {/* Intro */}
      <Sequence from={0} durationInFrames={introFrames}>
        <IntroSequence label="Team Update" />
      </Sequence>

      {/* Main Content */}
      <Sequence from={introFrames} durationInFrames={mainFrames}>
        <MainContent
          title={title}
          speakerName={speakerName}
          speakerTitle={speakerTitle}
          message={message}
        />
      </Sequence>

      {/* Outro */}
      <Sequence from={introFrames + mainFrames} durationInFrames={outroFrames}>
        <OutroSequence />
      </Sequence>
    </AbsoluteFill>
  );
}

function MainContent({
  title,
  speakerName,
  speakerTitle,
  message,
}: {
  title: string;
  speakerName: string;
  speakerTitle: string;
  message: string;
}) {
  const frame = useCurrentFrame();

  // Title animation
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(frame, [0, 20], [-20, 0], {
    extrapolateRight: 'clamp',
  });

  // Message animation (delayed)
  const messageOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${BRAND_COLORS.dark} 0%, ${BRAND_COLORS.darkSecondary} 50%, ${BRAND_COLORS.darkCard} 100%)`,
        }}
      />

      {/* Decorative accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 8,
          height: '100%',
          backgroundColor: BRAND_COLORS.green,
        }}
      />

      {/* Logo watermark */}
      <LogoWatermark />

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 160,
          left: 80,
          right: 80,
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 64,
            fontWeight: 800,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
      </div>

      {/* Message */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          left: 80,
          right: 200,
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
            opacity: 0.85,
          }}
        >
          {message}
        </span>
      </div>

      {/* Lower third */}
      <LowerThird name={speakerName} title={speakerTitle} />
    </AbsoluteFill>
  );
}

function OutroSequence() {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [1, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND_COLORS.dark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            backgroundColor: BRAND_COLORS.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="36" height="36" fill="none" stroke={BRAND_COLORS.cream} viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 32,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Christmas Air
        </span>
      </div>
    </AbsoluteFill>
  );
}
