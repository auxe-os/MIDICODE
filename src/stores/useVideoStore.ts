import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Video {
  id: string;
  url: string;
  title: string;
  artist?: string;
}

// Strongly type the plain state slice returned by getInitialState
type VideoStateData = Pick<
  VideoStoreState,
  "videos" | "currentVideoId" | "loopAll" | "loopCurrent" | "isShuffled" | "isPlaying"
>;

export const DEFAULT_VIDEOS: Video[] = [
  {
    id: "8UMhBsEj8f4",
    url: "https://youtu.be/8UMhBsEj8f4",
    title: "D33P3R",
    artist: "Mike WiLL Made-It",
  },
  {
    id: "DfiPqM3ONR0",
    url: "https://youtu.be/DfiPqM3ONR0",
    title: "I Just Bought a Bugatti (I'm Happy)",
    artist: "IceJJFish",
  },
  {
    id: "AHyJhTMuOd4",
    url: "https://youtu.be/AHyJhTMuOd4",
    title: "BREAKING: MC Name Change???",
    artist: "omhOS NEWS",
  },
  {
    id: "aLTAqWwmcLY",
    url: "https://youtu.be/aLTAqWwmcLY",
    title: "Ghost Vocalist",
    artist: "IceJJFish",
  },
  {
    id: "JSrZ7Qg8j9c",
    url: "https://youtu.be/JSrZ7Qg8j9c",
    title: "TRUNKS CORE",
    artist: "Dragonball Z",
  },
  {
    id: "GJuYvLPPm0s",
    url: "https://youtu.be/GJuYvLPPm0s",
    title: "BAD TIME",
    artist: "Lil Tecca",
  },
  {
    id: "ljHdccyQbT4",
    url: "https://youtu.be/ljHdccyQbT4",
    title: "SUGAR ON MY TONGUE",
    artist: "Tyler, The Creator",
  },
  {
    id: "6OxmafNPn3o",
    url: "https://youtu.be/6OxmafNPn3o",
    title: "LIL DEMON",
    artist: "FUTURE",
  },
  {
    id: "rKFYeod_1Fo",
    url: "https://youtu.be/rKFYeod_1Fo",
    title: "Cops & Robbers",
    artist: "Skepta",
  },
  {
    id: "3TtEay45sE8",
    url: "https://youtu.be/3TtEay45sE8",
    title: 'Lost All My Feelings',
    artist: "SahBabii",
  },
  {
    id: "CHRiakgTjuk",
    url: "https://youtu.be/CHRiakgTjuk",
    title: "Smooth Jazz",
    artist: "Skepta",
  },
  {
    id: "4duftbSZkxs",
    url: "https://youtu.be/4duftbSZkxs",
    title: "namesbliss, DeeRiginal, Pozzy, Saiming and Melvillous w/ Sir Spyro",
    artist: "BBC 1 Xtra",
  },
  {
    id: "qSRjlIko0VY",
    url: "https://youtu.be/qSRjlIko0VY",
    title: "Oblig with namesbliss, Melvillous & Saiming",
    artist: "Rinse FM",
  },
  {
    id: "TG1Vt7Czs8g",
    url: "https://www.youtube.com/watch?v=TG1Vt7Czs8g",
    title: "COCONUT",
    artist: "Sailorr",
  },
  {
    id: "PXWUU3qH0vw",
    url: "https://www.youtube.com/watch?v=PXWUU3qH0vw",
    title: "BBK",
    artist: "Unknown T",
  },
  {
    id: "tJdsQSNsaX8",
    url: "https://www.youtube.com/watch?v=tJdsQSNsaX8",
    title: "Twin Flame",
    artist: "tendai",
  },
  {
    id: "5nADiECRQWc",
    url: "https://www.youtube.com/watch?v=5nADiECRQWc",
    title: "On Ur Time",
    artist: "Natanya",
  },
  {
    id: "wLb9g_8r-mE",
    url: "https://youtu.be/wLb9g_8r-mE",
    title: "A Conversation with Jony Ive",
    artist: "Jony Ive",
  },
  {
    id: "TQhv6Wol6Ns",
    url: "https://www.youtube.com/watch?v=TQhv6Wol6Ns&t=26s",
    title: "Our designer built an OS with Cursor",
    artist: "Cursor",
  },
];

interface VideoStoreState {
  videos: Video[];
  currentVideoId: string | null;
  loopAll: boolean;
  loopCurrent: boolean;
  isShuffled: boolean;
  isPlaying: boolean;
  // derived caches (not persisted)
  videoIndexById: Record<string, number>;
  videoById: Record<string, Video>;
  // actions
  setVideos: (videos: Video[] | ((prev: Video[]) => Video[])) => void;
  setCurrentVideoId: (videoId: string | null) => void;
  setLoopAll: (val: boolean) => void;
  setLoopCurrent: (val: boolean) => void;
  setIsShuffled: (val: boolean) => void;
  togglePlay: () => void;
  setIsPlaying: (val: boolean) => void;
  // derived state helpers
  getCurrentIndex: () => number;
  getCurrentVideo: () => Video | null;
}

const CURRENT_VIDEO_STORE_VERSION = 8; // Clean ID-based version

