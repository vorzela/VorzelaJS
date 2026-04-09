import { createSignal } from 'solid-js'

export function CounterCard() {
  const [count, setCount] = createSignal(0)

  return (
    <div class="counter-card">
      <p class="counter-value">{count()}</p>
      <div class="counter-actions">
        <button onClick={() => setCount((c) => c - 1)} class="counter-btn">
          −
        </button>
        <button onClick={() => setCount((c) => c + 1)} class="counter-btn">
          +
        </button>
      </div>
    </div>
  )
}
