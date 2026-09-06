import {
  PLATFORM_DEFAULTS,
  type EffectivePolicy,
  type LimitKey,
  type LimitSource,
  type LimitValue,
} from "./defaults";

type Layer = Partial<Record<LimitKey, LimitValue | null>>;

function isNum(v: LimitValue): v is number {
  return typeof v === "number";
}

export function layerPolicies(
  base: Record<LimitKey, LimitValue>,
  plan: Layer,
  override: Layer,
): Pick<EffectivePolicy, "limits" | "source"> {
  const limits = { ...base };
  const source = Object.fromEntries(
    Object.keys(base).map((k) => [k, "platform"]),
  ) as Record<LimitKey, LimitSource>;

  for (const [layer, tag] of [
    [plan, "plan"],
    [override, "override"],
  ] as const) {
    for (const key of Object.keys(base) as LimitKey[]) {
      const next = layer[key];
      if (next === undefined || next === null) continue;
      limits[key] = next;
      source[key] = tag;
    }
  }
  return { limits, source };
}

export function clampPolicy(
  merged: Pick<EffectivePolicy, "limits" | "source">,
  clamps: Layer,
): Pick<EffectivePolicy, "limits" | "source"> {
  const limits = { ...merged.limits };
  const source = { ...merged.source };
  for (const key of Object.keys(limits) as LimitKey[]) {
    const cap = clamps[key];
    if (cap === undefined || cap === null) continue;
    const cur = limits[key];
    if (isNum(cur) && isNum(cap) && cap < cur) {
      limits[key] = cap;
      source[key] = "clamp";
    }
    if (typeof cur === "boolean" && typeof cap === "boolean") {
      limits[key] = cur && cap;
      if (cur && !cap) source[key] = "clamp";
    }
    if (Array.isArray(cur) && Array.isArray(cap)) {
      const next = cur.filter((x) => cap.includes(x));
      if (next.length !== cur.length) {
        limits[key] = next;
        source[key] = "clamp";
      }
    }
  }
  return { limits, source };
}

/** Fail-open: callers catch and use this when resolution throws. */
export function fallbackPolicy(): EffectivePolicy {
  const { limits, source } = layerPolicies(PLATFORM_DEFAULTS, {}, {});
  return { limits, source, state: "active", version: 0, expiresAt: null };
}

export function resolveFromLayers(input: {
  plan?: Layer;
  override?: Layer;
  clamps?: Layer;
  state?: EffectivePolicy["state"];
  version?: number;
  expiresAt?: string | null;
}): EffectivePolicy {
  try {
    const layered = layerPolicies(
      PLATFORM_DEFAULTS,
      input.plan ?? {},
      input.override ?? {},
    );
    const clamped = clampPolicy(layered, input.clamps ?? {});
    return {
      ...clamped,
      state: input.state ?? "active",
      version: input.version ?? 0,
      expiresAt: input.expiresAt ?? null,
    };
  } catch {
    return fallbackPolicy();
  }
}
