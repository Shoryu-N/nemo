import type {AiProvider} from "../types";

/**
 * Keeps provider selection outside the callable function.
 */
export function createAiProvider(provider: AiProvider): AiProvider {
  return provider;
}