const getInitialState = (): VideoStateData => ({
  videos: DEFAULT_VIDEOS,
  currentVideoId: DEFAULT_VIDEOS.length > 0 ? DEFAULT_VIDEOS[0].id : null,
  loopAll: true,
  loopCurrent: false,
  isShuffled: false,
  isPlaying: false,
});

// Internal helper to build lookup caches
const buildVideoCaches = (videos: Video[]) => {
  const videoIndexById: Record<string, number> = {};
  const videoById: Record<string, Video> = {};
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    videoIndexById[v.id] = i;
    videoById[v.id] = v;
  }
  return { videoIndexById, videoById };
};

// Capture store setters/getters for use in lifecycle callbacks that don't receive them directly
let __setRef: ((partial: Partial<VideoStoreState> | ((state: VideoStoreState) => Partial<VideoStoreState>)) => void) | undefined;
let __getRef: (() => VideoStoreState) | undefined;

export const useVideoStore = create<VideoStoreState>()(
  persist(
    (set, get) => ({
      // keep refs updated for use in onRehydrateStorage
      ...(function () {
        __setRef = set;
        __getRef = get;
        return {} as Record<string, never>;
      })(),
      ...getInitialState(),
      // initialize caches from defaults
      ...buildVideoCaches(DEFAULT_VIDEOS),

      setVideos: (videosOrUpdater) => {
        set((state) => {
          const maybeNewVideos =
            typeof videosOrUpdater === "function"
              ? (videosOrUpdater as (prev: Video[]) => Video[])(state.videos)
              : videosOrUpdater;

          const newVideos = Array.isArray(maybeNewVideos) ? maybeNewVideos : [];
          if (!Array.isArray(maybeNewVideos)) {
            // eslint-disable-next-line no-console
            console.warn("useVideoStore.setVideos: non-array provided; falling back to empty list");
          }

          // Validate currentVideoId when videos change (preserve null if explicitly unset)
          let currentVideoId = state.currentVideoId;
          if (currentVideoId && !newVideos.find((v) => v.id === currentVideoId)) {
            currentVideoId = newVideos.length > 0 ? newVideos[0].id : null;
          }

          // Soft URL validation (non-intrusive): log any non-http(s) URL and duplicate IDs to aid debugging
          try {
            const badUrl = newVideos.filter((v) => !/^https?:\/\//i.test(v.url));
            if (badUrl.length) {
              // eslint-disable-next-line no-console
              console.warn(
                "useVideoStore: videos with non-http(s) URL detected:",
                badUrl.map((v) => v.id)
              );
            }
            const idCounts = newVideos.reduce<Record<string, number>>((acc, v) => {
              acc[v.id] = (acc[v.id] || 0) + 1;
              return acc;
            }, {});
            const dupes = Object.keys(idCounts).filter((k) => idCounts[k] > 1);
            if (dupes.length) {
              // eslint-disable-next-line no-console
              console.warn("useVideoStore: duplicate video ids detected:", dupes);
            }
          } catch (error) {
            console.warn("useVideoStore: failed to validate videos", error);
          }

          const caches = buildVideoCaches(newVideos);

          return {
            videos: newVideos,
            currentVideoId,
            ...caches,
          };
        });
      },
      setCurrentVideoId: (videoId) =>
        set((state) => {
          // Ensure videoId exists in videos array
          const validVideoId =
            videoId && state.videos.find((v) => v.id === videoId)
              ? videoId
              : null;
          return { currentVideoId: validVideoId };
        }),
      setLoopAll: (val) => set({ loopAll: val }),
      setLoopCurrent: (val) => set({ loopCurrent: val }),
      setIsShuffled: (val) => set({ isShuffled: val }),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setIsPlaying: (val) => set({ isPlaying: val }),

      // Derived state helpers
      getCurrentIndex: () => {
        const { currentVideoId, videoIndexById } = get();
        return currentVideoId ? videoIndexById[currentVideoId] ?? -1 : -1;
      },
      getCurrentVideo: () => {
        const { currentVideoId, videoById } = get();
        return currentVideoId ? videoById[currentVideoId] ?? null : null;
      },
    }),
    {
      name: "midicode:videos",
      version: CURRENT_VIDEO_STORE_VERSION,
      migrate: () => {
        console.log(
          `Migrating video store to clean ID-based version ${CURRENT_VIDEO_STORE_VERSION}`
        );
        // Always reset to defaults for clean start
        const base = getInitialState();
        return {
          ...base,
          ...buildVideoCaches(base.videos),
        } as any;
      },
      // Persist videos array to prevent ID-based errors
      partialize: (state) => ({
        videos: state.videos,
        currentVideoId: state.currentVideoId,
        loopAll: state.loopAll,
        loopCurrent: state.loopCurrent,
        isShuffled: state.isShuffled,
      }),
      // After rehydration, ensure the currentVideoId still exists in the videos list
      onRehydrateStorage: () => () => {
        try {
          const vids: Video[] = __getRef?.().videos ?? [];
          const cur: string | null = __getRef?.().currentVideoId ?? null;

          // rebuild caches after load (not persisted)
          __setRef?.(buildVideoCaches(vids));

          if (cur && !vids.some((v) => v.id === cur)) {
            __setRef?.({ currentVideoId: vids.length ? vids[0].id : null });
          }
        } catch {
          // no-op
        }
      },
    }
  )
);
