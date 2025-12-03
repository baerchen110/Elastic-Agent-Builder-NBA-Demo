/**
 * Sentiment MCP Test Page
 */

import SentimentTester from '../components/SentimentTester';

export default function SentimentTestPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(16,185,129,0.18),_transparent_55%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-sky-200">
            Sentiment Playground
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Explore the NBA sentiment intelligence stack
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-slate-200 md:text-base">
            Run live MCP tools, tune cache behaviour, and inspect responses with a visualization-first JSON explorer.
            This testing surface is built for analysts who need fast, trustworthy insights before shipping commentary
            to fans.
          </p>
          <dl className="mt-10 grid gap-4 text-xs text-slate-300 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <dt className="font-semibold text-slate-100">Connected data feeds</dt>
              <dd className="mt-1 text-slate-300">Twitter/X, Reddit, narrative models</dd>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <dt className="font-semibold text-slate-100">MCP orchestration</dt>
              <dd className="mt-1 text-slate-300">Elastic Agent Builder aggregator</dd>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <dt className="font-semibold text-slate-100">Interactive tooling</dt>
              <dd className="mt-1 text-slate-300">Parameter presets &amp; JSON tree view</dd>
            </div>
          </dl>
        </div>
      </section>

      <main className="relative z-10 -mt-16 pb-20">
        <SentimentTester />
      </main>
    </div>
  );
}
