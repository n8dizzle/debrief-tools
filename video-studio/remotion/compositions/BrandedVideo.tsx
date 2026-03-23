import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { BRAND_COLORS, VIDEO_FPS } from '../constants';
import { IntroSequence } from '../components/IntroSequence';
import { LowerThird } from '../components/LowerThird';
import { LogoWatermark } from '../components/LogoWatermark';

export interface BrandedVideoProps {
  videoUrl: string;
  speakerName: string;
  speakerTitle: string;
  label: string; // "Team Update", "Shoutout", etc.
  showLowerThird: boolean;
  showWatermark: boolean;
  durationInSeconds: number;
}

export function BrandedVideo({
  videoUrl,
  speakerName,
  speakerTitle,
  label,
  showLowerThird,
  showWatermark,
  durationInSeconds,
}: BrandedVideoProps) {
  const introFrames = VIDEO_FPS * 2; // 2s intro
  const outroFrames = VIDEO_FPS * 2; // 2s outro
  const mainFrames = durationInSeconds * VIDEO_FPS - introFrames - outroFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_COLORS.dark }}>
      {/* Intro */}
      <Sequence from={0} durationInFrames={introFrames}>
        <IntroSequence label={label || 'Video Studio'} />
      </Sequence>

      {/* Main video content */}
      <Sequence from={introFrames} durationInFrames={mainFrames}>
        <MainVideoContent
          videoUrl={videoUrl}
          speakerName={speakerName}
          speakerTitle={speakerTitle}
          showLowerThird={showLowerThird}
          showWatermark={showWatermark}
        />
      </Sequence>

      {/* Outro */}
      <Sequence from={introFrames + mainFrames} durationInFrames={outroFrames}>
        <OutroSequence />
      </Sequence>
    </AbsoluteFill>
  );
}

function MainVideoContent({
  videoUrl,
  speakerName,
  speakerTitle,
  showLowerThird,
  showWatermark,
}: {
  videoUrl: string;
  speakerName: string;
  speakerTitle: string;
  showLowerThird: boolean;
  showWatermark: boolean;
}) {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      {/* Video fills the frame */}
      {videoUrl && (
        <OffthreadVideo
          src={videoUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Gradient overlay at bottom for lower third readability */}
      {showLowerThird && speakerName && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '30%',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          }}
        />
      )}

      {/* Logo watermark */}
      {showWatermark && (
        <Sequence from={15}>
          <LogoWatermark />
        </Sequence>
      )}

      {/* Lower third */}
      {showLowerThird && speakerName && (
        <Sequence from={20}>
          <LowerThird name={speakerName} title={speakerTitle} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

function OutroSequence() {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [40, 60], [1, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND_COLORS.dark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: Math.min(opacity, fadeOut),
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: 18,
            backgroundColor: BRAND_COLORS.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="40" height="40" fill="none" stroke={BRAND_COLORS.cream} viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 36,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Christmas Air
        </span>
        <span
          style={{
            color: BRAND_COLORS.gold,
            fontSize: 18,
            fontWeight: 400,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.7,
          }}
        >
          Comfort in Every Season
        </span>
      </div>
    </AbsoluteFill>
  );
}
