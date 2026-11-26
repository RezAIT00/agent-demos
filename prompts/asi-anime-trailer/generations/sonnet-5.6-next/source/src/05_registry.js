'use strict';
// shot registry and global hit lists (declared early so shot files can register)
const DURATION = 87.5;
const SHOTS = [];          // {id, t0, t1, draw(S)}
const IMPACTS = [];        // {t, n (frames), mode, ink, paper}
const FLASHES = [];        // {t, up, down, color, peak}
const shot = (id, t0, t1, draw) => SHOTS.push({ id, t0, t1, draw });
const impact = (t, n = 2, mode = 1, inkc = '#07061a', paper = '#f4f2ff') => IMPACTS.push({ t, n, mode, ink: inkc, paper });
const flashAt = (t, up, down, color = '#ffffff', peak = 1) => FLASHES.push({ t, up, down, color, peak });

