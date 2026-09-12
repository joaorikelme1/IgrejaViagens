export function TripRules({ rules }: { rules: string }) {
  return (
    <section className="traveler-rules" aria-labelledby="trip-rules-title">
      <header>
        <span>Normas e regulamentos</span>
        <h2 id="trip-rules-title">Regras da viagem</h2>
      </header>
      {rules.trim() ? (
        <p>{rules}</p>
      ) : (
        <p className="is-empty">Nenhuma regra cadastrada.</p>
      )}
    </section>
  )
}
