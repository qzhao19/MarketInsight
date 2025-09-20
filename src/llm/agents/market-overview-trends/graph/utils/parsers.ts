export function alignStructureMessage<T>(
  result: any, logPrefix: string = "data"
): T {

  if (typeof result === "object" && "content" in result) {
    try {
      const parsed = JSON.parse(result.content as string);
      console.log(`Successfully parsed ${logPrefix} AIMessage content as JSON`);
      return parsed as T;
    } catch (error) {
      console.warn(`Failed to parse ${logPrefix} AIMessage content as JSON:`, error);
      throw new Error(`Failed to parse structured ${logPrefix}: ${result.content}`);
    } 
  } else {
    console.log(`Successfully received structured ${logPrefix}`);
    return result as T;
  }
}