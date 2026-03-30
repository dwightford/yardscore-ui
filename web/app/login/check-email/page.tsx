export default function CheckEmailPage() {
  return (
    <div className="min-h-screen bg-[#07110c] flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-lime-300/10 border border-lime-300/20 flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-sm text-zinc-400 mb-6">
          We sent a sign-in link to your email. Click the link to continue.
        </p>
        <p className="text-xs text-zinc-500">
          Didn&apos;t get it? Check your spam folder or{" "}
          <a href="/login" className="text-lime-300 hover:underline">try again</a>.
        </p>
      </div>
    </div>
  );
}
