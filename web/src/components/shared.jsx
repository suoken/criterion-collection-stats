import { Link, useNavigate } from "react-router-dom";

// Section with a hairline rule above, a left-aligned heading, and an
// optional "more →" link on the right.
export function Section({ eyebrow, title, sub, more, children, id }) {
  return (
    <section className="section" id={id}>
      <div className="section-head">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 className="section-title">{title}</h2>
          {sub && <p className="section-sub">{sub}</p>}
        </div>
        {more && <Link className="more" to={more.to}>{more.label} →</Link>}
      </div>
      {children}
    </section>
  );
}

// A film card: cover, title, pick tally, and an optional call to action.
export function Billed({ name, image, to, tally, tallyLabel, cta, alt }) {
  const navigate = useNavigate();
  return (
    <div
      className="billed"
      onClick={() => navigate(to)}
      onKeyDown={(e) => e.key === "Enter" && navigate(to)}
      role="link"
      tabIndex={0}
      aria-label={name}
    >
      <div className="cover">
        {image ? (
          <img src={image} alt={alt || name} loading="lazy" />
        ) : (
          <div className="placeholder">{name?.[0] || "?"}</div>
        )}
      </div>
      <div className="billed-name">{name}</div>
      {tally != null && (
        <div className="tally"><b>{tally}</b> {tallyLabel}</div>
      )}
      {cta && <span className="more">{cta} →</span>}
    </div>
  );
}

export function Loading({ error }) {
  return (
    <div className="loading">
      {error ? "Not in this closet. Try the search above." : "Loading…"}
    </div>
  );
}
