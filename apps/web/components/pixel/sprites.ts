import type { Sprite } from './Pixel';

const C = '#f0703c', H = '#ffa47a', L = '#9c3e19', W = '#f3ecff', K = '#0b0716', G = '#ffd45e', Gd = '#b8892a', P = '#6a4fa3', Pd = '#3b2a60', Pl = '#8f74cc', M = '#7ff0c1', B = '#7cc4ff';

export const cloud: Sprite = {
  palette: { a: Pl, b: P, c: Pd },
  rows: [
    '......aaaa..........',
    '....aaabbaaa........',
    '..aaabbbbbbaaa..aa..',
    '.aabbbbbbbbbbaaaabaa',
    'aabbbbbbbbbbbbbbbbba',
    'abbbbbbbbbbbbbbbbbba',
    'abbbbbbbbccbbbbbbbba',
    'abbbbbbccccccbbbbbba',
    '.aabbbccccccccbbbaa.',
    '...aaaaaaaaaaaaaa...',
  ],
};

/** The tokseal seal: a wax-stamp coin with a diamond. */
export const seal: Sprite = {
  palette: { o: L, c: C, h: H, w: W, k: K },
  rows: [
    '.....oooooo.....',
    '...oocccccccoo..',
    '..occhhccccccco.',
    '.occhccccccccco.',
    '.ochcccckkcccco.',
    'occcccckwwkcccco',
    'occccckwwwwkccco',
    'occcckwwwwwwkcco',
    'occcckwwwwwwkcco',
    'occccckwwwwkccco',
    'occcccckwwkcccco',
    '.occcccckkccccoo',
    '.occcccccccccoo.',
    '..occccccccooo..',
    '...oocccccoo....',
    '.....oooooo.....',
  ],
};

export const coin: Sprite = {
  palette: { g: G, d: Gd, w: W },
  rows: [
    '...gggggg...',
    '.ggdddddddgg',
    '.gddwwddddgg',
    'gddwddddddgg',
    'gddwdddddddg',
    'gdddddddgddg',
    'gdddddddgddg',
    'gdddddddgddg',
    'gddddddddddg',
    '.gdddddddgg.',
    '.ggdddddgg..',
    '...gggggg...',
  ],
};

export const rocket: Sprite = {
  palette: { w: W, c: C, b: B, k: K, f: G, h: H },
  rows: [
    '....ww....',
    '...wwww...',
    '..wwwwww..',
    '..wwbbww..',
    '..wwbbww..',
    '..wwwwww..',
    '.cwwwwwwc.',
    'ccwwwwwwcc',
    'ccccwwcccc',
    '...cccc...',
    '..hffffh..',
    '...ffff...',
    '....ff....',
  ],
};

export const robot: Sprite = {
  palette: { p: P, d: Pd, l: Pl, m: M, k: K, c: C },
  rows: [
    '.....c......',
    '....ppp.....',
    '..pppppppp..',
    '.pdddddddddp',
    '.pdmmdddmmdp',
    '.pdmkdddmkdp',
    '.pdddddddddp',
    '.pddlllllddp',
    '..pppppppp..',
    'pp.pllllp.pp',
    'p..pllllp..p',
    '...pp..pp...',
    '..ppp..ppp..',
  ],
};

export const star: Sprite = { palette: { w: W }, rows: ['.w.', 'www', '.w.'] };
export const arrow: Sprite = { palette: { w: W }, rows: ['w.....w', 'ww...ww', '.ww.ww.', '..www..', '...w...'] };
