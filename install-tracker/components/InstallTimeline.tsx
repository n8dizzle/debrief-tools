'use client';

import { useState } from 'react';
import { STATUS_LABEL, type Stage } from '@/lib/install-stages';

export default function InstallTimeline({ stages }: { stages: Stage[] }) {
  // Selecting a stage expands its detail + sub-steps. Land on the first
  // non-done stage so the "live" part of the pipeline is what you see first.
  const firstActive = stages.findIndex((s) => s.status !== 'done');
  const [selected, setSelected] = useState(firstActive === -1 ? 0 : firstActive);
  const stage = stages[selected];

  if (!stage) return <p className="lede">No stages yet.</p>;

  return (
    <>
      <div className="rail" role="tablist" aria-label="Install stages">
        {stages.map((s, i) => (
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
              <li key={`${step.title}-${j}`}>
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
    </>
  );
}
