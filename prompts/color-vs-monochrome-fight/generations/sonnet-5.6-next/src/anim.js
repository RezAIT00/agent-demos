// anim.js — choreography. Drawings are on twos; contacts sit on even frames so each lands on a fresh drawing.
// K(frame, pose, [x, y, z], yaw, ease-into-this-key, extras)   y may be {g: offset} = on the (broken) ground
const G = (o = 0) => ({ g: o });
const K = (f, p, pos, yaw, ease = 'io', ex = {}) => Object.assign({ f, p, pos, yaw, ease, pitch: 0, roll: 0, spin: 0 }, ex);
const R_ = 90, L_ = -90;   // facing screen-right / screen-left

const STOMP_UP = makePose(SUMI.stand, { hip: [0, 0.02, 0], fL: [0.26, 0.78, 0.30], kL: [0.2, 0.5, 1], toeL: -6, pel: [-6, 0, 0], head: [20, 0, 0], eyes: 'sharp' });
const STOMP_HIGH = makePose(STOMP_UP, { fL: [0.26, 1.0, 0.30], hip: [0, 0.05, -0.02], pel: [-10, 0, 0] });
const STOMP_DOWN = makePose(SUMI.stand, { hip: [0, -0.22, 0.06], fL: [0.26, 0.02, 0.30], fR: [-0.30, 0, -0.18], pel: [14, 0, 0], spine: [10, 0, 0], head: [14, 0, 0], eyes: 'sharp' });
const DRIP_POSE = makePose(IRO.tired, { hR: [-0.20, -0.30, 0.36], gripR: 0, head: [20, 6, 4] });

