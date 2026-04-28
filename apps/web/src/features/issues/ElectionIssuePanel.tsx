import Link from "next/link";
import type { ElectionIssues } from "@/types";

interface Props {
  issues: ElectionIssues | null;
  electionId: string;
  /** Set of issue tags that have a deep-dive article available. */
  articleTags?: Set<string>;
}

export function ElectionIssuePanel({
  issues,
  electionId,
  articleTags,
}: Props) {
  return (
    <section
      role="complementary"
      aria-label="Election-wide drivers"
      className="rounded-md border border-neutral-200 bg-white p-4"
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
        Election drivers
      </h2>

      {issues ? (
        <>
          <p className="mt-3 text-sm text-neutral-800">{issues.summary}</p>

          {issues.issues.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-xs">
              {issues.issues.map((issue) => {
                const hasArticle = articleTags?.has(issue.tag) ?? false;
                return (
                  <li
                    key={issue.tag}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 truncate">
                      {hasArticle ? (
                        <Link
                          href={`/elections/${electionId}/drivers/${issue.tag}`}
                          className="text-neutral-900 underline underline-offset-2 hover:text-blue-700"
                        >
                          {issue.label}
                        </Link>
                      ) : (
                        <span className="text-neutral-700">{issue.label}</span>
                      )}
                      {hasArticle ? (
                        <span
                          className="text-neutral-500"
                          aria-label="Deep-dive article available"
                        >
                          →
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="font-mono tabular-nums text-neutral-500"
                      aria-label={`weight ${issue.weight.toFixed(2)}`}
                    >
                      {issue.weight.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-3 text-xs text-neutral-600">
            Confidence {issues.confidence.toFixed(2)}
            {issues.source_ids.length > 0
              ? ` · ${issues.source_ids.length} source${issues.source_ids.length === 1 ? "" : "s"}`
              : null}
          </p>

          {issues.confidence < 0.65 ? (
            <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Tentative — insufficient source support
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">Research pending.</p>
      )}
    </section>
  );
}
