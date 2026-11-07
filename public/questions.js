// Team Pulse question bank.
// All statements are written in our own words. Section A is informed by the team
// self-assessment in Macklin & Zbar, Driving School Improvement (2nd ed., ACER, 2020).
// The trust statements are informed by Bryk & Schneider's four determinants of
// relational trust (Trust in Schools, 2002; Educational Leadership, 2003).

export const SCALE = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Agree" },
  { value: 4, label: "Strongly agree" },
];

export const SECTIONS = [
  {
    id: "direction",
    title: "Direction and unity",
    blurb: "Do we know where we're going, and are we going there together?",
    part: "team",
    items: [
      { id: "d1", text: "We have a clear strategy for improving our school." },
      { id: "d2", text: "Every member of this team genuinely agrees with that strategy." },
      { id: "d3", text: "Our strategy builds on what our school already does well." },
      { id: "d4", text: "Our strategy tackles the areas we most need to improve." },
      { id: "d5", text: "We speak to staff with one voice." },
      { id: "d6", text: "We involve staff in shaping and carrying out our improvement work." },
    ],
  },
  {
    id: "developing",
    title: "Developing others",
    blurb: "Are we growing the people around us?",
    part: "team",
    items: [
      { id: "g1", text: "We regularly coach and mentor staff." },
      { id: "g2", text: "We work alongside teachers and lead professional learning in our priority areas." },
    ],
  },
  {
    id: "working",
    title: "How we work together",
    blurb: "What it's actually like inside our meetings.",
    part: "team",
    items: [
      { id: "w1", text: "We raise our differences openly and work them through." },
      { id: "w2", text: "Our meetings stay focused on what matters most for our school." },
      { id: "w3", text: "We regularly look at how well we're working as a team, and act on what we find." },
      { id: "w4", text: "Overall, we are a strong and united team." },
    ],
  },
  {
    id: "respect",
    title: "Trust: respect",
    blurb: "Being genuinely heard, and disagreement being welcome.",
    part: "trust",
    leg: "Respect",
    items: [
      { id: "r1", text: "I feel genuinely listened to in this team." },
      { id: "r2", text: "People in this team invite disagreement rather than avoid it." },
    ],
  },
  {
    id: "regard",
    title: "Trust: personal regard",
    blurb: "Treating each other as people, not roles.",
    part: "trust",
    leg: "Personal regard",
    items: [
      { id: "p1", text: "We care about each other as people, not just as colleagues." },
      { id: "p2", text: "People in this team go out of their way to support each other." },
    ],
  },
  {
    id: "competence",
    title: "Trust: competence",
    blurb: "Doing what we say, learning from feedback, holding each other to account.",
    part: "trust",
    leg: "Competence",
    items: [
      { id: "c1", text: "People in this team do what they say they'll do, when they say they'll do it." },
      { id: "c2", text: "We ask each other for feedback, and we use it." },
      { id: "c3", text: "We hold each other to account when commitments aren't met." },
    ],
  },
  {
    id: "integrity",
    title: "Trust: integrity",
    blurb: "Our actions match our words.",
    part: "trust",
    leg: "Integrity",
    items: [
      { id: "i1", text: "What we do as a team matches the values we talk about." },
      { id: "i2", text: "I would feel safe telling our team leader something they might not want to hear." },
    ],
  },
];

export const OPEN_QUESTIONS = [
  { id: "o1", text: "What is one thing this team does really well?" },
  { id: "o2", text: "What is one change that would make this team more effective?" },
];

export const ALL_ITEMS = SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, section: s.id })));
export const TEAM_ITEM_IDS = SECTIONS.filter((s) => s.part === "team").flatMap((s) => s.items.map((i) => i.id));
export const TRUST_SECTIONS = SECTIONS.filter((s) => s.part === "trust");

// Overall team score: sum of the 12 team items (range 12 to 48).
// Score bands follow the structure of Macklin & Zbar's interpretation guide; descriptions are ours.
export const BANDS = [
  { min: 37, max: 48, name: "Strong and united",
    text: "A clear, united team that works with staff toward a shared direction. The challenge now is keeping it that way and spreading leadership further." },
  { min: 25, max: 36.99, name: "Building unity",
    text: "Real strengths and a growing sense of purpose, with one or two areas holding the team back. Find the lowest-scoring areas and work on those first." },
  { min: 16, max: 24.99, name: "Mixed",
    text: "Some strengths to build on, balanced by significant gaps. The team probably needs to agree its purpose and ways of working before it can lead improvement well." },
  { min: 0, max: 15.99, name: "Back to basics",
    text: "The team isn't yet working as a team. Start with purpose: why do we meet, what are we for, and how will we work together?" },
];

export function bandFor(score) {
  return BANDS.find((b) => score >= b.min && score <= b.max) || BANDS[BANDS.length - 1];
}

export const MIN_RESPONSES = 3;
