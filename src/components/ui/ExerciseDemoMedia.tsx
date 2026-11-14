import { useVideoPlayer, VideoView } from "expo-video";
import { Image, StyleSheet, View } from "react-native";

import { Radius } from "@/constants/theme";
import { pickHeroMedia, pickOwnVideo, type ExerciseMediaRecord } from "@/lib/queries/exercise-library";
import { makeLegacyStyles } from "@/lib/theme";

// The demonstration for an exercise: your own clip (a looping, silent video) when staff have uploaded one, otherwise the library picture.
// The clip plays as soon as this is on screen and loops, like the picture does.

function OwnClip({ url, size, label }: { url: string; size: number; label: string }) {
  const styles = useStyles();
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={[styles.media, { width: size, height: size }]}
      contentFit="contain"
      nativeControls={false}
      allowsPictureInPicture={false}
      accessibilityLabel={label}
    />
  );
}

export function ExerciseDemoMedia({ media, name, size = 240 }: { media: ExerciseMediaRecord[]; name: string; size?: number }) {
  const styles = useStyles();
  const clip = pickOwnVideo(media);
  if (clip) return <OwnClip url={clip.url} size={size} label={`${name} demonstration`} />;
  const picture = pickHeroMedia(media);
  if (!picture) return <View style={[styles.media, { width: size, height: size }]} />;
  return <Image source={{ uri: picture.url }} style={[styles.media, { width: size, height: size }]} resizeMode="contain" accessibilityLabel={`${name} demonstration`} />;
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    media: { borderRadius: Radius.md, backgroundColor: Color.surface3 },
  })
);
