export default function LoadingIndicator() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-br from-slate-700/60 to-slate-800/60 border border-blue-400/20 w-fit">
      <div className="flex gap-1.5">
        <div className="w-2 h-2 bg-gradient-to-b from-blue-400 to-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
        <div className="w-2 h-2 bg-gradient-to-b from-blue-400 to-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
        <div className="w-2 h-2 bg-gradient-to-b from-blue-400 to-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
      </div>
      <span className="text-sm font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
        Analyzing...
      </span>
    </div>
  );
}
