/**
 * Card — a generic container widget used by screens to compose content.
 * Provides consistent card styling (border, spacing, background) across the demo.
 */

export interface CardProps {
  /** The card title. */
  title?: string;
  /** The card content. */
  children: React.ReactNode;
  /** Optional class name for styling override. */
  className?: string;
  /** Optional role for accessibility. */
  role?: string;
}

export function Card({ title, children, className, role = "region" }: CardProps) {
  return (
    <div className={`card${className ? ` ${className}` : ""}`} role={role}>
      {title && <h2 className="card__title">{title}</h2>}
      <div className="card__content">{children}</div>
    </div>
  );
}

export default Card;
