import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroVideo } from "@/features/marketing/hero-video";
import { MODELS } from "@/providers/registry";
import { quoteCredits } from "@/providers/quote";

const STEPS = [
  {
    n: "01",
    title: "Sign in",
    body: "Email, then a 6-digit code. Same form for every account.",
  },
  {
    n: "02",
    title: "Pick a model",
    body: "Veo and Nano Banana run live from Google AI Studio. Everything else is labelled mock.",
  },
  {
    n: "03",
    title: "Generate and download",
    body: "Credits debit first. You watch a real job, then take the file.",
  },
];

const PLANS = [
  { name: "Free", price: "$0", credits: "5 one-time", note: "No phone wall", highlight: false },
  { name: "Starter", price: "$16.90", credits: "60 / mo", note: "3 at once", highlight: false },
  { name: "Pro", price: "$32.90", credits: "180 / mo", note: "Most people start here", highlight: true },
  { name: "Business", price: "$65.90", credits: "420 / mo", note: "Commercial licence", highlight: false },
];

const GALLERY = [
  { prompt: "A bicycle rolling through honey-colored late light", aspect: "16:9", model: "veo-3-fast", kind: "video" },
  { prompt: "Still life of film canisters on sandstone", aspect: "1:1", model: "nano-banana-2", kind: "image" },
  { prompt: "Rain on a tram window at dusk, shallow focus", aspect: "9:16", model: "veo-3-standard", kind: "video" },
  { prompt: "Paper kites over a dry riverbed", aspect: "4:3", model: "nano-banana-2-4k", kind: "image" },
] as const;

export default function Home() {
  const video = MODELS.filter((m) => m.kind === "video");
  const image = MODELS.filter((m) => m.kind === "image");

  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">
            Video and images, honestly metered
          </p>
          <h1 className="mt-4 text-4xl text-fg sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]">
            Generate video and images.
            <span className="mt-2 block text-fg-muted">Watch honest progress.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
            Hearth runs Veo and Gemini image models from Google AI Studio. You
            see the cost before you click, then a real job — not a fake
            progress bar.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="h-11 px-5">
              <Link href="/auth/login">Get 5 free credits</Link>
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-bg-inset shadow-card">
          <HeroVideo />
        </div>
      </section>

      <section id="models" className="border-t border-border bg-bg-elevated/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">
            Models
          </p>
          <h2 className="mt-3 text-3xl text-fg">Live where the key reaches</h2>
          <p className="mt-3 max-w-2xl text-fg-muted">
            Veo and Nano Banana are live. Sora and Runway stay on the picker as
            mock — labelled, not hidden.
          </p>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <ModelGroup title="Video" models={video} />
            <ModelGroup title="Image" models={image} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">
          From the studio
        </p>
        <h2 className="mt-3 text-3xl text-fg">Output, not stock</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {GALLERY.map((item) => {
            const src = `/api/mock-asset?${new URLSearchParams({
              prompt: item.prompt,
              aspect: item.aspect,
              model: item.model,
              kind: item.kind,
            })}`;
            return (
              <figure
                key={item.prompt}
                className="overflow-hidden rounded-2xl border border-border bg-bg-inset shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={item.prompt}
                  className="aspect-[4/5] w-full object-cover"
                />
              </figure>
            );
          })}
        </div>
      </section>

      <section id="how" className="border-y border-border bg-bg-elevated/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">
            How it works
          </p>
          <h2 className="mt-3 text-3xl text-fg">Three steps. Then a file.</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="rounded-3xl border border-border bg-bg px-5 py-6 shadow-card"
              >
                <p className="font-mono text-xs text-accent">{step.n}</p>
                <h3 className="mt-3 text-xl text-fg">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
        <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">
          Pricing
        </p>
        <h2 className="mt-3 text-3xl text-fg">Credits, not surprise invoices</h2>
        <p className="mt-3 max-w-2xl text-fg-muted">
          Video is ceil(rate × seconds). Images are a flat rate. The number on
          Generate is the number we take.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl border px-5 py-6 shadow-card ${
                plan.highlight
                  ? "border-accent bg-bg-elevated ring-2 ring-accent/20"
                  : "border-border bg-bg-elevated"
              }`}
            >
              <p className="text-sm text-fg-muted">{plan.name}</p>
              <p className="mt-2 font-heading text-3xl text-fg">{plan.price}</p>
              <p className="mt-1 font-mono text-xs text-fg-subtle">{plan.credits}</p>
              <p className="mt-4 text-sm text-fg-muted">{plan.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <Button asChild size="lg" className="h-11 px-5">
            <Link href="/auth/login">Start with 5 credits</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function ModelGroup({
  title,
  models,
}: {
  title: string;
  models: typeof MODELS;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium tracking-wide text-fg-subtle uppercase">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {models.map((m) => {
          const sample = quoteCredits(m, m.capabilities.durations?.[0]);
          return (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg px-4 py-3"
            >
              <span>
                <span className="block font-medium text-fg">{m.label}</span>
                <span className="font-mono text-xs text-fg-subtle">
                  {m.vendor}
                  {m.credits.per === "second"
                    ? ` · ${m.credits.rate} cr/s`
                    : ` · ${sample} cr`}
                  {m.capabilities.audio ? " · audio" : ""}
                </span>
              </span>
              {m.availability === "mock_only" || m.badge ? (
                <span className="font-mono text-[10px] tracking-wide text-accent uppercase">
                  {m.availability === "mock_only" ? "Mock" : m.badge}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
