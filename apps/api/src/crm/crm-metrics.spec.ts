import { computeFunnel, type MetricDeal, type MetricStage, type StageReach } from './crm-metrics';

const stages: MetricStage[] = [
  { id: 'st-new', name: 'New', position: 1, isWon: false, isLost: false },
  { id: 'st-qual', name: 'Qualified', position: 2, isWon: false, isLost: false },
  { id: 'st-won', name: 'Won', position: 3, isWon: true, isLost: false },
];

function makeDeal(overrides: Partial<MetricDeal> & { id: string }): MetricDeal {
  return {
    value: 100,
    probability: 50,
    stageId: null,
    ownerId: null,
    createdAt: new Date('2026-01-01'),
    wonAt: null,
    lostAt: null,
    expectedCloseDate: null,
    ...overrides,
  };
}

describe('computeFunnel (count/value consistency)', () => {
  it('value covers exactly the same distinct deals as dealCount for every stage', () => {
    const deals = [
      makeDeal({ id: 'd1', stageId: 'st-new', value: 100 }),
      makeDeal({ id: 'd2', stageId: 'st-qual', value: 200 }),
      makeDeal({ id: 'd3', stageId: 'st-won', value: 300 }),
    ];

    const funnel = computeFunnel(stages, deals, []);

    expect(funnel).toHaveLength(3);
    for (const row of funnel) {
      // No history here: reached set == current membership per stage, so the
      // per-stage deal total must equal value summed over that same set.
      const expectedValue = deals
        .filter((d) => d.stageId === row.stageId)
        .reduce((sum, d) => sum + d.value, 0);
      expect(row.dealCount).toBe(deals.filter((d) => d.stageId === row.stageId).length);
      expect(row.value).toBe(expectedValue);
    }
  });

  it('a deal that advanced still contributes its value to earlier stages (reached semantics)', () => {
    // d1 moved New -> Qualified -> Won; history records both transitions.
    const deals = [makeDeal({ id: 'd1', stageId: 'st-won', value: 500 })];
    const reach: StageReach[] = [
      { dealId: 'd1', stageId: 'st-new' },
      { dealId: 'd1', stageId: 'st-qual' },
      { dealId: 'd1', stageId: 'st-won' },
    ];

    const funnel = computeFunnel(stages, deals, reach);

    // Before the fix, value used only current membership: New and Qualified
    // showed dealCount 1 but value 0.
    expect(funnel[0].dealCount).toBe(1);
    expect(funnel[0].value).toBe(500);
    expect(funnel[1].dealCount).toBe(1);
    expect(funnel[1].value).toBe(500);
    expect(funnel[2].dealCount).toBe(1);
    expect(funnel[2].value).toBe(500);
  });

  it('value never double-counts a deal that appears in both current stage and history', () => {
    const deals = [makeDeal({ id: 'd1', stageId: 'st-qual', value: 250 })];
    const reach: StageReach[] = [
      { dealId: 'd1', stageId: 'st-new' },
      { dealId: 'd1', stageId: 'st-qual' },
    ];

    const funnel = computeFunnel(stages, deals, reach);

    const qualified = funnel.find((f) => f.stageId === 'st-qual');
    expect(qualified?.dealCount).toBe(1);
    expect(qualified?.value).toBe(250);
  });

  it('history-only deals count in dealCount and contribute their known value', () => {
    const deals = [
      makeDeal({ id: 'd1', stageId: 'st-won', value: 100 }),
      // d2 no longer appears in the deal rows for the current stage (e.g. its
      // stageId is null) but its transition into New was recorded.
      makeDeal({ id: 'd2', stageId: null, value: 40 }),
    ];
    const reach: StageReach[] = [{ dealId: 'd2', stageId: 'st-new' }];

    const funnel = computeFunnel(stages, deals, reach);

    const fresh = funnel.find((f) => f.stageId === 'st-new');
    expect(fresh?.dealCount).toBe(1);
    expect(fresh?.value).toBe(40);
  });

  it('rounds value to two decimals', () => {
    const deals = [
      makeDeal({ id: 'd1', stageId: 'st-new', value: 10.005 }),
      makeDeal({ id: 'd2', stageId: 'st-new', value: 20.004 }),
    ];

    const funnel = computeFunnel(stages, deals, []);

    expect(funnel[0].value).toBe(30.01);
  });
});
