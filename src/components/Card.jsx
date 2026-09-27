export function Card({ className = "", children, hover = false, ...props }) {
  return (
    <div
      className={`
        bg-paper border-2 border-navy/10 rounded-2xl shadow-soft
        transition-all duration-200 ease-smooth
        ${hover ? "hover:shadow-soft-lg hover:-translate-y-0.5 hover:border-brand-yellow/30" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
