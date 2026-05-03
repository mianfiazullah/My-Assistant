import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAuthReady: false });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
            setUser(userDoc.data() as User);
          } else {
            console.log('Profile not found, creating new profile');
            // Create a new user profile if it doesn't exist
            const newUser: User = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'New Employee',
              email: firebaseUser.email || '',
              role: 'user',
              expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3-day demo
              subDivision: 'Gulberg',
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            console.log('Profile created successfully');
            setUser(newUser);
          }
        } catch (error: any) {
          console.error('AuthContext Error:', error.message);
          if (error.message.includes('permission')) {
            console.error('Permission denied. Check firestore.rules.');
          }
        }
      } else {
        console.log('No user authenticated');
        setUser(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};
