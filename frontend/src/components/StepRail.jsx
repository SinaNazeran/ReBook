/** مراحل روی خط مویی (فروش در Home، خرید و فروش در About) */
function StepRail({ steps }) {
  return (
    <ol className="sell-steps" style={{ '--steps': steps.length }}>
      {steps.map(({ title, text }) => (
        <li key={title} className="sell-step">
          <h3 className="sell-step-title">{title}</h3>
          <p className="sell-step-text">{text}</p>
        </li>
      ))}
    </ol>
  );
}

export default StepRail;
