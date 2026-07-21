import { useNavigate } from "react-router-dom";

// Section with poster-style centered heading and diamond rule.
export function Section({ eyebrow, title, children, id }) {
  return (
    <section className="section" id={id}>
      <div className="section-head">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="display">{title}</h2>
        <div className="diamond-rule"><span>◆</span></div>
      </div>
      {children}
    </section>
  );
}

// Split "Cary Grant" into small first name + big surname, cast-strip style.
function BilledName({ name }) {
  const parts = (name || "").split(" ");
  if (parts.length < 2) return <span className="last">{name}</span>;
  const last = parts.pop();
  return (
    <>
      {parts.join(" ")}
      <span className="last">{last}</span>
    </>
  );
}

// The signature element: arch-topped framed image with billing above.
export function Billed({ name, image, to, tally, tallyLabel, tall, alt }) {
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
      <div className="name smallcaps-name"><BilledName name={name} /></div>
      <div className={`portrait-frame${tall ? " tall" : ""}`}>
        {image ? (
          <img src={image} alt={alt || name} loading="lazy" />
        ) : (
          <div style={{ aspectRatio: "3 / 4", display: "grid", placeItems: "center" }}>
            <span className="display" style={{ fontSize: 34, color: "var(--maroon)" }}>
              {name?.[0] || "?"}
            </span>
          </div>
        )}
      </div>
      {tally != null && (
        <div className="tally"><b>{tally}</b> {tallyLabel}</div>
      )}
    </div>
  );
}

// Horizontal bar chart, pure CSS.
export function Bars({ data, max, onSelect, alt }) {
  const top = max || Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div
          key={d.label}
          className={`bar-row${alt && i % 2 ? " alt" : ""}${onSelect ? " clickable" : ""}`}
          onClick={onSelect ? () => onSelect(d) : undefined}
        >
          <span className="bar-label">{d.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(d.value / top) * 100}%`, display: "block" }} />
          </span>
          <span className="bar-num">{d.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export function Loading({ error }) {
  return (
    <div className="loading">
      {error ? "Not in this closet — try the search above." : "Now Loading…"}
    </div>
  );
}
