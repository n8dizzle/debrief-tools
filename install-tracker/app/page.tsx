'use client';

import { useState } from 'react';
import { INSTALL_STAGES, STATUS_LABEL } from '@/lib/install-stages';

export default function InstallTimeline() {
  // Rung 1: read-only. Selecting a stage expands its detail + sub-steps.
  // Default to the first non-done stage so the "live" part of the pipeline is what you land on.
  const firstActive = INSTALL_STAGES.findIndex((s) => s.status !== 'done');
  const [selected, setSelected] = useState(firstActive === -1 ? 0 : firstActive);
  const stage = INSTALL_STAGES[selected];

  return (
    <main className="wrap">
      <header className="masthead">
        <div className="mark">IA</div>
        <div>
          <div className="title">Install Tracker</div>
          <div className="url">install.christmasair.com</div>
        </div>
      </header>

      <p className="lede">
        The install process, end to end. Start at the top — the seven stages — then click any
        stage to see what happens inside it. This map grows as we learn each step.
      </p>

      <div className="legend" aria-hidden="true">
        <span><i className="sw" style={{ background: 'var(--good)' }} />Done</span>
        <span><i className="sw" style={{ background: 'var(--ember)' }} />Active now</span>
        <span><i className="sw" style={{ background: 'var(--wait)' }} />Waiting</span>
        <span><i className="sw" style={{ background: 'var(--blocked)' }} />Blocked</span>
      </div>

      <div className="rail" role="tablist" aria-label="Install stages">
        {INSTALL_STAGES.map((s, i) => (
          <button
            key={s.name}
            className="node"
            role="tab"
            aria-selected={i === selected}
            onClick={() => setSelected(i)}
          >
            <span className={`strip ${s.status}`} />
            <span className="body">
              <span className="idx">STAGE {i + 1}</span>
              <div className="nm">{s.name}</div>
              <span className="foot">
                <span className={`pill ${s.status}`}>{STATUS_LABEL[s.status]}</span>
                <span className="caret">›</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <section className="detail">
        <div className="card">
          <h2>
            <span className={`pill ${stage.status}`}>{STATUS_LABEL[stage.status]}</span>
            {stage.name}
          </h2>
          <p className="sub">{stage.summary}</p>
          <ol className="substeps">
            {stage.subSteps.map((step, j) => (
              <li key={step.title}>
                <span className="n">{j + 1}</span>
                <span className="st">
                  {step.title}
                  <span className="sd">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card">
          <div className="facts">
            <div className="fact">
              <div className="k">Who owns it</div>
              <div className="v">{stage.who}</div>
            </div>
            <div className="fact">
              <div className="k">Tools used today</div>
              <div className="v">{stage.tools}</div>
            </div>
            <div className="fact">
              <div className="k">Typical duration</div>
              <div className="v dur">{stage.duration}</div>
            </div>
            <div className="fact risk">
              <div className="k">What goes wrong</div>
              <div className="v">{stage.risk}</div>
            </div>
          </div>
        </div>
      </section>

      <p className="foot-note">
        Rung 1 — read-only seed map. Statuses are illustrative. Next: move the map into the
        database so stages can be edited and deepened.
      </p>
    </main>
  );
}
