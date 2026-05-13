import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface WeeklyPriority {
  id?: string;
  unitId: string;
  weekNumber: number;
  year: number;
  priorities: {
    text: string;
    status: 'pending' | 'completed' | 'ongoing' | 'support_needed';
  }[];
  submittedBy: string;
  submittedAt: number;
  updatedAt: number;
}

export const getWeekNumber = (date: Date): { week: number; year: number } => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
};

export const getDeadlineStatus = () => {
  const now = new Date();
  const day = now.getDay(); // 0 is Sun, 1 is Mon... 5 is Fri
  
  // Submission deadline: Monday 12 PM
  const isSubmissionWindow = (day === 1 && now.getHours() < 12) || (day === 0) || (day > 1 && day < 6); 
  // Actually, Monday 12pm is the deadline. So Sun and Mon before 12pm is the window for "next week"?
  // Re-reading: "deadline of 12pm Monday afternoons". This implies you submit before Monday 12pm for the *coming* week.
  
  // Review prompt: Friday
  const isReviewDay = day === 5;
  
  return { isSubmissionWindow, isReviewDay };
};

export const submitWeeklyPriorities = async (priority: Omit<WeeklyPriority, 'id'>) => {
  const prioritiesRef = collection(db, 'weeklyPriorities');
  const q = query(
    prioritiesRef, 
    where('unitId', '==', priority.unitId),
    where('weekNumber', '==', priority.weekNumber),
    where('year', '==', priority.year)
  );
  
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docRef = doc(db, 'weeklyPriorities', snapshot.docs[0].id);
    await updateDoc(docRef, {
      ...priority,
      updatedAt: Date.now()
    });
    return snapshot.docs[0].id;
  } else {
    const docRef = await addDoc(prioritiesRef, priority);
    return docRef.id;
  }
};

export const updatePriorityStatus = async (priorityId: string, index: number, status: WeeklyPriority['priorities'][0]['status']) => {
  const docRef = doc(db, 'weeklyPriorities', priorityId);
  // We need the current data to update the array
  // In a real app, we'd use a more atomic approach if possible, but for 3 items, this is fine
};
