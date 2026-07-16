import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { processQueue } from '../services/offline-queue';

interface NetworkState {
  isConnected: boolean;
  initNetworkStatus: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,
  initNetworkStatus: () => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const isConnected = state.isConnected ?? true;
      set({ isConnected });
      if (isConnected) {
        processQueue().catch((err) => console.warn('Failed to process offline queue on reconnect:', err));
      }
    });
    return unsubscribe;
  },
}));
