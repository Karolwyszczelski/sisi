// src/store/cartStore.ts
import { create } from 'zustand';

interface CartItem {
  name: string;
  price: number;
  quantity?: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  isCheckoutOpen: boolean;
  checkoutStep: number;
  addItem: (item: CartItem) => void;
  removeItem: (name: string) => void;
  toggleCart: () => void;
  clearCart: () => void;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  openCheckoutModal: () => void;
  closeCheckoutModal: () => void;
}

const useCartStore = create<CartState>((set) => ({
  items: [],
  isOpen: false,
  isCheckoutOpen: false,
  checkoutStep: 1,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.name === item.name);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.name === item.name ? { ...i, quantity: (i.quantity || 1) + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { ...item, quantity: 1 }] };
    }),

  removeItem: (name) =>
    set((state) => {
      const updatedItems = state.items.reduce<CartItem[]>((acc, item) => {
        if (item.name === name) {
          const newQuantity = (item.quantity || 1) - 1;
          if (newQuantity > 0) {
            acc.push({ ...item, quantity: newQuantity });
          }
          // jeśli nowa ilość to 0, nie dodajemy do acc = usuwamy produkt
        } else {
          acc.push(item);
        }
        return acc;
      }, []);
      return { items: updatedItems };
    }),

  toggleCart: () =>
    set((state) => ({
      isOpen: !state.isOpen,
    })),

  clearCart: () => set({ items: [] }),

  goToStep: (step) => set({ checkoutStep: step }),
  nextStep: () => set((state) => ({ checkoutStep: state.checkoutStep + 1 })),
  prevStep: () => set((state) => ({ checkoutStep: Math.max(1, state.checkoutStep - 1) })),

  openCheckoutModal: () => set({ isCheckoutOpen: true }),
  closeCheckoutModal: () => set({ isCheckoutOpen: false }),
}));

export default useCartStore;
