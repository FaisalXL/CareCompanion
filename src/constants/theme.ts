import { PatientState, StateTheme } from "../types";

export const colors = {
  cream: "#FAF8F3",
  surface: "#FFFFFF",
  sage: "#7DAE8B",
  sageLight: "#D6E8D4",
  sageFaint: "#EDF4EC",
  blue: "#6BA8CC",
  blueLight: "#C8DEF0",
  blueFaint: "#EBF3FA",
  amber: "#CC9E6A",
  amberLight: "#F0D8B8",
  amberFaint: "#FBF3EA",
  coral: "#D4736F",
  coralLight: "#F0ACA8",
  coralFaint: "#FDF0EF",
  lavender: "#A998C4",
  lavenderLight: "#D8CEE8",
  lavenderFaint: "#F2EFF8",
  text: "#1A2024",
  textSecondary: "#5A6570",
  textMuted: "#8E969C",
  border: "#EBE8E2",
  white: "#FFFFFF",
  emergency: "#C0392B",
  emergencyBg: "#FDEDEC",
  glass: "rgba(255,255,255,0.82)",
};

export const shadows = {
  sm: {
    shadowColor: "#1A2024",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  md: {
    shadowColor: "#1A2024",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  lg: {
    shadowColor: "#1A2024",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 6,
  },
};

export const radii = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
};

export const stateThemes: Record<PatientState, StateTheme> = {
  resting: {
    colors: ["#8CC4A0", "#7AB8C0", "#A0CCE0"],
    gradient: ["#DFEAE0", "#E4EDE8", "#F5F8F5"],
    label: "Resting Peacefully",
    iconName: "moon",
    pulseSpeed: 4200,
  },
  active: {
    colors: ["#DBA878", "#E4C098", "#F0D4B0"],
    gradient: ["#F0DEC8", "#F5EADC", "#FDF8F2"],
    label: "Active & Moving",
    iconName: "footprints",
    pulseSpeed: 2600,
  },
  eating: {
    colors: ["#98C498", "#8CC4A0", "#B8D8B0"],
    gradient: ["#E0ECE0", "#E8F0E4", "#F5F8F2"],
    label: "Mealtime",
    iconName: "utensils",
    pulseSpeed: 3600,
  },
  confused: {
    colors: ["#B0A0C8", "#C0B0D8", "#D0C4E4"],
    gradient: ["#E4DEF0", "#ECE8F4", "#F6F4FA"],
    label: "Needs Attention",
    iconName: "circle-help",
    pulseSpeed: 2200,
  },
  emergency: {
    colors: ["#DC6860", "#E48078", "#F0A098"],
    gradient: ["#F0D8D4", "#F4E4E0", "#FEF6F4"],
    label: "Emergency",
    iconName: "triangle-alert",
    pulseSpeed: 1000,
  },
};

export const typography = {
  hero: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: colors.text,
    letterSpacing: -1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "700" as const,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: colors.textMuted,
    letterSpacing: 0.1,
  },
  stateLabel: {
    fontSize: 21,
    fontWeight: "700" as const,
    color: colors.text,
    textAlign: "center" as const,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  timelineTime: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: colors.text,
    letterSpacing: -0.2,
  },
  timelineDetail: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: colors.textSecondary,
    lineHeight: 20,
  },
};
