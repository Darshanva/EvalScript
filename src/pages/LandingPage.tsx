import React from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';

const FEATURES = [
  {
    icon: '✎',
    title: 'AI Handwriting Transcription',
    description:
      'Groq-powered vision AI reads and transcribes handwritten answers with high accuracy, even for complex mathematical notation.',
  },
  {
    icon: '◉',
    title: 'Rubric-Based Evaluation',
    description:
      'Every answer is evaluated against faculty-defined rubrics — per-criterion scoring, not simple keyword matching.',
  },
  {
    icon: '≋',
    title: 'Confidence Scoring',
    description:
      'Each evaluation carries a confidence score based on image quality, handwriting clarity, and AI certainty. Low-confidence results are automatically flagged.',
  },
  {
    icon: '◎',
    title: 'Mandatory Faculty Review',
    description:
      'AI suggests marks — faculty approves and publishes. Students never see results until a human has reviewed and confirmed them.',
  },
  {
    icon: '⊞',
    title: 'Secure Private Storage',
    description:
      'Answer sheets are stored privately with signed access URLs. Original scripts are preserved and never overwritten.',
  },
  {
    icon: '☰',
    title: 'Complete Audit Trail',
    description:
      'Every action — upload, AI evaluation, mark change, publication — is logged with timestamps for academic integrity.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Student submits handwritten answers',
    desc: 'Students photograph their answer sheets and upload them through the secure student portal — one exam at a time.',
    color: 'bg-navy-50 border-navy-200',
    numColor: 'text-navy-600',
  },
  {
    num: '02',
    title: 'AI transcribes and evaluates',
    desc: 'The AI reads each page, transcribes the answers, maps them to rubric questions, and scores against each criterion with a confidence rating.',
    color: 'bg-gold-50 border-gold-200',
    numColor: 'text-gold-600',
  },
  {
    num: '03',
    title: 'Faculty reviews and publishes',
    desc: 'Faculty see the original images alongside AI transcription and suggested marks. They edit, approve, and publish — results go live only after human sign-off.',
    color: 'bg-emerald-50 border-emerald-200',
    numColor: 'text-emerald-700',
  },
];

const STATS = [
  { value: '600+', label: 'Students supported' },
  { value: '12,000', label: 'Pages per month' },
  { value: '100%', label: 'Faculty-reviewed results' },
  { value: '< 2 min', label: 'Avg. AI evaluation time' },
];

const DEMO_ACCOUNTS = [
  {
    role: 'Student',
    email: 'alice.johnson@student.edu',
    password: 'demo123',
    icon: '◯',
    color: 'bg-navy-50 border-navy-200 text-navy-800',
    btnVariant: 'primary' as const,
  },
  {
    role: 'Faculty',
    email: 'prof.sharma@university.edu',
    password: 'demo123',
    icon: '◎',
    color: 'bg-gold-50 border-gold-200 text-gold-800',
    btnVariant: 'gold' as const,
  },
  {
    role: 'Admin',
    email: 'admin@university.edu',
    password: 'demo123',
    icon: '⊞',
    color: 'bg-slate-50 border-slate-200 text-slate-700',
    btnVariant: 'secondary' as const,
  },
];

