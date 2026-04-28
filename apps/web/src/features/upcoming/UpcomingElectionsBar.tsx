import type { UpcomingElection, UpcomingElectionType } from "@/types";

interface Props {
  elections: UpcomingElection[];
}

const TYPE_LABEL: Record<UpcomingElectionType, string> = {
  local: "Local",
  national_assembly: "National Assembly",
  presidential: "Presidential",
  by_election: "By-election",
};

const TYPE_DOT: Record<UpcomingElectionType, string> = {
  local: "#0EA5E9",
  national_assembly: "#7C3AED",
  presidential: "#DC2626",
  by_election: "#6B7280",
};

function daysUntil(isoDate: string, today: Date): number {
  const target = new Date(`${isoDate}T00:00:00`);
  const ms = target.getTime() - today.getTime();
  return Math.ceil(ms / 86400000);
}

// Server component. Re-renders per request, so D-days stay accurate
// without static-build staleness for dev/SSR. For static export, would need
// a client-side refresh; not the current path.
export function UpcomingElectionsBar({ elections }: Props) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const computed = elections
    .map((e) => ({ ...e, daysUntil: daysUntil(e.date, today) }))
    .filter((e) => e.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (computed.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Upcoming Korean elections"
      className="border-b border-neutral-200 bg-white"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-6 py-2 text-xs">
        <span className="font-medium uppercase tracking-wide text-neutral-600">
          Upcoming
        </span>
        {computed.map((e) => (
          <span
            key={e.id}
            className="flex items-center gap-1.5"
            title={`${e.name_ko} · ${e.date}${e.estimated ? " (estimated)" : ""}${e.notes ? "\n" + e.notes : ""}`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: TYPE_DOT[e.type] }}
              aria-hidden="true"
            />
            <span
              className="font-mono font-semibold tabular-nums text-neutral-900"
              aria-label={`${e.daysUntil} days until ${TYPE_LABEL[e.type]} election`}
            >
              D-{e.daysUntil}
            </span>
            <span className="text-neutral-700">{TYPE_LABEL[e.type]}</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-600">{e.date}</span>
            {e.estimated ? (
              <span className="text-neutral-500">(est.)</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
