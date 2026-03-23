import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { BRAND_COLORS, VIDEO_FPS } from '../constants';
import { IntroSequence } from '../components/IntroSequence';
import { LogoWatermark } from '../components/LogoWatermark';
import { LowerThird } from '../components/LowerThird';

export interface AnnouncementProps {
  headline: string;
  body: string;
  speakerName: string;
  speakerTitle: string;
  durationInSeconds: number;
}

export function Announcement({
  headline,
  body,
  speakerName,
  speakerTitle,
  durationInSeconds,
}: AnnouncementProps) {
  const introFrames = VIDEO_FPS * 2;
  const outroFrames = VIDEO_FPS * 1;
  const mainFrames = durationInSeconds * VIDEO_FPS - introFrames - outroFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_COLORS.dark }}>
      <Sequence from={0} durationInFrames={introFrames}>
        <IntroSequence label="Announcement" />
      </Sequence>

      <Sequence from={introFrames} durationInFrames={mainFrames}>
        <AnnouncementContent
          headline={headline}
          body={body}
          speakerName={speakerName}
          speakerTitle={speakerTitle}
        />
      </Sequence>

      <Sequence from={introFrames + mainFrames} durationInFrames={outroFrames}>
        <AbsoluteFill style={{ backgroundColor: BRAND_COLORS.dark }} />
      </Sequence>
    </AbsoluteFill>
  );
}

function AnnouncementContent({
  headline,
  body,
  speakerName,
  speakerTitle,
}: {
  headline: string;
  body: string;
  speakerName: string;
  speakerTitle: string;
}) {
  const frame = useCurrentFrame();

  const bannerWidth = interpolate(frame, [0, 25], [0, 100], {
    extrapolateRight: 'clamp',
  });

  const headlineOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const bodyOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(160deg, ${BRAND_COLORS.dark} 0%, ${BRAND_COLORS.darkSecondary} 100%)`,
        }}
      />

      <LogoWatermark />

      {/* Green banner bar */}
      <div
        style={{
          position: 'absolute',
          top: 140,
          left: 0,
          width: `${bannerWidth}%`,
          height: 6,
          backgroundColor: BRAND_COLORS.green,
        }}
      />

      {/* Headline */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 80,
          right: 80,
          opacity: headlineOpacity,
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 72,
            fontWeight: 800,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.15,
          }}
        >
          {headline}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          position: 'absolute',
          top: 420,
          left: 80,
          right: 200,
          opacity: bodyOpacity,
        }}
      >
        <span
          style={{
            color: BRAND_COLORS.cream,
            fontSize: 32,
            fontWeight: 400,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.6,
            opacity: 0.8,
          }}
        >
          {body}
        </span>
      </div>

      <LowerThird name={speakerName} title={speakerTitle} />
    </AbsoluteFill>
  );
}
