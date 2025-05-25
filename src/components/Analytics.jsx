import { useEffect, useState } from 'react';
import { queryQwen3 } from '../utils/api';
import { getDB } from '../utils/db';
import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

Chart.defaults.color       = '#eee';
Chart.defaults.borderColor = '#333';

/* ------------------------------------------------------------- */
/*  Helpers – robust chart builder                               */
/* ------------------------------------------------------------- */

const stripFence = (s) => {
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-z]*\n?/i, '');
    const last = t.lastIndexOf('```');
    if (last !== -1) t = t.slice(0, last);
  }
  return t.trim();
};

const mountChart = (maker, setRef) => {
  setRef((old) => { if (old) old.destroy(); return null; });
  const canvas = document.getElementById('myChart');
  const chart  = maker(canvas);
  setRef(chart);
  return chart;
};

const buildChart = (rawJS, setRef) =>
  mountChart((__el) => {
    const code = stripFence(rawJS);

    /* 1️⃣ plain config object */
    if (/^[\[{]/.test(code)) {
      return new Chart(__el, JSON.parse(code));
    }

    /* 2️⃣ full JS sandbox */
    const sandboxDoc = { getElementById: () => __el };
    const fn = new Function(
      'Chart', '__el', '__ctx', 'document',
      `${code}\nreturn typeof chart === 'object' ? chart : undefined;`,
    );
    const maybe = fn(Chart, __el, __el.getContext('2d'), sandboxDoc);
    return maybe instanceof Chart ? maybe : Chart.getChart(__el);
  }, setRef);

/* ------------------------------------------------------------- */
/*  Component                                                    */
/* ------------------------------------------------------------- */
const Analytics = () => {
  const [query, setQuery]       = useState('');
  const [feedback, setFeedback] = useState(null);
  const [habits, setHabits]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [chartRef, setChartRef] = useState(null);

  const makeChart = async (prompt) => {
    const raw = await queryQwen3(prompt);
    try { return buildChart(raw, setChartRef); }
    catch (e1) {
      console.warn('Chart failed, retrying…', e1);
      const raw2 = await queryQwen3(
        'Previous answer was invalid JS. Return ONLY valid JavaScript.  ' + prompt,
      );
      return buildChart(raw2, setChartRef);
    }
  };

  const runFreeQuery = async () => {
    if (!query.trim()) return;
    setFeedback(null); setSelected(null);

    const db   = await getDB();
    const data = await db.getAll('logs');

    await makeChart(`
Data: ${JSON.stringify(data)}
User analytics request: "${query}".
Return EITHER:
  • a Chart.js config object, OR
  • full JavaScript that builds and returns a Chart instance.
No HTML, no markdown.
    `).catch(() => alert('Failed to build chart.'));
  };

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
Create an insightful Chart.js visual.
Use the provided canvas. JS only, no markdown.
    `).catch(()=>alert('Failed to build habit chart.'));
  };

  const vote = async (ok) => {
    setFeedback(ok);
    if (ok) return;
    const title = selected ? selected.name : query;
    try { await makeChart(
      `User disliked chart for "${title}". Improve it. Same constraints.`,
    ); } catch {/* ignore */}
  };

  useEffect(() => { refreshHabits(); }, []);

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
