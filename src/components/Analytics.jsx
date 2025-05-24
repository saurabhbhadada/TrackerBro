import { useEffect, useState } from 'react';
import { queryQwen3 } from '../utils/api';
import { getDB } from '../utils/db';
import { Chart } from 'chart.js/auto';

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

/** Destroy old chart, build new, store ref. */
const mountChart = (maker, setRef) => {
  setRef((prev) => { if (prev) prev.destroy(); return prev; });
  const canvas = document.getElementById('myChart');
  const chart  = maker(canvas);          // may throw
  setRef(chart);
  return chart;
};

/**
 * Try three strategies in order:
 *   1) JSON-parse as plain Chart.js config object.
 *   2) Execute full JS **without ctx param** if the code declares ctx itself.
 *   3) Execute full JS **with ctx param** when it doesn’t.
 */
const buildChart = (rawJS, setRef) =>
  mountChart((canvas) => {
    const code = stripFence(rawJS);

    /* 1️⃣ CONFIG OBJECT ------------------------------------- */
    if (code.startsWith('{') || code.startsWith('[')) {
      const cfg = JSON.parse(code);             // strict — will throw if not JSON
      return new Chart(canvas, cfg);
    }

    /* Check if the code defines ctx itself */
    const declaresCtx = /\b(?:const|let|var)\s+ctx\b/.test(code);

    /* 2️⃣/3️⃣ FULL JS --------------------------------------- */
    const fn = declaresCtx
      ? new Function('Chart', 'canvas', code)
      : new Function('Chart', 'canvas', 'ctx', code);

    const maybe = declaresCtx
      ? fn(Chart, canvas)
      : fn(Chart, canvas, canvas.getContext('2d'));

    /* Fallback if author forgot to return */
    return maybe instanceof Chart ? maybe : Chart.getChart(canvas);
  }, setRef);

/* ------------------------------------------------------------- */
/*  Component                                                    */
/* ------------------------------------------------------------- */
const Analytics = () => {
  const [query, setQuery]           = useState('');
  const [feedback, setFeedback]     = useState(null);
  const [habits, setHabits]         = useState([]);
  const [selected, setSelected]     = useState(null);
  const [chartRef, setChartRef]     = useState(null);

  /* ---------- Build / rebuild chart via LLM (with one retry) ---------- */
  const makeChart = async (prompt) => {
    const raw = await queryQwen3(prompt);
    try { return buildChart(raw, setChartRef); }
    catch (e1) {
      console.warn('Chart build failed once, retrying…', e1);
      const raw2 = await queryQwen3(
        'Your previous answer was invalid JS. '
      + 'Return ONLY valid JavaScript (no markdown/HTML).  ' + prompt,
      );
      return buildChart(raw2, setChartRef);      // bubble on second failure
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
User analytics request: "${query}".
Respond with EITHER:
 • a Chart.js config object (starts with "{"),
 • or full JavaScript that uses the provided variables
   (Chart, canvas, ctx) and returns the Chart instance.
No HTML, no markdown.
    `).catch(() => alert('Failed to build chart.'));
  };

  /* ---------- habit list + card helper ---------- */
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

  /* ---------- habit card click ---------- */
  const showHabit = async (h) => {
    setSelected(h); setFeedback(null); setQuery('');

    await makeChart(`
Logs for habit "${h.name}": ${JSON.stringify(h.entries)}
Create an insightful Chart.js visual.
Use the provided "canvas" or "ctx". JS only, no markdown.
    `).catch(()=>alert('Failed to build habit chart.'));
  };

  /* ---------- feedback ---------- */
  const vote = async (ok) => {
    setFeedback(ok);
    if (ok) return;
    const title = selected ? selected.name : query;
    try { await makeChart(
      `User disliked chart for "${title}". Improve it. Same constraints.`,
    ); } catch {/* ignore */}
  };

  /* ---------- initial load ---------- */
  useEffect(() => { refreshHabits(); }, []);

  /* ---------- render ---------- */
  return (
    <div style={{ padding:'1rem' }}>
      <h2>🧠 Ask AI for Analytics</h2>
      <input
        style={{ width:'100%',padding:'.5rem' }}
        placeholder='e.g., "show water intake trend"'
        value={query}
        onChange={e=>setQuery(e.target.value)}
      />
      <button onClick={runFreeQuery}>Generate Chart</button>

      {chartRef && feedback===null && (
        <>
          <p>Was that helpful?</p>
          <button onClick={()=>vote(true)}>👍 Yes</button>
          <button onClick={()=>vote(false)}>👎 No</button>
        </>
      )}

      <canvas id="myChart" style={{ maxWidth:'100%',marginTop:'1rem' }} />

      <hr style={{ margin:'2rem 0' }} />

      <h2>📋 Habit Cards</h2>
      <button onClick={refreshHabits}>🔄 Refresh</button>

      <div style={{ display:'flex',flexWrap:'wrap',gap:'1rem',marginTop:'1rem' }}>
        {habits.map(h=>(
          <div key={h.name}
            onClick={()=>showHabit(h)}
            style={{
              border:'1px solid #333',borderRadius:10,padding:'1rem',width:180,
              cursor:'pointer',
              background:selected?.name===h.name?'#00ffc633':'#1a1a1a',
              color:'#eee',
            }}>
            <strong>{h.name}</strong>
            <p>{h.count} logs</p>
            <p>Last: {h.last ? new Date(h.last).toLocaleDateString() : '-'}</p>
            {h.total>0 && <p>Total: {h.total}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Analytics;
