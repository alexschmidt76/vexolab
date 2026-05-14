import './index.css'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f4f4f5] flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-800">
        <span className="text-xl font-bold tracking-tight">VexoLab</span>
        <a
          href="mailto:support@vexolab.com"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Contact
        </a>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-block bg-indigo-500/10 text-indigo-400 text-xs font-semibold px-3 py-1 rounded-full mb-6 border border-indigo-500/20">
          AI-Powered Dev Agent
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 max-w-3xl leading-tight">
          Command from anywhere.<br />
          <span className="text-indigo-400">Build everywhere.</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mb-10">
          VexoLab turns your ideas into pull requests. Send a command from your phone
          and let the AI agent create branches, write code, and open PRs on GitHub — automatically.
        </p>
        <div className='flex justify-between items-center [&_a]:mx-1'>
          <a
            href="mailto:support@vexolab.dev"
            className="bg-indigo-500 hover:bg-indigo-600 transition-colors text-white font-semibold px-6 py-3 rounded-xl text-base"
          >
            Get Early Access
          </a>
          <a
            href="https://app.vexolab.dev"
            className="bg-indigo-500 hover:bg-indigo-600 transition-colors text-white font-semibold px-6 py-3 rounded-xl text-base"
          >
            Web Dashboard
          </a>
        </div>
      </main>

      {/* Features */}
      <section className="grid sm:grid-cols-3 gap-px bg-zinc-800 border-t border-zinc-800">
        {[
          { title: "AI Agent", desc: "Claude writes and commits code based on your plain-English command." },
          { title: "GitHub Integration", desc: "Automatic branch creation and pull request opening in any repo you own." },
          { title: "Mobile First", desc: "Command your agent from your phone. No laptop required." },
        ].map((f) => (
          <div key={f.title} className="bg-[#0f0f0f] p-8">
            <h2 className="text-base font-semibold mb-2">{f.title}</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-8 py-6 flex items-center justify-between text-zinc-500 text-sm">
        <span>© {new Date().getFullYear()} VexoLab</span>
        <a href="mailto:support@vexolab.com" className="hover:text-white transition-colors">
          support@vexolab.com
        </a>
      </footer>
    </div>
  )
}
