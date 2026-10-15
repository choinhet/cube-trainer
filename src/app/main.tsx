import { createRoot } from 'react-dom/client';
import { connectGanCube } from 'gan-web-bluetooth';
import { LiveApp } from './LiveApp';
import '../styles/cube.css';
import '../styles/workspace.css';
import '../styles/design-navigation.css';
import { connectCube, createMacProvider } from '../adapters/bluetooth';
const Page = LiveApp;
createRoot(document.getElementById('root')!).render(<Page connectCube={() => connectCube(createMacProvider({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) }, message => window.prompt(message)), connectGanCube)} />);
