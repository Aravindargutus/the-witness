import { Composition } from 'remotion';
import { WitnessVideo } from './WitnessVideo.jsx';

// 3 minutes = 180 seconds × 30fps = 5400 frames
export const Root = () => (
  <Composition
    id="WitnessVideo"
    component={WitnessVideo}
    durationInFrames={5400}
    fps={30}
    width={1920}
    height={1080}
  />
);
