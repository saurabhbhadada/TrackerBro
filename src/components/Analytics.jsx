import { useEffect, useState } from 'react';
import { queryQwen3 } from '../utils/api';
import { getDB } from '../utils/db';
import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

Chart.defaults.color       = '#eee';
Chart.defaults.borderColor = '#333';

/* ------------------------------------------------------------- */
/*  Helpers                                                      */
/* ------------------------------------------------------------- */

// drop ``` fences and leading / trailing whitespace
const stripFence = (s) => {
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-z]*\n?/i, '');
    const last = t.lastIndexOf('```');
    if (last !== -1) t = t.slice(0, last);
  }
  return t.trim();
};

/** Destroy whatever Chart.js instance is bound to this canvas. */
const nukeOldChart = (canvas) => {
  const old = Chart.getChart(canvas);
  if (old) old.destroy();
};

/** Try to turn a string into a plain JS object (strict JSON first). */
const toObject = (code) => {
  try {
    return JSON.parse(code);               // valid JSON – fast path
  } catch {
    /* Fall back to tolerant object-literal parsing. */
    // eslint-disable-next-line no-new-func
    return Function('"use strict";return (' + code + ')')();
  }
};

/** Single-responsibility builder: returns a *new* Chart or throws. */
const createChart = (canvas, raw) => {
  const clean = stripFence(raw);

  if (!/^[\[{]/.test(clean)) {
    throw new Error('Not a config object');        // triggers retry
  }

  const cfg = toObject(clean);
  return new Chart(canvas, cfg);
};

/* ------------------------------------------------------------- */
/*  Component                                                    */
/* ------------------------------------------------------------- */
const Analytics = () => {
  const [query, setQuery]       = useState('');
  const [feedback, setFeedback] = useState(null);
  const [habits, setHabits]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [chartRef, setChartRef] = useState(null);

  /* ---------- Build / rebuild chart (with one retry) ---------- */
  const makeChart = async (prompt) => {
    const canvas = document.getElementById('myChart');
    nukeOldChart(canvas);

    const raw = await queryQwen3(prompt);
    try {
      const ch = createChart(canvas, raw);
      setChartRef(ch);
      return ch;
    } catch (e1) {
      console.warn('Chart failed, retrying…', e1);

      nukeOldChart(canvas);               // ensure blank slate
      const raw2 = await queryQwen3(
        'Return ONLY a valid Chart.js **JSON object** (no JS code).  ' + prompt,
      );
      const ch2 = createChart(canvas, raw2);
      setChartRef(ch2);
      return ch2;
    }
  };

  /* ---------- free-form query ---------- */
  const runFreeQuery = async () => {
    if (!query.trim()) return;
    setFeedback(null); setSelected(null);

    const db   = await getDB();
    const data = await db.getAll('logs');

    await makeChart(`
Data: ${JSON.stringify(data)}
User request: "${query}".
Produce a concise Chart.js line, bar or scatter chart *only* as a JSON
config object. No markdown, comments or executable JS.
    `).catch(() => alert('Failed to build chart.'));
  };

  /* ---------- habits ---------- */
  const refreshHabits = async () => {
    const db   = await getDB();
    const data = await db.getAll('logs');

    const grouped = data.filter(e => e.habit)
      .reduce((acc,e)=>{ (acc[e.habit]??=[]).push(e); return acc; },{});

    const list = Object.entries(grouped).map(([name,arr])=>({
      name,
      entries: arr,
      count: arr.length,
      last:  arr.at(-1)?.date,
      total: arr.reduce((a,b)=>a+(b.amount||0),0),
    }));
    setHabits(list);
  };

  const showHabit = async (h) => {
    setSelected(h); setFeedback(null); setQuery('');

    await makeChart(`
Logs for habit "${h.name}": ${JSON.stringify(h.entries)}
Return a Chart.js config object visualising the data vs. date.
    `).catch(()=>alert('Failed to build habit chart.'));
  };

  /* ---------- feedback ---------- */
  const vote = async (ok) => {
    setFeedback(ok);
    if (ok) return;
    const title = selected ? selected.name : query;
    try { await makeChart(
      `User disliked chart "${title}". Improve & resend JSON config.`,
    ); } catch {/* ignore */}
  };

  useEffect(() => { refreshHabits(); }, []);

  /* ---------- render ---------- */
  return (
    <div style={{ padding: '1rem' }}>
      <h2>🧠 Ask TrackerBro for Analytics</h2>
      <input
        style={{ width: '100%', padding: '.5rem' }}
        placeholder='e.g., "show water-intake trend"'
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <button onClick={runFreeQuery}>Generate Chart</button>

      {chartRef && feedback === null && (
        <>
          <p>Was that helpful?</p>
          <button onClick={() => vote(true)}>👍 Yes</button>
          <button onClick={() => vote(false)}>👎 No</button>
        </>
      )}

      <canvas id="myChart" />

      <hr style={{ margin: '2rem 0' }} />

      <h2>📋 Habit Cards</h2>
      <button onClick={refreshHabits}>🔄 Refresh</button>

      <div className="habit-cards">
        {habits.map(h => (
          <div
            key={h.name}
            className={`habit-card ${selected?.name === h.name ? 'active' : ''}`}
            onClick={() => showHabit(h)}
          >
            <strong>{h.name}</strong>
            <p>{h.count} logs</p>
            <p>Last: {h.last ? new Date(h.last).toLocaleDateString() : '-'}</p>
            {h.total > 0 && <p>Total: {h.total}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Analytics;
