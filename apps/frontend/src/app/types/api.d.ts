export interface IPaginated<T> {
  items: Array<T>
  total: number
  page: number
  perPage: number
}
