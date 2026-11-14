/** FAQ copy shared by the home accordion and its FAQPage JSON-LD (spec Phase 6 §A3). */
export interface FaqItem {
  question: string;
  answer: string;
}

export const HOME_FAQ: FaqItem[] = [
  {
    question: 'Is it free?',
    answer: 'Yes. The plan, the tracker and the tools are free. No sign-up, no trial, no card.',
  },
  {
    question: 'Is this medical advice?',
    answer:
      "No. It's general guidance built on standard nutrition science. If you have a medical condition, take regular medicines, or are pregnant or breastfeeding, check with your doctor before changing how you eat.",
  },
  {
    question: 'Do I need protein powder?',
    answer:
      "No. Every plan gets its protein from food — dal, curd, paneer, chana, sprouts, eggs or meat. If food alone can't reach your target, the plan says so plainly.",
  },
  {
    question: 'Where is my data stored?',
    answer:
      'Only on your phone, in your browser. Nothing you type is sent to a server. You can export it or delete it any time from your plan page.',
  },
  {
    question: 'Does it work with PCOS, diabetes or thyroid?',
    answer:
      'Yes. Picking a condition changes the food choices and adds safety notes — for example, lower-GI grains for PCOS and diabetes. If you take insulin or diabetes tablets, the plan keeps any calorie cut small and asks you to talk to your doctor first.',
  },
  {
    question: 'Can I use it in a hostel?',
    answer:
      'Yes. Pick "Hostel, PG or mess" and you\'ll get simple rules for building your plate from what\'s served, plus what to order when you eat out.',
  },
];
