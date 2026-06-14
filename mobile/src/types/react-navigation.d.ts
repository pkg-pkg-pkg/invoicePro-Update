import '@react-navigation/native';

declare module '@react-navigation/native' {
  export function useRoute<T extends object = Record<string, unknown>>(): T;
}
