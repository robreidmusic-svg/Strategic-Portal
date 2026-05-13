import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  orderBy,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

export type ProposalStatus = 'pending' | 'approved' | 'denied';
export type ProposalScope = 'Quick' | 'Deep' | 'Exhaustive';
export type ProposalCost = 'Low' | 'Medium' | 'High';

export interface ResearchProposal {
  id: string;
  topic: string;
  source: string;
  sourceUrl: string;
  rationale: string;
  proposedQuestion: string;
  scope: ProposalScope;
  estimatedCost: ProposalCost;
  status: ProposalStatus;
  createdAt: number;
  decidedAt?: number;
}

const COLLECTION = 'research_proposals';

export async function getPendingProposals(): Promise<ResearchProposal[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ResearchProposal[];
  } catch (e) {
    console.error('Error fetching proposals:', e);
    return [];
  }
}

export async function getAllProposals(): Promise<ResearchProposal[]> {
  try {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ResearchProposal[];
  } catch (e) {
    console.error('Error fetching proposals:', e);
    return [];
  }
}

export async function saveProposal(
  proposal: Omit<ResearchProposal, 'id' | 'createdAt' | 'status'>
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...proposal,
    status: 'pending',
    createdAt: Date.now(),
  });
  return docRef.id;
}

export async function decideProposal(
  id: string,
  decision: 'approved' | 'denied'
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    status: decision,
    decidedAt: Date.now(),
  });
}