const IRO_KEYS = [
  K(0, IRO.stand, [-40, 0, 0], R_),
  // stare-down
  K(72, IRO.stand, [-4.6, 0, 0], 68, 'hold', { cut: true }),
  K(119, IRO.stand, [-4.6, 0, 0], 68),
  K(168, IRO.bounce, [-4.6, 0, 0], R_, 'hold', { cut: true }),
  K(176, IRO.ready, [-4.6, 0, 0], R_),
  K(188, IRO.coil, [-4.75, 0, 0], R_, 'out'),
  K(192, IRO.coil, [-4.8, 0, 0], R_),
  K(196, IRO.dash, [-4.0, 0.05, 0], R_, 'in'),
  K(200, IRO.kickCoil, [-2.1, 0.58, 0], R_, 'out'),
  K(202, IRO.flyKick, [-1.62, 0.64, 0], R_, 'lin'),
  // H3 first clash
  K(204, IRO.flyKick, [-1.15, 0.62, 0], R_, 'snap', { touch: { mine: 'anR', theirs: 'wrR', off: [-0.30, 0.00, 0.02] } }),
  K(212, IRO.flyKick, [-1.15, 0.62, 0], R_, 'hold'),
  K(214, IRO.flung, [-2.5, 1.25, 0], R_, 'out', { pitch: -25, slide: true }),
  K(220, IRO.tuck, [-4.6, 1.75, 0.2], R_, 'lin', { pitch: -190, slide: true }),
  K(228, IRO.skid, [-6.0, 0, 0.2], R_, 'lin', { pitch: -360, slide: true }),
  K(234, IRO.skid, [-6.55, 0, 0.2], R_, 'out', { pitch: -360, slide: true }),
  // flurry
  K(238, IRO.dash, [-4.0, 0.05, 0.1], R_, 'in', { cutRot: true }),
  K(242, IRO.knee, [0.0, 0.62, 0], R_, 'lin', { stretch: 1.3, slide: true }),
  K(244, IRO.knee, [0.55, 0.60, 0], R_, 'snap', { touch: { mine: 'knR', theirs: 'wrL', off: [-0.12, -0.04, 0.0] } }),
  K(246, IRO.knee, [0.55, 0.60, 0], R_, 'hold'),
  K(250, IRO.land, [0.0, 0.0, 0], R_, 'out'),
  K(252, IRO.guard, [0.35, 0, 0], R_, 'io'),
  K(254, IRO.guard, [0.45, 0, 0], R_, 'lin', { eyes: 'strain' }),
  K(256, IRO.guard, [0.45, 0, 0], R_, 'hold'),
  K(260, IRO.tuck, [-0.45, 0.55, 0.15], R_, 'out', { spin: -160 }),
  K(262, IRO.kickCoil, [0.25, 0.50, 0.1], R_, 'lin', { spin: -300, stretch: 1.2 }),
  K(264, IRO.elbow, [0.9, 0.42, 0.05], R_, 'snap', { spin: -360, touch: { mine: 'elR', theirs: 'wrR', off: [-0.14, 0.0, 0.0] } }),
  K(266, IRO.elbow, [0.9, 0.42, 0.05], R_, 'hold', { spin: -360 }),
  K(270, IRO.land, [0.4, 0.0, 0.05], R_, 'out', { spin: -360 }),
  K(272, IRO.launch, [0.5, 0.45, 0.05], R_, 'lin', { spin: -360 }),
  K(274, IRO.guard, [0.7, 0.55, 0.05], R_, 'lin', { spin: -360 }),
  K(276, IRO.guard, [0.7, 0.55, 0.05], R_, 'hold', { spin: -360 }),
  K(280, IRO.kickCoil, [0.0, 1.0, 0.1], R_, 'out', { spin: -560 }),
  // H4 spinning heel through the guard
  K(282, IRO.kickCoil, [0.55, 1.0, 0.1], R_, 'lin', { spin: -660, stretch: 1.2 }),
  K(284, IRO.roundKick, [1.2, 0.75, 0.1], R_, 'snap', { spin: -720, touch: { mine: 'anR', theirs: 'chest', off: [-0.30, 0.12, 0.12] } }),
  K(288, IRO.roundKick, [1.2, 0.75, 0.1], R_, 'hold', { spin: -720 }),
  K(292, IRO.wheel, [2.3, 0.65, 0.1], R_, 'out', { spin: -900 }),
  K(298, IRO.land, [2.9, 0, 0.1], R_, 'out', { spin: -1080 }),
  K(308, IRO.ready, [2.9, 0, 0.1], R_, 'io', { spin: -1080 }),
  K(318, IRO.bounce, [2.4, 0, 0.05], R_, 'io', { spin: -1080 }),
  K(324, IRO.coil, [1.7, 0, 0], R_, 'out', { spin: -1080 }),
  K(328, IRO.dash, [2.9, 0.2, 0], R_, 'in', { spin: -1080 }),
  K(332, IRO.launch, [4.2, 0.62, 0], R_, 'lin', { spin: -1080, stretch: 1.3, slide: true }),
  // H5 she takes the ink palm
  K(334, IRO.hurt, [4.75, 0.55, 0], R_, 'snap', { spin: -1080 }),
  K(338, IRO.hurt, [4.75, 0.55, 0], R_, 'hold', { spin: -1080 }),
  K(340, IRO.hurt, [-1.5, 1.35, -0.1], R_, 'lin', { spin: -1080, pitch: -22, stretch: 1.45, slide: true }),
  K(342, IRO.flung, [-9.05, 1.75, -0.2], R_, 'lin', { spin: -1080, pitch: -45, slide: true }),
  K(345, IRO.hurt, [-9.2, 1.72, -0.22], R_, 'hold', { spin: -1080, pitch: -34 }),
  K(347, IRO.flung, [-12.4, 1.25, 0.0], R_, 'lin', { spin: -1080, pitch: -80, stretch: 1.3, slide: true }),
  K(349, IRO.flung, [-14.6, 0.45, 0.2], R_, 'lin', { spin: -1080, pitch: -110, slide: true }),
  K(352, IRO.flung, [-15.2, 0.1, 0.3], R_, 'out', { spin: -1080, pitch: -80, slide: true }),
  K(354, IRO.sit, [-15.2, 0.0, 0.3], R_, 'out', { spin: -1080, eyes: 'closed', mouth: 'grit' }),
  K(373, IRO.sit, [-15.2, 0.0, 0.3], R_, 'hold', { spin: -1080, eyes: 'closed', mouth: 'grit' }),
  K(374, IRO.wipe, [-14.9, G(), 0.3], R_, 'hold', { cut: true }),
  K(380, IRO.wipe, [-14.9, G(), 0.3], R_, 'io'),
  K(384, IRO.flare, [-14.9, G(), 0.3], R_, 'back'),
  K(388, IRO.coil, [-15.0, G(), 0.3], R_, 'out'),
  K(392, IRO.dash, [-11.0, 0.25, 0.2], R_, 'in', { stretch: 1.35, slide: true }),
  K(396, IRO.runB, [-5.8, 0.15, 0.1], R_, 'lin', { stretch: 1.4, slide: true }),
  K(398, IRO.riseCoil, [-3.3, 0.0, 0], R_, 'lin', { slide: true }),
  K(402, IRO.riseCoil, [-2.75, 0.0, 0], R_, 'out'),
  // H6 rising heel
  K(404, IRO.rise, [-2.45, 0.28, 0], R_, 'snap', { touch: { mine: 'anR', theirs: 'head', off: [-0.20, -0.16, 0.06] } }),
  K(409, IRO.rise, [-2.45, 0.28, 0], R_, 'hold'),
  K(412, IRO.rise, [-2.1, 1.25, 0], R_, 'out', { pitch: -50, slide: true }),
  K(418, IRO.tuck, [-1.8, 1.9, 0], R_, 'lin', { pitch: -220, slide: true }),
  K(426, IRO.land, [-1.6, 0, 0], R_, 'lin', { pitch: -360, slide: true }),
  K(440, IRO.ready, [-1.5, 0, 0], R_, 'io', { pitch: -360 }),
  // the chase
  K(444, IRO.dash, [0.5, 0.0, 0], R_, 'in', { cutRot: true }),
  K(448, IRO.runA, [4.5, 0.05, 0], R_, 'lin', { slide: true }),
  K(452, IRO.runB, [9.5, 0.05, 0], R_, 'lin', { slide: true }),
  K(456, IRO.runA, [14.5, 0.05, 0.2], R_, 'lin', { slide: true }),
  K(460, IRO.runB, [18.2, 0.05, 0.4], R_, 'lin', { slide: true }),
  K(466, IRO.launch, [21.8, 0.9, 0.4], R_, 'lin', { slide: true }),
  K(470, IRO.launch, [22.9, 1.35, 0.4], R_, 'out', { eyes: 'wide' }),
  K(474, IRO.tuck, [22.2, 2.6, 0.5], R_, 'out', { eyes: 'wide' }),
  K(480, IRO.tuck, [21.2, 3.9, 0.6], R_, 'out', { pitch: -150, slide: true }),
  K(490, IRO.land, [20.6, G(), 0.7], R_, 'in', { pitch: -360, slide: true }),
  K(494, IRO.coil, [20.9, G(), 0.7], R_, 'io', { pitch: -360 }),
  K(498, IRO.launch, [22.3, 2.0, 0.6], R_, 'out', { cutRot: true, slide: true }),
  K(502, IRO.land, [23.3, 1.25, 0.8], R_, 'in', { slide: true }),
  K(508, IRO.launch, [24.1, 2.9, 0.5], R_, 'out', { slide: true }),
  K(516, IRO.tuck, [24.9, 3.35, 0.3], R_, 'out', { spin: -270, slide: true }),
  K(526, IRO.kickCoil, [25.8, 2.55, 0.25], R_, 'io', { spin: -560, slide: true }),
  K(536, IRO.kickCoil, [26.45, 1.7, 0.2], R_, 'out', { spin: -640 }),
  K(542, IRO.kickCoil, [26.7, 1.45, 0.2], R_, 'out', { spin: -660 }),
  // H8 wheel kick
  K(544, IRO.wheel, [27.05, 1.15, 0.15], R_, 'snap', { spin: -720, touch: { mine: 'anL', theirs: 'chest', off: [-0.24, 0.10, 0.10] } }),
  K(549, IRO.wheel, [27.05, 1.15, 0.15], R_, 'hold', { spin: -720 }),
  K(554, IRO.roundKick, [28.3, 1.05, 0.15], R_, 'out', { spin: -940 }),
  K(562, IRO.skid, [29.6, G(), 0.15], R_, 'out', { spin: -1080 }),
  K(576, IRO.ready, [30.2, G(), 0.1], R_, 'io', { spin: -1080 }),
  K(584, IRO.coil, [30.4, G(), 0.1], R_, 'out', { spin: -1080 }),
  // the lunge and the catch
  K(588, IRO.dash, [33.6, 0.45, 0.2], R_, 'in', { spin: -1080, stretch: 1.3, slide: true }),
  K(592, IRO.launch, [40.5, 1.25, 0.3], R_, 'lin', { spin: -1080, stretch: 1.45, slide: true }),
  K(596, IRO.flyKick, [46.7, 1.35, 0.25], R_, 'lin', { spin: -1080, stretch: 1.15, slide: true }),
  K(598, IRO.flyKick, [47.5, 1.3, 0.25], R_, 'snap', { spin: -1080, eyes: 'wide', mouth: 'open' }),
  K(600, IRO.flyKick, [47.5, 1.3, 0.25], R_, 'hold', { spin: -1080, eyes: 'wide', mouth: 'open' }),
  // 600..618 she is swung (see swingOverride)
  K(618, IRO.flung, [49.6, 4.6, 2.6], 0, 'hold', { cut: true }),
  K(622, IRO.flung, [53.4, 10.6, 3.6], 0, 'lin', { pitch: -20, stretch: 1.4, slide: true }),
  // H9 into the tower, and through it
  K(624, IRO.flung, [55.2, 13.4, 3.05], 0, 'lin', { pitch: -8 }),
  K(630, IRO.flung, [55.2, 13.4, 3.05], 0, 'hold', { pitch: -8 }),
  K(633, IRO.tuck, [57.6, 14.6, -1.6], R_, 'lin', { pitch: -90, slide: true }),
  K(636, IRO.flung, [64.6, 16.4, -4.2], R_, 'lin', { pitch: -150, stretch: 1.35, slide: true }),
  K(646, IRO.tuck, [68.0, 19.0, -2.4], L_, 'out', { pitch: -40, slide: true }),
  K(658, IRO.tuck, [65.5, 21.5, 2.6], L_, 'io', { pitch: -360, slide: true }),
  // up the falling tower
  K(664, IRO.land, [62.6, 22.6, 3.6], L_, 'out', { cutRot: true, pitch: 20 }),
  K(668, IRO.runA, [61.2, 25.0, 3.6], L_, 'lin', { pitch: -52, slide: true }),
  K(674, IRO.runB, [58.6, 30.0, 3.8], L_, 'lin', { pitch: -58, slide: true }),
  K(680, IRO.runA, [56.4, 35.4, 3.8], L_, 'lin', { pitch: -62, slide: true }),
  K(684, IRO.coil, [55.6, 37.6, 3.8], L_, 'out', { pitch: -40 }),
  K(695, IRO.launch, [47.0, 62.0, 2.0], L_, 'in', { pitch: -30, stretch: 1.4, slide: true }),
  // above the clouds
  K(696, IRO.dash, [21.0, 101.5, 0], R_, 'hold', { cut: true, pitch: -30 }),
  K(700, IRO.launch, [26.4, 108.8, 0], R_, 'lin', { pitch: -22, stretch: 1.4, slide: true }),
  // H10 mid-air clash
  K(704, IRO.flyKick, [28.8, 111.0, 0], R_, 'snap', { pitch: -8, touch: { mine: 'anR', theirs: 'wrR', off: [-0.30, 0.0, 0.02] } }),
  K(710, IRO.flyKick, [28.8, 111.0, 0], R_, 'hold', { pitch: -8 }),
  K(716, IRO.flung, [25.2, 112.6, 0.2], R_, 'snap', { pitch: -45, slide: true }),
  K(728, IRO.tuck, [26.8, 116.6, 0.2], R_, 'io', { pitch: -360, slide: true }),
  K(738, IRO.tuck, [29.4, 119.4, 0.1], R_, 'out', { pitch: -620, slide: true }),
  K(746, IRO.axeUp, [30.4, 120.1, 0.1], R_, 'out', { pitch: -720, slide: true }),
  K(758, IRO.axeUp, [30.85, 119.55, 0.1], R_, 'io', { pitch: -720 }),
  K(762, IRO.axeUp, [31.0, 118.9, 0.1], R_, 'in', { pitch: -708 }),
  // H11 meteor axe heel
  K(764, IRO.axeDown, [31.1, 117.7, 0.1], R_, 'snap', { pitch: -700, touch: { mine: 'anR', theirs: 'wrL', off: [-0.05, 0.14, 0.05] } }),
  K(769, IRO.axeDown, [31.1, 117.7, 0.1], R_, 'hold', { pitch: -700 }),
  K(774, IRO.axeDown, [31.3, 115.4, 0.1], R_, 'out', { pitch: -640, slide: true }),
  K(786, IRO.tuck, [31.0, 113.6, 0.2], R_, 'io', { pitch: -380 }),
  K(839, IRO.tuck, [20.0, 40, 0.5], R_, 'in', { pitch: -360 }),
  // the lull
  K(862, IRO.launch, [19.6, G(7.5), 1.0], R_, 'hold', { cut: true }),
  K(874, IRO.land, [19.6, G(), 1.0], R_, 'in'),
  K(884, IRO.kneel, [19.6, G(), 1.0], R_, 'out'),
  K(894, IRO.kneel, [19.6, G(), 1.0], R_),
  K(906, IRO.tired, [19.75, G(), 1.0], R_, 'io'),
  K(929, IRO.tired, [19.75, G(), 1.0], R_),
  K(930, DRIP_POSE, [19.75, G(), 1.0], R_, 'hold', { cut: true }),
  K(959, DRIP_POSE, [19.75, G(), 1.0], R_),
  // final exchange
  K(960, IRO.tired, [19.4, G(), 0.5], R_, 'hold', { cut: true }),
  K(976, IRO.ready, [19.4, G(), 0.5], R_, 'io', { eyes: 'wide', mouth: 'grit' }),
  K(1004, IRO.ready, [19.3, G(), 0.4], R_, 'io', { eyes: 'wide', mouth: 'grit' }),
  K(1014, IRO.gather, [19.2, G(), 0.3], R_, 'out'),
  K(1036, IRO.gather, [19.2, G(), 0.3], R_),
  K(1044, IRO.charge, [19.2, G(), 0.3], R_, 'back', { mouth: 'shout' }),
  K(1054, IRO.coil, [19.0, G(), 0.3], R_, 'out'),
  K(1058, IRO.launch, [19.4, G(1.8), 0.25], R_, 'in', { stretch: 1.35, slide: true }),
  K(1064, IRO.tuck, [20.1, 3.6, 0.2], R_, 'out', { pitch: 180, slide: true }),
  K(1070, IRO.comet, [20.7, 4.9, 0.12], R_, 'out', { pitch: 360, slide: true }),
  K(1076, IRO.comet, [21.55, 3.95, 0.1], R_, 'lin', { pitch: 374, slide: true }),
  K(1082, IRO.comet, [21.95, 3.55, 0.08], R_, 'lin', { pitch: 376, slide: true }),
  // H13
  K(1084, IRO.comet, [22.45, 3.05, 0.05], R_, 'snap', { pitch: 376, touch: { mine: 'anR', theirs: 'wrR', off: [-0.30, 0.06, 0.02] } }),
  K(1092, IRO.comet, [22.45, 3.05, 0.05], R_, 'hold', { pitch: 376 }),
  K(1100, IRO.flung, [17.0, 6.0, 0.05], R_, 'out', { pitch: 340, slide: true }),
  K(1131, IRO.flung, [8.0, 9.0, 0.05], R_, 'out', { pitch: 330 }),
  // aftermath: sitting face to face at the heart of it
  K(1132, IRO.sit, [22.78, G(), 0.15], 74, 'hold', { cut: true }),
  K(1156, IRO.sit, [22.78, G(), 0.15], 74, 'lin'),
  K(1199, IRO.sit, [22.78, G(), 0.15], 74, 'lin', { eyes: 'closed' }),
];

