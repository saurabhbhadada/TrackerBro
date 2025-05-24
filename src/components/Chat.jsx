import { useState } from 'react';
import { chatQwen3, queryQwen3 } from '../utils/api';
import { getDB } from '../utils/db';

/* ------------------------------------------------------------------ */
/* 1.  Helper: strip ```json ... ``` fences (or any back-tick fences)  */
/* ------------------------------------------------------------------ */
const stripCodeFence = (s) => {
  let t = s.trim();
  if (t.startsWith('```')) {
    // remove first fence
    t = t.replace(/^```[a-z]*\n?/i, '');
    // remove trailing fence
    const lastFence = t.lastIndexOf('```');
    if (lastFence !== -1) t = t.slice(0, lastFence);
  }
  return t.trim();
};

/* ------------------------------------------------------------------ */
const SYSTEM_PROMPT =
  'You are a friendly fitness & lifestyle companion. '
+ 'Chat naturally. Reply helpfully and conversationally. '
+ 'Do NOT reveal or mention that you are storing user data.';

const Chat = () => {
  /* ---------- UI state ---------- */
  const [input, setInput] = useState('');
  const [chat,  setChat]  = useState([]);                    // {role,text}[]

  /* ---------- LLM context ---------- */
  const [messages, setMessages] = useState([
    { role: 'system', content: SYSTEM_PROMPT },
  ]);

  const dbPromise = getDB();

  /* ---------- Extract & store structured info ---------- */
  const extractAndStore = async (sentence) => {
    const prompt = `
You are a JSON extraction engine.
Return ONLY a JSON object. Do NOT wrap it in markdown or code fences.
Keys:
  "habit"  (string | null)
  "amount" (number | null)
  "unit"   (string | null)
  "exercise","weight_kg","sets","reps" (nullable)
Sentence: """${sentence}"""
    `;

    try {
      const raw    = await queryQwen3(prompt);
      const clean  = stripCodeFence(raw);
      const parsed = JSON.parse(clean);

      const hasInfo = Object.values(parsed).some((v) => v !== null && v !== '');
      if (hasInfo) {
        const db = await dbPromise;
        await db.add('logs', { ...parsed, date: new Date().toISOString() });
      }
    } catch (e) {
      // Silent fail – the user experience should not be interrupted
      console.error('Extraction failed:', e);
    }
  };

  /* ---------- Handle send ---------- */
  const sendMessage = async () => {
    if (!input.trim()) return;

    /* show user bubble immediately */
    setChat((c) => [...c, { role: 'user', text: input }]);

    /* update conversation context */
    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs);

    /* Start extraction in background */
    extractAndStore(input);

    /* Get assistant reply */
    try {
      const assistantText = await chatQwen3(newMsgs);
      setChat((c) => [...c, { role: 'assistant', text: assistantText }]);
      setMessages((m) => [...m, { role: 'assistant', content: assistantText }]);
    } catch (e) {
      setChat((c) => [
        ...c,
        { role: 'assistant', text: 'Sorry, something went wrong.' },
      ]);
    }

    setInput('');
  };

  /* ---------- Render ---------- */
  return (
    <div style={{ padding: '1rem' }}>
      {chat.map((m, i) => (
        <p key={i} style={{ whiteSpace: 'pre-wrap' }}>
          <b>{m.role === 'user' ? 'You' : 'AI'}:</b> {m.text}
        </p>
      ))}

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your message…"
        style={{ width: '100%', padding: '.5rem', marginTop: '1rem' }}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
};

export default Chat;
