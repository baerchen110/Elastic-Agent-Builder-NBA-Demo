import StatsAndBuzzTile from '@/components/StatsAndBuzzTile';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative z-10 backdrop-blur-md bg-gradient-to-r from-blue-600/40 to-indigo-600/40 border-b border-blue-400/20 shadow-2xl">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-4xl">🏀</div>
            <h1 className="text-4xl font-black text-white tracking-tight">
              NBA<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300"> Commentary Companion</span>
            </h1>
          </div>
          <p className="text-blue-100 text-sm font-medium">
            Real-time analytics powered by Elastic Agent Builder
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-8">
        <div className="max-w-6xl w-full">
          {/* Welcome Section */}
          <div className="text-center mb-12">
            {/* Floating Basketball Animation */}
            <div className="mb-8 flex justify-center">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full animate-spin opacity-75" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
                  <span className="text-5xl">🏀</span>
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
              Welcome to NBA
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
                Commentary Companion
              </span>
            </h2>
            <p className="text-gray-300 mb-8 leading-relaxed max-w-2xl mx-auto">
              Get AI-powered insights on player statistics, game predictions, and fan sentiment.
              Powered by advanced analytics and real NBA data.
            </p>
          </div>

          {/* Quick Action Tiles Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
            {[
              { icon: '📊', text: 'Top Scorers', href: '/chat' },
              { icon: '🎮', text: 'Live Games', href: '/chat' },
              { icon: '⚖️', text: 'Compare', href: '/chat' },
              { icon: '🔮', text: 'Predict', href: '/chat' },
              { icon: '🏀💬', text: 'Stats And Buzz', href: '/statsandbuzz/chat' },
            ].map((btn, i) => (
              <StatsAndBuzzTile
                key={i}
                href={btn.href}
                className="col-span-1"
              >
                <div className="relative">
                  <div className="text-2xl mb-1">{btn.icon}</div>
                  <div className="text-xs font-bold text-white">{btn.text}</div>
                </div>
              </StatsAndBuzzTile>
            ))}
          </div>

          {/* Info Card */}
          <div className="mt-12 max-w-2xl mx-auto">
            <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 backdrop-blur-md border border-blue-400/20 rounded-lg p-4 text-left">
              <p className="text-xs text-gray-300">
                <span className="font-bold text-blue-300">💡 Features:</span> Access player performance stats, live game analysis, sentiment tracking, and predictive analytics powered by Elasticsearch and Claude AI.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 backdrop-blur-md bg-gradient-to-t from-slate-900/80 to-slate-900/40 border-t border-blue-400/20 p-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs text-gray-400">
            Powered by Elastic Agent Builder, Claude AI, and MCP Aggregator
          </p>
        </div>
      </div>
    </div>
  );
}
