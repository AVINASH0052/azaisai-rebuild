import Link from "next/link";
import { Bench } from "@/features/marketing/bench";
import { MODELS } from "@/providers/registry";
import { quoteCredits } from "@/providers/quote";

export default function Home() {
  const video = MODELS.filter((m) => m.kind === "video");
  const image = MODELS.filter((m) => m.kind === "image");

  return (
    <main>
      <Bench />

      <section id="models" className="border-t border-[#3a3226] px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.28em] text-[#d7b25a]">
                ON THE BENCH
              </p>
              <h2 className="mt-3 font-heading text-4xl text-[#f6edd8] sm:text-5xl">
                Five live tools. Zero costumes.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[#c9bba0]">
              If we cannot call it, it is not on the picker. Google AI Studio
              only — Veo for motion, Gemini for stills.
            </p>
          </div>
          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="font-mono text-[10px] tracking-[0.2em] text-[#8f846c]">
                  <th className="border-b border-[#3a3226] pb-3 font-medium">MODEL</th>
                  <th className="border-b border-[#3a3226] pb-3 font-medium">KIND</th>
                  <th className="border-b border-[#3a3226] pb-3 font-medium">RATE</th>
                  <th className="border-b border-[#3a3226] pb-3 font-medium">NOTES</th>
                </tr>
              </thead>
              <tbody>
                {[...video, ...image].map((m) => {
                  const sample = quoteCredits(m, m.kind === "video" ? 6 : undefined);
                  return (
                    <tr key={m.id} className="text-[#f6edd8]">
                      <td className="border-b border-[#3a3226]/80 py-4 font-heading text-xl">
                        {m.label}
                      </td>
                      <td className="border-b border-[#3a3226]/80 py-4 font-mono text-xs text-[#c9bba0]">
                        {m.kind}
                      </td>
                      <td className="border-b border-[#3a3226]/80 py-4 font-mono text-xs text-[#d7b25a]">
                        {m.credits.per === "second"
                          ? `${m.credits.rate} / second`
                          : `${sample} / still`}
                      </td>
                      <td className="border-b border-[#3a3226]/80 py-4 font-mono text-xs text-[#8f846c]">
                        {m.capabilities.audio ? "native audio · " : ""}
                        {m.capabilities.resolutions?.join(" / ") ?? "image"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 border-t border-[#3a3226] pt-12 md:flex-row md:items-end">
          <p className="max-w-xl font-heading text-3xl leading-tight text-[#f6edd8] sm:text-4xl">
            First fire is eighty credits. After that, the number on Generate
            is the number we take.
          </p>
          <Link
            href="/auth/login"
            className="shrink-0 rounded-full bg-[#f3ead2] px-5 py-2.5 text-sm text-[#1d1b16] hover:bg-white"
          >
            Open the studio
          </Link>
        </div>
      </section>
    </main>
  );
}