const SUMI_KEYS = [
  K(0, SUMI.stand, [40, 0, 0], L_),
  // hook: the boot
  K(34, STOMP_UP, [0.30, 0, 2.21], L_, 'hold', { cut: true }),
  K(48, STOMP_HIGH, [0.30, 0, 2.21], L_, 'out'),
  K(52, STOMP_UP, [0.30, 0, 2.21], L_, 'in'),
  K(54, STOMP_DOWN, [0.30, 0, 2.21], L_, 'in'),
  K(62, STOMP_DOWN, [0.30, 0, 2.21], L_, 'hold'),
  K(70, SUMI.stand, [0.30, 0, 2.21], L_, 'out', { head: [-2, -4, 0] }),
  // stare-down
  K(72, SUMI.stand, [4.6, 0, 0], -66, 'hold', { cut: true }),
  K(119, SUMI.stand, [4.6, 0, 0], -66),
  K(168, SUMI.stand, [4.6, 0, 0], -72, 'hold', { cut: true }),
  K(184, SUMI.stance, [4.65, 0, 0], L_, 'io'),
  K(192, SUMI.stance, [4.7, 0, 0], L_),
  K(196, SUMI.upperCoil, [4.0, 0, 0], L_, 'in'),
  K(200, SUMI.upperCoil, [1.95, 0.03, 0], L_, 'out'),
  K(202, SUMI.upper, [1.52, 0.08, 0], L_, 'lin'),
  // H3
  K(204, SUMI.clashFist, [1.1, 0.12, 0], L_, 'snap'),
  K(212, SUMI.clashFist, [1.1, 0.12, 0], L_, 'hold'),
  K(216, SUMI.guardBroke, [2.4, 0.25, 0], L_, 'out', { slide: true }),
  K(224, SUMI.skid, [4.4, 0, -0.1], L_, 'lin', { slide: true }),
  K(234, SUMI.skid, [5.1, 0, -0.1], L_, 'out', { slide: true }),
  K(240, SUMI.stance, [3.7, 0, 0], L_, 'io'),
  // flurry
  K(242, SUMI.guard, [2.05, 0, 0], L_, 'in'),
  K(244, SUMI.guard, [2.0, 0, 0], L_, 'lin'),
  K(246, SUMI.guard, [2.0, 0, 0], L_, 'hold'),
  K(250, SUMI.palmCoil, [2.35, 0, 0], L_, 'out'),
  K(252, SUMI.coil, [2.2, 0, 0], L_, 'io'),
  K(254, SUMI.palm, [1.85, 0, 0], L_, 'snap', { touch: { mine: 'wrR', theirs: 'wrL', off: [0.16, 0.0, 0.0] } }),
  K(256, SUMI.palm, [1.85, 0, 0], L_, 'hold'),
  K(260, SUMI.stance, [1.9, 0, 0], L_, 'io'),
  K(264, SUMI.guard, [2.25, 0, 0], L_, 'out'),
  K(266, SUMI.guard, [2.25, 0, 0], L_, 'hold'),
  K(270, SUMI.coil, [2.1, 0, 0], L_, 'out'),
  K(272, SUMI.coil, [1.9, 0, 0], L_, 'io'),
  K(274, SUMI.upper, [1.65, 0.05, 0], L_, 'snap', { touch: { mine: 'wrR', theirs: 'wrR', off: [0.16, -0.02, 0.0] } }),
  K(276, SUMI.upper, [1.65, 0.05, 0], L_, 'hold'),
  K(280, SUMI.stance, [2.5, 0, 0], L_, 'io'),
  K(282, SUMI.guard, [2.55, 0, 0], L_, 'io'),
  // H4
  K(284, SUMI.guardBroke, [2.6, 0.05, 0], L_, 'snap'),
  K(288, SUMI.guardBroke, [2.6, 0.05, 0], L_, 'hold'),
  K(290, SUMI.flung, [5.9, 0.85, 0], L_, 'lin', { pitch: -28, stretch: 1.35, slide: true }),
  K(292, SUMI.flung, [9.15, 1.35, -0.15], L_, 'lin', { pitch: -45, slide: true }),
  K(295, SUMI.hurt, [9.25, 1.33, -0.15], L_, 'hold', { pitch: -30 }),
  K(296, SUMI.flung, [10.2, 1.15, -0.12], L_, 'out', { pitch: -60, slide: true }),
  K(299, SUMI.flung, [11.7, 0.75, -0.1], L_, 'out', { pitch: -78, slide: true }),
  K(304, SUMI.skid, [12.1, 0, 0], L_, 'out', { slide: true }),
  K(308, SUMI.kneel, [12.1, 0, 0], L_, 'io'),
  K(314, SUMI.rise, [11.2, 0, 0], L_, 'io'),
  K(318, SUMI.stand, [9.0, 0, 0], L_, 'io', { cut: true }),
  K(324, SUMI.palmCoil, [7.6, 0, 0], L_, 'out'),
  K(330, SUMI.palmCoil, [7.3, 0, 0], L_),
  K(332, SUMI.coil, [6.6, 0, 0], L_, 'in'),
  // H5 ink palm
  K(334, SUMI.palm, [5.75, 0, 0], L_, 'snap', { touch: { mine: 'wrR', theirs: 'mid', off: [0.20, 0.02, 0.02] } }),
  K(338, SUMI.palm, [5.75, 0, 0], L_, 'hold'),
  K(342, SUMI.palm, [5.25, 0, 0], L_, 'out'),
  K(352, SUMI.palm, [5.2, 0, 0], L_),
  K(364, SUMI.stance, [4.6, 0, 0], L_, 'io'),
  K(374, SUMI.stand, [3.4, 0, 0], L_, 'io'),
  K(388, SUMI.stand, [1.2, 0, 0], L_, 'lin', { slide: true }),
  K(396, SUMI.stance, [-0.45, 0, 0], L_, 'io'),
  K(400, SUMI.stance, [-0.9, 0, 0], L_, 'io', { eyes: 'wide' }),
  K(402, SUMI.guard, [-1.05, 0, 0], L_, 'io', { eyes: 'wide' }),
  // H6
  K(404, SUMI.chinUp, [-1.15, 0.12, 0], L_, 'snap'),
  K(409, SUMI.chinUp, [-1.15, 0.12, 0], L_, 'hold'),
  K(411, SUMI.flung, [3.4, 2.7, 0], L_, 'lin', { pitch: -35, stretch: 1.4, slide: true }),
  K(414, SUMI.flung, [13.9, 3.0, -0.1], L_, 'lin', { pitch: -75, stretch: 1.35, slide: true }),
  K(424, SUMI.tuck || SUMI.flung, [19.8, 2.4, -0.2], L_, 'lin', { pitch: -170, stretch: 1.2, slide: true }),
  K(434, SUMI.flung, [23.6, 1.1, 0], L_, 'out', { pitch: -320, slide: true }),
  K(440, SUMI.skid, [24.9, 0, 0], L_, 'lin', { pitch: -360, slide: true }),
  K(448, SUMI.skid, [25.9, 0, 0], L_, 'out', { pitch: -360, slide: true }),
  // H7 the hammer
  K(454, SUMI.upperCoil, [25.9, 0, 0], L_, 'io', { cutRot: true }),
  K(458, SUMI.leap, [26.2, 1.2, 0], L_, 'out', { slide: true }),
  K(464, SUMI.hammerUp, [26.8, 4.3, 0], L_, 'out', { slide: true }),
  K(470, SUMI.hammerUp, [27.3, 4.75, 0], L_, 'out', { slide: true }),
  K(472, SUMI.hammerUp, [27.45, 3.4, 0], L_, 'in', { pitch: 18, stretch: 1.25 }),
  K(474, SUMI.hammerDown, [27.55, 0, 0], L_, 'in'),
  K(479, SUMI.hammerDown, [27.55, 0, 0], L_, 'hold'),
  K(492, SUMI.hammerDown, [27.55, G(), 0], L_),
  K(504, SUMI.rise, [27.7, G(0.05), 0], L_, 'io'),
  K(522, SUMI.stance, [28.0, G(0.05), 0], L_, 'io', { head: [-20, 24, 0] }),
  K(536, SUMI.stance, [28.0, G(0.05), 0], L_, 'io', { head: [-18, 24, 0], eyes: 'wide' }),
  K(542, SUMI.guard, [28.05, 0.0, 0], L_, 'io', { eyes: 'wide' }),
  // H8
  K(544, SUMI.hurt, [28.1, 0.25, 0], L_, 'snap'),
  K(549, SUMI.hurt, [28.1, 0.25, 0], L_, 'hold'),
  K(550, SUMI.hurt, [35.0, 1.05, -0.2], L_, 'lin', { pitch: -12, stretch: 1.4, slide: true }),
  K(556, SUMI.flung, [41.8, 1.35, -0.1], L_, 'lin', { pitch: -40, stretch: 1.35, slide: true }),
  K(562, SUMI.flung, [48.4, 1.55, 0], L_, 'lin', { pitch: -55, stretch: 1.25, slide: true }),
  K(564, SUMI.flung, [50.25, 1.6, 0.1], L_, 'out', { pitch: -30, slide: true }),
  K(571, SUMI.flung, [50.25, 1.55, 0.1], L_, 'hold', { pitch: -30 }),
  K(578, SUMI.kneel, [49.9, 0.35, 0.25], L_, 'in', { eyes: 'closed' }),
  K(590, SUMI.kneel, [49.9, 0.35, 0.25], L_, 'hold', { eyes: 'closed' }),
  K(591, SUMI.kneel, [49.9, 0.35, 0.25], L_, 'hold', { eyes: 'wide' }),
  K(595, SUMI.rise, [49.5, 0.2, 0.25], L_, 'out', { eyes: 'wide' }),
  // the catch
  K(598, SUMI.grab, [49.1, 0.15, 0.25], L_, 'snap', { touch: { mine: 'wrL', theirs: 'anR', off: [0.03, 0.0, 0.05] } }),
  K(600, SUMI.grab, [49.1, 0.15, 0.25], L_, 'hold'),
  // 600..618 swing (see swingOverride)
  K(618, SUMI.throwRel, [49.0, 0.15, 0.4], 24, 'hold', { cut: true, pitch: -16 }),
  K(630, SUMI.throwRel, [49.0, 0.15, 0.4], 24, 'io', { pitch: -16 }),
  K(638, SUMI.stand, [47.4, G(), 3.4], 70, 'io', { cut: true }),
  K(644, SUMI.strokeUp, [47.4, G(), 3.4], 68, 'out'),
  K(650, SUMI.strokeUp, [47.4, G(), 3.4], 68, 'hold'),
  K(652, SUMI.strokeCut, [47.5, G(), 3.4], 68, 'snap'),
  K(668, SUMI.strokeCut, [47.5, G(), 3.4], 68, 'hold'),
  K(674, SUMI.rise, [47.7, G(), 3.4], 72, 'io', { head: [-30, 0, 0] }),
  K(680, SUMI.upperCoil, [47.9, G(), 3.4], 84, 'out'),
  K(695, SUMI.leap, [50.0, 52.0, 2.0], 90, 'in', { pitch: -14, stretch: 1.3, slide: true }),
  // sky
  K(696, SUMI.coil, [39.0, 101.0, 0], L_, 'hold', { cut: true, pitch: -26 }),
  K(700, SUMI.coil, [33.8, 108.4, 0], L_, 'lin', { pitch: -18, stretch: 1.3, slide: true }),
  K(704, SUMI.clashFist, [31.3, 110.9, 0], L_, 'snap', { pitch: -8 }),
  K(710, SUMI.clashFist, [31.3, 110.9, 0], L_, 'hold', { pitch: -8 }),
  K(716, SUMI.guardBroke, [34.6, 110.2, 0], L_, 'snap', { pitch: -36, slide: true }),
  K(730, SUMI.flung, [34.4, 111.2, 0], L_, 'io', { pitch: -20, slide: true }),
  K(742, SUMI.airGuardUp, [32.9, 113.3, 0], L_, 'io'),
  K(762, SUMI.airGuardUp, [32.55, 114.55, 0], L_, 'out'),
  // H11
  K(764, SUMI.airGuardUp, [32.55, 114.5, 0], L_, 'lin', { mouth: 'shout' }),
  K(769, SUMI.airGuardUp, [32.55, 114.5, 0], L_, 'hold', { mouth: 'shout' }),
  K(772, SUMI.flung, [31.6, 103.0, 0], L_, 'lin', { pitch: -62, stretch: 1.2, slide: true }),
  K(778, SUMI.flung, [29.6, 77.0, 0], L_, 'lin', { pitch: -68, stretch: 1.18, slide: true }),
  K(786, SUMI.flung, [26.9, 38.0, 0], L_, 'lin', { pitch: -64, stretch: 1.18, slide: true }),
  K(792, SUMI.flung, [24.9, 7.0, 0], L_, 'lin', { pitch: -58, stretch: 1.14, slide: true }),
  // H12 the ground
  K(794, SUMI.down, [24.5, G(0.26), 0], L_, 'lin', { stretch: 0.9, slide: true }),
  K(802, SUMI.down, [24.5, G(0.26), 0], L_, 'hold'),
  K(839, SUMI.down, [24.5, G(0.05), 0], L_),
  // lull
  K(840, SUMI.down, [27.0, G(0.02), -0.2], L_, 'hold', { cut: true }),
  K(862, SUMI.down, [27.0, G(0.02), -0.2], L_),
  K(878, SUMI.kneel, [27.0, G(), -0.2], L_, 'io'),
  K(896, SUMI.kneel, [27.0, G(), -0.2], L_),
  K(912, SUMI.tired, [26.9, G(), -0.2], L_, 'io'),
  K(959, SUMI.tired, [26.9, G(), -0.2], L_),
  // final exchange
  K(960, SUMI.tired, [27.6, G(), 0], L_, 'hold', { cut: true }),
  K(972, SUMI.stand, [27.6, G(), 0], L_, 'io'),
  K(982, SUMI.strokeUp, [27.6, G(), 0], L_, 'out'),
  K(1000, SUMI.strokeUp, [27.6, G(), 0], L_, 'hold'),
  K(1010, SUMI.charge, [27.7, G(), 0], L_, 'back'),
  K(1024, SUMI.charge, [27.7, G(), 0], L_),
  K(1034, SUMI.finalCoil, [27.9, G(), 0], L_, 'out'),
  K(1056, SUMI.finalCoil, [28.0, G(), 0], L_),
  K(1060, SUMI.leap, [27.5, G(1.2), 0], L_, 'in', { slide: true }),
  K(1068, SUMI.finalCoil, [25.9, 1.9, 0], L_, 'out', { slide: true, pitch: -8 }),
  K(1076, SUMI.finalCoil, [25.35, 2.1, 0], L_, 'lin', { slide: true, pitch: -4 }),
  K(1082, SUMI.finalCoil, [25.05, 2.18, 0], L_, 'lin', { slide: true }),
  // H13
  K(1084, SUMI.finalPunch, [24.55, 2.35, 0], L_, 'snap', { pitch: 4 }),
  K(1092, SUMI.finalPunch, [24.55, 2.35, 0], L_, 'hold', { pitch: 4 }),
  K(1100, SUMI.flung, [30.0, 5.0, 0], L_, 'out', { slide: true, pitch: -20 }),
  K(1131, SUMI.flung, [40.0, 8.0, 0], L_, 'out', { pitch: -30 }),
  K(1132, SUMI.sit, [24.40, G(), 0.0], -74, 'hold', { cut: true }),
  K(1199, SUMI.sit, [24.40, G(), 0.0], -74),
];

