declare module '*?worker&inline' {
  const constructor: { new(options?: { name?: string }): Worker }
  export default constructor
}
