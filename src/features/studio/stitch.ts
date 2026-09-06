const MIMES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
] as const;

export function clipStillPlaying(currentTime: number, ended: boolean, limit?: number) {
  if (ended) return false;
  if (limit != null && currentTime >= limit) return false;
  return true;
}

export function recorderMime(isTypeSupported: (type: string) => boolean) {
  return MIMES.find((type) => isTypeSupported(type)) ?? "";
}

export function stitchFilename(id: string, mime: string) {
  return `hearth-${id}.${mime.includes("mp4") ? "mp4" : "webm"}`;
}

export function imageFilename(id: string, src: string) {
  if (src.startsWith("data:image/jpeg")) return `hearth-${id}.jpg`;
  if (src.startsWith("data:image/webp")) return `hearth-${id}.webp`;
  return `hearth-${id}.png`;
}

function loadVideo(video: HTMLVideoElement, src: string) {
  return new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Could not load a clip to stitch."));
    video.src = src;
    video.load();
  });
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = time;
  });
}

function drawLoop(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  limit: number | undefined,
  onDone: () => void,
) {
  let live = true;
  const stop = () => {
    if (!live) return;
    live = false;
    video.pause();
    onDone();
  };
  const next = (cb: () => void) =>
    "requestVideoFrameCallback" in video
      ? video.requestVideoFrameCallback(cb)
      : requestAnimationFrame(cb);
  const frame = () => {
    if (!live) return;
    ctx.drawImage(video, 0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!clipStillPlaying(video.currentTime, video.ended, limit)) {
      stop();
      return;
    }
    next(frame);
  };
  video.onended = stop;
  video.play().then(() => next(frame)).catch(stop);
}

/** ponytail: realtime canvas+MediaRecorder remux (1× duration). Worker ffmpeg is the upgrade. */
export async function stitchClips(urls: string[], limits?: number[]) {
  if (urls.length < 2) throw new Error("Need two clips to stitch.");
  const mime = recorderMime((t) => MediaRecorder.isTypeSupported(t));
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.setAttribute("playsinline", "");
  video.style.cssText = "position:fixed;left:-9999px;width:2px;height:2px;opacity:0";
  document.body.appendChild(video);

  try {
    await loadVideo(video, urls[0]);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not stitch those clips.");

    const stream = canvas.captureStream(30);
    try {
      const actx = new AudioContext();
      if (actx.state === "suspended") await actx.resume();
      const tap = actx.createMediaElementSource(video);
      const dest = actx.createMediaStreamDestination();
      tap.connect(dest);
      for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
    } catch {
      // muted autoplay still stitches picture if the audio tap is blocked
    }

    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.start(200);

    for (let i = 0; i < urls.length; i++) {
      if (i) await loadVideo(video, urls[i]);
      await seek(video, 0);
      await new Promise<void>((resolve, reject) => {
        video.onerror = () => reject(new Error("A clip failed while stitching."));
        drawLoop(video, ctx, limits?.[i], resolve);
      });
    }

    const stopped = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    if (rec.state !== "inactive") rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    const outMime = rec.mimeType || mime || "video/webm";
    const blob = new Blob(chunks, { type: outMime });
    if (!blob.size) throw new Error("Stitch produced an empty file.");
    return { url: URL.createObjectURL(blob), mime: outMime };
  } finally {
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}
