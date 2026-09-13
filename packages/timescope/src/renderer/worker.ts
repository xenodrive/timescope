import { connectWorkerEngine } from '#src/bridge/renderEngine';

connectWorkerEngine(self, { fonts: self.fonts });