// who is on screen (frame ranges, inclusive)
const VISIBLE = {
  iro: [[72, 1199]],
  sumi: [[34, 1199]],
};
const HIDDEN = {   // out of shot while elsewhere
  iro: [[787, 861]],
  sumi: [],
};
const onScreen = (kind, f) => VISIBLE[kind].some(r => f >= r[0] && f <= r[1]) && !HIDDEN[kind].some(r => f >= r[0] && f <= r[1]);

// heroes and violent releases animate on ones
const ONES = [[204, 214], [284, 292], [334, 350], [404, 414], [544, 566], [598, 636], [704, 716], [764, 796], [794, 806], [1070, 1101]];
const drawingFrame = f => (ONES.some(r => f >= r[0] && f < r[1]) ? f : f - (f % 2));

// victim shudder during hit-stop: [frame, hold, victim(s), axis, amount]
const SHUDDER = [
  [54, 3, [], [0, 1, 0], 0],
  [204, 8, ['iro', 'sumi'], [1, 0.15, 0], 0.030],
  [284, 4, ['sumi'], [1, 0.1, 0], 0.055],
  [334, 4, ['iro'], [-1, 0, 0], 0.055],
  [404, 5, ['sumi'], [0.5, 1, 0], 0.055],
  [544, 5, ['sumi'], [1, 0, 0], 0.060],
  [624, 6, ['iro'], [0, 0, 1], 0.060],
  [704, 6, ['iro', 'sumi'], [1, 0.2, 0], 0.035],
  [764, 5, ['sumi'], [0, 1, 0], 0.060],
  [794, 8, ['sumi'], [0, 1, 0], 0.050],
  [1084, 8, ['iro', 'sumi'], [1, 0.2, 0], 0.035],
];

