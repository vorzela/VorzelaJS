import { createSignal } from 'solid-js'

export function CounterCard() {
  const [count, setCount] = createSignal(0)

  return (
    <aside class="rounded-4xl border border-white/10 bg-white/6 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
      <p class="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">Interactive Component</p>
      <h2 class="mt-4 text-2xl font-semibold tracking-tight text-white">Counter card</h2>
      <p class="mt-3 text-sm leading-7 text-slate-300">
        This component lives in <code class="rounded bg-white/8 px-2 py-1 text-slate-100">src/components</code>
        {' '}and makes the home route a client-hydrated island.
      </p>

      <div class="mt-8 flex items-end justify-between gap-6 rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4">
        <div>
          <p class="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">Current count</p>
          <p class="mt-2 text-5xl font-semibold tracking-tight text-white">{count()}</p>
        </div>
        <button
          type="button"
          class="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/10 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/15"
          onClick={() => setCount(0)}
        >
          Reset
        </button>
      </div>

      <div class="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center rounded-full bg-sky-400 px-5 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-sky-300"
          onClick={() => setCount((value) => value + 1)}
        >
          Increment
        </button>
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/6 px-5 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/10"
          onClick={() => setCount((value) => value - 1)}
        >
          Decrement
        </button>
      </div>
    </aside>
  )
}