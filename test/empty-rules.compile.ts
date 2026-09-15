import { scanFile } from "../src/index.ts";

// @ts-expect-error an empty rule list would be a silent pass
scanFile("fixtures/clean.ts", []);
