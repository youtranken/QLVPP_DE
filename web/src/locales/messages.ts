export type Messages<T> = { [K in keyof T]: T[K] extends string ? string : Messages<T[K]> };
