import type { PlanModelEstimate } from '../../app/types'

export const planModels: PlanModelEstimate[] = [
  {
    plan_id: 'cmd-go',
    model_id: 'tencent/hy4-preview',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 918,
      per_week: 1837,
      per_month: 3061
    },
    note: 'Derived from usage calculator formula (800 in / 200 out / 50K cache read) at $0.834/$2.501/$0.042 per 1M; Go $10 limits 3/6/10'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'tencent/hy4-preview',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 1220,
      per_week: 3060,
      per_month: 6120
    },
    note: 'Synced 2026-08-29 from https://commandcode.ai/docs/plans/goat#usage-limits — Hy4 Preview 1220/3060/6120 on GOAT $20'
  },
  {
    plan_id: 'oc-go',
    model_id: 'tencent/hy4-preview',
    monthly_credits_usd: 30,
    estimates: {
      per_5h: 1350,
      per_week: 3380,
      per_month: 6770
    },
    note: 'Synced 2026-08-29 from https://opencode.ai/docs/go — Hy4 preview $30 on $10 Go; 830 in / 71500 cached / 295 out per request'
  },
  {
    plan_id: 'cmd-go',
    model_id: 'zai-org/glm-5.3-flash',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 1744,
      per_week: 3488,
      per_month: 5814
    },
    note: 'Derived from usage calculator formula (800 in / 200 out / 50K cache read) at $0.15/$0.50/$0.03 per 1M; matches https://commandcode.ai/docs/resources/pricing-limits ~5.9k req/month for Go'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'zai-org/glm-5.3-flash',
    monthly_credits_usd: 40,
    estimates: {
      per_5h: 4720,
      per_week: 11800,
      per_month: 23600
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'zai-org/glm-5.3-flash',
    monthly_credits_usd: 15,
    estimates: {
      per_5h: 1580,
      per_week: 3950,
      per_month: 7900
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'qwen/qwen3.8-flash',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 2936,
      per_week: 5871,
      per_month: 9785
    },
    note: 'Derived from usage calculator formula (800 in / 200 out / 50K cache read) at $0.16/$0.47/$0.016 per 1M; Go $10 limits 3/6/10'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'qwen/qwen3.8-flash',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 3910,
      per_week: 9780,
      per_month: 19600
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'deepseek/deepseek-v4-flash-vision-exp',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 4559,
      per_week: 9119,
      per_month: 15198
    },
    note: 'Recalc 2026-08-27: 800 in / 200 out / 50K cache at off-peak $0.22/$0.66/$0.007 per 1M; Go $10 limits 3/6/10'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'deepseek/deepseek-v4-flash-vision-exp',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 6080,
      per_week: 15200,
      per_month: 30400
    }
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'deepseek/deepseek-v4-flash-fast',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 1040,
      per_week: 2610,
      per_month: 5210
    },
    note: 'Synced 2026-08-31 from https://commandcode.ai/docs/plans/goat#usage-limits — Flash Fast 1040/2610/5210 on GOAT $20'
  },
  {
    plan_id: 'oc-go',
    model_id: 'deepseek/deepseek-v4-flash-vision-exp',
    monthly_credits_usd: 15,
    estimates: {
      per_5h: 3800,
      per_week: 9450,
      per_month: 18900
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'zai-org/glm-5.3',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 203,
      per_week: 406,
      per_month: 677
    },
    note: 'Derived from usage calculator formula (800 in / 150 out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'zai-org/glm-5.3',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 271,
      per_week: 677,
      per_month: 1350
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'zai-org/glm-5.3',
    monthly_credits_usd: 15,
    estimates: {
      per_5h: 220,
      per_week: 540,
      per_month: 1080
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'qwen/qwen3.8-27b',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 1028,
      per_week: 2055,
      per_month: 3425
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'qwen/qwen3.8-27b',
    monthly_credits_usd: 70,
    estimates: {
      per_5h: 4790,
      per_week: 12000,
      per_month: 24000
    }
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'google/gemini-3.7-flash',
    monthly_credits_usd: 40,
    estimates: {
      per_5h: 784,
      per_week: 1960,
      per_month: 3920
    },
    note: 'Synced 2026-08-31 from https://commandcode.ai/docs/plans/goat#usage-limits — Gemini 3.7 Flash $40 credits on GOAT'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'google/gemini-3.8-flash',
    monthly_credits_usd: 40,
    estimates: {
      per_5h: 784,
      per_week: 1960,
      per_month: 3920
    },
    note: 'Synced 2026-09-02 from https://commandcode.ai/docs/plans/goat#usage-limits — Gemini 3.8 Flash GOAT-only, $40 credits; released 2026-09-02, same rates as 3.7 Flash minus cache write; usage shape 800/200/50K'
  },
  {
    plan_id: 'cmd-go',
    model_id: 'deepseek/deepseek-v4-pro',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 1482,
      per_week: 2965,
      per_month: 4941
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'deepseek/deepseek-v4-pro',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 1980,
      per_week: 4940,
      per_month: 9880
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'deepseek/deepseek-v4-pro',
    monthly_credits_usd: 15,
    estimates: {
      per_5h: 1050,
      per_week: 2600,
      per_month: 5200
    }
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'xai/grok-4.6',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 144,
      per_week: 360,
      per_month: 719
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'xai/grok-4.6',
    monthly_credits_usd: 15,
    estimates: {
      per_5h: 169,
      per_week: 423,
      per_month: 845
    },
    note: 'Synced 2026-08-29 from https://opencode.ai/docs/go — Grok 4.6 $15 on $10 Go'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'meta/muse-spark-1.2',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 428,
      per_week: 1070,
      per_month: 2140
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'meta/muse-spark-1.2-contributor',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 13637,
      per_week: 27273,
      per_month: 45455
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'meta/muse-spark-1.2-contributor',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 18200,
      per_week: 45500,
      per_month: 90900
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'meta/muse-spark-1.2-contributor',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 45300,
      per_week: 113300,
      per_month: 226600
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'qwen/qwen3.8-max',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 196,
      per_week: 392,
      per_month: 654
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },

  {
    plan_id: 'cmd-go',
    model_id: 'qwen/qwen3.8-max-0902',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 196,
      per_week: 392,
      per_month: 654
    },
    note: 'Synced 2026-09-02 from https://commandcode.ai/docs/plans/go — Qwen 3.8 Max 0902 new on Go; estimates derived from usage calculator formula (same rate as qwen3.8-max: $2 in / $6 out / $0.25 cache read)'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'qwen/qwen3.8-max',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 261,
      per_week: 654,
      per_month: 1310
    }
  },

  {
    plan_id: 'cmd-goat',
    model_id: 'qwen/qwen3.8-max-0902',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 261,
      per_week: 654,
      per_month: 1310
    },
    note: 'Synced 2026-09-02 from https://commandcode.ai/docs/plans/goat — Qwen 3.8 Max 0902 new-model allowance $20, estimates published in GOAT usage-limits table (261/654/1310, same as qwen3.8-max)'
  },
  {
    plan_id: 'oc-go',
    model_id: 'qwen/qwen3.8-max',
    monthly_credits_usd: 15,
    estimates: {
      per_5h: 160,
      per_week: 400,
      per_month: 810
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'qwen/qwen3.8-flash',
    monthly_credits_usd: 30,
    estimates: {
      per_5h: 5400,
      per_week: 13500,
      per_month: 27000
    },
    note: 'Synced 2026-08-31 from https://opencode.ai/docs/go — Qwen3.8 Flash $30 on $10 Go'
  },
  {
    plan_id: 'cmd-go',
    model_id: 'deepseek/deepseek-v4-flash',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 4559,
      per_week: 9119,
      per_month: 15198
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-go',
    model_id: 'deepseek/deepseek-v4-flash-fast',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 782,
      per_week: 1564,
      per_month: 2607
    },
    note: 'Derived from usage calculator formula (800 in / 200 out / 50K cache read) at $0.28/$0.56/$0.07 per 1M; Go $10 limits 3/6/10'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'deepseek/deepseek-v4-flash',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 18200,
      per_week: 45600,
      per_month: 91200
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'deepseek/deepseek-v4-flash',
    monthly_credits_usd: 30,
    estimates: {
      per_5h: 7600,
      per_week: 18900,
      per_month: 37800
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'thinkingmachines/inkling-small',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 532,
      per_week: 1064,
      per_month: 1773
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'thinkingmachines/inkling-small',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 709,
      per_week: 1770,
      per_month: 3550
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'moonshotai/kimi-k3',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 147,
      per_week: 294,
      per_month: 490
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'moonshotai/kimi-k3',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 196,
      per_week: 490,
      per_month: 980
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'moonshotai/kimi-k3',
    monthly_credits_usd: 15,
    estimates: {
      per_5h: 110,
      per_week: 250,
      per_month: 490
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'qwen/qwen3.7-flash',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 2586,
      per_week: 5173,
      per_month: 8621
    },
    note: 'Derived; context-tiered pricing, estimate uses >32K tier at 50K cache profile'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'qwen/qwen3.7-flash',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 3448,
      per_week: 8621,
      per_month: 17241
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); GOAT page publishes no per-model estimates; context-tiered pricing; uses >32K tier at 50K cache profile'
  },
  {
    plan_id: 'cmd-go',
    model_id: 'thinkingmachines/inkling',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 297,
      per_week: 593,
      per_month: 989
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'thinkingmachines/inkling',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 396,
      per_week: 989,
      per_month: 1980
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'gpt-5.6-luna',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 2219,
      per_week: 4438,
      per_month: 7396
    },
    note: 'Derived from usage calculator formula (800 in / 160 out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'gpt-5.6-luna',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 2960,
      per_week: 7400,
      per_month: 14800
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'gpt-5.6-luna',
    monthly_credits_usd: 15,
    estimates: {
      per_5h: 2050,
      per_week: 5100,
      per_month: 10250
    }
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'gpt-5.6-sol',
    monthly_credits_usd: 70,
    estimates: {
      per_5h: 414,
      per_week: 1040,
      per_month: 2070
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'xai/grok-4.5',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 108,
      per_week: 216,
      per_month: 360
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'xai/grok-4.5',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 144,
      per_week: 360,
      per_month: 719
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'tencent/hy3-paid',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 1517,
      per_week: 3034,
      per_month: 5056
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'tencent/hy3-paid',
    monthly_credits_usd: 70,
    estimates: {
      per_5h: 7080,
      per_week: 17700,
      per_month: 35400
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'tencent/hy3-paid',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 4300,
      per_week: 10750,
      per_month: 21500
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'meituan/longcat-2.0',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 11400,
      per_week: 28600,
      per_month: 57200
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'zai-org/glm-5.2-fast',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 104,
      per_week: 208,
      per_month: 346
    },
    note: 'Derived from usage calculator formula (800 in / 150 out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'zai-org/glm-5.2-fast',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 138,
      per_week: 346,
      per_month: 691
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'zai-org/glm-5.2',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 203,
      per_week: 406,
      per_month: 677
    },
    note: 'Derived from usage calculator formula (800 in / 150 out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'zai-org/glm-5.2',
    monthly_credits_usd: 70,
    estimates: {
      per_5h: 947,
      per_week: 2370,
      per_month: 4740
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'zai-org/glm-5.2',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 880,
      per_week: 2150,
      per_month: 4300
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'moonshotai/kimi-k2.7-code-highspeed',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 136,
      per_week: 271,
      per_month: 452
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'moonshotai/kimi-k2.7-code-highspeed',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 181,
      per_week: 452,
      per_month: 904
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'moonshotai/kimi-k2.7-code',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 271,
      per_week: 542,
      per_month: 904
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'moonshotai/kimi-k2.7-code',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 1080,
      per_week: 2710,
      per_month: 5420
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'moonshotai/kimi-k2.7-code',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 1350,
      per_week: 3380,
      per_month: 6750
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'nvidia/nemotron-3-ultra-550b-a55b',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 431,
      per_week: 862,
      per_month: 1437
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'nvidia/nemotron-3-ultra-550b-a55b',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 575,
      per_week: 1440,
      per_month: 2870
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'qwen/qwen3.7-plus',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 647,
      per_week: 1293,
      per_month: 2155
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'qwen/qwen3.7-plus',
    monthly_credits_usd: 33,
    estimates: {
      per_5h: 1420,
      per_week: 3560,
      per_month: 7110
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'qwen/qwen3.7-plus',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 4300,
      per_week: 10800,
      per_month: 21600
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'minimaxai/minimax-m3',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 885,
      per_week: 1770,
      per_month: 2950
    },
    note: 'Derived from usage calculator formula (800 in / 125 out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'minimaxai/minimax-m3',
    monthly_credits_usd: 47,
    estimates: {
      per_5h: 2770,
      per_week: 6930,
      per_month: 13900
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'minimaxai/minimax-m3',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 3200,
      per_week: 8000,
      per_month: 16000
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'stepfun/step-3.7-flash',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 1255,
      per_week: 2510,
      per_month: 4184
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'stepfun/step-3.7-flash',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 1670,
      per_week: 4180,
      per_month: 8370
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'qwen/qwen3.7-max',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 105,
      per_week: 211,
      per_month: 351
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'qwen/qwen3.7-max',
    monthly_credits_usd: 33,
    estimates: {
      per_5h: 232,
      per_week: 579,
      per_month: 1160
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'qwen/qwen3.7-max',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 340,
      per_week: 840,
      per_month: 1690
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'xiaomi/mimo-v2.5',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 9740,
      per_week: 19481,
      per_month: 32468
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'xiaomi/mimo-v2.5',
    monthly_credits_usd: 30,
    estimates: {
      per_5h: 19500,
      per_week: 48700,
      per_month: 97400
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'xiaomi/mimo-v2.5',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 30100,
      per_week: 75200,
      per_month: 150400
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'xiaomi/mimo-v2.5-pro',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 4274,
      per_week: 8547,
      per_month: 14245
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'xiaomi/mimo-v2.5-pro',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 5700,
      per_week: 14200,
      per_month: 28500
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'xiaomi/mimo-v2.5-pro',
    monthly_credits_usd: 15,
    estimates: {
      per_5h: 3250,
      per_week: 8150,
      per_month: 16300
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'moonshotai/kimi-k2.6',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 314,
      per_week: 628,
      per_month: 1046
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'moonshotai/kimi-k2.6',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 418,
      per_week: 1046,
      per_month: 2092
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); GOAT page publishes no per-model estimates'
  },
  {
    plan_id: 'oc-go',
    model_id: 'moonshotai/kimi-k2.6',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 1150,
      per_week: 2880,
      per_month: 5750
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'qwen/qwen3.6-max-preview',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 192,
      per_week: 385,
      per_month: 641
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'qwen/qwen3.6-max-preview',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 256,
      per_week: 641,
      per_month: 1282
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); GOAT page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-go',
    model_id: 'zai-org/glm-5.1',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 203,
      per_week: 406,
      per_month: 677
    },
    note: 'Derived from usage calculator formula (800 in / 150 out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'zai-org/glm-5.1',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 271,
      per_week: 677,
      per_month: 1353
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); GOAT page publishes no per-model estimates'
  },
  {
    plan_id: 'oc-go',
    model_id: 'zai-org/glm-5.1',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 880,
      per_week: 2150,
      per_month: 4300
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'qwen/qwen3.6-plus',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 500,
      per_week: 1000,
      per_month: 1667
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'qwen/qwen3.6-plus',
    monthly_credits_usd: 33,
    estimates: {
      per_5h: 1100,
      per_week: 2750,
      per_month: 5500
    }
  },
  {
    plan_id: 'oc-go',
    model_id: 'qwen/qwen3.6-plus',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 3300,
      per_week: 8200,
      per_month: 16300
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'minimaxai/minimax-m2.7',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 885,
      per_week: 1770,
      per_month: 2950
    },
    note: 'Derived from usage calculator formula (800 in / 125 out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'minimaxai/minimax-m2.7',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 1180,
      per_week: 2950,
      per_month: 5900
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); GOAT page publishes no per-model estimates'
  },
  {
    plan_id: 'oc-go',
    model_id: 'minimaxai/minimax-m2.7',
    monthly_credits_usd: 60,
    estimates: {
      per_5h: 3400,
      per_week: 8500,
      per_month: 17000
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'minimaxai/minimax-m2.5',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 1587,
      per_week: 3175,
      per_month: 5291
    },
    note: 'Derived from usage calculator formula (800 in / 125 out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'minimaxai/minimax-m2.5',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 2116,
      per_week: 5291,
      per_month: 10582
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); GOAT page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-go',
    model_id: 'zai-org/glm-5',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 266,
      per_week: 532,
      per_month: 887
    },
    note: 'Derived from usage calculator formula (800 in / 150 out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'zai-org/glm-5',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 355,
      per_week: 887,
      per_month: 1773
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); GOAT page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-go',
    model_id: 'stepfun/step-3.5-flash',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 2632,
      per_week: 5263,
      per_month: 8772
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'stepfun/step-3.5-flash',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 3510,
      per_week: 8770,
      per_month: 17500
    }
  },
  {
    plan_id: 'cmd-go',
    model_id: 'moonshotai/kimi-k2.5',
    monthly_credits_usd: 10,
    estimates: {
      per_5h: 494,
      per_week: 987,
      per_month: 1645
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); Go page publishes no per-model estimates'
  },
  {
    plan_id: 'cmd-goat',
    model_id: 'moonshotai/kimi-k2.5',
    monthly_credits_usd: 20,
    estimates: {
      per_5h: 658,
      per_week: 1645,
      per_month: 3289
    },
    note: 'Derived from usage calculator formula (800 in / provider out / 50K cache read); GOAT page publishes no per-model estimates'
  }
]
