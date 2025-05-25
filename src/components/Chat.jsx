import { useState, useRef, useEffect } from 'react';
import { chatQwen3, queryQwen3 } from '../utils/api';
import { getDB } from '../utils/db';

/* ------------------------------------------------------------------ */
/* 1 .  Prompt: keep replies short and in-character                    */
/* ------------------------------------------------------------------ */
const SYSTEM_PROMPT =
  'You are TrackerBro 🏋️‍♂️, an upbeat, concise fitness companion. ' +
  'You track more than fitness habits in general :) ' +
  'Reply in **under 60 words** unless the user explicitly asks for detail. ' +
  'Dont output too much keep it concise.';

const stripCodeFence = (s) => {
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-z]*\n?/i, '');
    const last = t.lastIndexOf('```');
    if (last !== -1) t = t.slice(0, last);
  }
  return t.trim();
};

const Chat = () => {
  const [input, setInput] = useState('');
  const [chat,  setChat]  = useState([]);              // {role,text}[]
  const [messages, setMessages] = useState([
    { role: 'system', content: SYSTEM_PROMPT },
  ]);

  const dbPromise = getDB();
  const endRef    = useRef(null);

  /* ----- auto-scroll to bottom ----- */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  /* ------------------------------------------------------------------ */
/* 2.  Extraction & storage  (now supports an explicit "date" field)   */
/* ------------------------------------------------------------------ */
const extractAndStore = async (sentence) => {
    const prompt = `
  You are a JSON extraction engine.
  Return ONLY a JSON object (no markdown fences).
  Keys:
    "habit"      (string | null)
    "amount"     (number | null)
    "unit"       (string | null)
    "exercise"   (string | null)
    "weight_kg"  (number | null)
    "sets"       (number | null)
    "reps"       (number | null)
    "date"       (string | null)  // Accept formats like "2025-05-14" or "14 May 2025"
  Sentence: """${sentence}"""
    `;

    try {
      const raw    = await queryQwen3(prompt);
      const parsed = JSON.parse(stripCodeFence(raw));

      /* ---------- pick a date ---------- */
      let when = new Date();                        // default = NOW
      if (parsed.date) {
        const d = new Date(parsed.date);            // quick parse
        if (!isNaN(+d)) when = d;
      }

      const hasInfo = Object.entries(parsed)
        .some(([k, v]) => k !== 'date' && v !== null && v !== '');
      if (hasInfo) {
        const db = await dbPromise;
        await db.add('logs', { ...parsed, date: when.toISOString() });
      }
    } catch (e) {
      console.error('Extraction failed:', e);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 3 .  Send message                                                   */
  /* ------------------------------------------------------------------ */
  const sendMessage = async () => {
    if (!input.trim()) return;

    /* optimistic user bubble */
    setChat((c) => [...c, { role: 'user', text: input }]);
    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs);
    extractAndStore(input);

    try {
      const assistantText = await chatQwen3(newMsgs);
      setChat((c) => [...c, { role: 'assistant', text: assistantText }]);
      setMessages((m) => [...m, { role: 'assistant', content: assistantText }]);
    } catch {
      setChat((c) => [
        ...c,
        { role: 'assistant', text: 'Sorry, something went wrong.' },
      ]);
    }

    setInput('');
  };

  /* ------------------------------------------------------------------ */
  /* 4 .  Render                                                         */
  /* ------------------------------------------------------------------ */
  return (
    <div className="chat-wrap">
      <div className="chat-history">
        {chat.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <span className="sender">
              {m.role === 'user' ? 'You' : 'TrackerBro'}
            </span>
            <p style={{ whiteSpace: 'pre-wrap', margin: '.25rem 0 0' }}>
              {m.text}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="input-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
