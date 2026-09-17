import { parseBoard, type Board } from '../../src/core/board';

/** Valid boards drawn by the uniform sampler (seed "exp"), for tests that need boards but not sampling. */
export const SAMPLED_BOARDS: readonly string[] = [
  'gpygb/yppbr/rbppg/ygygy/rbrrb',
  'ygpbr/yrbpg/gprpb/pgygr/rbyyb',
  'bgrpy/rgbpy/bgrpp/rrbyy/bpygg',
  'prbyr/gggrp/ggbyp/bbypr/ybyrp',
  'ypbgr/rrgpr/pybyr/gpbgp/bygby',
  'pyrpg/grygy/pggpr/rypbb/bbbry',
  'grbpp/ybrgy/brbpp/brygp/ryggy',
  'ybryy/yybpr/prpgb/gbrbr/pggpg',
];

export const sampledBoards = (): Board[] => SAMPLED_BOARDS.map(parseBoard);
