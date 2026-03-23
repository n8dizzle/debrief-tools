'use client';

import { Player } from '@remotion/player';
import { TeamUpdate } from '@/remotion/compositions/TeamUpdate';
import { Shoutout } from '@/remotion/compositions/Shoutout';
import { Announcement } from '@/remotion/compositions/Announcement';
import { BrandedVideo } from '@/remotion/compositions/BrandedVideo';
import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT, TemplateId } from '@/remotion/constants';

type AllTemplates = TemplateId | 'branded-video';

interface VideoPlayerProps {
  template: AllTemplates;
  props: Record<string, any>;
  durationInSeconds: number;
}

const TEMPLATE_COMPONENTS: Record<AllTemplates, React.ComponentType<any>> = {
  'team-update': TeamUpdate,
  'shoutout': Shoutout,
  'announcement': Announcement,
  'branded-video': BrandedVideo,
};

export default function VideoPlayer({ template, props, durationInSeconds }: VideoPlayerProps) {
  const Component = TEMPLATE_COMPONENTS[template];

  if (!Component) {
    return <div>Unknown template</div>;
  }

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <Player
        component={Component}
        inputProps={{ ...props, durationInSeconds }}
        durationInFrames={durationInSeconds * VIDEO_FPS}
        fps={VIDEO_FPS}
        compositionWidth={VIDEO_WIDTH}
        compositionHeight={VIDEO_HEIGHT}
        style={{ width: '100%' }}
        controls
        autoPlay={false}
      />
    </div>
  );
}
