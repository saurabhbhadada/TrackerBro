import { useState } from 'react';
import Chat from './components/Chat';
import Analytics from './components/Analytics';

const App = () => {
  const [tab, setTab] = useState('chat');

  return (
    <div>
      <nav>
        <button
          className={tab === 'chat' ? 'active' : ''}
          onClick={() => setTab('chat')}
        >
          Chat
        </button>
        <button
          className={tab === 'analytics' ? 'active' : ''}
          onClick={() => setTab('analytics')}
        >
          Analytics
        </button>
      </nav>

      {tab === 'chat' ? <Chat /> : <Analytics />}
    </div>
  );
};

export default App;
