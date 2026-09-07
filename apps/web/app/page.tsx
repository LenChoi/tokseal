import Link from 'next/link';
import { renderCard, reportFromSubmission, gradeFromSubmission } from '@tokseal/core';
import { getLeaderboard, getSubmissionCount } from '@/lib/db';
import { DEMO } from '@/lib/env';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { CopyBlock } from '@/components/CopyBlock';
import { Pixel } from '@/components/pixel/Pixel';
import { seal, coin, rocket, robot, arrow } from '@/components/pixel/sprites';
import { Typer } from '@/components/pixel/Typer';
import { Marquee } from '@/components/pixel/Marquee';

export const revalidate = 300;

const GROUND = 'bg-[repeating-linear-gradient(90deg,#3b2a60_0_24px,#2b1e48_24px_48px)] border-t-4 border-line-hi';

export default async function Home() {
  const [rows, count] = await Promise.all([getLeaderboard(10), getSubmissionCount()]);
  const top = rows[0];
  const preview = top
    ? renderCard(reportFromSubmission(top.submission), gradeFromSubmission(top.submission), { username: top.login, theme: 'pixel' })
    : null;

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="relative -mx-5 overflow-hidden px-5">
        <div className="mx-auto grid min-h-[86vh] max-w-6xl items-center gap-10 py-16 md:grid-cols-[1.15fr_1fr]">
          <div className="reveal in">
            <p className="mb-6 font-pixel text-[10px] uppercase tracking-[.25em] text-coral"><i className="px-dot" />token + seal · v0.1</p>
            <h1 className="text-[22px] leading-[1.6] sm:text-[28px] md:text-[34px]">
              <span className="px-hl">SEAL YOUR</span>
              <br />
              <span className="text-coral">AI CODING</span>
              <br />
              USAGE.
            </h1>
            <p className="mt-8 max-w-xl text-[22px] text-muted">
              tokseal reads your local Claude Code sessions, grades how hard you lean on AI
              <span className="text-gold"> (S → C)</span>, and mints a card for your GitHub profile.
              Parsing happens on <span className="text-mint">your machine</span>. Nothing is uploaded unless you opt in.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/leaderboard" className="px-btn">▶ HI-SCORES</Link>
              <a href="https://github.com/LenChoi/tokseal" className="px-btn px-btn--ghost">★ STAR ON GITHUB</a>
            </div>
            <div className="mt-8 max-w-md">
              <CopyBlock text="npx tokseal" label="Insert coin" />
            </div>
          </div>

          <div className="relative mx-auto h-[360px] w-full max-w-[420px] md:h-[440px]">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Pixel sprite={seal} size={14} className="anim-float drop-shadow-[0_24px_0_#07040f]" />
            </div>
            <div className="absolute left-[6%] top-[12%] anim-bob" style={{ animationDelay: '.3s' }}><Pixel sprite={coin} size={5} className="anim-spin" /></div>
            <div className="absolute right-[8%] top-[20%] anim-bob" style={{ animationDelay: '.6s' }}><Pixel sprite={coin} size={4} className="anim-spin" /></div>
            <div className="absolute bottom-[16%] left-[4%] anim-bob" style={{ animationDelay: '.9s' }}><Pixel sprite={coin} size={6} className="anim-spin" /></div>
            <div className="absolute right-[2%] bottom-[8%] anim-float" style={{ animationDelay: '.5s' }}><Pixel sprite={rocket} size={6} className="-rotate-12" /></div>
            <div className="absolute left-1/2 top-[6%] -translate-x-1/2 font-pixel text-[9px] text-muted">
              <span className="anim-blink">GRADE: A-</span>
            </div>
          </div>
        </div>

        {/* ground */}
        <div className="relative mx-auto max-w-6xl">
          <div className="absolute -top-[60px] left-[8%]"><Pixel sprite={robot} size={5} className="anim-bob" /></div>
          <div className="absolute -top-[26px] right-[10%] anim-bob"><Pixel sprite={arrow} size={3} /></div>
        </div>
        <div className={`-mx-5 h-16 ${GROUND}`} />
        <div className="-mx-5 h-6 bg-[#120b22]" />
      </section>

      <div className="-mx-5"><Marquee items={['local-first', 'no api key', 'no signup', 'grade S → C', 'svg card for github', 'opt-in leaderboard', 'mit licensed', 'claude code · codex · gemini soon']} /></div>

      {/* ---------------- STAGE 1: TERMINAL + CARD ---------------- */}
      <section className="py-24">
        <SectionTitle kicker="STAGE 1" title="RUN IT. NO INSTALL." />
        <div className="mt-12 grid items-start gap-10 md:grid-cols-2">
          <div className="reveal px-panel px-panel--hi relative p-5 scanlines">
            <div className="mb-3 flex items-center gap-2 font-pixel text-[9px] text-muted">
              <i className="inline-block h-3 w-3 bg-coral" /><i className="inline-block h-3 w-3 bg-gold" /><i className="inline-block h-3 w-3 bg-mint" />
              <span className="ml-2">~ zsh</span>
            </div>
            <Typer />
          </div>
          <div className="reveal" data-delay="1">
            <div className="px-panel relative overflow-hidden p-3 scanlines">
              {preview ? (
                <div className="w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: preview }} />
              ) : (
                <div className="p-10 text-center text-muted">No cards yet</div>
              )}
            </div>
            <p className="mt-4 text-center text-muted">
              Live SVG at <code className="text-fg">/api/card?user=…&amp;theme=pixel|dark|light</code>. Real 5×7 bitmap glyphs, so it renders pixel-perfect in any README.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- HI-SCORES ---------------- */}
      <section className="py-12">
        <SectionTitle kicker="HI-SCORES" title="TOP PLAYERS" right={<span className="text-muted">{count} sealed{DEMO && ' · demo data'} · <Link href="/leaderboard" className="text-coral">see all →</Link></span>} />
        <div className="reveal mt-10"><LeaderboardTable rows={rows} compact /></div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="py-24">
        <SectionTitle kicker="STAGE 2" title="HOW THE GRADE WORKS" />
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            ['01', 'PARSE', 'Reads token counts, model ids and timestamps from ~/.claude/projects. Never message content, never file paths.'],
            ['02', 'GRADE', 'Four signals: tokens, active days, messages, sessions. Smoothed with an exponential CDF, the curve github-readme-stats uses for rank. No cliffs, no single-metric farming.'],
            ['03', 'SEAL', 'Renders a static SVG card. Optionally submit aggregate totals to the hi-score board with tokseal submit.'],
          ].map(([n, t, d], i) => (
            <div key={n} className="reveal px-panel p-6" data-delay={String(i)}>
              <div className="font-pixel text-[28px] text-coral">{n}</div>
              <h3 className="mt-3 text-[13px]">{t}</h3>
              <p className="mt-3 text-muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="reveal mt-10 flex flex-wrap items-center justify-center gap-3 font-pixel text-[10px]">
          {['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'].map((g) => (
            <span key={g} className="px-panel px-3 py-2" style={{ color: { S: '#ffd45e', 'A+': '#7ff0c1', A: '#7ff0c1', 'A-': '#7ff0c1', 'B+': '#7cc4ff', B: '#7cc4ff', 'B-': '#7cc4ff' }[g] ?? '#c4a5ff' }}>{g}</span>
          ))}
          <span className="ml-2 text-muted">← top 1% … top 100%</span>
        </div>
      </section>

      {/* ---------------- PRIVACY ---------------- */}
      <section className="py-12">
        <SectionTitle kicker="STAGE 3" title="PRIVACY IS THE BOSS FIGHT" />
        <div className="reveal mt-10 grid gap-6 md:grid-cols-2">
          <ul className="px-panel space-y-3 p-6 text-[21px]">
            {[
              ['✓', 'Parsing runs entirely on your machine, in a few hundred lines of dependency-light TypeScript.'],
              ['✓', 'Individual messages and code are never read for content.'],
              ['✓', 'The leaderboard is opt-in: tokseal login + tokseal submit.'],
              ['✓', 'The upload is exactly toSubmission(): totals, per-model totals, grade, date range. Read it in the repo.'],
              ['✗', 'No message content. No file paths. No project names. No session ids.'],
            ].map(([m, t]) => (
              <li key={t} className="flex gap-3"><span className={`font-pixel text-[12px] ${m === '✓' ? 'text-mint' : 'text-coral'}`}>{m}</span><span className="text-muted">{t}</span></li>
            ))}
          </ul>
          <div className="space-y-4">
            <CopyBlock label="Opt in (totals only)" text="npx tokseal login && npx tokseal submit" />
            <CopyBlock label="README" text="![tokseal](https://tokseal.dev/api/card?user=YOU&theme=pixel)" />
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="reveal py-24 text-center">
        <Pixel sprite={seal} size={6} className="anim-float" />
        <h2 className="mt-6 text-[18px] md:text-[24px]"><span className="px-hl">PRESS START</span></h2>
        <p className="mt-6 text-muted">One command. Your grade in two seconds. Your data stays home.</p>
        <div className="mt-8 flex justify-center"><div className="w-full max-w-sm"><CopyBlock text="npx tokseal" /></div></div>
      </section>
    </>
  );
}

function SectionTitle({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="reveal flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-pixel text-[10px] uppercase tracking-[.25em] text-coral"><i className="px-dot" />{kicker}</p>
        <h2 className="mt-3 text-[16px] md:text-[20px]">{title}</h2>
      </div>
      {right}
    </div>
  );
}
