export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-[#07110c] flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Sign in failed</h1>
        <p className="text-sm text-zinc-400 mb-6">
          The sign-in link may have expired or your email isn&apos;t on the access list.
        </p>
        <a
          href="/login"
          className="inline-block px-6 py-3 bg-lime-300 text-zinc-950 font-semibold rounded-xl text-sm hover:bg-lime-200 transition-colors"
        >
          Try again
        </a>
      </div>
    </div>
  );
}
