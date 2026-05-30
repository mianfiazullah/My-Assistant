import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;
  impersonateUser: (uid: string | null) => void;
  isImpersonating: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAuthReady: false, impersonateUser: () => {}, isImpersonating: false });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [realUser, setRealUser] = useState<User | null>(null);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(localStorage.getItem('impersonated_user_id'));
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const impersonateUser = (uid: string | null) => {
    setImpersonatedUserId(uid);
    if (uid) {
      localStorage.setItem('impersonated_user_id', uid);
    } else {
      localStorage.removeItem('impersonated_user_id');
      setImpersonatedUser(null);
    }
  };

  useEffect(() => {
    let unsubImpersonated: (() => void) | null = null;
    
    if (impersonatedUserId) {
      const loadImpersonated = async () => {
        try {
          const { onSnapshot: onSnap } = await import('firebase/firestore');
          unsubImpersonated = onSnap(doc(db, 'users', impersonatedUserId), (snapshot) => {
            if (snapshot.exists()) {
              setImpersonatedUser(snapshot.data() as User);
            } else {
              // If the user doesn't exist, stop impersonating
              impersonateUser(null);
            }
          });
        } catch (error) {
          console.error("Failed to load impersonated user:", error);
          impersonateUser(null);
        }
      };
      loadImpersonated();
    } else {
      setImpersonatedUser(null);
    }

    return () => {
      if (unsubImpersonated) unsubImpersonated();
    };
  }, [impersonatedUserId]);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (firebaseUser) {
        try {
          // Fetch user profile from Firestore with retry logic
          let userDoc;
          let retries = 3;
          while (retries > 0) {
            try {
              userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              break;
            } catch (error) {
              retries--;
              if (retries === 0) throw error;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (userDoc && userDoc.exists()) {
            console.log('Profile found');
            const data = userDoc.data() as User;
            const isMian = firebaseUser.email?.toLowerCase() === 'mianfiazullah@gmail.com';
            if (isMian && data.role !== 'admin') {
              console.log('Auto promoting super-admin to admin role in Firestore...');
              const updatedUser = { ...data, role: 'admin' as const };
              await setDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' }, { merge: true });
              setRealUser(updatedUser);
            } else {
              setRealUser(data);
            }
          } else {
            console.log('Profile not found, checking for pre-registered account...');
            // Check if there is an admin pre-created/pre-registered profile by email query
            const { query, where, collection, getDocs, deleteDoc } = await import('firebase/firestore');
            const preUserQuery = query(collection(db, 'users'), where('email', '==', firebaseUser.email || ''));
            const preUserSnapshot = await getDocs(preUserQuery);
            
            if (!preUserSnapshot.empty) {
              const matchedDoc = preUserSnapshot.docs[0];
              const matchedData = matchedDoc.data();
              const isMian = firebaseUser.email?.toLowerCase() === 'mianfiazullah@gmail.com';
              // Create the linked profile for the user with their true UID
              const linkedUser: User = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || matchedData.name || 'New Employee',
                email: firebaseUser.email || matchedData.email || '',
                role: isMian ? 'admin' : (matchedData.role || 'user'),
                expiryDate: matchedData.expiryDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                subDivision: matchedData.subDivision || 'Gulberg',
                disabled: !!matchedData.disabled,
                webhookUrl: matchedData.webhookUrl || '',
                webhookUrl2: matchedData.webhookUrl2 || '',
                sdoName: matchedData.sdoName || '',
                sdoNameUrdu: matchedData.sdoNameUrdu || '',
                designation: matchedData.designation || '',
                sdoCnic: matchedData.sdoCnic || '',
                sdoMobile: matchedData.sdoMobile || '',
                policeStation: matchedData.policeStation || '',
                policeStationUrdu: matchedData.policeStationUrdu || '',
                policeStations: matchedData.policeStations || [],
                policeStationsUrdu: matchedData.policeStationsUrdu || [],
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), linkedUser);
              
              // Only delete if the placeholder ID is different from the true UID
              if (matchedDoc.id !== firebaseUser.uid) {
                await deleteDoc(doc(db, 'users', matchedDoc.id));
              }
              
              console.log('Linked pre-registered account matching email:', firebaseUser.email);
              setRealUser(linkedUser);
            } else {
              console.log('Profile not found, creating new profile');
              const isMian = firebaseUser.email?.toLowerCase() === 'mianfiazullah@gmail.com';
              // Create a new user profile if it doesn't exist
              const newUser: User = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'New Employee',
                email: firebaseUser.email || '',
                role: isMian ? 'admin' : 'user',
                expiryDate: isMian 
                  ? new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString()
                  : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3-day demo
                subDivision: 'Gulberg',
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              console.log('Profile created successfully');
              setRealUser(newUser);
            }
          }

          // Attach a real-time listener for profile synchronization so Admin/Sheet imports hit the current user's UI instantly
          const { onSnapshot: onSnap } = await import('firebase/firestore');
          unsubProfile = onSnap(doc(db, 'users', firebaseUser.uid), (snapshot) => {
            if (snapshot.exists()) {
              setRealUser(snapshot.data() as User);
            }
          });

        } catch (error: any) {
          console.error('AuthContext Error:', error.message);
          if (error.message.includes('offline')) {
            console.warn('App is offline, profile loading deferred.');
          } else if (error.message.includes('permission')) {
            console.error('Permission denied. Check firestore.rules.');
          }

          // Use Spec Error Handler if it's not a standard offline warning
          try {
            const { handleFirestoreError, OperationType } = await import('../firebase');
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          } catch (e) {
            // Ignore failure in the error handler itself
          }
        }
      } else {
        console.log('No user authenticated');
        setRealUser(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const activeUser = impersonatedUser || realUser;

  return (
    <AuthContext.Provider value={{ 
      user: activeUser, 
      loading, 
      isAuthReady, 
      impersonateUser, 
      isImpersonating: !!impersonatedUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
