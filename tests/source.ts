import { importSource as importDataset, prepareSource as prepareDataset } from "../src/import/source.js";
import { demoSourceLocation } from "../src/import/locations.js";

// Public suites explicitly select synthetic fixtures, independently of local private settings.
export const importSource = (now = new Date()) => importDataset(now, demoSourceLocation);
export const prepareSource = (now = new Date()) => prepareDataset(now, demoSourceLocation);
