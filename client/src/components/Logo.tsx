// Official Botion logo. Kept in sync with public/logo.svg (favicon + app icon
// source). Uses currentColor so it inherits text color anywhere it's placed.
export function Logo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Botion"
      role="img"
    >
      <g fill="currentColor" fillRule="evenodd" clipRule="evenodd">
        <rect x="4" y="4" width="5" height="24" rx="2.5" />
        <path d="M 10 4 H 19 C 23.418 4 27 7.582 27 12 C 27 16.418 23.418 20 19 20 H 10 V 15.5 H 18 C 19.933 15.5 21.5 13.933 21.5 12 C 21.5 10.067 19.933 8.5 18 8.5 H 10 V 4 Z" />
        <path d="M 10 13.5 H 20.5 C 24.918 13.5 28.5 17.082 28.5 21.5 C 28.5 25.918 24.918 29.5 20.5 29.5 H 10 V 25 H 19.5 C 21.433 25 23 23.433 23 21.5 C 23 19.567 21.433 18 19.5 18 H 10 V 13.5 Z" />
        <polygon points="12,27 18,5 21,5 15,27" />
      </g>
    </svg>
  );
}
