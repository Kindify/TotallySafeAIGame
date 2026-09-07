// Shows the error instead of a black screen, so a crash can be reported and the player can recover.
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    return <div className="min-h-screen bg-black text-gray-300 font-mono p-6 text-sm">
      <div className="text-red-500 mb-2">SYSTEM FAULT</div>
      <div className="text-gray-400 mb-3">Something in the game crashed. This is a bug, not a game event.</div>
      <pre className="text-[11px] text-red-300 whitespace-pre-wrap border border-red-900/40 p-3 mb-3">{String(e?.message || e)}{"\n\n"}{String(e?.stack || "").split("\n").slice(0, 6).join("\n")}</pre>
      <button className="border border-cyan-900/40 px-3 py-2 text-cyan-400" onClick={() => window.location.reload()}>Reload (progress is saved)</button>
    </div>;
  }
}
