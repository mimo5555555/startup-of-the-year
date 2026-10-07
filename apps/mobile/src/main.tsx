import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './styles/game.css';
import { initGameServices } from './services';

initGameServices();

createRoot(document.getElementById('root')!).render(<App />);
