/**
 * Fixes: PERF-02 (mobile LCP 4.2 s field / 10.4 s lab)
 *
 * Problem: the headline word rotates, so the LCP element keeps changing and the
 * real headline appears only after JS hydrates.
 * Fix: render the first word on the server (instant LCP), load the rotating
 * animation lazily on the client afterwards.
 */
import dynamic from 'next/dynamic';

const RotatingWord = dynamic(() => import('./RotatingWord'), {
  ssr: false,
  // While JS loads, the server-rendered word stays visible: no blank frames
  loading: () => <span className="accent">Software dev.</span>,
});

export default function Hero() {
  return (
    <section>
      {/* Server-rendered, present in the initial HTML => LCP at first paint */}
      <h1>
        Architecting the future with <RotatingWord />
      </h1>
      <p>
        Cynbit Technologies architects the digital future with autonomous AI
        agents, custom software development, and scalable business platforms.
      </p>
    </section>
  );
}
