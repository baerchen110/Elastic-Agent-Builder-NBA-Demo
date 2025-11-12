import ChatContainer from '@/components/ChatContainer';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative">
      {/* Stats and Buzz Banner - Prominent but not intrusive */}
      <div className="absolute top-4 right-4 z-50">
        <Link href="/statsandbuzz/chat">
          <div className="group bg-gradient-to-r from-blue-500/90 to-indigo-500/90 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl border border-blue-300/50 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏀💬</span>
              <div className="text-left">
                <div className="text-xs font-bold text-white">Stats & Buzz</div>
                <div className="text-[10px] text-blue-100 opacity-90">MCP-Powered Chat</div>
              </div>
              <div className="text-white text-sm group-hover:translate-x-1 transition-transform">→</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Original Chat Interface */}
      <ChatContainer />
    </div>
  );
}
