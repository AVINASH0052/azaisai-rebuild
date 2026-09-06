export type Kind = "video" | "image";
export type Availability = "live" | "mock_only" | "disabled";

export type Model = {
  id: string;
  label: string;
  vendor: string;
  kind: Kind;
  badge?: string;
  availability: Availability;
  providerModel?: string;
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

const GOOGLE = "Google AI Studio";

export const MODELS: Model[] = [
  {
    id: "veo-3-fast",
    label: "Veo 3 Fast",
    vendor: GOOGLE,
    kind: "video",
    badge: "Fast",
    availability: "live",
    providerModel: "veo-3.1-fast-generate-preview",
    credits: { per: "second", rate: 1.5 },
    capabilities: {
      audio: true,
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p"],
    },
    estimatedSeconds: 35,
  },
  {
    id: "veo-3-standard",
    label: "Veo 3",
    vendor: GOOGLE,
    kind: "video",
    badge: "New",
    availability: "live",
    providerModel: "veo-3.1-generate-preview",
    credits: { per: "second", rate: 3 },
    capabilities: {
      audio: true,
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p", "1080p"],
    },
    estimatedSeconds: 60,
  },
  {
    id: "veo-2",
    label: "Veo 2",
    vendor: GOOGLE,
    kind: "video",
    availability: "live",
    providerModel: "veo-2.0-generate-001",
    credits: { per: "second", rate: 3 },
    capabilities: {
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p"],
    },
    estimatedSeconds: 45,
  },
  {
    id: "sora-2",
    label: "Sora Standard",
    vendor: "OpenAI",
    kind: "video",
    badge: "Popular",
    availability: "mock_only",
    credits: { per: "second", rate: 1 },
    capabilities: {
      audio: true,
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p", "1080p"],
    },
    estimatedSeconds: 120,
  },
  {
    id: "sora-2-pro",
    label: "Sora Pro",
    vendor: "OpenAI",
    kind: "video",
    badge: "Premium",
    availability: "mock_only",
    credits: { per: "second", rate: 2 },
    capabilities: {
      audio: true,
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p", "1080p"],
    },
    estimatedSeconds: 180,
  },
  {
    id: "runway-gen4-turbo",
    label: "Gen-4 Turbo",
    vendor: "Runway",
    kind: "video",
    badge: "Popular",
    availability: "mock_only",
    credits: { per: "second", rate: 1 },
    capabilities: {
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
    availability: "mock_only",
    credits: { per: "second", rate: 1.2 },
    capabilities: {
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
    availability: "mock_only",
    credits: { per: "second", rate: 1 },
    capabilities: {
      aspects: VIDEO_ASPECTS,
      resolutions: ["720p"],
    },
    estimatedSeconds: 60,
  },
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    vendor: GOOGLE,
    kind: "image",
    badge: "New",
    availability: "live",
    providerModel: "gemini-2.5-flash-image",
    credits: { per: "image", rate: 1 },
    capabilities: { aspects: IMAGE_ASPECTS, styles: [...IMAGE_STYLES] },
    estimatedSeconds: 8,
  },
  {
    id: "nano-banana-2-4k",
    label: "Nano Banana 2 4K",
    vendor: GOOGLE,
    kind: "image",
    badge: "4K",
    availability: "live",
    providerModel: "gemini-2.5-flash-image",
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
    availability: "mock_only",
    credits: { per: "image", rate: 2 },
    capabilities: { aspects: IMAGE_ASPECTS, styles: [...IMAGE_STYLES] },
    estimatedSeconds: 10,
  },
  {
    id: "runway-gen4-image",
    label: "Gen-4 Image",
    vendor: "Runway",
    kind: "image",
    availability: "mock_only",
    credits: { per: "image", rate: 1 },
    capabilities: { aspects: IMAGE_ASPECTS, styles: [...IMAGE_STYLES] },
    estimatedSeconds: 20,
  },
];

export function modelsFor(kind: Kind) {
  return MODELS.filter((m) => m.kind === kind && m.availability !== "disabled").sort(
    (a, b) => Number(a.availability !== "live") - Number(b.availability !== "live"),
  );
}

export function getModel(id: string) {
  return MODELS.find((m) => m.id === id);
}
