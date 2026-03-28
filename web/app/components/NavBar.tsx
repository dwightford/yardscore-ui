"use client";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/capture", label: "Upload" },
  { href: "/map", label: "Map" },
  { href: "/scan", label: "Scan", arrow: true },
];

export default function NavBar({ active }: { active?: string }) {
  return (
    <nav className="bg-white border-b border-gray-200 flex-none">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <a href="/dashboard" className="flex items-center">
            <svg viewBox="0 0 160 44" className="h-8 w-auto" aria-label="YardScore">
              <rect width="44" height="44" rx="9" fill="#2d6a4f" />
              <path d="M14 11 L22 21 L30 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="22" y1="21" x2="22" y2="29" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="13" y1="33" x2="31" y2="33" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
              <text x="56" y="29" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" fontSize="19" fontWeight="600" letterSpacing="-0.4" fill="#1a3328">YardScore</text>
            </svg>
          </a>
          <div className="flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = active === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "text-sm font-medium text-[#2d6a4f] border-b-2 border-[#2d6a4f] pb-0.5"
                      : "text-sm font-medium text-gray-500 hover:text-[#2d6a4f] transition-colors" +
                        (item.arrow ? " flex items-center gap-1" : "")
                  }
                >
                  {item.label}
                  {item.arrow && !isActive && <span className="text-xs">&rarr;</span>}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
