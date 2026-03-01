import { PatientProfile } from "../types";

export const mockPatientProfile: PatientProfile = {
  name: "Margaret Johnson",
  age: 78,
  bloodType: "A+",
  conditions: ["Early-stage dementia", "Mild hypertension"],
  emergencyContact: {
    name: "John Johnson",
    relationship: "Son",
    phone: "(555) 012-3456",
  },
  medications: [
    {
      id: "med-1",
      name: "Donepezil",
      dosage: "10mg",
      schedule: "8:00 AM daily",
      notes: "Take with breakfast",
    },
    {
      id: "med-2",
      name: "Lisinopril",
      dosage: "5mg",
      schedule: "9:00 AM daily",
      notes: "Blood pressure",
    },
    {
      id: "med-3",
      name: "Vitamin D",
      dosage: "1000 IU",
      schedule: "Morning with food",
    },
  ],
  lovedOnes: [
    {
      id: "face-1",
      name: "John",
      relationship: "Son",
      imageUri: null,
    },
    {
      id: "face-2",
      name: "Sarah",
      relationship: "Daughter",
      imageUri: null,
    },
    {
      id: "face-3",
      name: "Dr. Patel",
      relationship: "Doctor",
      imageUri: null,
    },
  ],
  notes: [
    {
      id: "note-1",
      text: "Gets confused in dim lighting — keep hallway lights on",
      category: "quirk",
    },
    {
      id: "note-2",
      text: "Loves gardening in the morning",
      category: "preference",
    },
    {
      id: "note-3",
      text: "Allergic to penicillin",
      category: "allergy",
    },
    {
      id: "note-4",
      text: "Prefers to be called Maggie",
      category: "preference",
    },
  ],
};
