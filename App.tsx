import React from 'react';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
  return (
    <div className="antialiased text-slate-200">
      <GameCanvas />
    </div>
  );
};

export default App;