class Animator {
  constructor() {
    this.keys = { iro: IRO_KEYS, sumi: SUMI_KEYS };
    this.delta = new Map();
    this.solveTouches();
  }
  yOf(y, x, z, f) { return typeof y === 'number' ? y : groundHeight(x, z, f) + y.g; }
  sample(kind, fPose, fMove) {
    const ks = this.keys[kind];
    let i = ks.length - 1;
    for (let k = 0; k < ks.length - 1; k++) if (fPose < ks[k + 1].f) { i = k; break; }
    const a = ks[i], b = ks[Math.min(i + 1, ks.length - 1)];
    const span = Math.max(1, b.f - a.f);
    let u = clamp((fPose - a.f) / span);
    if (b.cut || a === b) u = 0;
    const e = Ease[b.ease](u);
    const pa = this.poseOf(a), pb = this.poseOf(b);
    const pose = lerpPose(pa, pb, e);
    // slide: the cel keeps moving on ones while the drawing is held
    let um = u, em = e;
    if (b.slide && !b.cut && a !== b) { um = clamp((fMove - a.f) / span); em = Ease[b.ease](um); }
    const dA = this.delta.get(a) || [0, 0, 0], dB = this.delta.get(b) || [0, 0, 0];
    const ax = a.pos[0] + dA[0], az = a.pos[2] + dA[2], bx = b.pos[0] + dB[0], bz = b.pos[2] + dB[2];
    const x = lerp(ax, bx, em), z = lerp(az, bz, em);
    const ya = this.yOf(a.pos[1], ax, az, fPose) + dA[1], yb = this.yOf(b.pos[1], bx, bz, fPose) + dB[1];
    const rot = k => {
      let av = a[k], bv = b[k];
      if (b.cutRot) av = av - Math.round((av - bv) / 360) * 360;
      return lerp(av, bv, e);
    };
    let stretch = lerp(a.stretch || 1, b.stretch || 1, e);
    return {
      pose, root: { pos: [x, lerp(ya, yb, em), z], yaw: rot('yaw'), pitch: rot('pitch'), roll: rot('roll'), spin: rot('spin') },
      stretch, keyA: a, keyB: b,
    };
  }
  poseOf(k) {
    if (!k._pose) {
      const ov = {};
      for (const q of ['eyes', 'mouth', 'head']) if (k[q] !== undefined) ov[q] = k[q];
      k._pose = makePose(k.p, ov);
    }
    return k._pose;
  }
  // IRO spins on SUMI's grip
  swingOverride(kind, f, s) {
    if (f < 601 || f >= 618) return s;
    const u = (f - 600) / 18;
    const turn = Ease.in(u) * 2.35;                      // revolutions
    const yawS = -90 + turn * 360 + 6 * u;
    const centre = [49.05, 0.15, 0.3];
    if (kind === 'sumi') {
      const w = smooth(0, 0.22, u);
      const pose = lerpPose(this.poseOf({ p: SUMI.grab }), makePose(SUMI.swing, {}), w);
      return { pose, root: { pos: centre, yaw: yawS, pitch: -10 * w, roll: 0, spin: 0 }, stretch: 1 };
    }
    const a = yawS * D2R, rad = lerp(1.7, 2.35, u);
    const pos = [centre[0] + Math.sin(a) * rad, centre[1] + 1.0 + Math.sin(turn * TAU * 0.5) * 0.55 + u * u * 2.0, centre[2] + Math.cos(a) * rad * 0.72];
    return { pose: makePose(IRO.flung, { eyes: 'strain' }), root: { pos, yaw: yawS + 90, pitch: -52, roll: 0, spin: 0 }, stretch: 1 + 0.3 * u };
  }
  raw(kind, f) {
    const fp = drawingFrame(f);
    let s = this.sample(kind, fp, f);
    s = this.swingOverride(kind, fp, s);
    return s;
  }
  // rig for a frame with all layered motion applied
  evaluate(kind, f) {
    const s = this.raw(kind, f);
    const pose = s.pose;
    const fp = drawingFrame(f);
    // breathing in the quiet passages
    const quiet = (fp >= 72 && fp < 188) || (fp >= 874 && fp < 1004) || (fp >= 1132);
    if (quiet) {
      const tired = fp >= 874 && fp < 1004 ? 1 : 0.35;
      const br = Math.sin(fp / 24 * TAU * (tired > 0.5 ? 0.72 : 0.45) + (kind === 'iro' ? 0 : 2.1)) * tired;
      pose.hip = V.add(pose.hip, [0, br * 0.014, 0]);
      pose.spine = V.add(pose.spine, [br * 3.2, 0, 0]);
      pose.hL = V.add(pose.hL, [0, br * 0.010, 0]); pose.hR = V.add(pose.hR, [0, br * 0.010, 0]);
    }
    const root = Object.assign({}, s.root);
    root.pos = root.pos.slice();
    for (const [hf, hold, who, axis, amt] of SHUDDER) {
      if (f > hf && f < hf + hold && who.includes(kind)) {
        const sg = (f - hf) % 2 ? 1 : -1;
        const k = amt * (1 - (f - hf) / (hold + 1));
        root.pos = V.mad(root.pos, V.norm(axis), sg * k);
      }
    }
    return { pose, root, stretch: s.stretch };
  }
  position(kind, f) { return this.sample(kind, f, f).root.pos; }
  // smoothed position for cameras
  anchor(kind, f, h = 1.0) {
    const s = this.swingOverride(kind, f, this.sample(kind, f, f));
    return V.add(s.root.pos, [0, h, 0]);
  }
  velocity(kind, f) {
    const fp = drawingFrame(f);
    const a = this.raw(kind, Math.max(0, fp - 3)).root.pos, b = this.raw(kind, fp).root.pos;
    const v = V.mul(V.sub(b, a), 24 / 3);
    if (V.len(v) > 130) return [0, 0, 0];
    return v;
  }
  // line up the striking limb with its target on contact frames
  solveTouches() {
    for (const kind of ['sumi', 'iro']) {
      const other = kind === 'iro' ? 'sumi' : 'iro';
      const ks = this.keys[kind];
      for (let i = 0; i < ks.length; i++) {
        const k = ks[i];
        if (!k.touch) continue;
        const mine = this.raw(kind, k.f), theirs = this.raw(other, k.f);
        const rm = solveRig(kind, mine.pose, mine.root), rt = solveRig(other, theirs.pose, theirs.root);
        const want = V.add(rt.J[k.touch.theirs], k.touch.off);
        const d = V.sub(want, rm.J[k.touch.mine]);
        if (V.len(d) > 2.2) console.warn('large contact correction', kind, k.f, d.map(x => x.toFixed(2)).join(','));
        // apply to the contact drawing, its hold, and ease into it from the drawing before
        this.delta.set(k, d);
        for (let j = i + 1; j < ks.length && ks[j].ease === 'hold'; j++) this.delta.set(ks[j], d);
        if (i > 0 && k.f - ks[i - 1].f <= 3) this.delta.set(ks[i - 1], V.add(this.delta.get(ks[i - 1]) || [0, 0, 0], V.mul(d, 0.6)));
      }
    }
  }
}
