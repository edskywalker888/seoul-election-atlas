import Link from "next/link";
import { notFound } from "next/navigation";
import { tryLoadElection } from "@/lib/loadElection";
import { loadArticle, loadSources } from "@/lib/loadArticle";

export default async function DriverArticlePage({
  params,
}: {
  params: Promise<{ electionId: string; tag: string }>;
}) {
  const { electionId, tag } = await params;

  const election = await tryLoadElection(electionId);
  if (!election) notFound();

  const article = await loadArticle(electionId, tag);
  if (!article) notFound();

  const sources = await loadSources();

  // Confidence presentation matches the panels: < 0.65 = tentative.
  const tentative = article.confidence < 0.65;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href={`/elections/${electionId}`}
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← {election.name_en}
      </Link>

      <header className="mt-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Election drivers · {article.tag}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          {article.title}
        </h1>
        {article.subtitle ? (
          <p className="mt-1 text-base text-neutral-700">{article.subtitle}</p>
        ) : null}
      </header>

      {tentative ? (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Tentative — limited source support (confidence{" "}
          {article.confidence.toFixed(2)})
        </p>
      ) : null}

      <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm text-neutral-800">{article.thesis}</p>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <article className="space-y-6">
          {article.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-medium text-neutral-900">
                {s.heading}
              </h2>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-neutral-800">
                {s.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <aside className="space-y-4">
          {article.key_data_points.length > 0 ? (
            <section
              role="complementary"
              aria-label="Key data points"
              className="rounded-md border border-neutral-200 bg-white p-3"
            >
              <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Key data points
              </h2>
              <ul className="mt-3 space-y-3 text-xs">
                {article.key_data_points.map((d, i) => (
                  <li key={i}>
                    <p className="font-medium text-neutral-900">{d.label}</p>
                    <p className="font-mono tabular-nums text-neutral-700">
                      {d.value}
                    </p>
                    {d.date ? (
                      <p className="text-neutral-600">{d.date}</p>
                    ) : null}
                    <p className="mt-0.5 text-neutral-600">
                      Source:{" "}
                      <span className="font-mono">{d.source_id}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            role="complementary"
            aria-label="Sources"
            className="rounded-md border border-neutral-200 bg-white p-3"
          >
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Sources
            </h2>
            <ul className="mt-3 space-y-2 text-xs">
              {article.source_ids.map((id) => {
                const s = sources[id];
                return (
                  <li key={id}>
                    {s ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-800 underline-offset-2 hover:underline"
                      >
                        {s.title}
                      </a>
                    ) : (
                      <span className="font-mono text-neutral-700">{id}</span>
                    )}
                    {s ? (
                      <p className="text-neutral-600">
                        Tier {s.tier}
                        {s.credibility_weight
                          ? ` · ${s.credibility_weight} credibility`
                          : ""}{" "}
                        · retrieved {s.retrieved_at}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
            <p>
              Confidence{" "}
              <span className="font-mono">
                {article.confidence.toFixed(2)}
              </span>{" "}
              · last updated {article.last_updated}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
