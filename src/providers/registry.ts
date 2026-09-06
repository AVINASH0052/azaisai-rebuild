export type Kind = "video" | "image";

export type Model = {
  id: string;
  label: string;
  vendor: string;
  kind: Kind;
  badge?: string;
  credits: { per: "second" | "image"; rate: number };
  capabilities: {
    audio?: boolean;
    durations?: number[];
    aspects: string[];
    resolutions?: string[];
    styles?: string[];
  };
  estimatedSeconds: number;
};

const VIDEO_ASPECTS = ["16:9", "9:16"];
const IMAGE_ASPECTS = ["16:9", "1:1", "9:16", "4:3", "3:4"];
export const IMAGE_STYLES = [
  "None",
  "Cinematic",
  "Anime",
  "Photo",
  "Illustration",
  "Abstract",
] as const;

export const MODELS: Model[] = [
  {
    id: "sora-2",
    label: "Sora Standard",
    vendor: "OpenAI",
    kind: "video",
    badge: "Popular",
    credits: { per: "second", rate: 1 },
    capabilities: {
      audio: true,
      durations: [4, 6, 8],
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p", "1080p"],
    },
    estimatedSeconds: 120,
  },
  {
    id: "veo-3-fast",
    label: "Veo 3 Fast",
    vendor: "Google",
    kind: "video",
    badge: "Fast",
    credits: { per: "second", rate: 1.5 },
    capabilities: {
      audio: true,
      durations: [4, 6, 8],
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p"],
    },
    estimatedSeconds: 35,
  },
  {
    id: "sora-2-pro",
    label: "Sora Pro",
    vendor: "OpenAI",
    kind: "video",
    badge: "Premium",
    credits: { per: "second", rate: 2 },
    capabilities: {
      audio: true,
      durations: [4, 6, 8],
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p", "1080p"],
    },
    estimatedSeconds: 180,
  },
  {
    id: "veo-2",
    label: "Veo 2",
    vendor: "Google",
    kind: "video",
    credits: { per: "second", rate: 3 },
    capabilities: {
      durations: [4, 6, 8],
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p"],
    },
    estimatedSeconds: 45,
  },
  {
    id: "veo-3-standard",
    label: "Veo 3",
    vendor: "Google",
    kind: "video",
    badge: "New",
    credits: { per: "second", rate: 3 },
    capabilities: {
      audio: true,
      durations: [4, 6, 8],
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p", "1080p"],
    },
    estimatedSeconds: 60,
  },
  {
    id: "runway-gen4-turbo",
    label: "Gen-4 Turbo",
    vendor: "Runway",
    kind: "video",
    badge: "Popular",
    credits: { per: "second", rate: 1 },
    capabilities: {
      durations: [4, 6, 8],
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p"],
    },
    estimatedSeconds: 120,
  },
  {
    id: "runway-gen4-5",
    label: "Gen-4.5",
    vendor: "Runway",
    kind: "video",
    badge: "Premium",
    credits: { per: "second", rate: 1.2 },
    capabilities: {
      durations: [4, 6, 8],
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p", "1080p"],
    },
    estimatedSeconds: 120,
  },
  {
    id: "runway-gen3-alpha-turbo",
    label: "Gen-3 Alpha Turbo",
    vendor: "Runway",
    kind: "video",
    badge: "Fast",
    credits: { per: "second", rate: 1 },
    capabilities: {
      durations: [4, 6, 8],
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p"],
    },
    estimatedSeconds: 60,
  },
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    vendor: "Google",
    kind: "image",
    badge: "New",
    credits: { per: "image", rate: 1 },
    capabilities: { aspects: IMAGE_ASPECTS, styles: [...IMAGE_STYLES] },
    estimatedSeconds: 8,
  },
  {
    id: "nano-banana-2-4k",
    label: "Nano Banana 2 4K",
    vendor: "Google",
    kind: "image",
    badge: "4K",
    credits: { per: "image", rate: 2 },
    capabilities: { aspects: IMAGE_ASPECTS, styles: [...IMAGE_STYLES] },
    estimatedSeconds: 15,
  },
  {
    id: "gpt-image",
    label: "GPT Image",
    vendor: "OpenAI",
    kind: "image",
    badge: "Premium",
    credits: { per: "image", rate: 2 },
    capabilities: { aspects: IMAGE_ASPECTS, styles: [...IMAGE_STYLES] },
    estimatedSeconds: 10,
  },
  {
    id: "runway-gen4-image",
    label: "Gen-4 Image",
    vendor: "Runway",
    kind: "image",
    credits: { per: "image", rate: 1 },
    capabilities: { aspects: IMAGE_ASPECTS, styles: [...IMAGE_STYLES] },
    estimatedSeconds: 20,
  },
];

export function modelsFor(kind: Kind) {
  return MODELS.filter((m) => m.kind === kind);
}

export function getModel(id: string) {
  return MODELS.find((m) => m.id === id);
}
