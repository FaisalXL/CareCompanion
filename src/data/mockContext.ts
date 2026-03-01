import { ContextEntry, CurrentContext, QuickStat } from "../types";

export const mockCurrentContext: CurrentContext = {
  state: "resting",
  summary: "Mom is resting in the living room",
  detail: "Sitting on the couch, watching TV. Calm and comfortable.",
  patientName: "Mom",
  lastUpdated: "10:32 AM",
};

export const mockTimeline: ContextEntry[] = [
  {
    id: "1",
    timestamp: "10:32 AM",
    state: "resting",
    summary: "Resting in the living room",
    detail: "Sitting on the couch, watching TV. Calm and comfortable.",
  },
  {
    id: "2",
    timestamp: "10:15 AM",
    state: "active",
    summary: "Walking to the living room",
    detail:
      "Moved from the kitchen to the living room. Steady gait, no concerns.",
  },
  {
    id: "3",
    timestamp: "9:45 AM",
    state: "active",
    summary: "Walking in the garden",
    detail: "Light physical activity in the backyard. Enjoying the morning sun.",
  },
  {
    id: "4",
    timestamp: "9:15 AM",
    state: "eating",
    summary: "Having breakfast",
    detail:
      "Sitting at the kitchen table. Oatmeal and tea. Ate well this morning.",
  },
  {
    id: "5",
    timestamp: "8:45 AM",
    state: "active",
    summary: "Preparing breakfast",
    detail:
      "Moving around the kitchen. Used the stove and kettle without issues.",
  },
  {
    id: "6",
    timestamp: "8:30 AM",
    state: "active",
    summary: "Morning routine",
    detail: "Moving between bedroom and bathroom. Getting ready for the day.",
  },
  {
    id: "7",
    timestamp: "8:00 AM",
    state: "resting",
    summary: "Waking up",
    detail:
      "Movement detected in the bedroom. Slowly transitioning from sleep.",
  },
  {
    id: "8",
    timestamp: "7:30 AM",
    state: "resting",
    summary: "Sleeping",
    detail: "Resting in bed. Breathing steady, no disturbance detected.",
  },
  {
    id: "9",
    timestamp: "3:15 AM",
    state: "confused",
    summary: "Brief restlessness",
    detail:
      "Sat up in bed momentarily. Appeared briefly disoriented, then settled back to sleep.",
  },
  {
    id: "10",
    timestamp: "11:00 PM",
    state: "resting",
    summary: "Fell asleep",
    detail: "Turned off bedside lamp. Settled into sleep for the night.",
  },
];

export const mockQuickStats: QuickStat[] = [
  {
    label: "Mood",
    value: "Calm",
    iconName: "heart",
    color: "#E07470",
  },
  {
    label: "Last Meal",
    value: "9:15 AM",
    iconName: "utensils",
    color: "#8FB89A",
  },
  {
    label: "Activity",
    value: "Moderate",
    iconName: "activity",
    color: "#7EB8D8",
  },
];
