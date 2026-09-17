import './styles.css';
import { Rng } from './core/rng';
import { App } from './ui/app';
import { randomSeed } from './ui/seed';
import { GeneratorClient, type WorkerLike } from './worker/client';
import GeneratorWorker from './worker/generator.worker?worker';

const app = new App({
  root: document.getElementById('app')!,
  source: new GeneratorClient(() => new GeneratorWorker() as unknown as WorkerLike),
  rng: new Rng(randomSeed()),
  url: new URL(window.location.href),
  onUrlChange: (url) => window.history.replaceState(null, '', url),
  newSeed: randomSeed,
  clipboard: navigator.clipboard,
});

void app.start();
