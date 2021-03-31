import { textsecure } from '../../lib/ts/textsecure/index';

export function createTaskWithTimeout<T>(
  task: () => Promise<T>,
  id: string = 'default',
  options: { timeout?: number } = {}
): () => Promise<T> {
  return textsecure.createTaskWithTimeout<T>(task, id, options);
}
