export const INSIGHTS = [
  {
    id: 'dietary',
    aspect: 'Dietary Aspect',
    confidence: 94,
    observations: [
      { icon: 'warning', text: 'Fiber target met' },
      { icon: 'warning', text: 'Protein below goal' },
      { icon: 'alert', text: 'High Sugar Intake' },
    ],
    conclusion:
      'You have been diligently hitting your caloric intake goals however, meals taken tend to be high sugar with less fiber and also.',
    title: 'Protein below Goal',
    summary:
      'Your protein intake has fallen short of your 160g daily goal on 6 of the last 7 days.',
    observation: 'Avg daily protein: 118g (26% below goal)',
    dataUsed: [
      'Daily logs Jul 14–20',
      'Goal set during onboarding (Jul 3)',
    ],
    reasoningSimple: [
      'Extracted daily protein totals from the past 7 days',
      'Intake: 118g vs Target: 160g resulting in 26.0% protein deficit',
      'Not enough protein intake during both Training and Rest days',
      'Energy levels is reported as "low" on 4/6 deficit days',
      'Conclusion: consistent & ongoing shortfall — may impact the repairing and growth of muscle tissues',
    ],
    reasoningTechnical: [
      'Extracted daily protein totals from the past 7 days',
      'Computed mean: 118.4g vs target 160g → 26.0% deficit',
      'Checked for rest-day vs training-day patterns: deficit persists on both',
      'Cross-referenced with energy levels self-reported as "low" on 4/6 deficit days',
      'Conclusion: structural gap, not occasional — high likelihood of muscle synthesis impact',
    ],
    recommendation:
      'Add a 170-cal, 12g protein snack (Greek yogurt) daily around 3 PM.',
    footer: 'High Sugar Intake',
  },
  {
    id: 'activity',
    aspect: 'Activity Aspect',
    confidence: 88,
    observations: [{ icon: 'warning', text: 'Sedentary lifestyle' }],
    conclusion:
      'You have not been doing your exercises enough. Long sitting hours have been observed.',
    title: 'Low Activity Level',
    summary: 'Your active time has averaged 40 minutes against a 90 minute goal.',
    observation: 'Avg active time: 40min (56% below goal)',
    dataUsed: ['Activity logs Jul 14–20', 'Goal set during onboarding (Jul 3)'],
    reasoningSimple: [
      'Totalled active minutes across the past 7 days',
      'Average 40min vs target 90min',
      'Long sedentary blocks recorded on weekdays',
    ],
    reasoningTechnical: [
      'Totalled active minutes across the past 7 days',
      'Computed mean: 40.2min vs target 90min → 55.3% deficit',
      'Identified sedentary blocks exceeding 4h on 5/7 weekdays',
      'Correlated with reported energy dips in the afternoon',
    ],
    recommendation: 'Add a 20 minute walk after lunch on weekdays.',
    footer: '',
  },
  {
    id: 'sleep',
    aspect: 'Sleep Aspect',
     confidence: 91,
    observations: [{ icon: 'warning', text: '5 hours sleep on average' }],
    conclusion: '',
    title: 'Sleep Below Recommended',
    summary: 'You have averaged 5 hours of sleep against a 7-9 hour recommendation.',
    observation: 'Avg sleep: 5h 00m',
    dataUsed: ['Sleep logs Jul 14–20'],
    reasoningSimple: [
      'Averaged recorded sleep duration over 7 days',
      '5h average falls below the 7-9h recommended range',
    ],
    reasoningTechnical: [
      'Averaged recorded sleep duration over 7 days: 5h 02m',
      'Compared against NSF adult recommendation of 7-9h',
      'Bedtime variance of ±90min suggests irregular schedule',
    ],
    recommendation: 'Aim for a consistent bedtime before 11:30 PM.',
    footer: '',
  },
];