export default function LandingPage() {
  const { navigate } = useApp();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center">
              <span className="text-gold-400 font-bold text-sm">E</span>
            </div>
            <span className="font-semibold text-navy-900 text-lg">EvalScript</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('auth')}>
              Sign in
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('auth')}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, #c4891e 0%, transparent 60%), radial-gradient(circle at 80% 20%, #2e5289 0%, transparent 50%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/80 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
              Powered by Groq Vision AI · Demo available
            </div>
            <h1
              className="font-display text-5xl lg:text-6xl font-normal leading-tight mb-6"
              style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
            >
              AI-Assisted
              <br />
              <span className="text-gold-400">Handwritten Exam</span>
              <br />
              Evaluation
            </h1>
            <p className="text-white/70 text-xl leading-relaxed mb-10 max-w-2xl">
              Transcribe handwritten answers, evaluate them against faculty rubrics, and keep
              faculty in control. Every result reviewed by a human before students see it.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="gold" onClick={() => navigate('auth')}>
                Try the Demo
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                See how it works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-8 py-8 text-center">
                <p
                  className="text-3xl font-semibold text-navy-900 mb-1"
                  style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
                >
                  {stat.value}
                </p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Accounts — click opens Login page */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">
              Explore the platform now
            </h2>
            <p className="text-slate-500">
              Choose a role — you will be taken to the login page to authenticate.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {DEMO_ACCOUNTS.map((account) => (
              <div
                key={account.role}
                className={`rounded-xl border p-5 flex flex-col gap-4 ${account.color}`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{account.icon}</span>
                    <span className="font-semibold">{account.role}</span>
                  </div>
                  <p className="text-xs opacity-70 font-mono break-all">{account.email}</p>
                  <p className="text-xs opacity-50 font-mono mt-0.5">
                    Password: {account.password}
                  </p>
                </div>
                <Button
                  variant={account.btnVariant}
                  size="sm"
                  className="w-full"
                  onClick={() => navigate('auth')}
                >
                  Login as {account.role}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2
              className="text-3xl font-normal text-slate-900 mb-3"
              style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
            >
              Everything your department needs
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              From handwriting recognition to faculty review workflows, EvalScript covers the full
              examination pipeline.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat) => (
              <div
                key={feat.title}
                className="p-6 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 bg-navy-50 rounded-lg flex items-center justify-center text-navy-700 text-xl mb-4">
                  {feat.icon}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{feat.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-navy-950 text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2
              className="text-3xl font-normal mb-3"
              style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
            >
              How it works
            </h2>
            <p className="text-white/60 max-w-xl mx-auto">
              A three-step pipeline from handwritten script to published result.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-white/10 z-0" />
                )}
                <div className={`relative z-10 rounded-xl border p-6 ${step.color}`}>
                  <div className={`font-mono text-3xl font-bold mb-4 ${step.numColor}`}>
                    {step.num}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Faculty review highlight */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-50 border border-gold-200 text-xs font-medium text-gold-700 mb-6">
                Faculty-First Design
              </div>
              <h2
                className="text-3xl font-normal text-slate-900 mb-4"
                style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
              >
                Faculty stays in control.{' '}
                <span className="text-gold-600">Always.</span>
              </h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                AI suggestions are exactly that — suggestions. Faculty see the original handwritten
                image alongside the AI transcription and can edit any mark before publishing. Every
                change is recorded in an immutable audit log.
              </p>
              <ul className="space-y-3">
                {[
                  'Side-by-side image and transcription view',
                  'Criterion-by-criterion mark override',
                  'Flag resolution for uncertain areas',
                  'Per-question faculty feedback',
                  'One-click publish when satisfied',
                  'Result versioning for any post-publication changes',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 rounded-2xl p-4 shadow-xl">
              <div className="bg-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 border-b border-slate-600">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <span className="text-slate-400 text-xs ml-2">Faculty Review Interface</span>
                </div>
                <div className="grid grid-cols-2 gap-0">
                  <div className="border-r border-slate-700 p-3">
                    <div className="text-slate-500 text-xs mb-2">Original Script</div>
                    <div className="bg-slate-700 rounded-lg h-32 flex items-center justify-center">
                      <img
                        src="https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=300&h=200&fit=crop&auto=format"
                        alt="Handwritten answer sheet"
                        className="w-full h-full object-cover rounded-lg opacity-80"
                      />
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-slate-500 text-xs mb-2">AI Evaluation</div>
                    <div className="space-y-2">
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400 mb-1">Q1 · 10 marks</div>
                        <div className="text-xs text-white/80">AI suggests: 9/10</div>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex-1 h-1 bg-slate-600 rounded-full">
                            <div className="h-full w-11/12 bg-emerald-500 rounded-full" />
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400 mb-1">Confidence</div>
                        <div className="text-xs text-emerald-400">91% · HIGH</div>
                      </div>
                      <div className="bg-gold-900/30 border border-gold-700/30 rounded p-2">
                        <div className="text-xs text-gold-400">Faculty override: [_] / 10</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-3 pb-3 flex gap-2">
                  <div className="flex-1 h-7 bg-navy-700 rounded text-xs text-white/70 flex items-center justify-center">
                    Save Draft
                  </div>
                  <div className="flex-1 h-7 bg-gold-600 rounded text-xs text-white flex items-center justify-center font-medium">
                    Approve &amp; Publish
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2
            className="text-3xl font-normal text-slate-900 mb-4"
            style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
          >
            Ready to modernise your examination workflow?
          </h2>
          <p className="text-slate-500 mb-8">
            Start with the free demo. No API keys required to explore the full student and faculty
            workflows.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" onClick={() => navigate('auth')}>
              Start with Demo
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('auth')}>
              Faculty Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-navy-900 rounded flex items-center justify-center">
              <span className="text-gold-400 text-xs font-bold">E</span>
            </div>
            <span className="text-slate-600 text-sm font-medium">EvalScript</span>
          </div>
          <p className="text-xs text-slate-400">
            Demo platform · AI mode: Demo (no Groq API key required) · All data is simulated
          </p>
        </div>
      </footer>
    </div>
  );
}