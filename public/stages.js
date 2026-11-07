// Stage-of-improvement diagnosis.
// Structure (three stages, four features each, rated 1 to 4) follows Macklin & Zbar,
// Driving School Improvement (2nd ed., ACER, 2020), ch. 5. Indicators and
// interpretations are written in our own words.

export const EVIDENT = [
  { value: 1, label: "Not evident" },
  { value: 2, label: "Sometimes" },
  { value: 3, label: "Often" },
  { value: 4, label: "Always" },
];

export const STAGES = [
  {
    id: "s1",
    n: 1,
    title: "Getting the preconditions in place",
    short: "Preconditions",
    blurb: "The foundations that have to be there before whole-school improvement can take hold.",
    features: [
      { id: "s1a", title: "Strong leadership that is shared",
        signs: ["A clear direction everyone can describe", "Leaders focused on improvement, not just operations", "A united, effective leadership team", "Leadership deliberately grown in others"] },
      { id: "s1b", title: "High expectations and belief, for staff and students",
        signs: ["Targets set above 'schools like ours'", "Staff believe they can make a difference for every student", "No-one says 'you can't expect more from these kids'", "All students genuinely challenged"] },
      { id: "s1c", title: "An orderly and supportive learning environment",
        signs: ["Clear, documented expectations for behaviour and wellbeing", "Applied consistently by all staff", "Every student well known by adults", "Student voice is sought and acted on"] },
      { id: "s1d", title: "A focus on what matters most",
        signs: ["A small number of clear priorities", "First things first, and distractions resisted", "Money, time and people directed to the priorities", "Things that don't work are stopped"] },
    ],
    bands: [
      "Significant work to do on the preconditions. Focus on the leadership team, expectations and an orderly environment before scaling up teaching initiatives.",
      "The preconditions are coming into place. Keep the focus, and start building teaching capacity as you move toward Stage 2.",
      "The preconditions are firmly in place. Keep tending them, but your main focus can shift to building teaching capacity across the school.",
    ],
  },
  {
    id: "s2",
    n: 2,
    title: "Building teaching capacity across the school",
    short: "Teaching capacity",
    blurb: "A shared view of good teaching, used by every teacher, supported by teams.",
    features: [
      { id: "s2a", title: "A shared view of effective teaching",
        signs: ["Staff can describe what good teaching looks like here", "That shared view guides planning in every room"] },
      { id: "s2b", title: "An instructional model that guides planning",
        signs: ["One agreed model, visible across the school", "Teachers use it to plan, alone and in teams"] },
      { id: "s2c", title: "Structures for collaborative planning",
        signs: ["Professional learning teams meet regularly", "That time is protected in the meeting schedule"] },
      { id: "s2d", title: "Planning focused on better lessons in every classroom",
        signs: ["Teams plan and review actual lessons", "Feedback on delivered lessons improves the next ones"] },
    ],
    bands: [
      "Build a shared picture of effective teaching first, then an instructional model teachers actually use to plan, individually and in teams.",
      "There's an agreed view of good teaching. The challenge is consistency: making it the norm in every classroom.",
      "A shared model and collaborative planning are consistent across the school. You're ready to drill down into classroom practice.",
    ],
  },
  {
    id: "s3",
    n: 3,
    title: "Drilling down to improve classroom practice",
    short: "Classroom practice",
    blurb: "Precise, evidence-driven teaching that adapts to every student.",
    features: [
      { id: "s3a", title: "Data and evidence inform teaching",
        signs: ["Teachers reteach in response to progress data", "Evidence, not habit, drives decisions"] },
      { id: "s3b", title: "Learning goals focus planning and delivery",
        signs: ["Clear goals for every lesson", "Students assess their own progress toward them"] },
      { id: "s3c", title: "Feedback improves teaching and learning",
        signs: ["Students get specific feedback on how to improve", "Teachers adjust in response to student feedback", "Teachers get regular feedback on their practice"] },
      { id: "s3d", title: "Lessons meet the full range of needs",
        signs: ["Strategic grouping so every student participates", "Every student experiences success"] },
    ],
    bands: [
      "Strengthen the focus on evidence-based practices applied consistently. Learning goals are a good place to start.",
      "Effective practices are spreading. The challenge is making sure every teacher uses them, every day.",
      "Highly effective practice is consistent across classes. You probably have something to share with other schools.",
    ],
  },
];

export const STAGE_FEATURE_IDS = STAGES.flatMap((s) => s.features.map((f) => f.id));

// Each stage totals 4 to 16. Bands: 4 to 8, 9 to 12, 13 to 16.
export function stageBand(total) {
  if (total == null) return null;
  return total >= 13 ? 2 : total >= 9 ? 1 : 0;
}
export const BAND_NAMES = ["Not yet in place", "Developing", "Firmly in place"];
