import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Opportunity, Unit, UnitQuotas, ForecastSubmission, ChurnEntry, AppTheme } from '../types';
import { DEFAULT_QUOTAS, UNITS } from '../constants';
import Papa from 'papaparse';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  addDoc, 
  query, 
  orderBy, 
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { WHITELISTED_USERS } from '../constants';
import { toast } from 'sonner';

interface PortalUser {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'user';
}

interface AppContextType {
  opportunities: Opportunity[];
  quotas: UnitQuotas;
  forecastHistory: ForecastSubmission[];
  adminMode: boolean;
  setAdminMode: (mode: boolean) => void;
  updateQuotas: (unit: Unit, quota: { monthly: number; annual: number }) => void;
  uploadCSV: (file: File, targetMonth: string) => void;
  submitForecast: (submission: ForecastSubmission) => Promise<void>;
  getOpportunitiesByUnit: (unit: Unit) => Opportunity[];
  updateOpportunity: (id: string, updates: Partial<Opportunity>) => void;
  addOpportunity: (opp: Omit<Opportunity, 'id'>) => Promise<void>;
  clearAllOpportunities: (month?: string) => Promise<void>;
  portalUser: PortalUser | null;
  login: (firstName: string, lastName: string, password: string, isNewUser?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  isQuotasLoaded: boolean;
  selectedForecastMonth: string;
  setSelectedForecastMonth: (month: string) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  unitOpportunities: Record<Unit, Opportunity[]>;
  knowledgeBaseContent: string;
  updateKnowledgeBase: (content: string) => Promise<void>;
  isKnowledgeBaseLoaded: boolean;
  legalKnowledgeBaseContent: string;
  updateLegalKnowledgeBase: (content: string) => Promise<void>;
  isLegalKnowledgeBaseLoaded: boolean;
  churnEntries: ChurnEntry[];
  addChurnEntry: (entry: Omit<ChurnEntry, 'id' | 'timestamp'>) => Promise<void>;
  updateChurnEntry: (id: string, updates: Partial<ChurnEntry>) => Promise<void>;
  deleteChurnEntry: (id: string) => Promise<void>;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  showQuickDraft: boolean;
  setShowQuickDraft: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [quotas, setQuotas] = useState<UnitQuotas>(DEFAULT_QUOTAS);
  const [isQuotasLoaded, setIsQuotasLoaded] = useState(false);
  const [forecastHistory, setForecastHistory] = useState<ForecastSubmission[]>([]);
  const [adminMode, setAdminMode] = useState(false);
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedForecastMonth, setSelectedForecastMonth] = useState(new Date().toISOString().slice(0, 7));
  const [accentColor, setAccentColor] = useState('sage');
  const [knowledgeBaseContent, setKnowledgeBaseContent] = useState('');
  const [isKnowledgeBaseLoaded, setIsKnowledgeBaseLoaded] = useState(false);
  const [legalKnowledgeBaseContent, setLegalKnowledgeBaseContent] = useState('');
  const [isLegalKnowledgeBaseLoaded, setIsLegalKnowledgeBaseLoaded] = useState(false);
  const [churnEntries, setChurnEntries] = useState<ChurnEntry[]>([]);
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('app-theme');
    return (saved as AppTheme) || 'light';
  });
  const [showQuickDraft, setShowQuickDraft] = useState(false);

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
  };

  // Memoized Unit Accessor - Prevents O(n) filtering in UI components
  const unitOpportunities = useMemo(() => {
    const map: Record<Unit, Opportunity[]> = {
      'Hyperscale': [],
      'Strategic Wholesale': [],
      'China/Apac': [],
      'U.S AI': []
    };
    opportunities.forEach(opp => {
      if (map[opp.unit]) {
        map[opp.unit].push(opp);
      }
    });
    return map;
  }, [opportunities]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Fetch user profile from Firestore
          let userDoc;
          try {
            userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          } catch (docErr: any) {
            // If we're offline, and persistence is on, getDoc might still work
            // But if it fails with a network error, we don't want to lock the user out
            console.warn('Firestore profile fetch failed in listener, possibly offline:', docErr);
            // We'll trust the auth state for now but keep the loader if we truly have no profile
            return; 
          }

          if (userDoc?.exists()) {
            const userData = userDoc.data() as PortalUser;
            setPortalUser(userData);
          } else {
            console.error('User profile not found in Firestore');
            setPortalUser(null);
          }
        } else {
          setPortalUser(null);
        }
      } catch (error) {
        console.error('Auth Listener Error:', error);
        setPortalUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (firstName: string, lastName: string, password: string, isNewUser: boolean = false) => {
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    // Sanitize email: no spaces, all lowercase
    const email = `${cleanFirst.toLowerCase().replace(/\s+/g, '')}.${cleanLast.toLowerCase().replace(/\s+/g, '')}@zayo.internal`;
    
    // Check whitelist first
    const match = WHITELISTED_USERS.find(
      u => u.firstName.toLowerCase() === cleanFirst.toLowerCase() && 
           u.lastName.toLowerCase() === cleanLast.toLowerCase()
    );

    if (!match) {
      throw new Error(`Access Denied: "${cleanFirst} ${cleanLast}" is not on the approved personnel list.`);
    }

    try {
      // Helper function for login with retry
      const performAuthOp = async (retryCount = 0): Promise<{ user: any }> => {
        try {
          if (isNewUser) {
            return await createUserWithEmailAndPassword(auth, email, password);
          } else {
            return await signInWithEmailAndPassword(auth, email, password);
          }
        } catch (err: any) {
          // If network failure and we have retries left, wait and try again
          if (err.code === 'auth/network-request-failed' && retryCount < 2) {
            console.warn(`Network failure, retrying auth (attempt ${retryCount + 1}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
            return performAuthOp(retryCount + 1);
          }
          throw err;
        }
      };

      const { user } = await performAuthOp();
      
      // Double check Firestore profile existence on successful login
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        console.warn('Profile missing for authenticated user. Repairing...');
        const profile: PortalUser = {
          uid: user.uid,
          firstName: match.firstName,
          lastName: match.lastName,
          email,
          role: match.role as any
        };
        await setDoc(doc(db, 'users', user.uid), profile);
        setPortalUser(profile);
      } else {
        setPortalUser(userDoc.data() as PortalUser);
      }
      
      toast.success(`Welcome, ${match.firstName}!`, {
        description: "Strategic Portal access authorized.",
        duration: 4000
      });
    } catch (error: any) {
      console.error('Auth Error Details:', error);
      if (error.code === 'auth/network-request-failed') {
        throw new Error("Connection failed. This is likely a transient network issue or browser restriction. Please try clicking 'Authorize Access' again or check your internet connection.");
      }
      if (error.code === 'auth/email-already-in-use') {
        throw new Error("User profile already established. Please use the Login tab instead.");
      }
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error(`CRITICAL CONFIG: Email/Password login is not enabled for project [gen-lang-client-0920925748]. Please double-check this specific project in your Firebase Console.`);
      }
      if (error.code === 'auth/user-not-found') {
        throw new Error("Account not found. Ensure you have used 'Setup Profile' first.");
      }
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error("Authentication failed. Please verify your name and password.");
      }
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setPortalUser(null);
  };

  // Firestore Listeners
  useEffect(() => {
    if (!portalUser) return;

    const unsubOpps = onSnapshot(collection(db, 'opportunities'), 
      (snapshot) => {
        const opps = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Opportunity));
        setOpportunities(opps);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'opportunities')
    );

    const unsubQuotas = onSnapshot(collection(db, 'quotas'), 
      (snapshot) => {
        console.log('[Quotas Debug] Received snapshot from Firestore, docs:', snapshot.size);
        
        // If snapshot is empty, we keep DEFAULT_QUOTAS but mark as loaded
        if (snapshot.empty) {
          console.log('[Quotas Debug] No quotas found in Firestore, using defaults.');
          setQuotas(DEFAULT_QUOTAS);
          setIsQuotasLoaded(true);
          return;
        }

        const newQuotas = { ...DEFAULT_QUOTAS };
        snapshot.docs.forEach(doc => {
          const originalUnit = UNITS.find(u => u.replace(/\//g, '_') === doc.id);
          if (originalUnit) {
            console.log(`[Quotas Debug] Loading quota for ${originalUnit}:`, doc.data());
            newQuotas[originalUnit] = doc.data() as any;
          } else if (UNITS.includes(doc.id as any)) {
            newQuotas[doc.id as Unit] = doc.data() as any;
          }
        });
        setQuotas(newQuotas);
        setIsQuotasLoaded(true);
      },
      (err) => {
        console.error('[Quotas Debug] Error loading quotas:', err);
        handleFirestoreError(err, OperationType.LIST, 'quotas');
      }
    );

    const unsubHistory = onSnapshot(query(collection(db, 'forecastHistory'), orderBy('timestamp', 'desc')), 
      (snapshot) => {
        const history = snapshot.docs.map(doc => doc.data() as ForecastSubmission);
        setForecastHistory(history);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'forecastHistory')
    );

    const unsubKB = onSnapshot(doc(db, 'knowledge_base', 'brilliant_basics'), 
      (docSnap) => {
        if (docSnap.exists()) {
          setKnowledgeBaseContent(docSnap.data()?.content || '');
        }
        setIsKnowledgeBaseLoaded(true);
      },
      (err) => {
        console.error('Error fetching knowledge base:', err);
        setIsKnowledgeBaseLoaded(true);
      }
    );

    const unsubLegalKB = onSnapshot(doc(db, 'knowledge_base', 'legal_counsel'), 
      (docSnap) => {
        if (docSnap.exists()) {
          setLegalKnowledgeBaseContent(docSnap.data()?.content || '');
        }
        setIsLegalKnowledgeBaseLoaded(true);
      },
      (err) => {
        console.error('Error fetching legal knowledge base:', err);
        setIsLegalKnowledgeBaseLoaded(true);
      }
    );

    const unsubChurn = onSnapshot(collection(db, 'churn'), 
      (snapshot) => {
        const churn = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChurnEntry));
        setChurnEntries(churn);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'churn')
    );

    return () => {
      unsubOpps();
      unsubQuotas();
      unsubHistory();
      unsubKB();
      unsubLegalKB();
      unsubChurn();
    };
  }, [portalUser]);

  const getQuotaDocId = (unit: string) => unit.replace(/\//g, '_');

  const updateQuotas = async (unit: Unit, quota: { monthly: number; annual: number }) => {
    try {
      await setDoc(doc(db, 'quotas', getQuotaDocId(unit)), quota);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `quotas/${getQuotaDocId(unit)}`);
      throw err;
    }
  };

  const uploadCSV = (file: File, targetMonth: string) => {
    Papa.parse(file, {
      header: false, // Strict index-based extraction
      skipEmptyLines: 'greedy',
      complete: async (results) => {
        if (results.data.length < 2) return;

        const dataRows = (results.data as string[][]).slice(1); // Skip header row
        const monthsInCSV = new Set<string>();
        
        const ROSTER: Record<string, Unit> = {
          'Ed Wheeler': 'Hyperscale',
          'Keera Johnstone': 'Hyperscale',
          'Alfie James': 'Strategic Wholesale',
          'Eva Tsang': 'China/Apac',
          'Filaretos Koutsogiannis': 'U.S AI',
          'Abigail Moore': 'U.S AI'
        };

        const processedRows = dataRows.map((row, index) => {
          if (!row || row.length < 5) return null;

          // A:0 (Cust), B:1 (Date), C:2 (Name), D:3 (IGNORE), E:4 (VALUE), F:5 (Next), G:6 (Owner), H:7 (Stage)
          const customer = row[0]?.trim() || 'Unknown';
          const rawDate = row[1]?.trim() || '';
          const oppIdentifier = row[2]?.trim() || `ID-${index + 1000}`;
          
          // STRICT Column E for MRC
          const mrcRaw = row[4]?.trim() || '0';
          
          const nextStep = row[5]?.trim() || '';
          const owner = row[6]?.trim() || 'Unknown';
          const stage = row[7]?.trim() || 'Pipeline';

          let normalizedDate = '';
          let forecastMonth = '';
          
          if (rawDate && rawDate.includes('/')) {
            const parts = rawDate.split('/');
            if (parts.length === 3) {
              const d = parts[0].padStart(2, '0');
              const m = parts[1].padStart(2, '0');
              const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              normalizedDate = `${y}-${m}-${d}`;
              forecastMonth = `${y}-${m}`;
              monthsInCSV.add(forecastMonth);
            }
          }

          if (!forecastMonth) {
            forecastMonth = targetMonth;
            monthsInCSV.add(forecastMonth);
          }

          // ROUNDING: MRC rounded to nearest full number, remove decimals
          const cleanedMrc = mrcRaw.replace(/[^\d.-]/g, '');
          const mrcVal = parseFloat(cleanedMrc) || 0;
          const mrc = Math.round(mrcVal);

          const assignedUnit: Unit = ROSTER[owner] || 'Hyperscale';
          const isCallStage = stage.toLowerCase().includes('commit') || stage === 'Closed Won';

          return {
            oppIdentifier,
            owner,
            customer,
            mrc,
            closeDate: normalizedDate,
            forecastMonth,
            stage,
            nextStep,
            unit: assignedUnit,
            isIncludedInCall: isCallStage
          };
        }).filter((r): r is NonNullable<typeof r> => r !== null);

        const batch = writeBatch(db);
        const monthsToClear = Array.from(monthsInCSV);
        const toDelete = opportunities.filter(opp => 
          monthsToClear.includes(opp.forecastMonth) && 
          opp.stage !== 'Closed Won'
        );

        toDelete.forEach(opp => {
          batch.delete(doc(db, 'opportunities', opp.id));
        });

        processedRows.forEach((data, index) => {
          const existingOpp = opportunities.find(o => o.oppIdentifier === data.oppIdentifier);
          if (existingOpp && existingOpp.stage === 'Closed Won') return;

          const isIncludedInCall = (existingOpp && existingOpp.isIncludedInCall !== undefined) 
            ? existingOpp.isIncludedInCall 
            : !!data.isIncludedInCall;

          const oppId = `opp-${Date.now()}-${index}`;
          const newDocRef = doc(db, 'opportunities', oppId);
          batch.set(newDocRef, {
            ...data,
            id: oppId,
            isIncludedInCall,
            updatedAt: new Date().toISOString()
          });
        });

        try {
          await batch.commit();
          alert(`Successfully imported data for ${monthsToClear.join(', ')}.`);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'opportunities (batch import)');
        }
      }
    });
  };

  const submitForecast = async (submission: ForecastSubmission) => {
    try {
      await addDoc(collection(db, 'forecastHistory'), {
        ...submission,
        timestamp: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'forecastHistory');
      throw err;
    }
  };

  const getOpportunitiesByUnit = (unit: Unit) => {
    return opportunities.filter(opp => opp.unit === unit);
  };

  const updateOpportunity = async (id: string, updates: Partial<Opportunity>) => {
    try {
      await setDoc(doc(db, 'opportunities', id), updates, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `opportunities/${id}`);
      throw err;
    }
  };

  const addOpportunity = async (opp: Omit<Opportunity, 'id'>) => {
    try {
      const oppId = `opp-${Date.now()}`;
      await setDoc(doc(db, 'opportunities', oppId), opp);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'opportunities');
      throw err;
    }
  };

  const clearAllOpportunities = async (month?: string) => {
    const batch = writeBatch(db);
    opportunities.forEach(opp => {
      // If month is provided, only delete non-won opps for that month
      if (month) {
        if (opp.forecastMonth === month && opp.stage !== 'Closed Won') {
          batch.delete(doc(db, 'opportunities', opp.id));
        }
      } else {
        // Otherwise delete everything
        batch.delete(doc(db, 'opportunities', opp.id));
      }
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'opportunities (batch delete)');
      throw err;
    }
  };

  const updateKnowledgeBase = async (content: string) => {
    try {
      await setDoc(doc(db, 'knowledge_base', 'brilliant_basics'), {
        content,
        updatedAt: Date.now(),
        updatedBy: portalUser?.firstName + ' ' + portalUser?.lastName || 'Admin'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'knowledge_base/brilliant_basics');
      throw err;
    }
  };

  const updateLegalKnowledgeBase = async (content: string) => {
    try {
      await setDoc(doc(db, 'knowledge_base', 'legal_counsel'), {
        content,
        updatedAt: Date.now(),
        updatedBy: portalUser?.firstName + ' ' + portalUser?.lastName || 'Admin'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'knowledge_base/legal_counsel');
      throw err;
    }
  };

  const addChurnEntry = async (entry: Omit<ChurnEntry, 'id' | 'timestamp'>) => {
    try {
      const churnId = `churn-${Date.now()}`;
      await setDoc(doc(db, 'churn', churnId), {
        ...entry,
        timestamp: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'churn');
      throw err;
    }
  };

  const updateChurnEntry = async (id: string, updates: Partial<ChurnEntry>) => {
    try {
      await setDoc(doc(db, 'churn', id), updates, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `churn/${id}`);
      throw err;
    }
  };

  const deleteChurnEntry = async (id: string) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'churn', id));
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `churn/${id}`);
      throw err;
    }
  };

  return (
    <AppContext.Provider value={{
      opportunities,
      quotas,
      forecastHistory,
      adminMode,
      setAdminMode,
      updateQuotas,
      uploadCSV,
      submitForecast,
      getOpportunitiesByUnit,
      updateOpportunity,
      addOpportunity,
      clearAllOpportunities,
      portalUser,
      login,
      logout,
      loading,
      isQuotasLoaded,
      selectedForecastMonth,
      setSelectedForecastMonth,
      accentColor,
      setAccentColor,
      unitOpportunities,
      knowledgeBaseContent,
      updateKnowledgeBase,
      isKnowledgeBaseLoaded,
      legalKnowledgeBaseContent,
      updateLegalKnowledgeBase,
      isLegalKnowledgeBaseLoaded,
      churnEntries,
      addChurnEntry,
      updateChurnEntry,
      deleteChurnEntry,
      theme,
      setTheme,
      showQuickDraft,
      setShowQuickDraft
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

