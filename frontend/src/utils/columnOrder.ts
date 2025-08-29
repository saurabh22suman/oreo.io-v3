// Returns columns ordered by the dataset schema when possible.
// Supports JSON Schema where properties order is the key iteration order of the object.
export function orderColumnsBySchema(columns: string[], schemaJson?: string | any): string[] {
  try{
    if(!schemaJson) return columns
    const schema = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson
    const props = schema?.properties
    if(props && typeof props === 'object'){
      const schemaOrder = Object.keys(props)
      const inSchema = columns.filter(c => schemaOrder.includes(c)).sort((a,b)=> schemaOrder.indexOf(a) - schemaOrder.indexOf(b))
      const extras = columns.filter(c => !schemaOrder.includes(c))
      return [...inSchema, ...extras]
    }
    return columns
  }catch{
    return columns
  }
}
