
export function getObjectSetObserver(taskQueue, array) {
  return ModifyArrayObserver.for(taskQueue, array);
}
