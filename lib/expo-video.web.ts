// Web shim for expo-video
// expo-video is not fully supported on web, so we provide no-op implementations

export const useVideoPlayer = (uri: string, callback?: (player: any) => void) => {
  // Return a mock player object for web
  const mockPlayer = {
    loop: false,
    muted: false,
    play: () => {},
    pause: () => {},
    replay: () => {},
  };
  
  if (callback) {
    callback(mockPlayer);
  }
  
  return mockPlayer;
};

export const VideoView = () => null; // Return null component on web
