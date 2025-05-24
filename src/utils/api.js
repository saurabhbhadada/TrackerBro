import axios from 'axios';

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/* ------------------------------------------------------------------ */
/* 1.  Single-prompt helper (string → string) — used by Analytics.jsx  */
/* ------------------------------------------------------------------ */
export const queryQwen3 = async (prompt) => {
  const body = {
    model: 'qwen/qwen3-32b',
    messages: [
      { role: 'system', content: 'You are a concise assistant.' },
      { role: 'user',   content: prompt },
    ],
  };
  return callLLM(body);
};

/* ------------------------------------------------------------------ */
/* 2.  Chat helper (messages[] → assistant content string)             */
/* ------------------------------------------------------------------ */
export const chatQwen3 = async (messages) => {
  const body = {
    model: 'qwen/qwen3-32b',
    messages,
  };
  return callLLM(body);
};

/* ------------------------------------------------------------------ */
/* 3.  Low-level wrapper with error handling                           */
/* ------------------------------------------------------------------ */
async function callLLM(body) {
  try {
    const res = await axios.post(ENDPOINT, body, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    return res.data.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    console.error(err);
    throw new Error('⚠️ LLM call failed – check network/API key');
  }
}
