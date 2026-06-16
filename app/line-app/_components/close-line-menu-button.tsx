import Link from 'next/link';

type CloseLineMenuButtonProps = {
  label?: string;
};

export default function CloseLineMenuButton({ label = 'กลับสู่เมนู' }: CloseLineMenuButtonProps) {
  return (
    <Link
      href="/line-app/menu"
      className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#ffdc45] bg-[#fff257] px-2 text-xs font-bold text-[#06408f] shadow-[0_2px_0_rgba(2,53,132,0.25)] transition hover:bg-[#fff78c]"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 10.5V20h13v-9.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20v-5h5v5" />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
