import {Composition, Still} from "remotion";
import {ReplyLoomPromo} from "./ReplyLoomPromo";
import {TopPromo} from "./TopPromo";

export const RemotionRoot = () => (
  <>
    <Composition
      id="ReplyLoomPromo"
      component={ReplyLoomPromo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
    <Still id="ReplyLoomTopPromo" component={TopPromo} width={1400} height={560} />
  </>
);
