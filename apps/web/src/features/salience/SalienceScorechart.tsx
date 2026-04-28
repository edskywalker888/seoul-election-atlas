import type { SalienceSentiment, SalienceTopic } from "@/types";
import type { RankedTopic, SalienceView } from "@/lib/loadSalience";

const SENTIMENT_BADGE: Record<
  SalienceSentiment,
  { bg: string; fg: string; label: string }
> = {
  positive: { bg: "#DCFCE7", fg: "#15803D", label: "positive" },
  negative: { bg: "#FEE2E2", fg: "#B91C1C", label: "negative" },
  neutral: { bg: "#F1F5F9", fg: "#475569", label: "neutral" },
  mixed: { bg: "#FEF3C7", fg: "#92400E", label: "mixed" },
};

function RankDelta({ topic }: { topic: RankedTopic }) {
  if (topic.is_new) {
    return (
      <span
        className="inline-flex items-center gap-0.5 font-mono text-blue-700"
        aria-label="new entry"
        title="New in this snapshot"
      >
        ★ new
      </span>
    );
  }
  const change = topic.rank_change ?? 0;
  if (change > 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 font-mono text-green-700"
        aria-label={`moved up ${change} ${change === 1 ? "position" : "positions"}`}
      >
        ▲{change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 font-mono text-red-700"
        aria-label={`moved down ${-change} ${-change === 1 ? "position" : "positions"}`}
      >
        ▼{-change}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 font-mono text-neutral-600"
      aria-label="rank unchanged"
    >
      —
    </span>
  );
}

function SalienceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="flex items-center gap-2"
      title={`Salience ${value.toFixed(2)}`}
    >
      <div className="h-2 w-20 overflow-hidden rounded-sm bg-neutral-200">
        <div
          className="h-full bg-neutral-700"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-neutral-700">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment?: SalienceSentiment }) {
  if (!sentiment) return null;
  const cfg = SENTIMENT_BADGE[sentiment];
  return (
    <span
      className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.fg }}
    >
      {cfg.label}
    </span>
  );
}

function relativeTime(iso: string, now: Date): string {
  const t = new Date(iso).getTime();
  const diffMs = now.getTime() - t;
  const diffH = Math.round(diffMs / 3_600_000);
  if (diffH < 0) return `in ${-diffH}h`;
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}

function formatKST(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3_600_000);
  const Y = kst.getUTCFullYear();
  const M = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const D = String(kst.getUTCDate()).padStart(2, "0");
  const h = String(kst.getUTCHours()).padStart(2, "0");
  const m = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${Y}-${M}-${D} ${h}:${m} KST`;
}

interface Props {
  view: SalienceView;
}

export function SalienceScorechart({ view }: Props) {
  const { current, previous, ranked, dropped } = view;
  const now = new Date();
  const next = new Date(
    new Date(current.captured_at).getTime() + 12 * 3_600_000,
  ).toISOString();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-neutral-200 bg-white px-4 py-3 text-xs">
        <div>
          <span className="uppercase tracking-wide text-neutral-600">
            Last capture
          </span>
          <span className="ml-2 font-mono text-neutral-900">
            {formatKST(current.captured_at)}
          </span>
          <span className="ml-2 text-neutral-600">
            ({relativeTime(current.captured_at, now)})
          </span>
        </div>
        <div>
          <span className="uppercase tracking-wide text-neutral-600">
            Next due
          </span>
          <span className="ml-2 font-mono text-neutral-900">
            {formatKST(next)}
          </span>
        </div>
        <div>
          <span className="uppercase tracking-wide text-neutral-600">
            Method
          </span>
          <span className="ml-2 font-mono text-neutral-900">
            {current.method}
          </span>
          {current.model ? (
            <span className="ml-1 text-neutral-600">· {current.model}</span>
          ) : null}
        </div>
        {previous ? (
          <div>
            <span className="uppercase tracking-wide text-neutral-600">
              Δ vs
            </span>
            <span className="ml-2 font-mono text-neutral-900">
              {formatKST(previous.captured_at)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-600">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Δ</th>
              <th className="px-2 py-2 font-medium">Topic</th>
              <th className="px-2 py-2 font-medium">Salience</th>
              <th className="px-2 py-2 font-medium">Sentiment</th>
              <th className="px-2 py-2 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((t) => (
              <tr
                key={t.topic_en}
                className="border-b border-neutral-100 align-top last:border-0"
              >
                <td className="px-4 py-3 font-mono text-neutral-900">
                  {t.rank}
                </td>
                <td className="px-2 py-3 text-xs">
                  <RankDelta topic={t} />
                </td>
                <td className="px-2 py-3">
                  <div className="font-medium text-neutral-900" lang="ko">
                    {t.topic_ko}
                  </div>
                  <div className="text-xs text-neutral-600">{t.topic_en}</div>
                  {t.issue_tag ? (
                    <div className="mt-0.5 font-mono text-[10px] text-neutral-600">
                      {t.issue_tag}
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-3">
                  <SalienceBar value={t.salience} />
                </td>
                <td className="px-2 py-3">
                  <SentimentBadge sentiment={t.sentiment} />
                </td>
                <td className="px-2 py-3 text-xs text-neutral-700">
                  {t.summary}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dropped.length > 0 ? (
        <div className="mt-3 rounded-md border border-neutral-200 bg-white p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-600">
            Dropped from previous capture
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-neutral-700">
            {dropped.map((t: SalienceTopic) => (
              <li key={t.topic_en} className="flex items-baseline gap-2">
                <span className="font-mono text-neutral-600">
                  was #{t.rank}
                </span>
                <span className="text-neutral-900" lang="ko">
                  {t.topic_ko}
                </span>
                <span className="text-neutral-600">· {t.topic_en}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
