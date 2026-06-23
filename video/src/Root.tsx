import {Composition} from "remotion";
import {ReplyLoomPromo} from "./ReplyLoomPromo";

export const RemotionRoot = () => (
  <Composition
    id="ReplyLoomPromo"
    component={ReplyLoomPromo}
    durationInFrames={900}
    fps={30}
    width={1920}
    height={1080}
  />
);
