import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-black text-[#FFD700] mb-2">404 - Page Not Found</h2>
      <p className="text-sm text-zinc-400 mb-6">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-black text-sm uppercase tracking-wider"
      >
        Return Home
      </Link>
    </div>
  );
}
