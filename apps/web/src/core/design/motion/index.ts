import type { DesignToken } from '../types';

export const MOTION_TOKENS: readonly DesignToken[] = [
  // Duration
  { id: 'motion.duration.fast', name: 'Duration Fast', category: 'motion', group: 'duration', type: 'duration', version: '1.0.0', owner: 'design-system', tags: ['motion', 'duration'], value: '100ms' },
  { id: 'motion.duration.base', name: 'Duration Base', category: 'motion', group: 'duration', type: 'duration', version: '1.0.0', owner: 'design-system', tags: ['motion', 'duration'], value: '200ms' },
  { id: 'motion.duration.slow', name: 'Duration Slow', category: 'motion', group: 'duration', type: 'duration', version: '1.0.0', owner: 'design-system', tags: ['motion', 'duration'], value: '300ms' },

  // Transition (easing curves)
  { id: 'motion.ease.out', name: 'Ease Out', category: 'motion', group: 'transition', type: 'transition', version: '1.0.0', owner: 'design-system', tags: ['motion', 'easing'], value: 'cubic-bezier(0.2, 0, 0, 1)' },
  { id: 'motion.ease.in', name: 'Ease In', category: 'motion', group: 'transition', type: 'transition', version: '1.0.0', owner: 'design-system', tags: ['motion', 'easing'], value: 'cubic-bezier(0.4, 0, 1, 1)' },
  { id: 'motion.ease.inOut', name: 'Ease In Out', category: 'motion', group: 'transition', type: 'transition', version: '1.0.0', owner: 'design-system', tags: ['motion', 'easing'], value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  { id: 'motion.ease.linear', name: 'Ease Linear', category: 'motion', group: 'transition', type: 'transition', version: '1.0.0', owner: 'design-system', tags: ['motion', 'easing'], value: 'linear' },

  // Transition shorthand (property | duration | easing)
  { id: 'motion.transition.fast', name: 'Transition Fast', category: 'motion', group: 'transition', type: 'transition', version: '1.0.0', owner: 'design-system', tags: ['motion', 'transition'], value: 'all {motion.duration.fast} {motion.ease.out}' },
  { id: 'motion.transition.base', name: 'Transition Base', category: 'motion', group: 'transition', type: 'transition', version: '1.0.0', owner: 'design-system', tags: ['motion', 'transition'], value: 'all {motion.duration.base} {motion.ease.out}' },
  { id: 'motion.transition.slow', name: 'Transition Slow', category: 'motion', group: 'transition', type: 'transition', version: '1.0.0', owner: 'design-system', tags: ['motion', 'transition'], value: 'all {motion.duration.slow} {motion.ease.inOut}' },

  // Animation
  { id: 'motion.animation.fadeIn', name: 'Animation Fade In', category: 'motion', group: 'animation', type: 'motion', version: '1.0.0', owner: 'design-system', tags: ['motion', 'animation'], value: 'fadeIn {motion.duration.base} {motion.ease.out}' },
  { id: 'motion.animation.slideInUp', name: 'Animation Slide In Up', category: 'motion', group: 'animation', type: 'motion', version: '1.0.0', owner: 'design-system', tags: ['motion', 'animation'], value: 'slideInUp {motion.duration.slow} {motion.ease.inOut}' },
  { id: 'motion.animation.spin', name: 'Animation Spin', category: 'motion', group: 'animation', type: 'motion', version: '1.0.0', owner: 'design-system', tags: ['motion', 'animation'], value: 'spin 1s linear infinite' },
] as const satisfies readonly DesignToken[];

/** Lookup helper over the motion set. */
export const MOTION_TOKENS_BY_ID: ReadonlyMap<string, DesignToken> = new Map(
  MOTION_TOKENS.map((token) => [token.id, token]),
);