'use client';

import { Player } from '@remotion/player';
import { TeamUpdate, TeamUpdateProps } from '@/remotion/compositions/TeamUpdate';
import { Shoutout, ShoutoutProps } from '@/remotion/compositions/Shoutout';
import { Announcement, AnnouncementProps } from '@/remotion/compositions/Announcement';
import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT, TemplateId } from '@/remotion/constants';

interface VideoPlayerProps {
  template: TemplateId;
  props: Record<string, any>;
  durationInSeconds: number;
}

const TEMPLATE_COMPONENTS: Record<TemplateId, React.ComponentType<any>> = {
  'team-update': TeamUpdate,
  'shoutout': Shoutout,
  'announcement': Announcement,
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
