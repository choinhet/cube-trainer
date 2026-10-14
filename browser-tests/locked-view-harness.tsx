import { createRoot } from 'react-dom/client';
import type { GanCubeEvent } from 'gan-web-bluetooth';
import { LiveApp } from '../src/app/LiveApp';
import type { Connection } from '../src/domain/session';
import { SOLVED, turn } from '../src/domain/cube';
import { validateScramble } from '../src/domain/scramble';
export function mount() {
  let next: (event: GanCubeEvent) => void = () => {};
  let serial = 10, facelets = SOLVED;
  const connection: Connection = {
    deviceName: 'Synthetic orientation cube',
    events$: { subscribe: observer => { next = observer.next; return { unsubscribe: () => {} }; } },
    sendCubeCommand: async () => {}, disconnect: async () => {},
  };
  document.getElementById('root')!.remove();
  const container = document.createElement('div'); document.body.append(container);
  createRoot(container).render(<LiveApp connectCube={async () => connection} bluetoothAvailable generateScramble={async () => validateScramble('R2')} />);
  return {
    gyro: (quaternion: {x:number;y:number;z:number;w:number}) => next({type:'GYRO',timestamp:1,quaternion}),
    report: () => next({type:'FACELETS',timestamp:1,serial,facelets,state:{CP:[],CO:[],EP:[],EO:[]}}),
    move: (move: string) => { facelets = turn(facelets, move); next({type:'MOVE', timestamp:1, serial:++serial, move, face:'URFDLB'.indexOf(move[0]),direction:move.endsWith("'")?1:0,localTimestamp:1,cubeTimestamp:null}); },
  };
}
