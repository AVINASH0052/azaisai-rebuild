export async function captureLastFrame(src: string) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = src;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not load the clip."));
  });
  await video.play().catch(() => undefined);
  video.pause();
  const t = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.08) : 0;
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("Could not seek the clip."));
    video.currentTime = t;
  });
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture a frame.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
  const data = dataUrl.split(",")[1];
  if (!data) throw new Error("Could not capture a frame.");
  return { mimeType: "image/jpeg" as const, data };
}
